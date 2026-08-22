const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  calcularDistanciaKm, encontrarFaixa, montarEnderecoCompleto, freteDeConfig, calcularFreteRaio,
  normalizarNome, encontrarBairro, resolverFreteBairro,
} = require("../src/frete");
const frete = require("../src/frete");

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

// ---- normalizarNome ----
test("normalizarNome: remove acento, caixa e espaços duplicados", () => {
  assert.equal(normalizarNome("  Jardim  AMÉRICA "), "jardim america");
  assert.equal(normalizarNome("São João"), "sao joao");
});

// ---- encontrarBairro ----
const BAIRROS = [{ nome: "Centro", valor: 5 }, { nome: "Jardim América", valor: 8 }];
test("encontrarBairro: match exato ignora acento/caixa/espaço", () => {
  assert.deepEqual(encontrarBairro("centro", BAIRROS), { nome: "Centro", valor: 5 });
  assert.deepEqual(encontrarBairro(" jardim  america ", BAIRROS), { nome: "Jardim América", valor: 8 });
});
test("encontrarBairro: sem match / vazio / lista vazia → null", () => {
  assert.equal(encontrarBairro("Vila Santa Rosa", BAIRROS), null);
  assert.equal(encontrarBairro("", BAIRROS), null);
  assert.equal(encontrarBairro("Centro", []), null);
  assert.equal(encontrarBairro("Centro", null), null);
});

// ---- resolverFreteBairro ----
test("resolverFreteBairro: casa → disponível + valor + foraDaArea da config", () => {
  const f = freteDeConfig({ frete: { modo: "bairro", bairro: { faixas: BAIRROS, foraDaArea: "bloqueia" } } });
  const r = resolverFreteBairro(f, "CENTRO");
  assert.equal(r.entrega_disponivel, true);
  assert.equal(r.valor_frete, 5);
  assert.equal(r.bairro, "Centro");
  assert.equal(r.foraDaArea, "bloqueia");
});
test("resolverFreteBairro: não casa → indisponível + foraDaArea default", () => {
  const f = freteDeConfig({ frete: { modo: "bairro", bairro: { faixas: BAIRROS } } });
  const r = resolverFreteBairro(f, "Outro Bairro");
  assert.equal(r.entrega_disponivel, false);
  assert.equal(r.valor_frete, null);
  assert.equal(r.foraDaArea, "retirada");
});

// ---- freteDeConfig: bloco bairro ----
test("freteDeConfig: bloco bairro normalizado (descarta linha sem nome)", () => {
  const f = freteDeConfig({ frete: { modo: "bairro", bairro: { faixas: [{ nome: "Centro", valor: 5 }, { valor: 9 }] } } });
  assert.equal(f.modo, "bairro");
  assert.equal(f.bairro.faixas.length, 1);
  assert.equal(f.bairro.faixas[0].nome, "Centro");
  assert.equal(f.bairro.foraDaArea, "retirada");
});

// ---------------------------------------------------------------------------
// Bairro do frete: o CEP manda, o digitado é rede de segurança.
//
// No modo raio o servidor geocodifica o CEP e não dá para mentir. No modo
// bairro ele aceitava o campo de texto livre do checkout, com duas consequências:
// dava para escolher um bairro mais barato, e quem digitava uma variação do nome
// ("Pq das Gaivotas") ouvia "Não atendemos seu bairro" e era empurrado para
// Retirada sem entender por quê — o match é exato depois de normalizar.
//
// A ordem resolve os dois: tenta primeiro o nome que a base do CEP devolve e,
// só se não casar, o que a pessoa digitou. O fallback garante que nada que
// funciona hoje pare de funcionar (base de CEP desatualizada, área nova).
// ---------------------------------------------------------------------------

const cfgBairro = { modo: "bairro", bairro: { foraDaArea: "retirada", faixas: [
  { nome: "Parque das Gaivotas", valor: 12 },
  { nome: "Centro", valor: 5 },
] } };

test("resolverFreteBairroEntre: o bairro do CEP ganha do digitado", () => {
  const r = frete.resolverFreteBairroEntre(cfgBairro, ["Parque das Gaivotas", "Centro"]);
  assert.equal(r.entrega_disponivel, true);
  assert.equal(r.valor_frete, 12, "quem escolhe é o CEP, não o campo de texto");
});

test("resolverFreteBairroEntre: cai no digitado quando o CEP não casa", () => {
  const r = frete.resolverFreteBairroEntre(cfgBairro, ["Jardim Inexistente", "Centro"]);
  assert.equal(r.entrega_disponivel, true);
  assert.equal(r.valor_frete, 5);
});

test("resolverFreteBairroEntre: ignora candidato vazio e segue para o próximo", () => {
  const r = frete.resolverFreteBairroEntre(cfgBairro, ["", null, undefined, "Centro"]);
  assert.equal(r.entrega_disponivel, true);
  assert.equal(r.valor_frete, 5);
});

test("resolverFreteBairroEntre: nenhum candidato casa → não atende, com a política de fora da área", () => {
  const r = frete.resolverFreteBairroEntre(cfgBairro, ["Marte", "Vênus"]);
  assert.equal(r.entrega_disponivel, false);
  assert.equal(r.foraDaArea, "retirada");
});

test("resolverFreteBairroEntre: sem candidato nenhum não quebra", () => {
  assert.equal(frete.resolverFreteBairroEntre(cfgBairro, []).entrega_disponivel, false);
  assert.equal(frete.resolverFreteBairroEntre(cfgBairro, null).entrega_disponivel, false);
});

test("resolverFreteBairroEntre: continua tolerando acento e caixa, como o match de sempre", () => {
  const r = frete.resolverFreteBairroEntre(cfgBairro, ["PARQUE DAS GAIVOTAS"]);
  assert.equal(r.valor_frete, 12);
});
