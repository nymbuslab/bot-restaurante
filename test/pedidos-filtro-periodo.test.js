const { test } = require("node:test");
const assert = require("node:assert/strict");
const { intervaloDentroDoLimite } = require("../src/pedidos");

test("intervaloDentroDoLimite: intervalo curto passa", () => {
  assert.equal(intervaloDentroDoLimite("2026-01-01", "2026-01-31"), true);
});
test("intervaloDentroDoLimite: exatamente no teto (366 dias) passa", () => {
  assert.equal(intervaloDentroDoLimite("2025-01-01", "2026-01-02"), true);
});
test("intervaloDentroDoLimite: um dia além do teto não passa", () => {
  assert.equal(intervaloDentroDoLimite("2025-01-01", "2026-01-03"), false);
});
test("intervaloDentroDoLimite: sem `desde` não restringe (só um lado não define intervalo)", () => {
  assert.equal(intervaloDentroDoLimite(undefined, "2026-01-31"), true);
});
test("intervaloDentroDoLimite: sem `até` não restringe", () => {
  assert.equal(intervaloDentroDoLimite("2020-01-01", undefined), true);
});
test("intervaloDentroDoLimite: sem os dois lados não restringe", () => {
  assert.equal(intervaloDentroDoLimite(undefined, undefined), true);
});
test("intervaloDentroDoLimite: teto customizável pelo terceiro argumento", () => {
  assert.equal(intervaloDentroDoLimite("2026-01-01", "2026-04-01", 30), false);
  assert.equal(intervaloDentroDoLimite("2026-01-01", "2026-01-15", 30), true);
});
