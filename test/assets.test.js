const { test } = require("node:test");
const assert = require("node:assert/strict");
const { injetarVersao } = require("../src/assets");

test("injetarVersao: versiona css/js locais (relativo e root-relative)", () => {
  const html = '<link rel="stylesheet" href="style.css" /><script src="/app.js"></script>';
  const out = injetarVersao(html, "abc123");
  assert.ok(out.includes('href="style.css?v=abc123"'), out);
  assert.ok(out.includes('src="/app.js?v=abc123"'), out);
});

test("injetarVersao: não toca em URL externa", () => {
  const html = '<link href="https://fonts.googleapis.com/x.css" /><script src="//cdn/x.js"></script>';
  const out = injetarVersao(html, "abc123");
  assert.ok(out.includes('href="https://fonts.googleapis.com/x.css"'), out);
  assert.ok(out.includes('src="//cdn/x.js"'), out);
  assert.ok(!out.includes("?v="), out);
});

test("injetarVersao: substitui query existente (idempotente entre deploys)", () => {
  assert.equal(
    injetarVersao('<script src="app.js?v=old"></script>', "new"),
    '<script src="app.js?v=new"></script>'
  );
});

test("injetarVersao: não versiona links de página (.html)", () => {
  const html = '<a href="/privacidade.html">Privacidade</a>';
  assert.equal(injetarVersao(html, "x"), html);
});

test("injetarVersao: sem versão retorna o html intacto", () => {
  assert.equal(injetarVersao('<link href="a.css">', ""), '<link href="a.css">');
});
