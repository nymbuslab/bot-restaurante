const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Duas r\u00e9guas para o mesmo dado, nas rotas p\u00fablicas.
//
// 1. FORMAS DE PAGAMENTO. O painel e o PDV servem a lista NORMALIZADA; o
//    card\u00e1pio web servia a CRUA. Era a metade que sobrou do defeito corrigido em
//    8a366eb: um tenant com dado legado (`["Dinheiro", "Cart\u00e3o"]`, de quando as
//    formas eram texto livre) mostraria vocabul\u00e1rio diferente em cada tela, e a
//    confer\u00eancia do caixa contaria a mesma forma em duas linhas.
//
//    As duas pontas t\u00eam que andar juntas: normalizar s\u00f3 a exibi\u00e7\u00e3o e seguir
//    validando pela lista crua recria o mesmo defeito de cabe\u00e7a para baixo — a
//    tela oferece "Cart\u00e3o de Cr\u00e9dito" e o servidor recusa.
//
// 2. NOME DO CLIENTE. A rota do card\u00e1pio web corta em 120 caracteres; a venda do
//    PDV mandava `b.cliente` direto para o banco. Mesmo campo, duas r\u00e9guas.
// ---------------------------------------------------------------------------

const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");

function corpoDaRota(marcador) {
  const i = servidor.indexOf(marcador);
  assert.ok(i > -1, "rota n\u00e3o encontrada: " + marcador);
  const fim = servidor.indexOf("\napp.", i + 10);
  return servidor.slice(i, fim === -1 ? undefined : fim);
}

test("o card\u00e1pio p\u00fablico serve a lista NORMALIZADA de formas de pagamento", () => {
  const c = corpoDaRota('app.get("/api/c/:slug"');
  assert.match(c, /pagamentos:\s*formasPag\.normalizarFormasPagamento/,
    "servir a lista crua faz a tela do cliente falar um vocabul\u00e1rio e o painel outro");
});

test("o pedido web valida a forma pela mesma lista que a tela mostrou", () => {
  const c = corpoDaRota('app.post("/api/c/:slug/pedido"');
  assert.match(c, /formaPermitida/,
    "comparar contra a lista crua recusaria a forma que a pr\u00f3pria tela ofereceu");
  assert.doesNotMatch(c, /pagamentos\.indexOf\(pagamento\)/,
    "a compara\u00e7\u00e3o crua tem que sumir, n\u00e3o conviver com a nova");
});

test("a venda do PDV sanitiza o nome do cliente como a rota web j\u00e1 fazia", () => {
  const c = corpoDaRota('app.post("/api/pdv/vender"');
  assert.match(c, /const cliente = String\(b\.cliente/, "nome precisa passar por String()+trim");
  assert.match(c, /slice\(0,\s*120\)/, "e ter o mesmo teto de 120 da rota web");
  assert.doesNotMatch(c, /cliente:\s*b\.cliente/, "nenhum caminho pode mandar o cru");
});
