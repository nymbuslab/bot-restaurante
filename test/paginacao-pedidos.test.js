const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { contemTrecho } = require("./apoio/arquivo-estatico");
const { contagemInicial, proximaContagem, temMais } = require("../public/paginacao-pedidos");

test("contagemInicial: mostra o limite inicial quando há pedidos suficientes", () => {
  assert.equal(contagemInicial(100, 30), 30);
});

test("contagemInicial: mostra o total quando é menor que o limite inicial", () => {
  assert.equal(contagemInicial(5, 30), 5);
});

test("proximaContagem: soma o incremento ao atual, limitado ao total", () => {
  assert.equal(proximaContagem(30, 20, 100), 50);
});

test("proximaContagem: nunca ultrapassa o total mesmo perto do fim", () => {
  assert.equal(proximaContagem(90, 20, 100), 100);
});

test("temMais: false quando todos já estão visíveis", () => {
  assert.equal(temMais(100, 100), false);
});

test("temMais: true quando há pedidos além dos visíveis", () => {
  assert.equal(temMais(50, 100), true);
});

test("modulo é dual-mode: expõe window.PaginacaoPedidos no browser", () => {
  const arquivo = path.join(__dirname, "..", "public", "paginacao-pedidos.js");
  assert.ok(fs.existsSync(arquivo), "public/paginacao-pedidos.js deve existir");
  assert.equal(contemTrecho("public/paginacao-pedidos.js", "window.PaginacaoPedidos"), true);
});