const { test } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/db"); // stubado abaixo: nenhum teste aqui toca o banco real
const mesasDb = require("../src/mesas-db");

// mesasDb.empresaId resolve o slug via db.query (fora da transação, cacheado por
// slug). Stub para nunca sair do processo — o .env local aponta pra produção.
db.query = async () => ({ rows: [{ id: "emp-uuid" }] });

// Client fake: registra as queries e devolve respostas canned (sem tocar o banco).
function fakeClient(respostas) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      for (const [re, resposta] of respostas) {
        if (re.test(sql)) return typeof resposta === "function" ? resposta(params) : resposta;
      }
      return { rows: [] };
    },
  };
}

test("lancarItens: mesa com pedido aberto acumula os itens e devolve o id/numero existentes", async () => {
  const c = fakeClient([
    [/SELECT id, numero, itens, total FROM pedidos/i, { rows: [{ id: 42, numero: 7, itens: [{ nome: "Espeto" }], total: 20 }] }],
  ]);
  const pedido = await mesasDb.lancarItens(
    "/x/slug-mesa-a", 1,
    { itens: [{ nome: "Refri" }], total: 8, cliente: "Mesa 1" },
    c
  );
  assert.deepEqual(pedido, { id: 42, numero: 7 }); // pedido JÁ existente, não um novo
  assert.match(c.calls[0].sql, /SELECT id, numero, itens, total FROM pedidos/i);
  assert.match(c.calls[1].sql, /UPDATE pedidos SET itens/i); // acumula na mesma linha
  assert.equal(c.calls[1].params[2], 42); // WHERE id = <pedido existente>
  assert.equal(c.calls.filter((q) => /INSERT INTO pedidos/i.test(q.sql)).length, 0);
});

test("lancarItens: mesa sem pedido aberto insere um novo e devolve o id/numero gerados", async () => {
  const c = fakeClient([
    [/SELECT id, numero, itens, total FROM pedidos/i, { rows: [] }], // nenhum pedido aberto
    [/INSERT INTO pedidos/i, { rows: [{ id: 55, numero: 3 }] }],
  ]);
  const pedido = await mesasDb.lancarItens(
    "/x/slug-mesa-b", 2,
    { itens: [{ nome: "Espeto" }], total: 12, cliente: "Mesa 2" },
    c
  );
  assert.deepEqual(pedido, { id: 55, numero: 3 }); // pedido NOVO
  assert.match(c.calls[1].sql, /INSERT INTO pedidos[\s\S]*RETURNING id, numero/i);
});
