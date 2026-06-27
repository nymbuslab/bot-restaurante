const test = require("node:test");
const assert = require("node:assert");
const { tituloPt } = require("../public/texto");

test("tituloPt: capitaliza palavras e mantém conectivos minúsculos", () => {
  assert.equal(tituloPt("pastel de queijo"), "Pastel de Queijo");
  assert.equal(tituloPt("pastel de carne com queijo"), "Pastel de Carne com Queijo");
});

test("tituloPt: normaliza ALL CAPS", () => {
  assert.equal(tituloPt("PASTEL DE FRANGO"), "Pastel de Frango");
});

test("tituloPt: colapsa espaços repetidos e apara as pontas", () => {
  assert.equal(tituloPt("  pastel   de    queijo  "), "Pastel de Queijo");
});

test("tituloPt: preserva o hífen capitalizando cada parte", () => {
  assert.equal(tituloPt("x-tudo"), "X-Tudo");
  assert.equal(tituloPt("coca-cola"), "Coca-Cola");
});

test("tituloPt: 1ª palavra sempre capitalizada, mesmo sendo conectivo", () => {
  assert.equal(tituloPt("de queijo"), "De Queijo");
});

test("tituloPt: medida com dígito no começo fica intacta", () => {
  assert.equal(tituloPt("suco 500ml"), "Suco 500ml");
});

test("tituloPt: vazio/nulo devolve string vazia", () => {
  assert.equal(tituloPt(""), "");
  assert.equal(tituloPt(null), "");
  assert.equal(tituloPt(undefined), "");
});
