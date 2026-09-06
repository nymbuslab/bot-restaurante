const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { contemTrecho, trechoEntre } = require("./apoio/arquivo-estatico");

const APP = path.join(__dirname, "..", "public", "app.js");
const MASTER = path.join(__dirname, "..", "public", "admin-master.html");

test("contemTrecho encontra trecho presente em admin-master.html (aria-label Fechar)", () => {
  const presente = contemTrecho(MASTER, 'id="am-t-fechar" aria-label="Fechar"');
  assert.equal(presente, true);
});

test("contemTrecho retorna false para trecho ausente", () => {
  const ausente = contemTrecho(APP, "trechoQueNaoExisteEmLugarAlgum___");
  assert.equal(ausente, false);
});

test("trechoEntre isola o corpo de painelCarregando usando a funcao e o proximo function como marcadores", () => {
  const inicio = "function painelCarregando(";
  const fim = "\nasync function atualizarStatus(";
  const trecho = trechoEntre(APP, inicio, fim);
  assert.notEqual(trecho, null);
  assert.ok(trecho.includes("conexao-estado"));
  assert.ok(trecho.includes("painelCarregando(txt)"));
  assert.ok(!trecho.includes("atualizarStatus"));
});

test("trechoEntre retorna null com marcadores na ordem errada", () => {
  const inicio = "\nfunction atualizarStatus(";
  const fim = "function painelCarregando(";
  const trecho = trechoEntre(APP, inicio, fim);
  assert.equal(trecho, null);
});

test("trechoEntre retorna null com marcadores ausentes", () => {
  const trecho = trechoEntre(APP, "functionNaoExiste(", "\nfunctionTambemNaoExiste(");
  assert.equal(trecho, null);
});
