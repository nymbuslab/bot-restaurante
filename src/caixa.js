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
  const fundo = Number(fundoTroco) || 0;
  if (fundo < 0) throw new Error("Fundo de troco inválido.");
  const aberto = await caixaAberto(dir);
  if (aberto) throw new Error("Já existe um caixa aberto.");
  const r = await db.query(
    "INSERT INTO caixas (empresa_id, fundo_troco) VALUES ($1, $2) RETURNING *",
    [empId, fundo]
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
  const rec = await db.query(
    `SELECT m.pedido_id, m.forma_pagamento, m.valor, p.numero, p.cliente
       FROM caixa_movimentos m
       LEFT JOIN pedidos p ON p.id = m.pedido_id
      WHERE m.caixa_id = $1 AND m.tipo = 'recebimento'
      ORDER BY m.id DESC`,
    [caixa.id]
  );
  return {
    caixa: {
      id: caixa.id,
      abertoEm: new Date(caixa.aberto_em).toISOString(),
      fundoTroco: Number(caixa.fundo_troco) || 0,
    },
    resumo: calc.resumoCaixa(caixa, movimentos),
    recebimentos: rec.rows.map((r) => ({
      pedidoId: r.pedido_id, numero: r.numero, cliente: r.cliente,
      forma: r.forma_pagamento, valor: Number(r.valor) || 0,
    })),
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
