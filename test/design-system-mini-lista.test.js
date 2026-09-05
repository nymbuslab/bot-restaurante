const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

const JS = path.join(__dirname, "..", "public", "app.js");
const CSS = path.join(__dirname, "..", "public", "style.css");

const ALTURA_MIN = 36;

test("style.css declara button.mini-lista com altura de toque >= 36px", () => {
  const css = fs.readFileSync(CSS, "utf8");
  const bloco = css.match(/button\.mini-lista\b[^{]*\{([^}]*)\}/);
  assert.ok(bloco, "button.mini-lista nao encontrado em style.css");
  const corpo = bloco[1];
  assert.ok(/min-height:\s*36px/.test(corpo) || /padding:\s*[89]px/.test(corpo),
    "mini-lista deve declarar min-height>=36px (ou padding vertical suficiente), corpo: " + corpo);
});

test("os 3 botoes de acao de item do cardapio usam mini-lista", () => {
  const js = fs.readFileSync(JS, "utf8");
  assert.ok(/class="mini mini-lista" data-restore-item="/.test(js), "botao restaurar deve usar mini mini-lista");
  assert.ok(/class="mini mini-lista" data-edit-item="/.test(js), "botao editar deve usar mini mini-lista");
  assert.ok(/class="perigo mini mini-lista" data-del-item="/.test(js), "botao excluir deve usar mini mini-lista");
});

test("outros botoes com classe mini (fora os 3 de acao) nao foram convertidos", () => {
  const js = fs.readFileSync(JS, "utf8");
  const outros = js.match(/class="[^"]*\bmini\b(?!-lista)[^"]*" (?!data-(restore|edit|del)-item)/g) || [];
  assert.ok(outros.length >= 1, "deve restar usos de .mini fora dos 3 botoes de acao, achou: " + outros.length);
});