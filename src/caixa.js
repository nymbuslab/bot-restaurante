// ============================================================
// CAIXA — abertura/fechamento + recebimento por pedido + sangria/
// suprimento. Isolado por empresa_id (padrão do pedidos.js).
// Cálculos puros ficam em caixa-calc.js.
// ============================================================
const path = require("path");
const db = require("./db");
const calc = require("./caixa-calc");
const store = require("./store");
const relatorioCaixa = require("../public/relatorio-caixa"); // dual-mode Node/browser

const slugDe = (dir) => path.basename(dir);
const idCache = {};

async function empresaId(dir) {
  const slug = slugDe(dir);
  if (idCache[slug]) return idCache[slug];
  const r = await db.query("SELECT id FROM empresas WHERE slug = $1", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  idCache[slug] = r.rows[0].id;
  return idCache[slug];
}

// Conta pedidos do turno (criados desde a abertura do caixa) ainda NÃO recebidos.
// Base da regra "todos os pedidos precisam ser recebidos antes de fechar".
async function _contarAReceber(empId, abertoEm) {
  const r = await db.query(
    "SELECT COUNT(*)::int AS n FROM pedidos WHERE empresa_id = $1 AND recebido_em IS NULL AND criado_em >= $2",
    [empId, abertoEm]
  );
  return r.rows[0].n;
}

async function caixaAberto(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT * FROM caixas WHERE empresa_id = $1 AND status = 'aberto' ORDER BY id DESC LIMIT 1",
    [empId]
  );
  return r.rows[0] || null;
}

async function abrirCaixa(dir, { fundoTroco, operador, obsAbertura }) {
  const empId = await empresaId(dir);
  const fundo = Number(fundoTroco) || 0;
  if (fundo < 0) throw new Error("Fundo de troco inválido.");
  const aberto = await caixaAberto(dir);
  if (aberto) throw new Error("Já existe um caixa aberto.");
  const r = await db.query(
    "INSERT INTO caixas (empresa_id, fundo_troco, operador, obs_abertura) VALUES ($1, $2, $3, $4) RETURNING *",
    [empId, fundo, (operador || "").trim() || null, (obsAbertura || "").trim() || null]
  );
  return r.rows[0];
}

async function receberPedido(dir, pedidoId, { forma, valor }) {
  const empId = await empresaId(dir);
  const v = Number(valor) || 0;
  if (v <= 0) throw new Error("Valor deve ser positivo.");
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Abra o caixa antes de receber.");
  // Transação + FOR UPDATE: evita duplo recebimento em caso de corrida/falha
  // (o INSERT do movimento e o UPDATE do pedido viram tudo-ou-nada).
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const ped = await client.query(
      "SELECT id, recebido_em FROM pedidos WHERE empresa_id = $1 AND id = $2 FOR UPDATE",
      [empId, pedidoId]
    );
    if (!ped.rows[0]) throw new Error("Pedido não encontrado.");
    if (ped.rows[0].recebido_em) throw new Error("Pedido já recebido.");
    await client.query(
      `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, pedido_id)
       VALUES ($1, $2, 'recebimento', $3, $4, $5)`,
      [caixa.id, empId, forma || "Outros", v, pedidoId]
    );
    await client.query(
      "UPDATE pedidos SET recebido_em = now() WHERE empresa_id = $1 AND id = $2",
      [empId, pedidoId]
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function estornarRecebimento(dir, pedidoId) {
  const empId = await empresaId(dir);
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Sem caixa aberto para estornar.");
  // Transação: DELETE do movimento (com empresa_id — defesa em profundidade) +
  // UPDATE do pedido viram tudo-ou-nada.
  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM caixa_movimentos WHERE caixa_id = $1 AND pedido_id = $2 AND tipo = 'recebimento' AND empresa_id = $3",
      [caixa.id, pedidoId, empId]
    );
    await client.query(
      "UPDATE pedidos SET recebido_em = NULL WHERE empresa_id = $1 AND id = $2",
      [empId, pedidoId]
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function registrarMovimento(dir, { tipo, valor, descricao }) {
  const empId = await empresaId(dir);
  if (tipo !== "sangria" && tipo !== "suprimento") throw new Error("Tipo inválido.");
  const v = Number(valor) || 0;
  if (v <= 0) throw new Error("Valor deve ser positivo.");
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Abra o caixa primeiro.");
  const r = await db.query(
    `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, valor, descricao)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [caixa.id, empId, tipo, v, descricao || ""]
  );
  return r.rows[0];
}

async function _movimentos(caixaId) {
  const r = await db.query(
    "SELECT * FROM caixa_movimentos WHERE caixa_id = $1 ORDER BY id ASC",
    [caixaId]
  );
  return r.rows;
}

async function resumo(dir) {
  const caixa = await caixaAberto(dir);
  if (!caixa) return { caixa: null };
  const movimentos = await _movimentos(caixa.id);
  // Recebimentos DESTE caixa (com nº/cliente do pedido) — base do estorno.
  // O ato de "receber" acontece no Pedido; aqui o Caixa só mostra o que entrou
  // e permite estornar correções.
  // Extrato do turno: TODOS os movimentos (recebimento/sangria/suprimento) com
  // nº/cliente do pedido (recebimentos) — é o que o dono confere ao olhar o caixa.
  const mov = await db.query(
    `SELECT m.tipo, m.pedido_id, m.forma_pagamento, m.valor, m.descricao, m.criado_em,
            p.numero, p.cliente
       FROM caixa_movimentos m
       LEFT JOIN pedidos p ON p.id = m.pedido_id
      WHERE m.caixa_id = $1
      ORDER BY m.id DESC`,
    [caixa.id]
  );
  const empId = await empresaId(dir);
  const pedidosAReceber = await _contarAReceber(empId, caixa.aberto_em);
  return {
    caixa: {
      id: caixa.id,
      abertoEm: new Date(caixa.aberto_em).toISOString(),
      fundoTroco: Number(caixa.fundo_troco) || 0,
      operador: caixa.operador || null,
      obsAbertura: caixa.obs_abertura || null,
    },
    pedidosAReceber,
    resumo: calc.resumoCaixa(caixa, movimentos),
    movimentos: mov.rows.map((r) => ({
      tipo: r.tipo, pedidoId: r.pedido_id, numero: r.numero, cliente: r.cliente,
      forma: r.forma_pagamento, valor: Number(r.valor) || 0, descricao: r.descricao || "",
      quando: r.criado_em ? new Date(r.criado_em).toISOString() : null,
    })),
  };
}

// Formas eletrônicas do relatório = união das configuradas (menos dinheiro) com as
// que de fato tiveram recebimento — espelha a regra do front (corrige Pix fora da
// config) e mantém a montagem do relatório com dados do servidor.
function _formasEletronicas(pagamentos, recebidoPorForma) {
  const formas = (pagamentos || []).filter((f) => !calc.ehDinheiro(f));
  for (const f in (recebidoPorForma || {})) {
    if (!calc.ehDinheiro(f) && !formas.includes(f)) formas.push(f);
  }
  return formas;
}

// eletronico: [{ forma, valor }] informado pelo operador na conferência.
// O relatório é montado AQUI (servidor), nunca recebido do cliente — fonte única
// e autoritativa; guardado em detalhe_fechamento.relatorio p/ reimpressão.
async function fecharCaixa(dir, { contagem, eletronico }) {
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Não há caixa aberto.");

  // Regra de negócio: não fecha com pedidos do turno ainda a receber.
  const aReceber = await _contarAReceber(caixa.empresa_id, caixa.aberto_em);
  if (aReceber > 0) {
    throw new Error(`Há ${aReceber} pedido(s) com pagamento a receber. Receba todos antes de fechar o caixa.`);
  }

  const movimentos = await _movimentos(caixa.id);
  const resumo = calc.resumoCaixa(caixa, movimentos);

  // Recalcula no servidor a partir do detalhamento (não confia no total do cliente).
  const contadoDinheiro = calc.totalContagem(contagem || {});
  const lancs = Array.isArray(eletronico) ? eletronico : [];
  const contadoEletronico = lancs.reduce((s, l) => s + (Number(l && l.valor) || 0), 0);
  const totalCaixa = calc.totalEmCaixa(caixa, resumo);
  const diferenca = (contadoDinheiro + contadoEletronico) - totalCaixa;

  // Agrega lançamentos por forma p/ o snapshot e o relatório.
  const eletronicoPorForma = {};
  for (const l of lancs) {
    const f = (l && l.forma) || "Outros";
    eletronicoPorForma[f] = (eletronicoPorForma[f] || 0) + (Number(l.valor) || 0);
  }

  // Monta o relatório 80mm no servidor, com os dados autoritativos.
  await store.ensure(dir);
  const cfg = store.getConfig(dir) || {};
  const formaDinheiro = (cfg.pagamentos || []).find((f) => calc.ehDinheiro(f)) || "Dinheiro";
  const relatorio = relatorioCaixa.montarRelatorioFechamento({
    restaurante: (cfg.restaurante && cfg.restaurante.nome) || "",
    abertoEm: new Date(caixa.aberto_em).toISOString(),
    fechadoEm: new Date().toISOString(),
    operador: caixa.operador || "",
    formaDinheiro,
    formas: _formasEletronicas(cfg.pagamentos, resumo.recebidoPorForma),
    recebidoPorForma: resumo.recebidoPorForma || {},
    fundoTroco: Number(caixa.fundo_troco) || 0,
    suprimentos: resumo.suprimentos || 0,
    sangrias: resumo.sangrias || 0,
    contadoDinheiro,
    eletronicoPorForma,
  });

  const detalhe = {
    cedulas: contagem || {},
    eletronico: lancs,
    eletronicoPorForma,
    esperado: { totalEmCaixa: totalCaixa, especie: resumo.esperadoEspecie, eletronico: calc.esperadoEletronico(resumo) },
    contado: { dinheiro: contadoDinheiro, eletronico: contadoEletronico },
    relatorio,
  };

  await db.query(
    `UPDATE caixas SET status='fechado', fechado_em=now(),
            contado_dinheiro=$2, contado_eletronico=$3, diferenca=$4, detalhe_fechamento=$5
       WHERE id=$1`,
    [caixa.id, contadoDinheiro, contadoEletronico, diferenca, JSON.stringify(detalhe)]
  );
  return { diferenca, totalEmCaixa: totalCaixa, contadoDinheiro, contadoEletronico, relatorio };
}

async function listarCaixas(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT id, aberto_em, fechado_em, fundo_troco, contado_dinheiro, diferenca,
            detalhe_fechamento->>'relatorio' AS relatorio
       FROM caixas WHERE empresa_id = $1 AND status='fechado'
       ORDER BY id DESC LIMIT 50`,
    [empId]
  );
  return r.rows.map((c) => ({
    id: c.id,
    abertoEm: new Date(c.aberto_em).toISOString(),
    fechadoEm: c.fechado_em ? new Date(c.fechado_em).toISOString() : null,
    fundoTroco: Number(c.fundo_troco) || 0,
    contadoDinheiro: c.contado_dinheiro == null ? null : Number(c.contado_dinheiro),
    diferenca: c.diferenca == null ? null : Number(c.diferenca),
    relatorio: c.relatorio || null,
  }));
}

async function detalheCaixa(dir, id) {
  const empId = await empresaId(dir);
  const c = await db.query("SELECT * FROM caixas WHERE empresa_id = $1 AND id = $2", [empId, id]);
  if (!c.rows[0]) return null;
  const movimentos = await _movimentos(id);
  return {
    caixa: { ...c.rows[0], resumo: calc.resumoCaixa(c.rows[0], movimentos) },
    movimentos,
  };
}

function esquecer(slug) { delete idCache[slug]; }

module.exports = {
  caixaAberto, abrirCaixa, receberPedido, estornarRecebimento, registrarMovimento,
  resumo, fecharCaixa, listarCaixas, detalheCaixa, esquecer,
};
