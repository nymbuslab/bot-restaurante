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

test("normalizarGrupos: max < min sobe para o mínimo (subgrupo satisfazível)", () => {
  const g = normalizarGrupos([{ nome: "X", min: 3, max: 1, itens: ["a", "b", "c"] }]);
  assert.equal(g[0].min, 3);
  assert.equal(g[0].max, 3); // 1 < 3 → sobe a 3 (senão nunca dá pra satisfazer)
  const g2 = normalizarGrupos([{ nome: "Y", min: 2, max: 0, itens: ["a"] }]);
  assert.equal(g2[0].max, 0); // max 0 = ilimitado, preservado
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

test("avaliarComposicao: grupo acima do máx não entra em selecoes", () => {
  const r = avaliarComposicao(base, [
    { grupo: "Proteínas", itens: ["Frango", "Carne"] }, // 2 > máx 1
    { grupo: "Principais", itens: ["Arroz"] },
  ]);
  assert.equal(r.valido, false);
  assert.equal(r.selecoes.find((s) => s.grupo === "Proteínas"), undefined);
});

// ---- Biblioteca de grupos (cardapio.grupos) + vínculo do item (item.grupos) ----
const { normalizarBiblioteca, resolverGrupos } = require("../public/grupos");

const biblio = [
  { id: "g1", nome: "Guarnições", padrao: { obrigatorio: true, min: 1, max: 1 },
    opcoes: [{ id: "o1", nome: "Farofa", preco: 0 }, { id: "o2", nome: "Vinagrete", preco: 0 }] },
  { id: "g2", nome: "Adicionais", padrao: { obrigatorio: false, min: 0, max: 0 },
    opcoes: [{ id: "o3", nome: "Bacon", preco: 3 }] },
];

test("normalizarBiblioteca: coage tipos e descarta grupo sem id, sem opções ou não-objeto", () => {
  const b = normalizarBiblioteca([
    { id: "g1", nome: " X ", padrao: { obrigatorio: 1, min: "2", max: "4" },
      opcoes: [{ id: "o1", nome: " a ", preco: "3.5" }, { id: "", nome: "sem id", preco: 1 }, { id: "o2", nome: "", preco: 1 }] },
    { id: "g2", nome: "Vazio", opcoes: [] },
    { nome: "Sem id", opcoes: [{ id: "o9", nome: "x", preco: 0 }] },
    "lixo",
  ]);
  assert.equal(b.length, 1);
  assert.deepEqual(b[0], {
    id: "g1", nome: "X",
    padrao: { obrigatorio: true, min: 2, max: 4 },
    opcoes: [{ id: "o1", nome: "a", preco: 3.5 }],
  });
});

test("normalizarBiblioteca: não-array vira []", () => {
  assert.deepEqual(normalizarBiblioteca(undefined), []);
  assert.deepEqual(normalizarBiblioteca("x"), []);
});

test("normalizarBiblioteca: max < min sobe para o mínimo", () => {
  const b = normalizarBiblioteca([{ id: "g", nome: "G", padrao: { min: 3, max: 1 }, opcoes: [{ id: "o", nome: "a", preco: 0 }] }]);
  assert.equal(b[0].padrao.min, 3);
  assert.equal(b[0].padrao.max, 3);
});

test("resolverGrupos: aplica a regra do item por cima do padrão do grupo, na ordem do item", () => {
  const item = { grupos: [{ id: "g2" }, { id: "g1", obrigatorio: true, min: 3, max: 3 }] };
  const r = resolverGrupos(item, biblio);
  assert.equal(r.length, 2);
  assert.equal(r[0].id, "g2");
  assert.equal(r[0].min, 0);
  assert.equal(r[1].id, "g1");
  assert.deepEqual([r[1].obrigatorio, r[1].min, r[1].max], [true, 3, 3]);
  assert.equal(r[1].opcoes.length, 2);
});

test("resolverGrupos: vínculo órfão é ignorado sem quebrar", () => {
  const r = resolverGrupos({ grupos: [{ id: "nao-existe" }, { id: "g1" }] }, biblio);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "g1");
});

test("resolverGrupos: item sem grupos vira []", () => {
  assert.deepEqual(resolverGrupos({}, biblio), []);
  assert.deepEqual(resolverGrupos({ grupos: "x" }, biblio), []);
});

// ---- Escolhas do cliente contra os grupos resolvidos (saída nos campos legados) ----
const { avaliarEscolhas } = require("../public/grupos");

const resolvidos = [
  { id: "g1", nome: "Guarnições", obrigatorio: true, min: 2, max: 2,
    opcoes: [{ id: "o1", nome: "Farofa", preco: 0 }, { id: "o2", nome: "Vinagrete", preco: 0 }, { id: "o3", nome: "Purê", preco: 0 }] },
  { id: "g2", nome: "Adicionais", obrigatorio: false, min: 0, max: 0,
    opcoes: [{ id: "o4", nome: "Bacon", preco: 3 }, { id: "o5", nome: "Ovo", preco: 2 }] },
];

test("avaliarEscolhas: separa sem custo em composicao e pago em opcionais", () => {
  const r = avaliarEscolhas(resolvidos, [
    { grupo: "g1", opcoes: ["o1", "o2"] },
    { grupo: "g2", opcoes: ["o4"] },
  ]);
  assert.equal(r.valido, true);
  assert.equal(r.addUnit, 3);
  assert.deepEqual(r.composicao, [{ grupo: "Guarnições", itens: ["Farofa", "Vinagrete"] }]);
  assert.deepEqual(r.opcionais, [{ nome: "Bacon", preco: 3, qtd: 1 }]);
});

test("avaliarEscolhas: abaixo do mínimo gera pendência e invalida", () => {
  const r = avaliarEscolhas(resolvidos, [{ grupo: "g1", opcoes: ["o1"] }]);
  assert.equal(r.valido, false);
  assert.match(r.pendencias[0], /Guarnições/);
});

test("avaliarEscolhas: acima do máximo invalida", () => {
  const r = avaliarEscolhas(resolvidos, [{ grupo: "g1", opcoes: ["o1", "o2", "o3"] }]);
  assert.equal(r.valido, false);
  assert.match(r.pendencias[0], /no máximo 2/);
});

test("avaliarEscolhas: max 0 significa sem limite", () => {
  const r = avaliarEscolhas(resolvidos, [
    { grupo: "g1", opcoes: ["o1", "o2"] },
    { grupo: "g2", opcoes: ["o4", "o5"] },
  ]);
  assert.equal(r.valido, true);
  assert.equal(r.addUnit, 5);
});

test("avaliarEscolhas: opção de outro grupo, id inexistente e duplicata são descartados", () => {
  const r = avaliarEscolhas(resolvidos, [
    { grupo: "g1", opcoes: ["o1", "o1", "o4", "xx", "o2"] },
  ]);
  assert.equal(r.valido, true);
  assert.deepEqual(r.composicao, [{ grupo: "Guarnições", itens: ["Farofa", "Vinagrete"] }]);
  assert.equal(r.addUnit, 0);
});

test("avaliarEscolhas: grupo opcional sem escolha não entra na saída", () => {
  const r = avaliarEscolhas(resolvidos, [{ grupo: "g1", opcoes: ["o1", "o2"] }]);
  assert.equal(r.valido, true);
  assert.deepEqual(r.opcionais, []);
});
