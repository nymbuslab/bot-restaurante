const { test } = require("node:test");
const assert = require("node:assert/strict");
const dbMod = require("../src/db");
const caixa = require("../src/caixa");

const CARDAPIO = { categorias: [{ nome: "Cat", itens: [
  { id: "a1", nome: "Espeto", unidade: "un", estoque: 3 },
] }] };

test("cancelarRecebido devolve ao estoque dentro da MESMA transação do caixa", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT id FROM empresas/i.test(sql)) return { rows: [{ id: "emp-uuid" }] };
      if (/FROM caixas/i.test(sql)) return { rows: [{ id: 3, aberto_em: new Date(), fechado_em: null }] };
      if (/SELECT id, cardapio/i.test(sql)) return { rows: [{ id: "emp-uuid", cardapio: JSON.parse(JSON.stringify(CARDAPIO)) }] };
      if (/FROM pedidos/i.test(sql)) return { rows: [{ id: 41, numero: 50, status: "recebido", itens: [{ id: "a1", qtd: 2 }] }] };
      if (/SUM\(/i.test(sql)) return { rows: [{ forma: "Dinheiro", valor: 30 }] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const origPool = dbMod.pool, origQuery = dbMod.query;
  dbMod.pool = { connect: async () => client };
  dbMod.query = async (sql, params) => client.query(sql, params);
  try {
    await caixa.cancelarRecebido("/x/tenant-cx", 41, { devolver: true });
    const sqls = calls.map((q) => q.sql);
    const iCaixa  = sqls.findIndex((s) => /INSERT INTO caixa_movimentos/i.test(s));
    const iDev    = sqls.findIndex((s) => /INSERT INTO estoque_movimentos/i.test(s));
    const iStatus = sqls.findIndex((s) => /UPDATE pedidos SET status = 'cancelado'/i.test(s));
    const iCommit = sqls.findIndex((s) => /^\s*COMMIT/i.test(s));
    assert.ok(iCaixa > -1 && iDev > -1, "deveria deduzir do caixa e devolver ao estoque");
    assert.ok(iCaixa < iDev && iDev < iStatus && iStatus < iCommit,
      "tudo na mesma transação, com o status por último");
    assert.equal(calls[iDev].params[3], "devolucao");
    assert.equal(calls[iDev].params[8], 41); // pedido_id
  } finally {
    dbMod.pool = origPool;
    dbMod.query = origQuery;
  }
});
