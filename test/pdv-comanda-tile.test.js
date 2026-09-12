const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// T-03.01 — Comanda no PDV após a aprovação do portão de design (12/09): o tipo de
// venda é escolhido no seletor da LATERAL do carrinho (pdvTipos/pdvTipoHtml), o modal
// Finalizar venda não repete mais os tiles e só monta o bloco do tipo já escolhido.
// Harness: extrai pdvTipos/pdvTipoHtml + pdvIconeForma/renderPdvPagar REAIS de
// public/app.js e executa numa vm com stubs para o resto do PDV.
// $("pdvPagarCaixa") captura o HTML montado.
function renderizar(setup) {
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  const inicio = app.indexOf("function pdvIconeForma(");
  const fim = app.indexOf("\nfunction pdvSyncResumo(", inicio);
  assert.ok(inicio > -1, "pdvIconeForma/renderPdvPagar nao encontrados em public/app.js");
  assert.ok(fim > inicio && app.indexOf("const pdvTipos =", inicio) < fim, "pdvTipos/pdvTipoHtml precisam estar dentro do slice");

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
  return { ctx, htmlTipo: () => ctx.pdvTipoHtml(), renderPagar: () => { ctx.renderPdvPagar(); return cont.innerHTML; } };
}

function botaoTemClasse(html, tipo, classe) {
  return new RegExp('<button[^>]*data-tipo="' + tipo + '"[^>]*class="' + classe + '"').test(html)
    || new RegExp('<button[^>]*class="' + classe + '"[^>]*data-tipo="' + tipo + '"').test(html);
}

test("T-03.01 o seletor da lateral oferece Balcão/Comanda/Entrega, sem Retirada no PDV", () => {
  const { htmlTipo } = renderizar({ pdvTipoEntrega: "Balcão" });
  const html = htmlTipo();
  assert.match(html, /data-tipo="Balcão"/, "o seletor precisa ter Balcão");
  assert.match(html, /data-tipo="Comanda"/, "o seletor precisa ter Comanda");
  assert.match(html, /data-tipo="Entrega"/, "o seletor precisa ter Entrega");
  assert.doesNotMatch(html, /Retirada/, "Retirada não existe no PDV (continua no cardápio web)");
});

test("T-03.01 o seletor marca o tipo como ativo só no botão escolhido", () => {
  const { htmlTipo } = renderizar({ pdvTipoEntrega: "Comanda" });
  const html = htmlTipo();
  assert.ok(botaoTemClasse(html, "Comanda", "ativo"), "o tipo escolhido (Comanda) precisa ficar ativo");
  assert.ok(!botaoTemClasse(html, "Balcão", "ativo"));
  assert.ok(!botaoTemClasse(html, "Entrega", "ativo"));
});

test("T-03.01 o modal Finalizar venda não repete os tiles do tipo de venda", () => {
  const html = renderizar({ pdvTipoEntrega: "Comanda" }).renderPagar();
  assert.doesNotMatch(html, /data-tve|pdv-tve-bloco|<div class="pdv-tve"/, "o tipo foi escolhido na lateral; o modal não pode re-exibir os tiles");
});

test("T-03.01 Comanda monta a tela como a receber, sem bloco de pagamento e com botão Abrir Comanda", () => {
  const html = renderizar({ pdvTipoEntrega: "Comanda" }).renderPagar();
  assert.match(html, />Abrir Comanda<\/button>/, "o botão final precisa rotular Abrir Comanda");
  assert.doesNotMatch(html, /Forma de pagamento|pdv-formas|pdv-pg-addbtn/, "com Comanda não pode haver bloco de pagamento");
  assert.match(html, /pdv-areceber-nota/, "Comanda segue o caminho a receber");
});

test("T-03.01 Entrega continua com o rótulo Enviar para Pedidos", () => {
  const html = renderizar({ pdvTipoEntrega: "Entrega" }).renderPagar();
  assert.match(html, />Enviar para Pedidos<\/button>/, "o rótulo da Entrega não pode mudar");
});

test("T-03.01 Balcão mantém o bloco de pagamento e confirma com Confirmar pagamento", () => {
  const html = renderizar({ pdvTipoEntrega: "Balcão" }).renderPagar();
  assert.match(html, />Confirmar pagamento<\/button>/, "Balcão fecha com Confirmar pagamento");
  assert.match(html, /pdv-formas/, "Balcão é o único tipo com bloco de pagamento");
});