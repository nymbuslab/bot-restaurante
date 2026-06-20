// ============================================================
// CAIXA — abertura/fechamento + recebimento por pedido + sangria/
// suprimento. Isolado por empresa_id (padrão do pedidos.js).
// Cálculos puros ficam em caixa-calc.js.
// ============================================================
const path = require("path");
const db = require("./db");
const calc = require("./caixa-calc");

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

async function caixaAberto(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT * FROM caixas WHERE empresa_id = $1 AND status = 'aberto' ORDER BY id DESC LIMIT 1",
    [empId]
  );
  return r.rows[0] || null;
}

async function abrirCaixa(dir, { fundoTroco }) {
  const empId = await empresaId(dir);
  const aberto = await caixaAberto(dir);
  if (aberto) throw new Error("Já existe um caixa aberto.");
  const r = await db.query(
    "INSERT INTO caixas (empresa_id, fundo_troco) VALUES ($1, $2) RETURNING *",
    [empId, Number(fundoTroco) || 0]
  );
  return r.rows[0];
}

async function receberPedido(dir, pedidoId, { forma, valor }) {
  const empId = await empresaId(dir);
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Abra o caixa antes de receber.");
  const ped = await db.query(
    "SELECT id, recebido_em FROM pedidos WHERE empresa_id = $1 AND id = $2",
    [empId, pedidoId]
  );
  if (!ped.rows[0]) throw new Error("Pedido não encontrado.");
  if (ped.rows[0].recebido_em) throw new Error("Pedido já recebido.");
  await db.query(
    `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, pedido_id)
     VALUES ($1, $2, 'recebimento', $3, $4, $5)`,
    [caixa.id, empId, forma || "Outros", Number(valor) || 0, pedidoId]
  );
  await db.query(
    "UPDATE pedidos SET recebido_em = now() WHERE empresa_id = $1 AND id = $2",
    [empId, pedidoId]
  );
  return { ok: true };
}

async function estornarRecebimento(dir, pedidoId) {
  const empId = await empresaId(dir);
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Sem caixa aberto para estornar.");
  await db.query(
    "DELETE FROM caixa_movimentos WHERE caixa_id = $1 AND pedido_id = $2 AND tipo = 'recebimento'",
    [caixa.id, pedidoId]
  );
  await db.query(
    "UPDATE pedidos SET recebido_em = NULL WHERE empresa_id = $1 AND id = $2",
    [empId, pedidoId]
  );
  return { ok: true };
}

async function registrarMovimento(dir, { tipo, valor, descricao }) {
  const empId = await empresaId(dir);
  if (tipo !== "sangria" && tipo !== "suprimento") throw new Error("Tipo inválido.");
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Abra o caixa primeiro.");
  const r = await db.query(
    `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, valor, descricao)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [caixa.id, empId, tipo, Number(valor) || 0, descricao || ""]
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

// Pedidos do tenant com/sem recebimento (para as listas da aba).
async function _pedidosCaixa(empId) {
  const r = await db.query(
    `SELECT id, numero, cliente, pagamento, total, recebido_em
       FROM pedidos WHERE empresa_id = $1 ORDER BY id DESC LIMIT 200`,
    [empId]
  );
  return r.rows.map((p) => ({
    id: p.id, numero: p.numero, cliente: p.cliente, pagamento: p.pagamento,
    total: p.total == null ? 0 : Number(p.total),
    recebidoEm: p.recebido_em ? new Date(p.recebido_em).toISOString() : null,
  }));
}

async function resumo(dir) {
  const empId = await empresaId(dir);
  const caixa = await caixaAberto(dir);
  if (!caixa) return { caixa: null };
  const movimentos = await _movimentos(caixa.id);
  const peds = await _pedidosCaixa(empId);
  return {
    caixa: {
      id: caixa.id,
      abertoEm: new Date(caixa.aberto_em).toISOString(),
      fundoTroco: Number(caixa.fundo_troco) || 0,
    },
    resumo: calc.resumoCaixa(caixa, movimentos),
    aReceber: peds.filter((p) => !p.recebidoEm),
    recebidos: peds.filter((p) => p.recebidoEm),
  };
}

async function fecharCaixa(dir, { contadoDinheiro, observacao }) {
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Não há caixa aberto.");
  const movimentos = await _movimentos(caixa.id);
  const { esperadoEspecie } = calc.resumoCaixa(caixa, movimentos);
  const diferenca = calc.calcularDiferenca(esperadoEspecie, contadoDinheiro);
  await db.query(
    `UPDATE caixas SET status='fechado', fechado_em=now(),
            contado_dinheiro=$2, diferenca=$3, observacao=$4
       WHERE id=$1`,
    [caixa.id, Number(contadoDinheiro) || 0, diferenca, observacao || ""]
  );
  return { diferenca, esperadoEspecie };
}

async function listarCaixas(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT id, aberto_em, fechado_em, fundo_troco, contado_dinheiro, diferenca
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
