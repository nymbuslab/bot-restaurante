const test = require("node:test");
const assert = require("node:assert");
const V = require("../public/variacoes");

test("normalizarVariacoes: coage tipos, descarta sem nome, preserva id", () => {
  const out = V.normalizarVariacoes([
    { id: "a", nome: " Coca ", preco: "6,00", estoque: "12", estoqueMinimo: "2" },
    { id: "b", nome: "Água", preco: 4 },          // sem estoque = ilimitado
    { nome: "", preco: 5 },                          // sem nome → descartado
    "lixo",                                           // não-objeto → ignorado
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { id: "a", nome: "Coca", preco: 6, estoque: 12, estoqueMinimo: 2 });
  assert.deepEqual(out[1], { id: "b", nome: "Água", preco: 4 }); // sem campo estoque
});

test("normalizarVariacoes: não-array vira []", () => {
  assert.deepEqual(V.normalizarVariacoes(undefined), []);
  assert.deepEqual(V.normalizarVariacoes("x"), []);
});

test("normalizarVariacoes: estoqueMinimo é preservado mesmo sem estoque", () => {
  const out = V.normalizarVariacoes([{ id: "a", nome: "Coca", preco: 5, estoqueMinimo: "3" }]);
  assert.deepEqual(out[0], { id: "a", nome: "Coca", preco: 5, estoqueMinimo: 3 });
});

test("precoAPartir: menor preço entre as disponíveis; null sem variações", () => {
  const item = { variacoes: [
    { id: "a", nome: "Coca", preco: 6, estoque: 5 },
    { id: "b", nome: "Suco", preco: 9 },
    { id: "c", nome: "Água", preco: 4, estoque: 0 }, // esgotada → ignorada
  ] };
  assert.equal(V.precoAPartir(item), 6);
  assert.equal(V.precoAPartir({ variacoes: [] }), null);
  assert.equal(V.precoAPartir({}), null);
});

test("todasEsgotadas: só quando todas controladas e zeradas", () => {
  assert.equal(V.todasEsgotadas({ variacoes: [
    { id: "a", nome: "Coca", preco: 6, estoque: 0 },
    { id: "b", nome: "Água", preco: 4, estoque: 0 },
  ] }), true);
  // uma ilimitada → nunca tudo esgotado
  assert.equal(V.todasEsgotadas({ variacoes: [
    { id: "a", nome: "Coca", preco: 6, estoque: 0 },
    { id: "b", nome: "Água", preco: 4 },
  ] }), false);
  assert.equal(V.todasEsgotadas({ variacoes: [] }), false);
});

test("avaliarVariacoes: soma, dedupe por id, clamp qtd", () => {
  const item = { variacoes: [
    { id: "a", nome: "Coca", preco: 6 },
    { id: "b", nome: "Guaraná", preco: 5 },
  ] };
  const r = V.avaliarVariacoes(item, [{ id: "a", qtd: 2 }, { id: "a", qtd: 1 }, { id: "b", qtd: 1 }]);
  assert.equal(r.valido, true);
  assert.equal(r.addUnit, 6 * 3 + 5 * 1); // 23
  assert.equal(r.selecoes.length, 2);
  assert.deepEqual(r.selecoes.find((s) => s.id === "a"), { id: "a", nome: "Coca", preco: 6, qtd: 3 });
});

test("avaliarVariacoes: ignora id desconhecido", () => {
  const item = { variacoes: [{ id: "a", nome: "Coca", preco: 6 }] };
  const r = V.avaliarVariacoes(item, [{ id: "x", qtd: 5 }, { id: "a", qtd: 1 }]);
  assert.equal(r.addUnit, 6);
  assert.equal(r.selecoes.length, 1);
});

test("avaliarVariacoes: item COM variações exige ≥1 escolha", () => {
  const item = { variacoes: [{ id: "a", nome: "Coca", preco: 6 }] };
  const r = V.avaliarVariacoes(item, []);
  assert.equal(r.valido, false);
  assert.deepEqual(r.pendencias, ["Escolha ao menos 1 opção"]);
});

test("avaliarVariacoes: item SEM variações é válido e neutro", () => {
  const r = V.avaliarVariacoes({}, []);
  assert.equal(r.valido, true);
  assert.equal(r.addUnit, 0);
  assert.deepEqual(r.selecoes, []);
});

test("avaliarVariacoes: clampa a quantidade total em 99", () => {
  const item = { variacoes: [{ id: "a", nome: "Coca", preco: 6 }] };
  const r = V.avaliarVariacoes(item, [{ id: "a", qtd: 80 }, { id: "a", qtd: 80 }]);
  assert.equal(r.selecoes[0].qtd, 99);
});
