const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

const JS = path.join(__dirname, "..", "public", "app.js");

function trechoDaFuncaoAntesDoAwait(txt, cabecalho) {
  const inicio = txt.indexOf(cabecalho);
  assert.notEqual(inicio, -1, "cabecalho nao encontrado: " + cabecalho);
  const awaitIx = txt.indexOf("await api(", inicio);
  assert.notEqual(awaitIx, -1, "await api( nao encontrado apos " + cabecalho);
  return txt.slice(inicio, awaitIx);
}

function verificarCarregando(nome, cabecalho) {
  const txt = fs.readFileSync(JS, "utf8");
  const trecho = trechoDaFuncaoAntesDoAwait(txt, cabecalho);
  assert.ok(trecho.includes("Carregando"), nome + ": texto Carregando nao aparece antes do await api(");
  assert.ok(trecho.includes(".innerHTML"), nome + ": Carregando nao e uma atribuicao de innerHTML");
}

test("carregarPedidos atribui Carregando antes do await api(", () => {
  verificarCarregando("carregarPedidos", "async function carregarPedidos() {");
});

test("carregarPdv atribui Carregando antes do await api(", () => {
  verificarCarregando("carregarPdv", "async function carregarPdv() {");
});

test("carregarMesas atribui Carregando antes do await api(", () => {
  verificarCarregando("carregarMesas", "async function carregarMesas() {");
});

test("carregarCaixa atribui Carregando antes do await api(", () => {
  verificarCarregando("carregarCaixa", "async function carregarCaixa() {");
});