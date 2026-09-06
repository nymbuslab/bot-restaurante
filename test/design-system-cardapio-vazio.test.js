const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

const JS = path.join(__dirname, "..", "public", "app.js");

function corpoDaFuncao(txt, cabecalho) {
  const inicio = txt.indexOf(cabecalho);
  assert.notEqual(inicio, -1, "cabecalho nao encontrado: " + cabecalho);
  const fim = txt.indexOf("\n}", inicio);
  assert.notEqual(fim, -1, "fechamento nao encontrado para: " + cabecalho);
  return txt.slice(inicio, fim + 2);
}

test("renderCardapio: categorias vazias gravam estado-vazio com CTA para Categorias", () => {
  const js = fs.readFileSync(JS, "utf8");
  const corpo = corpoDaFuncao(js, "function renderCardapio() {");

  const bloco = corpo.match(
    /if \(![^{]*cardapioAtual\.categorias(\.length === 0|\.length < 1|\.length <= 0)?[^{]*\) \{\s*([A-Za-z_$][\w$]*\.innerHTML =[^;]*)/
  );
  assert.ok(bloco, "renderCardapio deve ter um if que testa cardapioAtual.categorias vazias e grava innerHTML");

  const conteudo = bloco[2];
  assert.ok(/estado-vazio/.test(conteudo), "bloco vazio deve usar a classe estado-vazio");
  assert.ok(/(categorias|Categorias)/.test(conteudo), "estado vazio deve ter CTA que leva para Categorias");
});