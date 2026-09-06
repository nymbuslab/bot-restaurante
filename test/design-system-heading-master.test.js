const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

const HTML = path.join(__dirname, "..", "public", "admin-master.html");
const CSS = path.join(__dirname, "..", "public", "style.css");

test("painel master: area autenticada tem 1 h1 e 4 h2.am-titulo", () => {
  const html = fs.readFileSync(HTML, "utf8");

  const ixDireita = html.indexOf("header-direita");
  assert.notEqual(ixDireita, -1, "header-direita nao encontrado");

  const ixHeaderH1 = html.lastIndexOf("<h1>", ixDireita);
  assert.notEqual(ixHeaderH1, -1, "h1 do header autenticado nao encontrado antes de header-direita");

  const doHeader = html.slice(ixHeaderH1);
  const h1s = doHeader.match(/<h1\b/g) || [];
  assert.equal(h1s.length, 1, "a partir do h1 do header autenticado deve haver exatamente 1 <h1>, achou: " + h1s.length);

  const h2Titulos = doHeader.match(/<h2 class="am-titulo"/g) || [];
  assert.equal(h2Titulos.length, 4, "a partir do header autenticado deve haver 4 <h2 class=\"am-titulo\">, achou: " + h2Titulos.length);
});

test("regra .am-titulo declara letter-spacing proprio, independendo da tag", () => {
  const css = fs.readFileSync(CSS, "utf8");
  const bloco = css.match(/\.am-titulo \{([^}]*)\}/);
  assert.ok(bloco, "regra .am-titulo nao encontrada em style.css");
  assert.ok(/letter-spacing/.test(bloco[1]), "a regra .am-titulo deve declarar letter-spacing proprio");
});