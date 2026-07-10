// ============================================================
// CLIENTES + ENDEREÇOS — cadastro do cliente final por empresa.
//
// Alimentado pelo checkout do cardápio web (best-effort: nunca bloqueia o
// pedido — se falhar, o pedido já foi salvo). Habilita o bot reconhecer o
// cliente ("Bem-vindo de novo, Fulano") e o checkout pré-preencher dados.
//
// Isolado por empresa_id (basename do `dir` = slug), igual a pedidos.js.
// PII → coberto pelo fluxo LGPD (export/excluir/retenção).
// ============================================================

const path = require("path");
const db = require("./db");
const { validarDocumento } = require("./validacao");

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

// Upsert por (empresa, telefone). Atualiza nome/chat_id SÓ quando vierem
// preenchidos — não apaga o que já existe. Retorna o id do cliente.
async function upsertCliente(empId, { telefone, chatId, nome }) {
  const r = await db.query(
    `INSERT INTO clientes (empresa_id, telefone, chat_id, nome)
       VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, telefone) WHERE telefone <> '' DO UPDATE
       SET nome    = CASE WHEN EXCLUDED.nome    <> '' THEN EXCLUDED.nome    ELSE clientes.nome    END,
           chat_id = CASE WHEN EXCLUDED.chat_id <> '' THEN EXCLUDED.chat_id ELSE clientes.chat_id END,
           atualizado_em = now()
     RETURNING id`,
    [empId, telefone || "", chatId || "", nome || ""]
  );
  return r.rows[0].id;
}

// Salva o endereço do cliente sem duplicar (mesma rua + número + cep).
async function salvarEndereco(empId, clienteId, e) {
  if (!e || (!e.logradouro && !e.cep)) return null;
  const dup = await db.query(
    `SELECT id FROM enderecos
       WHERE cliente_id = $1 AND cep = $2 AND logradouro = $3 AND numero = $4
       LIMIT 1`,
    [clienteId, e.cep || "", e.logradouro || "", e.numero || ""]
  );
  if (dup.rows[0]) return dup.rows[0].id;
  const r = await db.query(
    `INSERT INTO enderecos
       (cliente_id, empresa_id, cep, logradouro, numero, complemento, bairro, cidade, uf)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [clienteId, empId, e.cep || "", e.logradouro || "", e.numero || "",
     e.complemento || "", e.bairro || "", e.cidade || "", e.uf || ""]
  );
  return r.rows[0].id;
}

// Registra cliente (+ endereço, se for entrega) a partir de um pedido salvo.
// Best-effort: o chamador roda sem await e captura o erro. Sem telefone não há
// chave de cliente → não persiste.
async function registrarDoPedido(dir, { telefone, chatId, nome, tipoEntrega, endereco }) {
  if (!telefone) return null;
  const empId = await empresaId(dir);
  const clienteId = await upsertCliente(empId, { telefone, chatId, nome });
  if (tipoEntrega === "Entrega" && endereco) {
    await salvarEndereco(empId, clienteId, endereco);
  }
  return clienteId;
}

// Reconhece o cliente por chat_id (chave forte, vinda do token) ou, em fallback,
// pelo telefone. Ignora nome vazio e "anonimizado" (LGPD) → retorna null nesses
// casos (saudação genérica). Best-effort: erro de banco também retorna null,
// para nunca quebrar o atendimento do bot.
async function buscarCliente(dir, { chatId, telefone } = {}) {
  const chat = (chatId || "").trim();
  const tel = (telefone || "").replace(/\D/g, "");
  if (!chat && !tel) return null;
  try {
    const empId = await empresaId(dir);
    const r = await db.query(
      `SELECT nome, telefone, chat_id FROM clientes
         WHERE empresa_id = $1
           AND nome <> '' AND nome <> 'anonimizado'
           AND ( ($2 <> '' AND chat_id = $2) OR ($3 <> '' AND telefone = $3) )
         ORDER BY atualizado_em DESC
         LIMIT 1`,
      [empId, chat, tel]
    );
    return r.rows[0] ? { nome: r.rows[0].nome, telefone: r.rows[0].telefone, chatId: r.rows[0].chat_id } : null;
  } catch (e) {
    console.error("buscarCliente:", e.message);
    return null;
  }
}

// LGPD — exporta os clientes do tenant (cada um com seus endereços), p/ o
// "exportar meus dados". Inclui só o que é útil ao dono (sem o chat_id interno).
async function exportar(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT c.nome, c.telefone, c.criado_em, c.atualizado_em,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                       'cep', e.cep, 'logradouro', e.logradouro, 'numero', e.numero,
                       'complemento', e.complemento, 'bairro', e.bairro,
                       'cidade', e.cidade, 'uf', e.uf, 'apelido', e.apelido
                     ) ORDER BY e.criado_em)
              FROM enderecos e WHERE e.cliente_id = c.id
            ), '[]'::jsonb) AS enderecos
       FROM clientes c
      WHERE c.empresa_id = $1
      ORDER BY c.criado_em`,
    [empId]
  );
  return r.rows.map((x) => ({
    nome: x.nome,
    telefone: x.telefone,
    criadoEm: x.criado_em ? new Date(x.criado_em).toISOString() : null,
    atualizadoEm: x.atualizado_em ? new Date(x.atualizado_em).toISOString() : null,
    enderecos: x.enderecos || [],
  }));
}

// Retenção (LGPD): remove clientes inativos há mais de `meses` (por
// atualizado_em). Cascata apaga os endereços. Diferente de pedidos (que
// anonimiza p/ manter estatística), aqui é PII pura sem valor estatístico →
// apaga de vez. Global (todos os tenants), idempotente.
async function removerInativos(meses = 12) {
  const r = await db.query(
    "DELETE FROM clientes WHERE atualizado_em < now() - make_interval(months => $1)",
    [meses]
  );
  return r.rowCount;
}

// ============================================================
// CRUD ADMINISTRATIVO — cadastro de cliente pelo painel (Fase 2 do fiado).
// PF/PJ, documento (CPF/CNPJ), endereço do cadastro e limite de crédito.
// Isolado por empresa_id. Reusa a mesma tabela `clientes`.
// ============================================================

const soDigitos = (v) => String(v == null ? "" : v).replace(/\D/g, "");

// snake_case (banco) → camelCase (app), numéricos coagidos, datas em ISO.
function mapRow(r) {
  return {
    id: r.id,
    tipo: r.tipo || "PF",
    nome: r.nome || "",
    apelido: r.apelido || "",
    documento: r.documento || "",
    ieRg: r.ie_rg || "",
    telefone: r.telefone || "",
    cep: r.cep || "",
    logradouro: r.logradouro || "",
    numero: r.numero || "",
    complemento: r.complemento || "",
    bairro: r.bairro || "",
    cidade: r.cidade || "",
    uf: r.uf || "",
    limiteCredito: Number(r.limite_credito) || 0,
    diaVencimento: r.dia_vencimento == null ? null : Number(r.dia_vencimento),
    bloquearLimite: !!r.bloquear_limite,
    bloquearVencimento: !!r.bloquear_vencimento,
    liberacaoPontual: !!r.liberacao_pontual,
    criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
    atualizadoEm: r.atualizado_em ? new Date(r.atualizado_em).toISOString() : null,
  };
}

// Dia de vencimento: inteiro 1..31 ou null (sem vencimento fixo).
function normalizarDiaVenc(v) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}

// Saneia o payload do formulário para colunas (documento/telefone/cep só dígitos).
function normalizarDados(d) {
  d = d || {};
  return {
    tipo: d.tipo === "PJ" ? "PJ" : "PF",
    nome: String(d.nome || "").trim(),
    apelido: String(d.apelido || "").trim(),
    documento: soDigitos(d.documento),
    ieRg: String(d.ieRg || "").trim(),
    telefone: soDigitos(d.telefone),
    cep: soDigitos(d.cep),
    logradouro: String(d.logradouro || "").trim(),
    numero: String(d.numero || "").trim(),
    complemento: String(d.complemento || "").trim(),
    bairro: String(d.bairro || "").trim(),
    cidade: String(d.cidade || "").trim(),
    uf: String(d.uf || "").trim().toUpperCase().slice(0, 2),
    limiteCredito: Math.max(0, Number(d.limiteCredito) || 0),
    diaVencimento: normalizarDiaVenc(d.diaVencimento),
    bloquearLimite: !!d.bloquearLimite,
    bloquearVencimento: !!d.bloquearVencimento,
  };
}

// Retorna mensagem de erro (ao usuário) ou null. Documento vazio é permitido.
function validar(d) {
  if (!d.nome) return "Informe o nome do cliente.";
  if (!validarDocumento(d.tipo, d.documento)) return d.tipo === "PJ" ? "CNPJ inválido." : "CPF inválido.";
  return null;
}

// Traduz violação de unique (documento/telefone) para mensagem ao usuário.
function traduzErro(e) {
  if (e && e.code === "23505") {
    const alvo = (e.constraint || "") + " " + (e.detail || "");
    if (/documento/.test(alvo)) return new Error("Já existe um cliente com esse CPF/CNPJ.");
    if (/telefone/.test(alvo)) return new Error("Já existe um cliente com esse telefone.");
    return new Error("Cliente duplicado.");
  }
  return e;
}

// Lista os clientes do tenant. `busca` casa nome/apelido (ILIKE) e, quando o
// termo tem dígitos, também documento/telefone (LIKE nos dígitos armazenados).
async function listar(dir, { busca } = {}) {
  const empId = await empresaId(dir);
  const termo = String(busca || "").trim();
  const params = [empId];
  let sql = "SELECT * FROM clientes WHERE empresa_id = $1";
  if (termo) {
    params.push(`%${termo}%`);
    const partes = [`nome ILIKE $${params.length}`, `apelido ILIKE $${params.length}`];
    const dig = soDigitos(termo);
    if (dig) {
      params.push(`%${dig}%`);
      partes.push(`documento LIKE $${params.length}`, `telefone LIKE $${params.length}`);
    }
    sql += ` AND (${partes.join(" OR ")})`;
  }
  sql += " ORDER BY nome NULLS LAST, criado_em DESC LIMIT 500";
  const r = await db.query(sql, params);
  return r.rows.map(mapRow);
}

// Resumo de crédito do cliente. Fase 2: ainda não há vendas a prazo (a Fase 3
// adiciona pedidos.cliente_id/a_prazo); gasto=0. A Fase 4 deriva gasto/vencido
// das vendas a prazo em aberto.
async function resumoFiado(dir, cli) {
  const limite = cli.limiteCredito || 0;
  const gasto = 0;
  return { gasto, saldo: limite - gasto, vencido: false, emAberto: 0 };
}

async function buscarPorId(dir, id) {
  const empId = await empresaId(dir);
  const r = await db.query("SELECT * FROM clientes WHERE empresa_id = $1 AND id = $2", [empId, id]);
  if (!r.rows[0]) return null;
  const cli = mapRow(r.rows[0]);
  cli.resumoFiado = await resumoFiado(dir, cli);
  return cli;
}

async function criar(dir, dados) {
  const empId = await empresaId(dir);
  const d = normalizarDados(dados);
  const erro = validar(d);
  if (erro) throw new Error(erro);
  try {
    const r = await db.query(
      `INSERT INTO clientes (empresa_id, tipo, nome, apelido, documento, ie_rg, telefone,
         cep, logradouro, numero, complemento, bairro, cidade, uf,
         limite_credito, dia_vencimento, bloquear_limite, bloquear_vencimento)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [empId, d.tipo, d.nome, d.apelido, d.documento, d.ieRg, d.telefone,
       d.cep, d.logradouro, d.numero, d.complemento, d.bairro, d.cidade, d.uf,
       d.limiteCredito, d.diaVencimento, d.bloquearLimite, d.bloquearVencimento]
    );
    return mapRow(r.rows[0]);
  } catch (e) {
    throw traduzErro(e);
  }
}

async function atualizar(dir, id, dados) {
  const empId = await empresaId(dir);
  const d = normalizarDados(dados);
  const erro = validar(d);
  if (erro) throw new Error(erro);
  try {
    const r = await db.query(
      `UPDATE clientes SET tipo=$3, nome=$4, apelido=$5, documento=$6, ie_rg=$7, telefone=$8,
         cep=$9, logradouro=$10, numero=$11, complemento=$12, bairro=$13, cidade=$14, uf=$15,
         limite_credito=$16, dia_vencimento=$17, bloquear_limite=$18, bloquear_vencimento=$19,
         atualizado_em=now()
       WHERE empresa_id=$1 AND id=$2
       RETURNING *`,
      [empId, id, d.tipo, d.nome, d.apelido, d.documento, d.ieRg, d.telefone,
       d.cep, d.logradouro, d.numero, d.complemento, d.bairro, d.cidade, d.uf,
       d.limiteCredito, d.diaVencimento, d.bloquearLimite, d.bloquearVencimento]
    );
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  } catch (e) {
    throw traduzErro(e);
  }
}

// Exclui o cliente (cascata apaga endereços). Fase 4 bloqueia se houver fiado
// em aberto — na Fase 2 ainda não há vendas a prazo.
async function excluir(dir, id) {
  const empId = await empresaId(dir);
  const r = await db.query("DELETE FROM clientes WHERE empresa_id = $1 AND id = $2", [empId, id]);
  return r.rowCount > 0;
}

// Liberação pontual: libera a PRÓXIMA venda a prazo mesmo estourado/vencido.
// Consumida na venda (Fase 3). Aqui só arma a flag.
async function liberarPontual(dir, id) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "UPDATE clientes SET liberacao_pontual = true, atualizado_em = now() WHERE empresa_id = $1 AND id = $2 RETURNING id",
    [empId, id]
  );
  return r.rowCount > 0;
}

// Limpa o empresa_id cacheado de um slug (ex.: ao excluir um tenant).
function esquecer(slug) { delete idCache[slug]; }

module.exports = {
  registrarDoPedido, buscarCliente, exportar, removerInativos, esquecer,
  listar, buscarPorId, criar, atualizar, excluir, liberarPontual,
};
