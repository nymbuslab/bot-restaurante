const { test } = require("node:test");
const assert = require("node:assert/strict");
const { podeVenderAPrazo } = require("../src/fiado");

// ---- podeVenderAPrazo ----
const base = { limiteCredito: 100, bloquearLimite: false, bloquearVencimento: false, liberacaoPontual: false };

test("podeVenderAPrazo: sem bloqueios → libera", () => {
  assert.equal(podeVenderAPrazo(base, 500, 999, true).ok, true);
});
test("podeVenderAPrazo: liberação pontual vence qualquer bloqueio", () => {
  const c = { ...base, bloquearLimite: true, bloquearVencimento: true, liberacaoPontual: true };
  const r = podeVenderAPrazo(c, 999, 999, true);
  assert.equal(r.ok, true);
  assert.equal(r.liberado, true);
});
test("podeVenderAPrazo: bloqueia ao estourar o limite", () => {
  const c = { ...base, bloquearLimite: true };
  const r = podeVenderAPrazo(c, 20, 90, false); // 110 > 100
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "limite");
});
test("podeVenderAPrazo: no limite exato não bloqueia", () => {
  const c = { ...base, bloquearLimite: true };
  assert.equal(podeVenderAPrazo(c, 20, 80, false).ok, true); // 100 == 100
});
test("podeVenderAPrazo: dentro do limite libera", () => {
  const c = { ...base, bloquearLimite: true };
  assert.equal(podeVenderAPrazo(c, 20, 50, false).ok, true);
});
test("podeVenderAPrazo: limite 0 (não configurado) não bloqueia", () => {
  const c = { ...base, limiteCredito: 0, bloquearLimite: true };
  assert.equal(podeVenderAPrazo(c, 50, 0, false).ok, true);
});
test("podeVenderAPrazo: bloqueia por conta vencida", () => {
  const c = { ...base, bloquearVencimento: true };
  const r = podeVenderAPrazo(c, 10, 0, true);
  assert.equal(r.ok, false);
  assert.equal(r.motivo, "vencimento");
});
test("podeVenderAPrazo: vencimento sem venda vencida libera", () => {
  const c = { ...base, bloquearVencimento: true };
  assert.equal(podeVenderAPrazo(c, 10, 0, false).ok, true);
});
test("podeVenderAPrazo: bloqueio desligado ignora venda vencida", () => {
  assert.equal(podeVenderAPrazo(base, 10, 0, true).ok, true);
});
