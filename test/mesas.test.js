const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  precoLinha,
  calcularTotalMesa,
  dividirIgualitario,
  dividirPorProduto,
  calcularFalta,
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

test("dividirPorProduto: 2 pessoas com itens distintos", () => {
  const pedidos = [
    { id: 1, itens: [{ nome: "X-Burger", preco: 20, qtd: 2 }, { nome: "Cerveja", preco: 10, qtd: 1 }] },
  ];
  const atribuicoes = [
    { pedidoId: 1, itemIndex: 0, pessoa: "Pessoa 1" },
    { pedidoId: 1, itemIndex: 1, pessoa: "Pessoa 2" },
  ];
  const r = dividirPorProduto(pedidos, atribuicoes);
  const p1 = r.find((p) => p.pessoa === "Pessoa 1");
  const p2 = r.find((p) => p.pessoa === "Pessoa 2");
  assert.equal(p1.subtotal, 40);
  assert.equal(p2.subtotal, 10);
});

test("dividirPorProduto: item sem atribuição vai para 'Não atribuído'", () => {
  const pedidos = [{ id: 7, itens: [{ nome: "Batata", preco: 15, qtd: 1 }] }];
  const r = dividirPorProduto(pedidos, []);
  assert.equal(r.length, 1);
  assert.equal(r[0].pessoa, "Não atribuído");
  assert.equal(r[0].subtotal, 15);
});

test("calcularFalta: recebe 50 de 100 → falta 50", () => {
  const r = calcularFalta(100, [{ valor: 50 }]);
  assert.equal(r.recebido, 50);
  assert.equal(r.falta, 50);
  assert.equal(r.troco, 0);
});

test("calcularFalta: recebe o restante → falta 0", () => {
  const r = calcularFalta(100, [{ valor: 50 }, { valor: 50 }]);
  assert.equal(r.falta, 0);
  assert.equal(r.troco, 0);
});

test("calcularFalta: pagou a mais em dinheiro → troco", () => {
  const r = calcularFalta(92, [{ valor: 100 }]);
  assert.equal(r.falta, 0);
  assert.equal(r.troco, 8);
});

test("calcularFalta: sem pagamentos → falta o total", () => {
  const r = calcularFalta(72.5, []);
  assert.equal(r.recebido, 0);
  assert.equal(r.falta, 72.5);
});
