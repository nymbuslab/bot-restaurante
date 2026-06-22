const test = require("node:test");
const assert = require("node:assert");
const { normalizarTexto, itemCasaBusca } = require("../public/busca");

test("normalizarTexto: minúsculas, sem acento e com trim", () => {
  assert.equal(normalizarTexto("Café"), "cafe");
  assert.equal(normalizarTexto("  MARMITA  "), "marmita");
  assert.equal(normalizarTexto("Açaí"), "acai");
});

test("normalizarTexto: entrada nula vira string vazia", () => {
  assert.equal(normalizarTexto(null), "");
  assert.equal(normalizarTexto(undefined), "");
});

test("itemCasaBusca: substring sem acento e case-insensitive", () => {
  assert.equal(itemCasaBusca("Café com leite", "cafe"), true);
  assert.equal(itemCasaBusca("Marmitex P", "MAR"), true);
  assert.equal(itemCasaBusca("Coca lata", "pizza"), false);
});

test("itemCasaBusca: termo vazio casa com tudo", () => {
  assert.equal(itemCasaBusca("Pizza", ""), true);
});

test("itemCasaBusca: nome vazio/nulo não casa com termo não-vazio", () => {
  assert.equal(itemCasaBusca("", "x"), false);
  assert.equal(itemCasaBusca(null, "x"), false);
});
