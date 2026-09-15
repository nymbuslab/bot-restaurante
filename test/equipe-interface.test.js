const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "public", "admin.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "style.css"), "utf8");

test("a tela de equipe possui carregamento, vazio, erro, lista e editor acessível", () => {
  for (const id of [
    "aba-equipe",
    "equipeCarregando",
    "equipeVazio",
    "equipeErro",
    "equipeLista",
    "equipeGaveta",
    "equipeForm",
  ]) assert.match(html, new RegExp(`id=["']${id}["']`), `faltou #${id}`);
  assert.match(html, /aria-modal=["']true["']/);
  assert.match(html, /aria-live=["']polite["']/);
});

test("troca de operador usa PIN numérico e sessão opaca sem persistir no localStorage", () => {
  assert.match(html, /id=["']equipePin["'][^>]*inputmode=["']numeric["']/);
  assert.match(app, /sessionStorage\.getItem\(["']equipeSessao["']\)/);
  assert.doesNotMatch(app, /localStorage\.setItem\(["']equipeSessao["']/);
  assert.match(html, /src=["']equipe\.js["']/);
});

test("controles de equipe mantêm alvo mínimo de 44 px e layout mobile", () => {
  assert.match(css, /\.equipe-[^{]+\{[^}]*min-height:\s*44px/s);
  assert.match(css, /@media\s*\(max-width:\s*700px\)[\s\S]*\.equipe-/);
});
