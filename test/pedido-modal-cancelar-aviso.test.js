"use strict";
// T-04.01 — Segundo aviso ao cancelar item que já foi enviado à cozinha (D-08).
// Item com cozinha:true dispara DOIS diálogos em sequência antes do POST
// cancelar-item (o aviso da cozinha e depois o confirmarComOpcao existente);
// item sem cozinha continua com um só diálogo (sem regressão).
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

function pedidoQueijo() {
  return {
    id: 42,
    numero: 7,
    tipoEntrega: "Comanda",
    status: "pendente",
    recebidoEm: null,
    criadoEm: "2026-09-10T10:00:00.000Z",
    cliente: "Maria",
    telefone: "11990000000",
    total: 30,
    taxaEntrega: 0,
    trocoPara: 0,
    origem: "pdv",
    avisadoEm: null,
    chatId: "",
    itens: [
      { nome: "Parmegiana", preco: 15, qtd: 2, cozinha: true, opcionais: [], variacoes: [], observacao: "" },
      { nome: "Suco", preco: 8, qtd: 1, cozinha: false, opcionais: [], variacoes: [], observacao: "" },
    ],
  };
}

function monteHarness(pedido, opcoes = {}) {
  const log = [];
  const btnAdd = { addEventListener() {} };
  const btnsDel = pedido.itens.map((it, idx) => ({
    dataset: { itemIdx: String(idx) },
    addEventListener(ev, fn) { this["_" + ev] = fn; },
  }));
  const corpo = {
    innerHTML: "",
    querySelector(sel) { return sel === "#btn-acrescentar-item" ? btnAdd : null; },
    querySelectorAll(sel) { return sel === ".ped-item-del" ? btnsDel : []; },
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
    fecharModalPedido: () => {},
    pedidoModoAtivar: () => {},
    toast: () => {},
    renderPedidos: () => {},
    pedidosCache: [],
    confirmar: async (titulo, mensagem) => {
      log.push({ dialogo: "confirmar", titulo, mensagem });
      return opcoes.okAviso === undefined ? true : opcoes.okAviso;
    },
    confirmarComOpcao: async (titulo, mensagem, rotulo) => {
      log.push({ dialogo: "confirmarComOpcao", titulo, mensagem, rotulo });
      return { opcao: true };
    },
    api: async (m, u, b) => {
      log.push({ api: m + " " + u, corpo: b });
      return { ok: true, json: async () => ({ id: 42, numero: 7, itens: [] }) };
    },
  };
  const sandbox = ctx;
  vm.createContext(sandbox);
  vm.runInContext(extrairAbridor(APP), sandbox);
  sandbox.abrirModalPedido(pedido);
  return { btnsDel, log };
}

test("T-04.01 item com cozinha:true dispara o aviso da cozinha antes do cancelamento", async () => {
  const h = monteHarness(pedidoQueijo());
  await h.btnsDel[0]._click({ stopPropagation() {} });

  const ordem = h.log.map((x) => x.dialogo || x.api);
  assert.deepEqual(ordem, ["confirmar", "confirmarComOpcao", "POST /api/pedidos/42/cancelar-item"],
    "aviso da cozinha, confirmarComOpcao e POST devem rodar nessa ordem");
  assert.match(h.log[0].mensagem, /cozinha/i, "o primeiro dialogo deve mencionar a cozinha");
  // A opção de devolver ao estoque segue existindo (sem regressão).
  assert.equal(h.log[1].rotulo, "Devolver os itens ao estoque");
  // O POST continua levando o item certo e a opção de devolver.
  assert.equal(h.log[2].corpo.itemIdx, 0);
  assert.equal(h.log[2].corpo.devolver, true);
});

test("T-04.01 item sem cozinha continua com um so dialogo (sem regressao)", async () => {
  const h = monteHarness(pedidoQueijo());
  await h.btnsDel[1]._click({ stopPropagation() {} });

  const ordem = h.log.map((x) => x.dialogo || x.api);
  assert.deepEqual(ordem, ["confirmarComOpcao", "POST /api/pedidos/42/cancelar-item"],
    "item sem cozinha:true deve passar direto pelo confirmarComOpcao de hoje");
  assert.equal(h.log[1].corpo.itemIdx, 1, "o item certo vai no POST");
});

test("T-04.01 desistir do aviso da cozinha nao cancele o item", async () => {
  const h = monteHarness(pedidoQueijo(), { okAviso: false });
  await h.btnsDel[0]._click({ stopPropagation() {} });

  assert.deepEqual(h.log.map((x) => x.dialogo || x.api), ["confirmar"],
    "se o usuario desiste do aviso, nada mais roda");
});