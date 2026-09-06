const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const { contemTrecho, trechoEntre } = require("./apoio/arquivo-estatico");

const APP = path.join(__dirname, "..", "public", "app.js");
const HTML = path.join(__dirname, "..", "public", "admin.html");
const CSS = path.join(__dirname, "..", "public", "style.css");
const lerArquivo = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

// Isolamento do corpo de renderListaPedidos: do início da função até o fim da
// lista de handlers de filtros (o que vem depois dela). Nunca testa o arquivo inteiro.
function corpoRenderListaPedidos() {
  return trechoEntre(APP, "function renderListaPedidos(lista) {", "\n// Handlers dos filtros");
}

// T-02.01 — corte por contagem visível + resets + script tag
test("T-02.01: renderListaPedidos corta a lista com a contagem visivel via PaginacaoPedidos", () => {
  const trecho = corpoRenderListaPedidos();
  assert.notEqual(trecho, null, "isolar o corpo de renderListaPedidos deve funcionar");
  assert.ok(trecho.includes("PaginacaoPedidos.contagemInicial"), "deve calcular a contagem visivel via PaginacaoPedidos");
  assert.ok(trecho.includes("lista.slice(0, visiveis)"), "o corte da lista deve usar a contagem visivel");
  assert.ok(!trecho.includes("PEDIDOS_POR_PAGINA"), "nao pode sobrar PEDIDOS_POR_PAGINA no corpo");
});

test("T-02.01: admin.html carrega paginacao-pedidos.js antes de app.js", () => {
  const html = lerArquivo(HTML);
  const i = html.indexOf('src="paginacao-pedidos.js"');
  const j = html.indexOf('src="app.js"');
  assert.ok(i !== -1, "admin.html deve carregar paginacao-pedidos.js");
  assert.ok(j !== -1, "admin.html deve carregar app.js");
  assert.ok(i < j, "paginacao-pedidos.js deve vir ANTES de app.js");
});

test("T-02.01: os 8 pontos de reset atualizam a contagem visivel para o valor inicial", () => {
  const pontos = [
    { ini: "function irParaPedidosAReceber(opts = {}) {", fim: "\n// Fechamento: modal de conferência" },
    { ini: '$("filtroPeriodo").addEventListener("click"', fim: '\n$("dataIni").addEventListener' },
    { ini: '$("dataIni").addEventListener', fim: '\n$("dataFim").addEventListener' },
    { ini: '$("dataFim").addEventListener', fim: '\n$("filtroTipo").addEventListener' },
    { ini: '$("filtroTipo").addEventListener', fim: '\n$("filtroCanal").addEventListener' },
    { ini: '$("filtroCanal").addEventListener', fim: '\n$("filtroPagamento").addEventListener' },
    { ini: '$("filtroPagamento").addEventListener', fim: '\n$("buscaPedido").addEventListener' },
    { ini: '$("buscaPedido").addEventListener', fim: '\n// Ícones neutros (Lucide) para o detalhe' },
  ];
  assert.equal(pontos.length, 8, "devem ser 8 pontos de reset");
  pontos.forEach((p) => {
    const trecho = trechoEntre(APP, p.ini, p.fim);
    assert.notEqual(trecho, null, `ponto nao isolado por "${p.ini}"`);
    assert.ok(
      trecho.includes("pedidosVisiveis = LIMITE_INICIAL_PEDIDOS;"),
      `o ponto "${p.ini}" deve resetar pedidosVisiveis para o valor inicial`
    );
  });
});

test("T-02.01: PEDIDOS_POR_PAGINA e paginaPedidos nao existem mais em public/app.js", () => {
  assert.equal(contemTrecho("public/app.js", "PEDIDOS_POR_PAGINA"), false);
  assert.equal(contemTrecho("public/app.js", "paginaPedidos"), false, "nao pode sobrar referencia a paginaPedidos");
});

// T-02.02 — botão único "Carregar mais" + remoção da paginação numerada + CSS
test("T-02.02: renderListaPedidos desenha um botao unico 'Carregar mais'", () => {
  const trecho = corpoRenderListaPedidos();
  assert.notEqual(trecho, null);
  assert.ok(trecho.includes("Carregar mais"), "o corpo de renderListaPedidos deve conter o texto do botao");
});

test("T-02.02: o botao usa literalmente a classe ped-mais e PaginacaoPedidos.temMais para aparecer", () => {
  const trecho = corpoRenderListaPedidos();
  assert.notEqual(trecho, null);
  assert.ok(trecho.includes('class="ped-mais"'), "o HTML do botao deve conter class=\"ped-mais\"");
  assert.ok(trecho.includes("PaginacaoPedidos.temMais"), "o botao deve decidir se aparece via PaginacaoPedidos.temMais");
});

test("T-02.02: paginacaoHtml, paginasVisiveis e irParaPagina nao existem mais em public/app.js", () => {
  assert.equal(contemTrecho("public/app.js", "paginacaoHtml"), false);
  assert.equal(contemTrecho("public/app.js", "paginasVisiveis"), false);
  assert.equal(contemTrecho("public/app.js", "irParaPagina"), false);
});

test("T-02.02: style.css define a regra .ped-mais", () => {
  assert.equal(contemTrecho("public/style.css", ".ped-mais"), true);
});