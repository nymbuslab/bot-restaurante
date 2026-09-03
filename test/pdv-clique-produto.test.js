const { test } = require("node:test");
const assert = require("node:assert/strict");
const { criarArnês } = require("./apoio/pdv-modal-harness");

test("cozinha+sem-nada: abre modal de observação (D-01, D-04)", () => {
  const { pdvCart, chamadasModal, simularCliqueTile } = criarArnês();
  simularCliqueTile({ id: "m1", nome: "Marmitex", preco: 15, unidade: "un", cozinha: true, grupos: [], variacoes: [] });
  assert.equal(chamadasModal.length, 1, "deve abrir modal para item de cozinha sem grupo");
  assert.equal(chamadasModal[0].item.id, "m1");
  assert.equal(pdvCart.length, 0, "não deve empilhar direto antes do modal confirmar");
});

test("cozinha+variação-sem-grupo: abre modal de observação (D-02)", () => {
  const { pdvCart, chamadasModal, simularCliqueVariacao } = criarArnês();
  const item = { id: "p1", nome: "PIZZA", preco: 40, unidade: "un", cozinha: true, grupos: [], variacoes: [{ id: "v1", nome: "Pequena", preco: 0 }] };
  simularCliqueVariacao(item, item.variacoes[0]);
  assert.equal(chamadasModal.length, 1, "deve abrir modal para item de cozinha com variação sem grupo");
  assert.equal(chamadasModal[0].item.id, "p1");
  assert.equal(pdvCart.length, 0, "não deve empilhar direto antes do modal confirmar");
});

test("cozinha+grupo: aciona abrirPdvItemModal", () => {
  const { pdvCart, chamadasModal, simularCliqueTile } = criarArnês();
  simularCliqueTile({ id: "c1", nome: "Combo", preco: 25, unidade: "un", cozinha: true, grupos: [{ id: "g1" }], variacoes: [] });
  assert.equal(chamadasModal.length, 1, "deve abrir modal");
  assert.equal(chamadasModal[0].item.id, "c1");
  assert.equal(pdvCart.length, 0, "não deve empilhar direto");
});

test("sem-cozinha+sem-nada: empilha direto no carrinho (sem modal)", () => {
  const { pdvCart, chamadasModal, simularCliqueTile } = criarArnês();
  simularCliqueTile({ id: "b1", nome: "Biscoito", preco: 5, unidade: "un", cozinha: false, grupos: [], variacoes: [] });
  assert.equal(chamadasModal.length, 0, "não deve abrir modal");
  assert.equal(pdvCart.length, 1, "deve criar 1 linha no carrinho");
  assert.equal(pdvCart[0].id, "b1");
});
