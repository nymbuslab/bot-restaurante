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
      if (/SELECT id, cardapio/i.test(sql)) return { rows: [{ id: "emp-uuid", cardapio }] };
      if (/INSERT INTO estoque_movimentos/i.test(sql)) {
        const n = params.length / 12; // params vêm em blocos de 12 por movimento
        return { rows: Array.from({ length: n }, (_, i) => ({ id: 900 + i })) };
      }
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
  const { cardapio: novo } = await store.baixarEstoqueTx(c, "/x/slug-teste", [{ id: "a1", qtd: 2 }, { id: "a3", qtd: 5 }]);
  assert.match(c.calls[0].sql, /SELECT id, cardapio[\s\S]*FOR UPDATE/i); // 1ª query trava a linha
  assert.match(c.calls[1].sql, /UPDATE empresas SET cardapio/i);     // 2ª regrava
  const it = novo.categorias[0].itens;
  assert.equal(it[0].estoque, 1);             // 3 - 2
  assert.equal(it[2].estoque, undefined);     // item ilimitado não muda
});

test("baixarEstoqueTx: item por kg decrementa peso decimal", async () => {
  const c = fakeClient(clone());
  const { cardapio: novo } = await store.baixarEstoqueTx(c, "/x/slug", [{ id: "a2", qtd: "0,5" }]);
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

test("baixarEstoqueTx: grava o movimento de venda na MESMA transação e devolve o id inserido", async () => {
  const c = fakeClient(clone());
  const { movimentoIds } = await store.baixarEstoqueTx(c, "/x/slug-teste", [{ id: "a1", qtd: 2 }], { pedidoId: 7, numero: 12 });
  assert.match(c.calls[0].sql, /SELECT id, cardapio[\s\S]*FOR UPDATE/i);
  assert.match(c.calls[1].sql, /UPDATE empresas SET cardapio/i);
  assert.match(c.calls[2].sql, /INSERT INTO estoque_movimentos/i);
  assert.match(c.calls[2].sql, /RETURNING id/i);
  assert.equal(c.calls[2].params[0], "emp-uuid"); // empresa_id veio do mesmo SELECT
  assert.equal(c.calls[2].params[3], "venda");
  assert.equal(c.calls[2].params[8], 7);          // pedido_id
  assert.deepEqual(movimentoIds, [900]);          // id devolvido pelo RETURNING, repassado por baixarEstoqueTx
});

test("baixarEstoqueTx: item sem controle não gera INSERT", async () => {
  const c = fakeClient(clone());
  await store.baixarEstoqueTx(c, "/x/slug", [{ id: "a3", qtd: 5 }]);
  assert.equal(c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql)).length, 0);
});

// ---- devolverEstoqueTx (Task 7) ----
test("devolverEstoqueTx: soma de volta e grava movimento de devolução", async () => {
  const c = fakeClient(clone());
  const novo = await store.devolverEstoqueTx(c, "/x/slug", [{ id: "a1", qtd: 2 }], { pedidoId: 7, numero: 12 });
  assert.equal(novo.categorias[0].itens[0].estoque, 5); // 3 + 2
  const ins = c.calls.find((q) => /INSERT INTO estoque_movimentos/i.test(q.sql));
  assert.equal(ins.params[3], "devolucao");
  assert.equal(ins.params[4], 2);
});

test("devolverEstoqueTx: item sem controle agora não ganha estoque e não grava nada", async () => {
  const c = fakeClient(clone());
  const novo = await store.devolverEstoqueTx(c, "/x/slug", [{ id: "a3", qtd: 5 }]);
  assert.equal(novo.categorias[0].itens[2].estoque, undefined);
  assert.equal(c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql)).length, 0);
});

// ---- ajustarEstoqueTx (Task 7) ----
test("ajustarEstoqueTx: entrada soma", async () => {
  const c = fakeClient(clone());
  const r = await store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a1", tipo: "entrada", quantidade: 5 });
  assert.equal(r.movimento.saldoDepois, 8);
  assert.equal(r.movimento.quantidade, 5);
});

test("ajustarEstoqueTx: perda maior que o saldo trava em zero", async () => {
  const c = fakeClient(clone());
  const r = await store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a1", tipo: "perda", quantidade: 10 });
  assert.equal(r.movimento.saldoDepois, 0);
  assert.equal(r.movimento.quantidade, -3); // o delta aplicado, não o pedido
});

test("ajustarEstoqueTx: contagem calcula a diferença", async () => {
  const c = fakeClient(clone());
  const r = await store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a1", tipo: "contagem", contado: 7 });
  assert.equal(r.movimento.quantidade, 4); // contou 7, tinha 3
  assert.equal(r.movimento.saldoDepois, 7);
});

test("ajustarEstoqueTx: contagem liga o controle de item ilimitado", async () => {
  const c = fakeClient(clone());
  const r = await store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a3", tipo: "contagem", contado: 12 });
  assert.equal(r.cardapio.categorias[0].itens[2].estoque, 12);
  assert.equal(r.movimento.quantidade, 12);
});

test("ajustarEstoqueTx: contagem igual ao saldo (já controlado) não grava nada", async () => {
  const c = fakeClient(clone());
  const r = await store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a1", tipo: "contagem", contado: 3 });
  assert.equal(r.movimento, null);
  assert.equal(c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql)).length, 0);
  assert.equal(c.calls.filter((q) => /UPDATE empresas SET cardapio/i.test(q.sql)).length, 0);
});

// Correção 2 (Ruling): contagem em item AINDA NÃO controlado liga o controle mesmo
// contando 0 — é assim que o dono zera um produto que esgotou. Persiste o cardápio
// com o saldo, mas não grava movimento (delta zero não é evento).
test("ajustarEstoqueTx: contagem zero em item ilimitado liga o controle em zero e persiste", async () => {
  const c = fakeClient(clone());
  const r = await store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a3", tipo: "contagem", contado: 0 });
  assert.equal(r.movimento, null);
  assert.equal(r.cardapio.categorias[0].itens[2].estoque, 0);
  assert.equal(c.calls.filter((q) => /UPDATE empresas SET cardapio/i.test(q.sql)).length, 1);
  assert.equal(c.calls.filter((q) => /INSERT INTO estoque_movimentos/i.test(q.sql)).length, 0);
});

test("ajustarEstoqueTx: item inexistente falha", async () => {
  const c = fakeClient(clone());
  await assert.rejects(() => store.ajustarEstoqueTx(c, "/x/slug", { itemId: "zzz", tipo: "entrada", quantidade: 1 }), /não encontrado/i);
});

test("ajustarEstoqueTx: tipo desconhecido falha", async () => {
  const c = fakeClient(clone());
  await assert.rejects(() => store.ajustarEstoqueTx(c, "/x/slug", { itemId: "a1", tipo: "sei-la", quantidade: 1 }), /[Tt]ipo/);
});

test("amarrarPedidoTx: carimba só os ids desta transação, nunca um órfão de outra venda", async () => {
  const calls = [];
  const c = { calls, async query(sql, params) { calls.push({ sql, params }); return { rows: [] }; } };
  // [7,8] são os movimentos desta transação; um órfão pré-existente (de outra
  // venda, sem carimbo) NÃO pode ser tocado — a query só pode citar estes ids.
  await store.amarrarPedidoTx(c, [7, 8], 33, 12);
  const q = calls[calls.length - 1];
  assert.match(q.sql, /WHERE id = ANY\(\$3::bigint\[\]\)/i);
  assert.deepEqual(q.params, [33, 12, [7, 8]]);
  assert.doesNotMatch(q.sql, /empresa_id/i);      // não filtra mais por tenant
  assert.doesNotMatch(q.sql, /pedido_id IS NULL/i); // nem por "qualquer órfão"
});
