"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { comandaAberta, estadoOperacional } = require("./fixtures/comandas");

test("fixture de comanda aberta preserva o contrato de pedido do PDV", () => {
  const comanda = comandaAberta();
  assert.equal(comanda.origem, "pdv");
  assert.equal(comanda.tipoEntrega, "Comanda");
  assert.equal(comanda.recebidoEm, null);
  assert.equal(comanda.status, "novo");
});

test("fixture operacional separa visibilidade das permissoes financeiras", () => {
  const estado = estadoOperacional();
  assert.equal(estado.permissoes.ver, true);
  assert.equal(estado.permissoes.imprimir, true);
  assert.equal(estado.permissoes.acrescentar, true);
  assert.equal(estado.permissoes.receber, false);
  assert.equal(estado.caixaAberto, false);
});
