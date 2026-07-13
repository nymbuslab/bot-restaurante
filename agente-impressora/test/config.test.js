const test = require("node:test");
const assert = require("node:assert");
const { normalizarConfig, DEFAULTS } = require("../main/config");

test("normalizarConfig: vazio devolve os defaults", () => {
  const c = normalizarConfig({});
  assert.equal(c.apiBase, "https://bot-restaurante.fly.dev");
  assert.equal(c.conexao, "rede");
  assert.equal(c.corte, "parcial");
  assert.equal(c.copias, 1);
  assert.deepEqual(c.vias, { cozinha: true, cupom: true });
});

test("normalizarConfig: clampa copias >=1 e conexao invalida vira rede", () => {
  assert.equal(normalizarConfig({ copias: 0 }).copias, 1);
  assert.equal(normalizarConfig({ copias: 99 }).copias, 10);
  assert.equal(normalizarConfig({ conexao: "xpto" }).conexao, "rede");
});

test("normalizarConfig: corte invalido vira parcial; semAcento vira boolean", () => {
  assert.equal(normalizarConfig({ corte: "laser" }).corte, "parcial");
  assert.equal(normalizarConfig({ semAcento: 1 }).semAcento, true);
});

test("normalizarConfig: pelo menos uma via fica ligada (nao deixa imprimir nada)", () => {
  const c = normalizarConfig({ vias: { cozinha: false, cupom: false } });
  assert.equal(c.vias.cozinha || c.vias.cupom, true);
});

test("normalizarConfig: preserva nome/slug (identidade da sessao) e ignora nao-string", () => {
  const c = normalizarConfig({ nome: "Sabor D' Casa", slug: "sabor-d-casa" });
  assert.equal(c.nome, "Sabor D' Casa");
  assert.equal(c.slug, "sabor-d-casa");
  // ausente/invalido vira string vazia (nunca undefined -> UI cai no "Restaurante" so quando vazio de fato)
  assert.equal(normalizarConfig({}).nome, "");
  assert.equal(normalizarConfig({ nome: 123 }).nome, "");
});
