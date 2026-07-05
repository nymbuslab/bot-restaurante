const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  precoLinha,
  calcularTotalMesa,
  dividirIgualitario,
} = require("../src/mesas");

test("precoLinha: base + opcionais + variações × qtd", () => {
  const item = { preco: 8, qtd: 2, opcionais: [{ preco: 3.5, qtd: 1 }], variacoes: [] };
  assert.equal(precoLinha(item), 23); // (8 + 3.5) * 2
});

test("calcularTotalMesa: soma pedidos + taxa de serviço 10%", () => {
  const pedidos = [{ total: 40 }, { total: 56 }];
  const r = calcularTotalMesa(pedidos, 10);
  assert.equal(r.subtotal, 96);
  assert.equal(r.taxaServico, 9.6);
  assert.equal(r.total, 105.6);
});

test("calcularTotalMesa: taxa 0 = sem acréscimo", () => {
  const r = calcularTotalMesa([{ total: 50 }], 0);
  assert.equal(r.taxaServico, 0);
  assert.equal(r.total, 50);
});

test("calcularTotalMesa: ignora pedido cancelado", () => {
  const r = calcularTotalMesa([{ total: 30 }, { total: 20, status: "cancelado" }], 0);
  assert.equal(r.subtotal, 30);
});

test("calcularTotalMesa: sem `total`, soma as linhas de itens", () => {
  const pedidos = [{ itens: [{ preco: 10, qtd: 2 }, { preco: 5, qtd: 1 }] }];
  const r = calcularTotalMesa(pedidos, 0);
  assert.equal(r.subtotal, 25);
});

test("dividirIgualitario: 3 pessoas de 100, centavos fecham", () => {
  const r = dividirIgualitario(100, 3);
  assert.equal(r.length, 3);
  assert.equal(r[0].valor, 33.34);
  assert.equal(r[1].valor, 33.33);
  assert.equal(r[2].valor, 33.33);
  const soma = r.reduce((s, p) => s + p.valor, 0);
  assert.equal(Math.round(soma * 100) / 100, 100);
});

test("dividirIgualitario: 1 pessoa = total inteiro", () => {
  const r = dividirIgualitario(72.5, 1);
  assert.equal(r.length, 1);
  assert.equal(r[0].valor, 72.5);
});

test("dividirIgualitario: 30,02 entre 3 → soma fecha no total (centavo distribuído)", () => {
  const r = dividirIgualitario(30.02, 3);
  assert.equal(r.length, 3);
  const soma = Math.round(r.reduce((s, p) => s + p.valor, 0) * 100) / 100;
  assert.equal(soma, 30.02);
  // 10.01, 10.01, 10.00 — o resto (2 centavos) vai para as primeiras pessoas.
  assert.equal(r[0].valor, 10.01);
  assert.equal(r[2].valor, 10.00);
});
