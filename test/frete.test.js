const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  calcularDistanciaKm, encontrarFaixa, montarEnderecoCompleto, freteDeConfig, calcularFreteRaio,
} = require("../src/frete");

// ---- calcularDistanciaKm (Haversine) ----
test("calcularDistanciaKm: mesmo ponto = 0", () => {
  assert.equal(calcularDistanciaKm(-23.56, -46.65, -23.56, -46.65), 0);
});
test("calcularDistanciaKm: distância conhecida (~aprox)", () => {
  // Av. Paulista (-23.5616,-46.6557) → Praça da Sé (-23.5505,-46.6333): ~2.5 km
  const d = calcularDistanciaKm(-23.5616, -46.6557, -23.5505, -46.6333);
  assert.ok(d > 2 && d < 3, `esperava ~2.5km, veio ${d}`);
});

// ---- encontrarFaixa ----
const FAIXAS = [{ ini: 0, fim: 2, valor: 5 }, { ini: 2, fim: 4, valor: 8 }, { ini: 4, fim: 6, valor: 12 }];
test("encontrarFaixa: dentro de uma faixa", () => {
  assert.equal(encontrarFaixa(1.5, FAIXAS).valor, 5);
  assert.equal(encontrarFaixa(3, FAIXAS).valor, 8);
});
test("encontrarFaixa: borda inclui o limite", () => {
  assert.equal(encontrarFaixa(0, FAIXAS).valor, 5);
  assert.equal(encontrarFaixa(6, FAIXAS).valor, 12);
});
test("encontrarFaixa: fora de todas → null", () => {
  assert.equal(encontrarFaixa(9, FAIXAS), null);
  assert.equal(encontrarFaixa(1, []), null);
  assert.equal(encontrarFaixa(1, null), null);
});

// ---- montarEnderecoCompleto ----
test("montarEnderecoCompleto: junta campos + Brasil, pula vazios", () => {
  assert.equal(
    montarEnderecoCompleto({ logradouro: "Rua X", numero: "10", bairro: "", cidade: "SP", uf: "SP" }),
    "Rua X, 10, SP, SP, Brasil"
  );
});

// ---- freteDeConfig (normalizador + compat) ----
test("freteDeConfig: legado taxaEntrega vira modo fixo", () => {
  const f = freteDeConfig({ atendimento: { taxaEntrega: 7.5 } });
  assert.equal(f.modo, "fixo");
  assert.equal(f.taxaFixa, 7.5);
});
test("freteDeConfig: bloco frete raio normalizado", () => {
  const f = freteDeConfig({ frete: { modo: "raio", raio: { faixas: [{ ini: 0, fim: 2, valor: 5 }] } } });
  assert.equal(f.modo, "raio");
  assert.equal(f.raio.faixas.length, 1);
  assert.equal(f.raio.foraDaArea, "retirada"); // default
});

// ---- calcularFreteRaio ----
test("calcularFreteRaio: dentro do raio devolve valor", () => {
  const r = calcularFreteRaio({ lat: -23.56, lon: -46.65 }, { lat: -23.565, lon: -46.655 }, FAIXAS);
  assert.equal(r.entrega_disponivel, true);
  assert.ok(r.valor_frete > 0);
});
test("calcularFreteRaio: fora do raio → indisponível", () => {
  const r = calcularFreteRaio({ lat: -23.56, lon: -46.65 }, { lat: -22.0, lon: -45.0 }, FAIXAS);
  assert.equal(r.entrega_disponivel, false);
  assert.equal(r.valor_frete, null);
});
test("calcularFreteRaio: sem coordenadas → indisponível", () => {
  assert.equal(calcularFreteRaio(null, { lat: 1, lon: 1 }, FAIXAS).entrega_disponivel, false);
});
