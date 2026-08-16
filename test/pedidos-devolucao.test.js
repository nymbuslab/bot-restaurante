const { test } = require("node:test");
const assert = require("node:assert/strict");
const dbMod = require("../src/db");
const pedidos = require("../src/pedidos");

const CARDAPIO = { categorias: [{ nome: "Cat", itens: [
  { id: "a1", nome: "Espeto", unidade: "un", estoque: 3 },
  { id: "a2", nome: "Refri", unidade: "un" }, // sem controle
] }] };

// Substitui db.pool e db.query por um cliente falso que empilha as queries e
// responde as leituras do fluxo. Restaura no fim, dê certo ou não. Cada teste usa
// um slug diferente: empresaId() tem cache por slug.
function comPoolFalso(pedido, fn) {
  const calls = [];
  const client = {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT id FROM empresas/i.test(sql)) return { rows: [{ id: "emp-uuid" }] };
      if (/SELECT id, cardapio/i.test(sql)) return { rows: [{ id: "emp-uuid", cardapio: JSON.parse(JSON.stringify(CARDAPIO)) }] };
      if (/FROM pedidos/i.test(sql)) return { rows: [pedido] };
      return { rows: [], rowCount: 1 };
    },
    release() {},
  };
  const origPool = dbMod.pool, origQuery = dbMod.query;
  dbMod.pool = { connect: async () => client };
  dbMod.query = async (sql, params) => client.query(sql, params);
  return Promise.resolve()
    .then(() => fn(client))
    .finally(() => { dbMod.pool = origPool; dbMod.query = origQuery; });
}

test("cancelarPedido com devolver: devolve na mesma transação, antes do status", async () => {
  await comPoolFalso({ id: 7, numero: 12, itens: [{ id: "a1", qtd: 2 }] }, async (c) => {
    await pedidos.cancelarPedido("/x/tenant-a", 7, { devolver: true });
    const sqls = c.calls.map((q) => q.sql);
    const iIns    = sqls.findIndex((s) => /INSERT INTO estoque_movimentos/i.test(s));
    const iStatus = sqls.findIndex((s) => /UPDATE pedidos SET status = 'cancelado'/i.test(s));
    const iCommit = sqls.findIndex((s) => /^\s*COMMIT/i.test(s));
    assert.ok(iIns > -1, "deveria gravar a devolução");
    assert.ok(iIns < iStatus && iStatus < iCommit, "devolução antes do status, tudo antes do COMMIT");
    const ins = c.calls[iIns];
    assert.equal(ins.params[3], "devolucao");
    assert.equal(ins.params[4], 2);  // quantidade devolvida
    assert.equal(ins.params[5], 5);  // saldo depois: 3 + 2
    assert.equal(ins.params[8], 7);  // pedido_id
  });
});

test("cancelarPedido com devolver=false: cancela sem tocar no estoque", async () => {
  await comPoolFalso({ id: 8, numero: 13, itens: [{ id: "a1", qtd: 2 }] }, async (c) => {
    await pedidos.cancelarPedido("/x/tenant-b", 8, { devolver: false });
    assert.equal(c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql)).length, 0);
    assert.ok(c.calls.some((q) => /UPDATE pedidos SET status = 'cancelado'/i.test(q.sql)));
  });
});

test("cancelarItemPedido devolve só o item cancelado", async () => {
  const ped = { id: 9, numero: 14, itens: [{ id: "a1", qtd: 2 }, { id: "a2", qtd: 1 }], taxa_entrega: 0, desconto: 0 };
  await comPoolFalso(ped, async (c) => {
    await pedidos.cancelarItemPedido("/x/tenant-c", 9, 0, { devolver: true });
    const ins = c.calls.find((q) => /INSERT INTO estoque_movimentos/i.test(q.sql));
    assert.equal(ins.params.length, 12); // um movimento só
    assert.equal(ins.params[1], "a1");
    assert.equal(ins.params[4], 2);
  });
});
