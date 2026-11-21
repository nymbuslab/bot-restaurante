"use strict";

function comandaAberta(patch) {
  return Object.assign({
    id: 33,
    numero: 33,
    status: "novo",
    origem: "pdv",
    tipoEntrega: "Comanda",
    cliente: "Balcão",
    criadoEm: "2026-11-10T17:36:00.000Z",
    recebidoEm: null,
    itens: [{ id: 201, nome: "Café expresso", qtd: 1, preco: 3, opcionais: [], variacoes: [] }],
    total: 3,
  }, patch || {});
}

function estadoOperacional(patch) {
  return Object.assign({
    caixa: null,
    caixaAberto: false,
    caixaVencido: false,
    permissoes: {
      ver: true,
      acrescentar: true,
      imprimir: true,
      receber: false,
      cancelar: false,
    },
  }, patch || {});
}

module.exports = { comandaAberta, estadoOperacional };
