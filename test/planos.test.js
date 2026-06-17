// Env ANTES do require: o mapa reverso price→plano é montado no load do módulo.
process.env.STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "price_bot_test";
process.env.STRIPE_PRICE_ID_DIGITAL = process.env.STRIPE_PRICE_ID_DIGITAL || "price_digital_test";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const planos = require("../src/planos");

test("get: chave conhecida retorna o plano certo", () => {
  assert.equal(planos.get("bot").chave, "bot");
  assert.equal(planos.get("digital").chave, "digital");
});

test("get: chave desconhecida/ausente cai no padrão (bot)", () => {
  assert.equal(planos.get("xyz").chave, "bot");
  assert.equal(planos.get(undefined).chave, "bot");
  assert.equal(planos.get(null).chave, "bot");
});

test("planoPadrao é 'bot'", () => {
  assert.equal(planos.planoPadrao(), "bot");
});

test("temFeature: bot só tem bot; digital tem bot + cardapioDigital", () => {
  assert.equal(planos.temFeature("bot", "bot"), true);
  assert.equal(planos.temFeature("bot", "cardapioDigital"), false);
  assert.equal(planos.temFeature("digital", "bot"), true);
  assert.equal(planos.temFeature("digital", "cardapioDigital"), true);
});

test("temFeature: plano desconhecido mantém o bot (fallback), sem digital", () => {
  assert.equal(planos.temFeature("xyz", "bot"), true);
  assert.equal(planos.temFeature("xyz", "cardapioDigital"), false);
});

test("planoPorPriceId: resolve a chave pelo price; null se não mapeado/ vazio", () => {
  assert.equal(planos.planoPorPriceId("price_bot_test"), "bot");
  assert.equal(planos.planoPorPriceId("price_digital_test"), "digital");
  assert.equal(planos.planoPorPriceId("price_inexistente"), null);
  assert.equal(planos.planoPorPriceId(""), null);
  assert.equal(planos.planoPorPriceId(undefined), null);
});

test("priceIdDe: devolve o Stripe Price do plano", () => {
  assert.equal(planos.priceIdDe("bot"), "price_bot_test");
  assert.equal(planos.priceIdDe("digital"), "price_digital_test");
});

test("publico: lista planos vendáveis sem expor stripePriceId", () => {
  const pub = planos.publico();
  const chaves = pub.map((p) => p.chave);
  assert.ok(chaves.includes("bot") && chaves.includes("digital"));
  assert.ok(pub.every((p) => !("stripePriceId" in p)));
  assert.ok(pub.every((p) => p.nome && p.precoLabel && p.features));
});
