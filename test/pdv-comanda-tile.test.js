const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// T-03.01 — Tile Comanda na tela de cobrança do PDV.
// Harness: extrai pdvIconeForma + renderPdvPagar REAIS de public/app.js e executa
// numa vm com stubs para o resto do PDV (mesmo padrão de test/apoio/pdv-modal-harness.js
// e test/caixa-reimpressao-front.test.js). $("pdvPagarCaixa") captura o HTML montado.
function renderizarPdvPagar(setup) {
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  const inicio = app.indexOf("function pdvIconeForma(");
  const fim = app.indexOf("\nfunction pdvSyncResumo(", inicio);
  assert.ok(inicio > -1 && fim > inicio, "pdvIconeForma/renderPdvPagar nao encontrados em public/app.js");

  const cont = { innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  const fakeBotao = { addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] };

  const ctx = Object.assign({
    window: {
      Pagamentos: { ehDinheiro: (f) => String(f || "").toLowerCase() === "dinheiro" },
      Estoque: { formatarQtd: (n, u) => String(n).replace(".", ",") + " " + u },
    },
    Dinheiro: { mascarar: () => {}, setValor: () => {}, comPrefixo: (n) => "R$ " + (Number(n) || 0).toFixed(2).replace(".", ",") },
    $: (id) => (id === "pdvPagarCaixa" ? cont : fakeBotao),
    pdvEhDinheiro: (f) => String(f || "").toLowerCase() === "dinheiro",
    pdvEsc: (s) => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"),
    pdvCart: [],
    pdvFormasPg: ["Dinheiro", "PIX"],
    pdvFormaSel: "Dinheiro",
    pdvDesconto: null,
    pdvPagamentos: [],
    pdvEntrega: null,
    pdvTipoEntrega: "Balcão",
    pdvPrecoLinha: (l) => Number(l.precobase || l.qtd) * (Number(l.qtd) || 1),
    pdvTotalCobrar: () => 42.5,
    pdvPagoTotal: () => 0,
    pdvMoney: (n) => "R$ " + (Number(n) || 0).toFixed(2).replace(".", ","),
    toast: () => {},
    pdvSyncResumo: () => {},
    pdvPagarRecalc: () => {},
    renderPdvPgLista: () => {},
    pdvRenderEntregaResumo: () => {},
    abrirPdvEntrega: () => {},
    abrirPdvDescModal: () => {},
    pdvAddPagamento: () => {},
    fecharPdvPagar: () => {},
    finalizarVendaPdv: () => {},
  }, setup || {});

  vm.runInNewContext(app.slice(inicio, fim), ctx);
  ctx.renderPdvPagar();
  return { html: cont.innerHTML };
}

test("T-03.01 a cobrança do PDV oferece o tipo Comanda ao lado dos demais", () => {
  const { html } = renderizarPdvPagar({ pdvTipoEntrega: "Balcão" });
  assert.match(html, /data-tve="Comanda"/, "o tile Comanda precisa existir na lista de tipos de venda");
});

test("T-03.01 Comanda monta a tela como a receber, sem bloco de pagamento e com botão Abrir Comanda", () => {
  const { html } = renderizarPdvPagar({ pdvTipoEntrega: "Comanda" });
  assert.match(html, /data-tve="Comanda"/);
  assert.match(html, />Abrir Comanda<\/button>/, "o botão final precisa rotular Abrir Comanda");
  assert.doesNotMatch(html, /Forma de pagamento|pdv-formas|pdv-pg-addbtn/, "com Comanda não pode haver bloco de pagamento");
  assert.match(html, /pdv-areceber-nota/, "Comanda segue o caminho a receber, igual Entrega/Retirada");
});

test("T-03.01 Entrega/Retirada continuam com o rótulo Enviar para Pedidos", () => {
  const { html } = renderizarPdvPagar({ pdvTipoEntrega: "Retirada" });
  assert.match(html, />Enviar para Pedidos<\/button>/, "o rótulo dos demais tipos a receber não pode mudar");
});