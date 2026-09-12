const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// T-03.02 — Modo PDV acrescentando à comanda existente (pedidoModoId).
// Harness: extrai a seção REAL "Modo PDV acrescentando" de public/app.js (funções
// pedidoModoAtivar/pedidoModoDesativar/pdvTituloModoPedido/pedidoLancarDoPdv) e a
// linha de wiring de #pdvCobrar, e executa tudo numa vm com stubs (api, $, abrirPdvPagar).

function itemCarrinho(patch) {
  return Object.assign({ id: 201, qtd: 2, nome: "Pizza", composicao: [], opcionais: [], grupos: [], variacoes: [], observacao: "" }, patch || {});
}

function carregarHarness() {
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

  const iniModo = app.indexOf("function pedidoModoAtivar(");
  const fimModo = app.indexOf("\n// ---- Wiring do PDV", iniModo);
  assert.ok(iniModo > -1 && fimModo > iniModo, "secao 'Modo PDV acrescentando' nao encontrada em public/app.js");

  const padraoWiring = 'if ($("pdvCobrar")) $("pdvCobrar").addEventListener("click", function ()';
  const iniWiring = app.indexOf(padraoWiring);
  const fimWiring = app.indexOf("});", iniWiring) + "});".length;
  assert.ok(iniWiring > -1 && fimWiring > iniWiring, "wiring de #pdvCobrar nao encontrado em public/app.js");

  const apiCalls = [];
  const chamadas = { mesaLancar: 0, abrirPdvPagar: 0 };
  const cobrar = {
    disabled: false, textContent: "", querySelectorAll: () => [],
    addEventListener: (evt, fn) => { if (evt === "click") cobrar._click = fn; },
  };
  const fakeElemento = {
    disabled: false, textContent: "", hidden: false, value: "", innerHTML: "",
    remove() {}, addEventListener() {}, insertBefore() {}, appendChild() {},
    querySelector: () => null, querySelectorAll: () => [],
    classList: { add() {}, remove() {}, toggle() {} }, style: {},
  };

  const ctx = {
    api: async (m, u, b) => { apiCalls.push({ m, u, b }); return { ok: true, json: async () => ({}) }; },
    toast: () => {},
    $: (id) => (id === "pdvCobrar" ? cobrar : fakeElemento),
    document: { querySelector: () => null },
    mesaModoId: null,
    mesaLancarDoPdv: () => { chamadas.mesaLancar++; },
    abrirPdvPagar: () => { chamadas.abrirPdvPagar++; },
    pdvCart: [],
    renderPdvCarrinho: () => {},
    pdvLimparBusca: () => {},
    carregarPedidos: undefined,
  };

  vm.runInNewContext(app.slice(iniModo, fimModo), ctx);
  vm.runInNewContext(app.slice(iniWiring, fimWiring), ctx);
  return { ctx, apiCalls, chamadas, cobrar };
}

test("T-03.02 com pedidoModoId setado, o clique em #pdvCobrar posta em /api/pedidos/:id/itens e não abre a tela de pagamento", async () => {
  const h = carregarHarness();
  h.ctx.pedidoModoId = 42;
  h.ctx.pedidoModoNumero = "7";
  h.ctx.pdvCart = [itemCarrinho()];
  h.cobrar._click();
  await new Promise((r) => setImmediate(r));

  assert.equal(h.apiCalls.length, 1, "exatamente uma chamada de api");
  assert.equal(h.apiCalls[0].m, "POST");
  assert.equal(h.apiCalls[0].u, "/api/pedidos/42/itens");
  const corpo = h.apiCalls[0].b;
  assert.deepEqual(Object.keys(corpo), ["itens"]);
  assert.equal(corpo.itens.length, 1);
  assert.equal(corpo.itens[0].id, 201);
  assert.equal(corpo.itens[0].qtd, 2);
  assert.equal(h.chamadas.abrirPdvPagar, 0, "abrirPdvPagar nao pode ser chamada no modo comanda");
  assert.equal(h.chamadas.mesaLancar, 0, "o modo mesa nao pode roubar o clique");
});

test("T-03.02 pedidoLancarDoPdv monta o corpo {itens:[...]} e posta na rota certa", async () => {
  const h = carregarHarness();
  h.ctx.pedidoModoId = 42;
  h.ctx.pedidoModoNumero = "7";
  h.ctx.pdvCart = [
    itemCarrinho(),
    itemCarrinho({ id: 202, qtd: 1, nome: "Refri", observacao: "gelada", variacoes: [{ id: 9, qtd: 1, nome: "Lata" }] }),
  ];
  await h.ctx.pedidoLancarDoPdv();

  assert.equal(h.apiCalls.length, 1);
  assert.equal(h.apiCalls[0].m, "POST");
  assert.equal(h.apiCalls[0].u, "/api/pedidos/42/itens");
  const corpo = h.apiCalls[0].b;
  assert.deepEqual(Object.keys(corpo), ["itens"]);
  assert.equal(corpo.itens.length, 2);
  const linha = corpo.itens[1];
  assert.equal(linha.id, 202);
  assert.equal(linha.qtd, 1);
  assert.deepEqual(linha.variacoes.map((v) => [v.id, v.qtd]), [[9, 1]]);
  assert.equal(linha.observacao, "gelada");
  assert.equal(linha.opcionais.length, 0);
  assert.equal(linha.composicao.length, 0);
  assert.equal(h.chamadas.abrirPdvPagar, 0);
});

test("T-03.02 carrinho vazio não dispara a chamada", async () => {
  const h = carregarHarness();
  h.ctx.pedidoModoId = 42;
  await h.ctx.pedidoLancarDoPdv();
  assert.deepEqual(h.apiCalls, []);
  assert.equal(h.chamadas.abrirPdvPagar, 0);
});