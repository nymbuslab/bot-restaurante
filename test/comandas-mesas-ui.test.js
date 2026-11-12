const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// T-01.03 / T-03.01 / T-04.02 — Comandas abertas na aba Mesas.
// Harness: extrai a seção REAL de comandas de public/app.js (estado + carga + grade +
// detalhe + ações) e roda numa vm com um DOM falso mínimo. O resto são asserções
// estáticas no markup (public/admin.html) e no CSS (public/style.css).

const APP = path.join(__dirname, "..", "public", "app.js");
const HTML = path.join(__dirname, "..", "public", "admin.html");
const CSS = path.join(__dirname, "..", "public", "style.css");

function corpoDaFuncao(txt, cabecalho, proximoCabecalho) {
  const ini = txt.indexOf(cabecalho);
  assert.notEqual(ini, -1, "cabecalho nao encontrado: " + cabecalho);
  const fim = txt.indexOf(proximoCabecalho, ini);
  assert.notEqual(fim, -1, "proximo cabecalho nao encontrado: " + proximoCabecalho);
  return txt.slice(ini, fim);
}

function montarHarness(opts) {
  opts = opts || {};
  const app = fs.readFileSync(APP, "utf8");
  const trecho = corpoDaFuncao(app, "var comandaState = {", "\nfunction mostrarMesasFisicas(");

  const chamadas = [];
  const toasts = [];
  const docListeners = {};
  const registro = new Map();

  function novoEl(tag) {
    const el = {
      tagName: String(tag || "div").toUpperCase(),
      id: "",
      className: "",
      type: "",
      hidden: false,
      disabled: false,
      textContent: "",
      dataset: {},
      style: {},
      children: [],
      listeners: {},
      _innerHTML: "",
      classList: {
        _s: new Set(),
        add(c) { this._s.add(c); },
        remove(c) { this._s.delete(c); },
        contains(c) { return this._s.has(c); },
        toggle() {},
      },
      setAttribute() {},
      focus() {},
      remove() {},
      insertBefore() {},
      appendChild(c) { this.children.push(c); return c; },
      addEventListener(evt, fn) { (this.listeners[evt] = this.listeners[evt] || []).push(fn); },
      click() { (this.listeners.click || []).forEach((fn) => fn()); },
      querySelector(sel) {
        if (!this._qs) this._qs = new Map();
        if (!this._qs.has(sel)) this._qs.set(sel, novoEl("span"));
        return this._qs.get(sel);
      },
      querySelectorAll() { return []; },
    };
    Object.defineProperty(el, "innerHTML", {
      get() { return el._innerHTML; },
      set(v) { el._innerHTML = String(v); el.children = []; },
    });
    return el;
  }

  function $(id) {
    if (!registro.has(id)) {
      const el = novoEl("div");
      el.id = id;
      registro.set(id, el);
    }
    return registro.get(id);
  }

  const ctx = {
    setInterval: () => 0,
    setTimeout: () => 0,
    toast: (msg, tipo) => { toasts.push([msg, tipo]); },
    api: async (m, u, b) => {
      chamadas.push({ m, u, b });
      const resposta = (opts.respostas || {})[u] || (opts.respostas || {})["*"];
      if (typeof resposta === "function") return resposta();
      return { ok: true, json: async () => ({}) };
    },
    $,
    document: {
      hidden: false,
      createElement: (tag) => novoEl(tag),
      addEventListener: (evt, fn) => { (docListeners[evt] = docListeners[evt] || []).push(fn); },
      removeEventListener: (evt, fn) => {
        const lista = docListeners[evt] || [];
        const i = lista.indexOf(fn);
        if (i > -1) lista.splice(i, 1);
      },
      querySelector: () => null,
    },
    pdvEsc: (s) => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    pdvMoney: (v) => "R$ " + Number(v || 0).toFixed(2).replace(".", ","),
    pdvPrecoLinha: (i) => (i.total != null ? i.total : Number(i.preco || 0) * Number(i.qtd || 1)),
    ICO_LIXEIRA: '<svg aria-hidden="true"></svg>',
    pedidoModoAtivar: (d) => { ctx._pedidoModo = d; },
    abrirPedReceber: (c, cb) => { ctx._receber = { c, cb }; },
    confirmarComOpcao: async () => ctx._confirmar,
    carregarPedidos: undefined,
  };

  vm.runInNewContext(trecho, ctx);
  return { ctx, $, chamadas, toasts, docListeners, novoEl };
}

function comanda(patch) {
  return Object.assign({
    id: 3, numero: 8, cliente: "Ana",
    criadoEm: new Date(Date.now() - 12 * 60000).toISOString(),
    itens: [{ nome: "Pizza", qtd: 1, preco: 40, total: 40 }],
    total: 40,
  }, patch || {});
}

function operacao(patch) {
  return Object.assign({
    caixaAberto: true,
    caixaVencido: false,
    permissoes: { acrescentar: true, receber: true, imprimir: true, cancelar: true },
  }, patch || {});
}

test("T-01.03 a seção Comandas abertas fica acima da grade de mesas físicas", () => {
  const html = fs.readFileSync(HTML, "utf8");
  const comandas = html.indexOf('id="comandasAbertas"');
  const grade = html.indexOf('id="mesasGrade"');
  assert.notEqual(comandas, -1, "#comandasAbertas nao encontrado");
  assert.notEqual(grade, -1, "#mesasGrade nao encontrado");
  assert.ok(comandas < grade, "as comandas abertas aparecem antes das mesas físicas");

  const secao = html.slice(comandas, grade);
  assert.match(secao, /aria-labelledby="comandasTitulo"/);
  assert.match(secao, /id="comandasGrade"[^>]*aria-live="polite"/);
  assert.match(secao, /Da mais antiga para a mais recente/);

  const btnConfigurar = html.indexOf('id="btnConfigurarMesas"');
  assert.ok(btnConfigurar > -1 && btnConfigurar < comandas, "Configurar continua no topo, como ação das mesas");
});

test("T-03.01 o detalhe da comanda tem itens, total e as quatro ações", () => {
  const html = fs.readFileSync(HTML, "utf8");
  const ini = html.indexOf('id="comandaPainel"');
  assert.notEqual(ini, -1);
  const drawer = html.slice(ini, ini + 3000);
  for (const id of ["comandaPainelNome", "comandaPainelSub", "comandaItensQtd", "comandaItensLista",
    "comandaTotal", "btnComandaAdicionar", "btnComandaReceber", "btnComandaPreConta",
    "btnComandaCancelar", "comandaCaixaAviso"]) {
    assert.ok(drawer.includes('id="' + id + '"'), "faltou #" + id + " no detalhe da comanda");
  }
  assert.match(drawer, /role="dialog"/);
  assert.match(drawer, /aria-modal="true"/);
});

test("T-01.04 a grade renderiza número, identificação, duração, itens e total", () => {
  const h = montarHarness();
  h.ctx.comandaState.lista = [
    comanda({ id: 9, numero: 12, cliente: "Maria", itens: [{ qtd: 2 }, { qtd: 1 }], total: 87.5 }),
    comanda({ id: 7, numero: 11, cliente: "", itens: [], total: 0, criadoEm: new Date(Date.now() - 90 * 60000).toISOString() }),
  ];
  h.ctx.renderComandasAbertas();

  const grade = h.$("comandasGrade");
  assert.equal(grade.children.length, 2);
  const [primeira, segunda] = grade.children;

  assert.match(primeira.innerHTML, /Comanda 12/);
  assert.match(primeira.innerHTML, /Aberta/);
  assert.match(primeira.innerHTML, /Maria/);
  assert.match(primeira.innerHTML, /12 min/);
  assert.match(primeira.innerHTML, /3 itens/);
  assert.match(primeira.innerHTML, /R\$ 87,50/);
  assert.equal(primeira.className, "comanda-card");

  assert.match(segunda.innerHTML, /Comanda 11/);
  assert.match(segunda.innerHTML, /Sem identificação/);
  assert.match(segunda.innerHTML, /1h 30min/);
  assert.match(segunda.innerHTML, /0 itens/);
  assert.match(segunda.innerHTML, /R\$ 0,00/);
});

test("T-01.04 o card da comanda abre o detalhe certo e o destaque acompanha a seleção", async () => {
  const h = montarHarness({
    respostas: { "/api/comandas/9": () => ({ ok: true, json: async () => ({ comanda: comanda({ id: 9, numero: 12 }), operacao: operacao() }) }) },
  });
  h.ctx.comandaState.lista = [comanda({ id: 9, numero: 12 })];
  h.ctx.renderComandasAbertas();
  h.$("comandasGrade").children[0].click();
  await new Promise((r) => setImmediate(r));

  assert.equal(h.chamadas[0].u, "/api/comandas/9");
  assert.equal(h.ctx.comandaState.selecionada.id, 9);
  assert.equal(h.ctx.comandaState.destaqueId, 9);
  assert.equal(h.$("comandaPainel").classList.contains("aberto"), true);
  assert.equal(h.$("comandaPainelOverlay").classList.contains("visivel"), true);
  assert.equal(h.$("comandasGrade").children[0].className, "comanda-card destaque");
});

test("T-01.05 lista vazia e falha de abertura têm estado próprio", () => {
  const h = montarHarness();
  h.ctx.comandaState.lista = [];
  h.ctx.renderComandasAbertas();
  assert.equal(h.$("comandasGrade").innerHTML, "");
  assert.equal(h.$("comandasGrade").children[0].textContent, "Nenhuma comanda aberta.");

  h.ctx.comandaState.lista = [comanda({ id: 5, numero: 4 })];
  h.ctx.comandaState.falhaAbertura = { id: 5, numero: 4 };
  h.ctx.renderComandasAbertas();
  const aviso = h.$("comandasGrade").children[0];
  assert.equal(aviso.className, "comanda-retry");
  assert.match(aviso.innerHTML, /Comanda 4/);
  assert.match(aviso.innerHTML, /Tentar abrir/);
  assert.ok(aviso.querySelector("button").listeners.click, "o aviso precisa reabrir o detalhe");
});

test("D-08 caixa fechado bloqueia acrescentar e receber, mas não imprimir nem cancelar", () => {
  for (const vencido of [false, true]) {
    const h = montarHarness();
    h.ctx.comandaState.selecionada = comanda();
    h.ctx.comandaState.operacao = operacao({ caixaAberto: false, caixaVencido: vencido });
    h.ctx.renderComandaPainel();

    assert.equal(h.$("btnComandaAdicionar").disabled, true);
    assert.equal(h.$("btnComandaReceber").disabled, true);
    assert.equal(h.$("btnComandaPreConta").hidden, false, "pré-conta continua disponível");
    assert.equal(h.$("btnComandaPreConta").disabled, false);
    assert.equal(h.$("btnComandaCancelar").hidden, false, "cancelar continua disponível");
    assert.equal(h.$("comandaCaixaAviso").hidden, false);
    const texto = h.$("comandaCaixaAviso").querySelector("span").textContent;
    if (vencido) assert.match(texto, /caixa de outro dia aberto.*Feche o caixa/i);
    else assert.match(texto, /^Abra o caixa/);
  }
});

test("D-08 com caixa do dia aberto o aviso some e as ações ficam liberadas", () => {
  const h = montarHarness();
  h.ctx.comandaState.selecionada = comanda();
  h.ctx.comandaState.operacao = operacao();
  h.ctx.renderComandaPainel();
  assert.equal(h.$("comandaCaixaAviso").hidden, true);
  assert.equal(h.$("btnComandaAdicionar").disabled, false);
  assert.equal(h.$("btnComandaReceber").disabled, false);
});

test("D-07 as ações respeitam as permissões do ator", () => {
  const h = montarHarness();
  h.ctx.comandaState.selecionada = comanda();
  h.ctx.comandaState.operacao = operacao({ permissoes: { acrescentar: false, receber: false, imprimir: false, cancelar: false } });
  h.ctx.renderComandaPainel();
  for (const id of ["btnComandaAdicionar", "btnComandaReceber", "btnComandaPreConta", "btnComandaCancelar"]) {
    assert.equal(h.$(id).hidden, true, "#" + id + " deveria sumir sem permissão");
  }
});

test("D-07 cada ação usa o endpoint do seu contrato", async () => {
  const h = montarHarness({ respostas: { "*": () => ({ ok: true, json: async () => ({ comanda: comanda(), operacao: operacao() }) }) } });
  h.ctx.comandaState.selecionada = comanda({ id: 3 });
  h.ctx.comandaState.operacao = operacao();

  await h.ctx.imprimirPreContaComanda();
  assert.equal(h.chamadas[0].m, "POST");
  assert.equal(h.chamadas[0].u, "/api/comandas/3/imprimir-pre-conta");

  h.chamadas.length = 0;
  h.ctx._confirmar = { opcao: true };
  await h.ctx.cancelarComandaAberta();
  assert.equal(h.chamadas[0].u, "/api/pedidos/3/cancelar");
  assert.deepEqual(Object.keys(h.chamadas[0].b), ["devolver"]);
  assert.equal(h.chamadas[0].b.devolver, true, "a opção de devolver ao estoque vai no corpo");

  assert.equal(h.toasts.some(([msg]) => /Comanda cancelada/.test(msg)), true);
  assert.equal(h.$("comandaPainel").classList.contains("aberto"), false);
});

test("D-05 adicionar produtos fecha o detalhe e abre o PDV na via da comanda", () => {
  const h = montarHarness();
  h.ctx.comandaState.selecionada = comanda({ id: 3, numero: 8, cliente: "Ana" });
  h.ctx.abrirComandaPainel = () => true;
  h.$("comandaPainel").classList.add("aberto");
  h.ctx.adicionarProdutosComanda();

  assert.equal(h.ctx._pedidoModo.id, 3);
  assert.equal(h.ctx._pedidoModo.numero, 8);
  assert.equal(h.ctx._pedidoModo.viaComanda, true, "o acréscimo precisa usar a rota de Comandas");
  assert.equal(h.$("comandaPainel").classList.contains("aberto"), false);
});

test("T-04.02 receber abre o fluxo de recebimento com a comanda selecionada", () => {
  const h = montarHarness();
  h.ctx.comandaState.selecionada = comanda({ id: 3 });
  h.ctx.receberComanda();
  assert.equal(h.ctx._receber.c.id, 3);
  assert.equal(typeof h.ctx._receber.cb, "function");
});

test("D-06 Escape fecha o detalhe da comanda", () => {
  const h = montarHarness({
    respostas: { "/api/comandas/3": () => ({ ok: true, json: async () => ({ comanda: comanda(), operacao: operacao() }) }) },
  });
  h.ctx.comandaState.selecionada = comanda();
  h.ctx.comandaState.operacao = operacao();
  h.ctx.renderComandaPainel();
  h.$("comandaPainel").classList.add("aberto");
  h.$("comandaPainelOverlay").classList.add("visivel");
  // Abrir registra o handler de teclado (o mesmo caminho do app real).
  return h.ctx.abrirComandaPainel(3).then(() => {
    const handler = (h.docListeners.keydown || [])[(h.docListeners.keydown || []).length - 1];
    assert.ok(handler, "handler de teclado registrado ao abrir");
    handler({ key: "Escape", preventDefault() {} });
    assert.equal(h.$("comandaPainel").classList.contains("aberto"), false);
    assert.equal(h.$("comandaPainelOverlay").classList.contains("visivel"), false);
  });
});

test("D-08 carregarMesas não esconde as comandas quando o caixa está fechado", () => {
  const app = fs.readFileSync(APP, "utf8");
  const corpo = corpoDaFuncao(app, "async function carregarMesas() {", "\nfunction renderMesasGrade(");
  const branch = corpo.match(/if \(!caixaData\.caixa\) \{([^}]+)\}/);
  assert.ok(branch, "branch !caixaData.caixa nao encontrada");
  assert.match(branch[1], /mesasSemCaixa/);
  assert.doesNotMatch(branch[1], /comandasAbertas/, "o caixa fechado só esconde as mesas físicas");
  assert.doesNotMatch(branch[1], /mesasConteudo\.hidden/, "as comandas continuam visíveis no conteúdo");
});

test("T-01.03 o CSS das comandas existe e cobre o mobile", () => {
  const css = fs.readFileSync(CSS, "utf8");
  for (const classe of [".comandas-abertas", ".comandas-grade", ".comanda-card", ".comanda-aberta-badge",
    ".comanda-identificacao", ".comanda-card-meta", ".comanda-caixa-aviso", ".comanda-itens-cab",
    ".comanda-item", ".comanda-total", ".comanda-acoes", ".comanda-cancelar", ".comanda-retry"]) {
    assert.ok(css.includes(classe), "faltou a regra " + classe + " em public/style.css");
  }
  const mobile = css.lastIndexOf("@media (max-width: 560px)");
  assert.notEqual(mobile, -1, "as comandas precisam de ajuste no mobile");
  assert.match(css.slice(mobile, mobile + 4000), /\.comanda-card|\.comandas-grade/, "o bloco mobile precisa cobrir as comandas");
});
