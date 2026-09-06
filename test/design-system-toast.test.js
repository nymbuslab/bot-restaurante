const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { contemTrecho, trechoEntre } = require("./apoio/arquivo-estatico");

const APP = path.join(__dirname, "..", "public", "app.js");
const ADMIN = path.join(__dirname, "..", "public", "admin.html");

test("admin.html define aria-live=polite no #toast-container", () => {
  const presente = contemTrecho(ADMIN, '<div id="toast-container"');
  assert.equal(presente, true);
  const ariaLive = contemTrecho(ADMIN, 'id="toast-container" aria-live="polite"');
  assert.equal(ariaLive, true);
});

test("toast() define role=alert dentro do branch tipo === erro", () => {
  const corpo = trechoEntre(APP, "function toast(", "\n// Mantém compatibilidade");
  assert.notEqual(corpo, null, "corpo de toast() não encontrado");

  const iErro = corpo.indexOf('tipo === "erro"');
  assert.ok(iErro > -1, "branch tipo === erro não encontrado");

  const iAlerta = corpo.indexOf('setAttribute("role", "alert")');
  assert.ok(iAlerta > -1, "role=alert não encontrado no corpo de toast()");
  assert.ok(iAlerta > iErro, "role=alert deve estar DENTRO do branch tipo === erro");
});
