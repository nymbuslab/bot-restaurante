// ============================================================
// FINANCEIRO-DB — contas financeiras do tenant e o razão imutável de
// movimentos (D-16/D-17). T-04.03 (contas + implantação + movimento básico)
// e T-04.04 (transferência vinculada, estorno, conciliação manual — D-18).
//
// Contas são SEPARADAS do caixa operacional do PDV (D-16) — não é o mesmo
// dinheiro nem a mesma tabela. O saldo mora em `contas_financeiras.saldo` e é
// atualizado ATOMICAMENTE (mesma transação) a cada movimento — nunca é
// recomputado por SUM() na leitura. `financeiro_movimentos` nunca sofre
// UPDATE de valor/saldo_depois depois de gravado: correção é sempre uma NOVA
// linha (estorno), nunca edição da antiga.
//
// Isolado por empresa_id, resolvido do slug com cache (mesmo padrão de
// estoque-db.js/fornecedores-db.js). FK composta (empresa_id, conta_id)
// impede movimento cruzar tenant por constraint.
// ============================================================

const path = require("path");
const db = require("./db");

const TIPOS_MOVIMENTO = ["implantacao", "pagamento", "estorno", "transferencia_debito", "transferencia_credito"];
const slugDe = (dir) => path.basename(dir);
const idCache = {}; // slug -> empresa_id (uuid)

async function empresaId(dir) {
  const slug = slugDe(dir);
  if (idCache[slug]) return idCache[slug];
  const r = await db.query("SELECT id FROM empresas WHERE slug = $1", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  idCache[slug] = r.rows[0].id;
  return idCache[slug];
}

function erro(codigo, mensagem) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}

function mapConta(r) {
  return {
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    saldo: Number(r.saldo),
    arquivada: r.arquivada,
    criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
    atualizadoEm: r.atualizado_em ? new Date(r.atualizado_em).toISOString() : null,
  };
}

function mapMovimento(r) {
  return {
    id: r.id,
    contaId: r.conta_id,
    tipo: r.tipo,
    valor: Number(r.valor),
    saldoDepois: Number(r.saldo_depois),
    descricao: r.descricao,
    vinculoId: r.vinculo_id,
    estornoDe: r.estorno_de,
    conciliado: r.conciliado,
    conciliadoEm: r.conciliado_em ? new Date(r.conciliado_em).toISOString() : null,
    atorTipo: r.ator_tipo,
    atorId: r.ator_id,
    criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
  };
}

// Cria a conta e, se `saldoInicial` vier diferente de zero, já lança a
// implantação (D-17) NA MESMA TRANSAÇÃO — a conta nunca existe com saldo
// divergente do que a razão registra.
async function criarConta(dir, { nome, tipo = "geral", saldoInicial = 0 } = {}, ator = {}) {
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo) throw erro("NOME_OBRIGATORIO", "Informe o nome da conta.");
  if (!["geral", "banco", "caixinha", "fornecedor"].includes(tipo)) {
    throw erro("TIPO_INVALIDO", "Tipo de conta inválido.");
  }
  const valorInicial = Number(saldoInicial) || 0;
  const empId = await empresaId(dir);
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    // Nasce com saldo ZERO: o valor inicial entra pelo MESMO caminho de
    // qualquer outro movimento (registrarMovimentoTx), que lê o saldo atual e
    // soma — gravar `valorInicial` direto na coluna E TAMBÉM lançar a
    // implantação em cima dele duplicaria o saldo.
    const r = await client.query(
      `INSERT INTO contas_financeiras (empresa_id, nome, tipo, saldo) VALUES ($1, $2, $3, 0) RETURNING *`,
      [empId, nomeLimpo, tipo]
    );
    let conta = r.rows[0];
    if (valorInicial !== 0) {
      await registrarMovimentoTx(client, empId, conta.id, {
        tipo: "implantacao", valor: valorInicial, descricao: "Saldo inicial da conta",
      }, ator);
      const fresco = await client.query("SELECT * FROM contas_financeiras WHERE empresa_id = $1 AND id = $2", [empId, conta.id]);
      conta = fresco.rows[0];
    }
    await client.query("COMMIT");
    return mapConta(conta);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

async function listarContas(dir, { incluirArquivadas = false } = {}) {
  const empId = await empresaId(dir);
  let sql = "SELECT * FROM contas_financeiras WHERE empresa_id = $1";
  if (!incluirArquivadas) sql += " AND arquivada = false";
  sql += " ORDER BY nome ASC";
  const r = await db.query(sql, [empId]);
  return r.rows.map(mapConta);
}

async function buscarConta(dir, contaId) {
  const empId = await empresaId(dir);
  const r = await db.query("SELECT * FROM contas_financeiras WHERE empresa_id = $1 AND id = $2", [empId, Number(contaId)]);
  if (!r.rows[0]) throw erro("CONTA_NAO_ENCONTRADA", "Conta não encontrada.");
  return mapConta(r.rows[0]);
}

async function arquivarConta(dir, contaId, arquivada = true) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "UPDATE contas_financeiras SET arquivada = $1, atualizado_em = now() WHERE empresa_id = $2 AND id = $3 RETURNING *",
    [!!arquivada, empId, Number(contaId)]
  );
  if (!r.rows[0]) throw erro("CONTA_NAO_ENCONTRADA", "Conta não encontrada.");
  return mapConta(r.rows[0]);
}

// Núcleo atômico: trava a conta (FOR UPDATE), recusa em conta arquivada,
// calcula o novo saldo, grava a linha do razão e atualiza `contas_financeiras.
// saldo` NA MESMA TRANSAÇÃO do chamador (`client`). Nunca abre conexão
// própria — quem quiser um movimento avulso chama `registrarMovimento`
// (abaixo), que abre a transação e delega para cá; transferência (T-04.04)
// chama isto duas vezes dentro da MESMA transação, para o par débito/crédito
// nunca ficar parcialmente aplicado.
async function registrarMovimentoTx(client, empId, contaId, { tipo, valor, descricao = "", vinculoId = null, estornoDe = null } = {}, ator = {}) {
  if (!TIPOS_MOVIMENTO.includes(tipo)) throw erro("TIPO_INVALIDO", "Tipo de movimento inválido: " + tipo);
  const valorNum = Number(valor);
  if (!Number.isFinite(valorNum) || valorNum === 0) throw erro("VALOR_INVALIDO", "Informe um valor diferente de zero.");
  const r = await client.query(
    "SELECT * FROM contas_financeiras WHERE empresa_id = $1 AND id = $2 FOR UPDATE",
    [empId, Number(contaId)]
  );
  if (!r.rows[0]) throw erro("CONTA_NAO_ENCONTRADA", "Conta não encontrada.");
  if (r.rows[0].arquivada) throw erro("CONTA_ARQUIVADA", "Conta arquivada não aceita novo movimento.");
  const saldoDepois = Number(r.rows[0].saldo) + valorNum;
  await client.query(
    "UPDATE contas_financeiras SET saldo = $1, atualizado_em = now() WHERE empresa_id = $2 AND id = $3",
    [saldoDepois, empId, Number(contaId)]
  );
  const mov = await client.query(
    `INSERT INTO financeiro_movimentos
       (empresa_id, conta_id, tipo, valor, saldo_depois, descricao, vinculo_id, estorno_de, ator_tipo, ator_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      empId, Number(contaId), tipo, valorNum, saldoDepois,
      String(descricao || "").slice(0, 200), vinculoId, estornoDe,
      ator.tipo || "sistema", ator.id == null ? null : String(ator.id),
    ]
  );
  return mapMovimento(mov.rows[0]);
}

// Movimento avulso (fora de uma transferência): abre a própria transação.
async function registrarMovimento(dir, contaId, dados = {}, ator = {}) {
  const empId = await empresaId(dir);
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const movimento = await registrarMovimentoTx(client, empId, contaId, dados, ator);
    await client.query("COMMIT");
    return movimento;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Extrato de UMA conta, mais recente primeiro (cursor por id, igual ao
// padrão de estoque-db.js/listar).
async function listarMovimentos(dir, contaId, { limite = 30, antesId = null } = {}) {
  const empId = await empresaId(dir);
  await buscarConta(dir, contaId); // 404 cedo se a conta não existe/não é do tenant
  const lim = Math.min(Math.max(parseInt(limite, 10) || 30, 1), 100);
  const params = [empId, Number(contaId)];
  let sql = "SELECT * FROM financeiro_movimentos WHERE empresa_id = $1 AND conta_id = $2";
  if (antesId != null) {
    params.push(parseInt(antesId, 10));
    sql += ` AND id < $${params.length}`;
  }
  params.push(lim);
  sql += ` ORDER BY id DESC LIMIT $${params.length}`;
  const r = await db.query(sql, params);
  return r.rows.map(mapMovimento);
}

async function buscarMovimento(dir, movimentoId) {
  const empId = await empresaId(dir);
  const r = await db.query("SELECT * FROM financeiro_movimentos WHERE empresa_id = $1 AND id = $2", [empId, Number(movimentoId)]);
  if (!r.rows[0]) throw erro("MOVIMENTO_NAO_ENCONTRADO", "Movimento não encontrado.");
  return mapMovimento(r.rows[0]);
}

// Transferência vinculada (T-04.04): débito na origem + crédito no destino,
// NA MESMA TRANSAÇÃO — se qualquer lado falhar (conta arquivada, conta de
// outro tenant, etc.), o ROLLBACK desfaz os dois, nenhuma conta fica com
// metade da operação aplicada. As duas linhas compartilham `vinculo_id`
// (o id do movimento de débito), o que deixa explícito que pertencem à
// MESMA transferência — útil para reconstruir o par depois.
//
// As contas são travadas em ORDEM DETERMINÍSTICA (id crescente) — mesmo
// cuidado de deadlock já registrado como risco em
// base/06-BANCO-TENANCY-E-TRANSACOES.md — para duas transferências
// concorrentes (A→B e B→A) nunca travarem uma na outra.
async function transferir(dir, { contaOrigemId, contaDestinoId, valor, descricao = "" } = {}, ator = {}) {
  const origemId = Number(contaOrigemId);
  const destinoId = Number(contaDestinoId);
  if (!origemId || !destinoId) throw erro("CONTA_NAO_ENCONTRADA", "Informe a conta de origem e de destino.");
  if (origemId === destinoId) throw erro("CONTAS_IGUAIS", "A conta de origem e de destino não podem ser a mesma.");
  const valorNum = Number(valor);
  if (!Number.isFinite(valorNum) || valorNum <= 0) throw erro("VALOR_INVALIDO", "Informe um valor de transferência maior que zero.");

  const empId = await empresaId(dir);
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    // Trava as duas linhas em ordem crescente de id ANTES de mexer em
    // qualquer uma — registrarMovimentoTx também trava, mas travar aqui
    // primeiro fixa a ordem determinística mesmo que o menor id seja o
    // destino (a transferência em si roda origem→destino sempre).
    const [menor, maior] = [origemId, destinoId].sort((a, b) => a - b);
    await client.query("SELECT id FROM contas_financeiras WHERE empresa_id = $1 AND id = $2 FOR UPDATE", [empId, menor]);
    await client.query("SELECT id FROM contas_financeiras WHERE empresa_id = $1 AND id = $2 FOR UPDATE", [empId, maior]);

    const debito = await registrarMovimentoTx(client, empId, origemId, {
      tipo: "transferencia_debito", valor: -Math.abs(valorNum), descricao,
    }, ator);
    // O vínculo é o id do PRÓPRIO movimento de débito — grava nele mesmo
    // (self-link) e repassa para o crédito, então as duas linhas do par
    // compartilham exatamente o mesmo valor de vinculo_id.
    await client.query("UPDATE financeiro_movimentos SET vinculo_id = $1 WHERE empresa_id = $2 AND id = $1", [debito.id, empId]);
    const credito = await registrarMovimentoTx(client, empId, destinoId, {
      tipo: "transferencia_credito", valor: Math.abs(valorNum), descricao, vinculoId: debito.id,
    }, ator);
    await client.query("COMMIT");
    return { debito: Object.assign({}, debito, { vinculoId: debito.id }), credito };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Estorno: NUNCA edita o movimento original (imutabilidade do razão, D-17) —
// grava uma linha NOVA de sinal oposto, apontando `estorno_de` para o
// original. Um movimento só pode ser estornado uma vez.
async function estornar(dir, movimentoId, { motivo = "" } = {}, ator = {}) {
  const empId = await empresaId(dir);
  const original = await buscarMovimento(dir, movimentoId);
  if (original.tipo === "estorno") throw erro("MOVIMENTO_JA_E_ESTORNO", "Não é possível estornar um estorno.");
  const jaEstornado = await db.query(
    "SELECT 1 FROM financeiro_movimentos WHERE empresa_id = $1 AND estorno_de = $2",
    [empId, original.id]
  );
  if (jaEstornado.rows.length) throw erro("ESTORNO_DUPLICADO", "Este movimento já foi estornado.");

  const descricao = motivo ? `Estorno: ${String(motivo).slice(0, 180)}` : `Estorno do movimento #${original.id}`;
  return registrarMovimento(dir, original.contaId, {
    tipo: "estorno", valor: -original.valor, descricao, estornoDe: original.id,
  }, ator);
}

// Conciliação manual (D-18): metadata pura — nunca toca valor/saldo_depois.
// Marcar/desmarcar não é "editar o movimento" no sentido que a task proíbe:
// o FATO financeiro (quanto, quando, em qual conta) continua intacto.
async function marcarConciliado(dir, movimentoId, conciliado = true, ator = {}) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `UPDATE financeiro_movimentos
        SET conciliado = $1,
            conciliado_em = CASE WHEN $1 THEN now() ELSE NULL END,
            conciliado_por_tipo = CASE WHEN $1 THEN $2 ELSE NULL END,
            conciliado_por_id = CASE WHEN $1 THEN $3 ELSE NULL END
      WHERE empresa_id = $4 AND id = $5
      RETURNING *`,
    [!!conciliado, ator.tipo || "sistema", ator.id == null ? null : String(ator.id), empId, Number(movimentoId)]
  );
  if (!r.rows[0]) throw erro("MOVIMENTO_NAO_ENCONTRADO", "Movimento não encontrado.");
  return mapMovimento(r.rows[0]);
}

// Limpa o empresa_id cacheado de um slug (ex.: ao excluir o tenant).
function esquecer(slug) {
  delete idCache[slug];
}

module.exports = {
  empresaId, criarConta, listarContas, buscarConta, arquivarConta,
  registrarMovimentoTx, registrarMovimento, listarMovimentos, buscarMovimento,
  transferir, estornar, marcarConciliado, esquecer,
  TIPOS_MOVIMENTO,
};
