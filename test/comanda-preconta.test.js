"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Comanda = require("../public/comanda");

test("pre-conta de comanda usa o rotulo correto e nao inclui taxa", () => {
  const texto = Comanda.montarPreConta(
    { nome: "33" },
    [{ status: "novo", itens: [{ nome: "Cafe", qtd: 1, preco: 3 }] }],
    { rotulo: "Comanda", subtotal: 3, taxaServico: 0, total: 3, quando: "2026-11-12T12:00:00.000Z" },
    { restaurante: { nome: "Loja" } }
  );
  assert.match(texto, /Comanda: 33/);
  assert.doesNotMatch(texto, /Taxa servico/i);
  assert.match(texto, /TOTAL:/);
});
