const { test } = require("node:test");
const assert = require("node:assert/strict");
const dbMod = require("../src/db");
const mesasDb = require("../src/mesas-db");

const CARDAPIO = { categorias: [{ nome: "Cat", itens: [
  { id: "a1", nome: "Espeto", unidade: "un", estoque: 5 },
  { id: "a2", nome: "Refri", unidade: "un" }, // sem controle
] }] };

// Substitui db.pool e db.query por um cliente falso que empilha as queries e
// responde as leituras do fluxo. Restaura no fim, dê certo ou não. Cada teste usa
// um slug diferente: empresaId() tem cache por slug. Helper copiado de
// test/pedidos-devolucao.test.js (Task 11) — aqui a branch `FROM pedidos` devolve
// a LISTA INTEIRA de pedidos abertos da mesa (`{ rows: pedidosRows }`), não um só.
function comPoolFalso(pedidosRows, fn) {
  const calls = [];
  const client = {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT id FROM empresas/i.test(sql)) return { rows: [{ id: "emp-uuid" }] };
      if (/SELECT id, cardapio/i.test(sql)) return { rows: [{ id: "emp-uuid", cardapio: JSON.parse(JSON.stringify(CARDAPIO)) }] };
      if (/FROM pedidos/i.test(sql)) return { rows: pedidosRows };
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

test("mesas.cancelar devolve os itens de TODOS os pedidos abertos da mesa", async () => {
  const abertos = [
    { id: 21, numero: 30, itens: [{ id: "a1", qtd: 1 }] },
    { id: 22, numero: 31, itens: [{ id: "a1", qtd: 2 }] },
  ];
  await comPoolFalso(abertos, async (c) => {
    await mesasDb.cancelar("/x/tenant-m1", 5, { devolver: true });
    const ins = c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql));
    assert.equal(ins.length, 2); // um por pedido, cada movimento amarrado ao seu
    assert.deepEqual(ins.map((q) => q.params[8]), [21, 22]);
  });
});

test("mesas.cancelarItem devolve só o item removido da comanda", async () => {
  const ped = [{ id: 23, numero: 32, itens: [{ id: "a1", qtd: 2 }, { id: "a2", qtd: 1 }] }];
  await comPoolFalso(ped, async (c) => {
    await mesasDb.cancelarItem("/x/tenant-m2", 5, 23, 0, { devolver: true });
    const ins = c.calls.find((q) => /INSERT INTO estoque_movimentos/i.test(q.sql));
    assert.equal(ins.params[1], "a1");
    assert.equal(ins.params[4], 2);
  });
});

test("mesas.cancelar com devolver=false não grava movimento", async () => {
  await comPoolFalso([{ id: 24, numero: 33, itens: [{ id: "a1", qtd: 1 }] }], async (c) => {
    await mesasDb.cancelar("/x/tenant-m3", 6, { devolver: false });
    assert.equal(c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql)).length, 0);
  });
});
