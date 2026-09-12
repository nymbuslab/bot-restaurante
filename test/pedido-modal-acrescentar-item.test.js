"use strict";
// T-03.03 — Botão "Acrescentar item" no modal do pedido (reabre o PDV em modo
// comanda para acrescentar itens ao pedido em aberto).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

function extrairAbridor(src) {
  const inicio = src.indexOf("function abrirModalPedido(p) {");
  const fim = src.indexOf("// ---- Avisar cliente ----");
  assert.ok(inicio > -1, "funcao abrirModalPedido nao encontrada em public/app.js");
  assert.ok(fim > inicio, "marcador '// ---- Avisar cliente ----' nao encontrado");
  return src.slice(inicio, fim);
}

function pedidoBase() {
  return {
    id: 42,
    numero: 7,
    tipoEntrega: "Comanda",
    status: "pendente",
    recebidoEm: null,
    criadoEm: "2026-09-10T10:00:00.000Z",
    cliente: "Maria",
    telefone: "11990000000",
    total: 34,
    taxaEntrega: 0,
    trocoPara: 0,
    origem: "pdv",
    avisadoEm: null,
    chatId: "",
    itens: [
      { nome: "Parmegiana", preco: 15, qtd: 2, opcionais: [], variacoes: [], observacao: "" },
    ],
  };
}

function monteHarness(pedido) {
  const capturados = [];
  const chamadas = { fechar: 0, modoAtivar: [] };
  const btnAdd = {
    addEventListener(ev, fn) { capturados.push({ ev, fn }); },
  };
  const corpo = {
    innerHTML: "",
    querySelector(sel) { return sel === "#btn-acrescentar-item" ? btnAdd : null; },
    querySelectorAll() { return []; },
  };
  const overlay = {
    style: {},
    classList: { add() {}, remove() {} },
    addEventListener() {},
  };
  const ctx = {
    $: (id) => {
      switch (id) {
        case "btnImprimirPedido": return { hidden: false };
        case "pedido-numero": return { textContent: "" };
        case "pedido-quando": return { textContent: "" };
        case "pedido-detalhe-corpo": return corpo;
        case "pedido-overlay": return overlay;
        default: return null;
      }
    },
    moedaBR: (v) => String(v),
    escapar: (s) => s,
    tagTipo: () => "Comanda",
    tipoPedido: () => "Local",
    telefoneFmt: () => "(11) 90000-0000",
    textoPagamento: () => "Dinheiro",
    configAtual: { restaurante: { endereco: "Rua das Flores, 10" } },
    planoAtual: "completo",
    marcarImprBloqueado: () => {},
    ICO_USER: "u",
    ICO_LOCAL: "l",
    ICO_PAG: "p",
    ICO_LIXEIRA: "x",
    pedidoModalAtual: null,
    montarAcoes: () => {},
    fecharModalPedido: () => { chamadas.fechar++; },
    pedidoModoAtivar: (d) => { chamadas.modoAtivar.push(d); },
    toast: () => {},
    api: async () => ({ ok: true }),
    confirmarComOpcao: async () => null,
    renderPedidos: () => {},
  };
  const sandbox = ctx;
  vm.createContext(sandbox);
  vm.runInContext(extrairAbridor(APP), sandbox);
  sandbox.abrirModalPedido(pedido);
  return { corpo, capturados, chamadas };
}

test("T-03.03 pedido a receber mostra o botao Acrescentar item no HTML do modal", () => {
  const h = monteHarness(pedidoBase());
  assert.ok(h.corpo.innerHTML.includes('id="btn-acrescentar-item"'),
    "botao Acrescentar item deve aparecer no corpo do modal");
  assert.ok(h.corpo.innerHTML.includes("Acrescentar item"), "rotulo do botao presente");
  assert.equal(h.capturados.length, 1, "wiring deve registrar exatamente 1 listener");
  assert.equal(h.capturados[0].ev, "click");
});

test("T-03.03 pedido recebido ou cancelado NAO mostra o botao", () => {
  const casos = [
    Object.assign(pedidoBase(), { recebidoEm: "2026-09-10T12:00:00.000Z" }),
    Object.assign(pedidoBase(), { status: "cancelado" }),
  ];
  for (const p of casos) {
    const h = monteHarness(p);
    assert.ok(!h.corpo.innerHTML.includes("btn-acrescentar-item"), "botao nao pode aparecer");
    assert.equal(h.capturados.length, 0, "nenhum listener pode ser registrado");
  }
});

test("T-03.03 clicar em Acrescentar item ativa o modo comanda com id e numero do pedido", () => {
  const p = pedidoBase();
  const h = monteHarness(p);
  h.capturados[0].fn();
  assert.equal(h.chamadas.modoAtivar.length, 1, "pedidoModoAtivar deve ser chamada uma vez");
  assert.equal(h.chamadas.modoAtivar[0].id, 42, "deve ativar com o id do pedido");
  assert.equal(h.chamadas.modoAtivar[0].numero, 7, "deve ativar com o numero da comanda");
  assert.equal(h.chamadas.fechar, 1, "o modal do pedido deve fechar ao ativar o modo");
});