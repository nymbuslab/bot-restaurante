const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resumoCaixa, calcularDiferenca, ehDinheiro } = require("../src/caixa-calc");

const caixa = { fundo_troco: 100 };
const movs = [
  { tipo: "recebimento", forma_pagamento: "Dinheiro", valor: 50 },
  { tipo: "recebimento", forma_pagamento: "dinheiro", valor: 30 }, // case-insensitive
  { tipo: "recebimento", forma_pagamento: "Pix", valor: 20 },
  { tipo: "suprimento", valor: 10 },
  { tipo: "sangria", valor: 25 },
];

test("resumoCaixa: agrega por forma, dinheiro e esperado em espécie", () => {
  const r = resumoCaixa(caixa, movs);
  assert.equal(r.totalRecebido, 100);
  assert.equal(r.recebidoDinheiro, 80);        // 50 + 30
  assert.equal(r.recebidoPorForma["Pix"], 20);
  assert.equal(r.suprimentos, 10);
  assert.equal(r.sangrias, 25);
  // fundo 100 + dinheiro 80 + suprimento 10 − sangria 25 = 165
  assert.equal(r.esperadoEspecie, 165);
});

test("resumoCaixa: caixa sem movimentos = só o fundo", () => {
  const r = resumoCaixa({ fundo_troco: 70 }, []);
  assert.equal(r.totalRecebido, 0);
  assert.equal(r.recebidoDinheiro, 0);
  assert.equal(r.esperadoEspecie, 70);
});

test("calcularDiferenca: sobra/falta/zero", () => {
  assert.equal(calcularDiferenca(165, 170), 5);   // sobra
  assert.equal(calcularDiferenca(165, 160), -5);  // falta
  assert.equal(calcularDiferenca(165, 165), 0);
});

test("ehDinheiro: case-insensitive, ignora espaços", () => {
  assert.equal(ehDinheiro(" Dinheiro "), true);
  assert.equal(ehDinheiro("DINHEIRO"), true);
  assert.equal(ehDinheiro("Pix"), false);
  assert.equal(ehDinheiro(null), false);
});
