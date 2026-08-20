const { test } = require("node:test");
const assert = require("node:assert/strict");
const Estoque = require("../public/estoque");
const cw = require("../src/cardapio-web");
const pdv = require("../src/pdv");

// ---------------------------------------------------------------------------
// PARIDADE: o que sai do estoque tem que ser o que o pedido registra.
//
// Os recalculadores (`cardapio-web.recalcularItens` e `pdv.recalcularVenda`)
// aplicam TETOS de quantidade — 50 por item no cardápio web, 99 no PDV, 100 kg
// nos itens por peso. A agregação da baixa (`estoque._agregar`) não aplica teto
// nenhum: ela só garante >= 1.
//
// Enquanto a baixa recebia o payload CRU e o pedido gravava o recalculado, as
// duas metades discordavam: `qtd: 60` gravava pedido de 50 e tirava 60 do
// estoque. E como o cancelamento devolve pelo que foi GRAVADO, voltavam 50 — a
// diferença sumia para sempre, sem movimento que a explicasse. Reproduzido ao
// vivo antes da correção: venda -60, devolução +50, saldo 200 -> 190.
//
// Estes testes prendem a regra dos dois lados: a baixa casa com o pedido, e
// baixa mais devolução se anulam.
// ---------------------------------------------------------------------------

const cardapio = {
  categorias: [{ nome: "Bebidas", itens: [
    { id: 2, nome: "Coca", preco: 3, unidade: "un", estoque: 200 },
    { id: 9, nome: "Picanha", preco: 80, unidade: "kg", estoque: 500 },
  ] }],
  grupos: [],
};

// Saldo de um item no cardápio devolvido pelo cálculo.
function saldo(card, id) {
  let s = null;
  (card.categorias || []).forEach((c) => (c.itens || []).forEach((i) => { if (i.id === id) s = i.estoque; }));
  return s;
}

test("cardápio web: acima do teto, a baixa é a quantidade que o pedido grava", () => {
  const r = cw.recalcularItens(cardapio, [{ id: 2, qtd: 60 }]);
  assert.equal(r.itens[0].qtd, 50, "o recálculo limita a 50 por item");

  const baixa = Estoque.calcularBaixa(cardapio, r.itens);
  assert.equal(saldo(baixa.cardapio, 2), 150); // 200 - 50, não 200 - 60
  assert.equal(baixa.movimentos[0].quantidade, -50);
});

test("cardápio web: o payload cru tiraria mais do que o pedido cobra", () => {
  // Guarda a razão de existir da paridade: se alguém voltar a passar `b.itens`
  // para a baixa, é ESTE o número que volta a sair do estoque.
  const cru = Estoque.calcularBaixa(cardapio, [{ id: 2, qtd: 60 }]);
  assert.equal(cru.movimentos[0].quantidade, -60);
  assert.equal(saldo(cru.cardapio, 2), 140);
});

test("PDV: acima do teto de 99, a baixa acompanha o que a venda registra", () => {
  const r = pdv.recalcularVenda(cardapio, [{ id: 2, qtd: 150 }]);
  assert.equal(r.itens[0].qtd, 99);
  const baixa = Estoque.calcularBaixa(cardapio, r.itens);
  assert.equal(baixa.movimentos[0].quantidade, -99);
});

test("item por kg: o teto de 100 vale para a baixa também", () => {
  const r = pdv.recalcularVenda(cardapio, [{ id: 9, qtd: "250,5" }]);
  assert.equal(r.itens[0].qtd, 100);
  const baixa = Estoque.calcularBaixa(cardapio, r.itens);
  assert.equal(baixa.movimentos[0].quantidade, -100);
  assert.equal(saldo(baixa.cardapio, 9), 400);
});

test("baixa e devolução se anulam quando as duas leem os itens gravados", () => {
  // O cancelamento lê `pedidos.itens`, que é o recalculado. Com a baixa lendo o
  // mesmo, cancelar devolve exatamente o que a venda tirou — que é a assimetria
  // permanente que esta fase corrige.
  const gravados = cw.recalcularItens(cardapio, [{ id: 2, qtd: 60 }]).itens;
  const depoisDaVenda = Estoque.calcularBaixa(cardapio, gravados).cardapio;
  const depoisDoCancel = Estoque.calcularDevolucao(depoisDaVenda, gravados).cardapio;
  assert.equal(saldo(depoisDoCancel, 2), saldo(cardapio, 2));
});

test("dentro do teto nada muda: a paridade não altera o caso comum", () => {
  const r = cw.recalcularItens(cardapio, [{ id: 2, qtd: 3 }]);
  assert.equal(r.itens[0].qtd, 3);
  const baixa = Estoque.calcularBaixa(cardapio, r.itens);
  assert.equal(baixa.movimentos[0].quantidade, -3);
  assert.equal(saldo(baixa.cardapio, 2), 197);
});

// ---------------------------------------------------------------------------
// A validação segue a mesma régua da baixa.
//
// `validarEstoque` rodava sobre o payload CRU enquanto a baixa já usava o
// recalculado. Isso nunca perdeu estoque (validava mais do que tirava), mas
// recusava venda que cabia: pedido de 60 com saldo 55 morria na validação,
// embora o recálculo limitasse a 50 e o estoque comportasse os 50.
// ---------------------------------------------------------------------------

const cardapioApertado = {
  categorias: [{ nome: "Bebidas", itens: [
    { id: 2, nome: "Coca", preco: 3, unidade: "un", estoque: 55 },
  ] }],
  grupos: [],
};

test("saldo entre o teto e o pedido: valida pelo recalculado e a venda passa", () => {
  const cru = [{ id: 2, qtd: 60 }];
  assert.equal(Estoque.validarEstoque(cardapioApertado, cru).ok, false); // o que acontecia antes

  const r = cw.recalcularItens(cardapioApertado, cru);
  assert.equal(r.itens[0].qtd, 50);
  assert.equal(Estoque.validarEstoque(cardapioApertado, r.itens).ok, true);
});

test("estoque insuficiente de verdade continua barrando", () => {
  const magro = { categorias: [{ itens: [{ id: 2, nome: "Coca", preco: 3, unidade: "un", estoque: 10 }] }], grupos: [] };
  const r = cw.recalcularItens(magro, [{ id: 2, qtd: 60 }]);
  assert.equal(r.itens[0].qtd, 50);
  const check = Estoque.validarEstoque(magro, r.itens);
  assert.equal(check.ok, false); // 50 não cabe em 10
  assert.match(check.erro, /Coca/);
});

test("PDV: mesma régua com o teto de 99", () => {
  const card = { categorias: [{ itens: [{ id: 2, nome: "Coca", preco: 3, unidade: "un", estoque: 100 }] }], grupos: [] };
  assert.equal(Estoque.validarEstoque(card, [{ id: 2, qtd: 150 }]).ok, false);
  const r = pdv.recalcularVenda(card, [{ id: 2, qtd: 150 }]);
  assert.equal(Estoque.validarEstoque(card, r.itens).ok, true); // 99 cabe em 100
});
