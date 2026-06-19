const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PLANO_INFO, planoDoPrice } = require("../src/planos");

const IDS = { essencial: "price_essencial", completo: "price_completo" };

// ---- planoDoPrice ----
test("planoDoPrice: reconhece o preço do Essencial", () => {
  assert.equal(planoDoPrice("price_essencial", IDS), "essencial");
});
test("planoDoPrice: reconhece o preço do Completo", () => {
  assert.equal(planoDoPrice("price_completo", IDS), "completo");
});
test("planoDoPrice: preço desconhecido → null", () => {
  assert.equal(planoDoPrice("price_outro", IDS), null);
});
test("planoDoPrice: sem priceId ou sem ids → null", () => {
  assert.equal(planoDoPrice(null, IDS), null);
  assert.equal(planoDoPrice("", IDS), null);
  assert.equal(planoDoPrice("price_completo", {}), null);
});

// ---- PLANO_INFO ----
test("PLANO_INFO: tem nome e valor dos dois planos", () => {
  assert.equal(PLANO_INFO.essencial.nome, "Plano Essencial");
  assert.equal(PLANO_INFO.essencial.valorMes, 79);
  assert.equal(PLANO_INFO.completo.nome, "Plano Completo");
  assert.equal(PLANO_INFO.completo.valorMes, 99);
});
