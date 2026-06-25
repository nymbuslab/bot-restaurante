const { test } = require("node:test");
const assert = require("node:assert/strict");
const store = require("../src/store");

// Client fake: registra as queries e devolve respostas canned (sem tocar o banco).
function fakeClient(cardapio) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT cardapio/i.test(sql)) return { rows: [{ cardapio }] };
      return { rows: [] }; // UPDATE
    },
  };
}

const baseCardapio = {
  categorias: [
    { nome: "X", itens: [
      { id: "a1", nome: "Espeto", unidade: "un", estoque: 3, estoqueMinimo: 1 },
      { id: "a2", nome: "Picanha", unidade: "kg", estoque: 2, estoqueMinimo: 0 },
      { id: "a3", nome: "Refri", unidade: "un" }, // sem controle (ilimitado)
    ] },
  ],
};
const clone = () => JSON.parse(JSON.stringify(baseCardapio));

test("baixarEstoqueTx: trava (FOR UPDATE), decrementa e regrava o cardápio", async () => {
  const c = fakeClient(clone());
  const novo = await store.baixarEstoqueTx(c, "/x/slug-teste", [{ id: "a1", qtd: 2 }, { id: "a3", qtd: 5 }]);
  assert.match(c.calls[0].sql, /SELECT cardapio[\s\S]*FOR UPDATE/i); // 1ª query trava a linha
  assert.match(c.calls[1].sql, /UPDATE empresas SET cardapio/i);     // 2ª regrava
  const it = novo.categorias[0].itens;
  assert.equal(it[0].estoque, 1);             // 3 - 2
  assert.equal(it[2].estoque, undefined);     // item ilimitado não muda
});

test("baixarEstoqueTx: item por kg decrementa peso decimal", async () => {
  const c = fakeClient(clone());
  const novo = await store.baixarEstoqueTx(c, "/x/slug", [{ id: "a2", qtd: "0,5" }]);
  assert.equal(novo.categorias[0].itens[1].estoque, 1.5); // 2 - 0.5
});

test("baixarEstoqueTx: estoque insuficiente lança ESTOQUE e NÃO grava", async () => {
  const c = fakeClient(clone());
  await assert.rejects(
    () => store.baixarEstoqueTx(c, "/x/slug", [{ id: "a1", qtd: 99 }]),
    (e) => e.code === "ESTOQUE" && /Restam só/.test(e.message)
  );
  assert.equal(c.calls.length, 1);                 // só o SELECT; nenhum UPDATE
  assert.match(c.calls[0].sql, /FOR UPDATE/i);
});

test("baixarEstoqueTx: item esgotado lança ESTOQUE", async () => {
  const cz = clone();
  cz.categorias[0].itens[0].estoque = 0;
  const c = fakeClient(cz);
  await assert.rejects(
    () => store.baixarEstoqueTx(c, "/x/slug", [{ id: "a1", qtd: 1 }]),
    (e) => e.code === "ESTOQUE"
  );
});
