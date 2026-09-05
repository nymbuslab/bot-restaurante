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

test("renderCardapio: busca sem resultado usa estado-vazio e cardapio-vazio-busca foi removido", () => {
  const js = fs.readFileSync(JS, "utf8");
  assert.ok(!/\bcardapio-vazio-busca\b/.test(js), "a string cardapio-vazio-busca nao pode mais existir em app.js");

  const corpo = corpoDaFuncao(js, "function renderCardapio() {");
  const branch = corpo.match(/if \(termo && totalMostrado === 0\) \{([^}]+)\}/);
  assert.ok(branch, "branch de busca sem resultado nao encontrada em renderCardapio");
  assert.ok(/estado-vazio/.test(branch[1]), "branch de busca sem resultado deve usar a classe estado-vazio");
  assert.ok(/nenhum item|Nenhum item|nenhum/i.test(branch[1]), "branch deve manter a mensagem de nenhum item encontrado");
});