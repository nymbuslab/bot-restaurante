const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizarGrupos, avaliarComposicao } = require("../public/grupos");

const base = {
  composicao: [
    { nome: "Proteínas", obrigatorio: true, min: 1, max: 1, itens: ["Frango", "Carne"] },
    { nome: "Principais", obrigatorio: true, min: 1, max: 3, itens: ["Arroz", "Feijão", "Sem Feijão"] },
    { nome: "Adicionais", obrigatorio: false, min: 0, max: 2, itens: ["Farofa", "Vinagrete"] },
  ],
};

test("normalizarGrupos: coage tipos e descarta subgrupo sem itens", () => {
  const g = normalizarGrupos([
    { nome: " X ", obrigatorio: 1, min: "2", max: "4", itens: [" a ", "", "b"] },
    { nome: "Vazio", itens: [] },
    "lixo",
  ]);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0], { nome: "X", obrigatorio: true, min: 2, max: 4, itens: ["a", "b"] });
});

test("normalizarGrupos: não-array vira []", () => {
  assert.deepEqual(normalizarGrupos("Principal:\n* Arroz"), []);
  assert.deepEqual(normalizarGrupos(undefined), []);
});

test("avaliarComposicao: seleção válida normaliza e não acusa pendência", () => {
  const r = avaliarComposicao(base, [
    { grupo: "Proteínas", itens: ["Frango"] },
    { grupo: "Principais", itens: ["Arroz", "Feijão"] },
  ]);
  assert.equal(r.valido, true);
  assert.deepEqual(r.pendencias, []);
  assert.deepEqual(r.selecoes, [
    { grupo: "Proteínas", itens: ["Frango"] },
    { grupo: "Principais", itens: ["Arroz", "Feijão"] },
  ]);
});

test("avaliarComposicao: obrigatório sem escolha → inválido", () => {
  const r = avaliarComposicao(base, [{ grupo: "Principais", itens: ["Arroz"] }]);
  assert.equal(r.valido, false);
  assert.match(r.pendencias.join(" "), /Proteínas/);
});

test("avaliarComposicao: acima do máx → inválido", () => {
  const r = avaliarComposicao(base, [
    { grupo: "Proteínas", itens: ["Frango"] },
    { grupo: "Principais", itens: ["Arroz", "Feijão", "Sem Feijão"] },
    { grupo: "Adicionais", itens: ["Farofa", "Vinagrete"] }, // permitido (máx 2)
  ]);
  // Proteínas máx 1, Principais máx 3 → tudo ok aqui
  assert.equal(r.valido, true);
  const r2 = avaliarComposicao(base, [
    { grupo: "Proteínas", itens: ["Frango", "Carne"] }, // máx 1 → estoura
    { grupo: "Principais", itens: ["Arroz"] },
  ]);
  assert.equal(r2.valido, false);
  assert.match(r2.pendencias.join(" "), /Proteínas/);
});

test("avaliarComposicao: item fora do subgrupo é descartado (não conta)", () => {
  const r = avaliarComposicao(base, [
    { grupo: "Proteínas", itens: ["Fantasma"] }, // não existe → vira 0 escolhas
    { grupo: "Principais", itens: ["Arroz"] },
  ]);
  assert.equal(r.valido, false); // Proteínas obrigatória ficou vazia
  assert.match(r.pendencias.join(" "), /Proteínas/);
});

test("avaliarComposicao: dedup e respeita item duplicado uma vez", () => {
  const r = avaliarComposicao(base, [
    { grupo: "Proteínas", itens: ["Frango"] },
    { grupo: "Principais", itens: ["Arroz", "Arroz", "Feijão"] },
  ]);
  assert.equal(r.valido, true);
  assert.deepEqual(r.selecoes.find((s) => s.grupo === "Principais").itens, ["Arroz", "Feijão"]);
});

test("avaliarComposicao: item sem composição → válido e selecoes vazias", () => {
  const r = avaliarComposicao({ nome: "Refri" }, undefined);
  assert.deepEqual(r, { valido: true, selecoes: [], pendencias: [] });
});
