const { test } = require("node:test");
const assert = require("node:assert/strict");
const sessoes = require("../src/sessoes");

const MIN = 60 * 1000;

// limparExpiradas aceita `agora` injetável → dá pra simular passagem de tempo
// sem mexer no relógio real. getSessao carimba atualizadoEm = Date.now() real.

test("limparExpiradas: não remove sessão dentro da janela (30min)", () => {
  sessoes.limparExpiradas(Date.now() + 999 * MIN); // zera resíduo de outros testes
  const s = sessoes.getSessao("k-janela");
  const T0 = s.atualizadoEm;
  assert.equal(sessoes.limparExpiradas(T0 + 10 * MIN), 0); // 10min < 30min → fica
});

test("limparExpiradas: remove sessões inativas além de 30min", () => {
  sessoes.limparExpiradas(Date.now() + 999 * MIN); // estado limpo
  sessoes.getSessao("k-velha-1");
  sessoes.getSessao("k-velha-2");
  const T0 = Date.now();
  assert.equal(sessoes.limparExpiradas(T0 + 31 * MIN), 2); // as duas expiram
  assert.equal(sessoes.limparExpiradas(T0 + 31 * MIN), 0); // já removidas → 0
});

test("limparExpiradas: getSessao recria sessão zerada após a varredura", () => {
  sessoes.limparExpiradas(Date.now() + 999 * MIN);
  const s1 = sessoes.getSessao("k-recria");
  s1.estado = "ATENDENTE";
  sessoes.limparExpiradas(Date.now() + 31 * MIN); // remove
  const s2 = sessoes.getSessao("k-recria");       // recria do zero
  assert.equal(s2.estado, "INICIO");
  assert.equal(s2.saudou, false);
});
