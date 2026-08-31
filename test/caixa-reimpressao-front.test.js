const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function renderizarCaixa(data) {
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  const inicio = app.indexOf("function ehMovimentoReversaoCaixa");
  const fim = app.indexOf("\nasync function estornarCaixa", inicio);
  assert.ok(inicio > -1 && fim > inicio, "trecho do caixa nao encontrado");

  const cont = {
    innerHTML: "",
    querySelectorAll: () => [],
  };
  const fakeBotao = { addEventListener: () => {} };
  const ctx = {
    ComprovanteCaixa: require("../public/comprovante-caixa"),
    SVG_REIMPRIMIR_CAIXA: "<svg></svg>",
    ehFormaDinheiro: (f) => String(f || "").toLowerCase() === "dinheiro",
    escapar: (s) => String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;"),
    fmtBRn: (n) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    carregarCaixa: () => {},
    movimentoCaixa: () => {},
    renderFechamentoCaixa: () => {},
    verHistoricoCaixa: () => {},
    $: (id) => id === "caixaConteudo" ? cont : fakeBotao,
  };

  vm.runInNewContext(app.slice(inicio, fim), ctx);
  ctx.renderCaixaAberto(data);
  return cont.innerHTML;
}

test("caixa aberto renderiza icone de reimpressao so nos movimentos com comprovante", () => {
  const html = renderizarCaixa({
    restaurante: "Restaurante Teste",
    formasPagamento: ["Dinheiro", "PIX"],
    caixa: { id: 1, fundoTroco: 100, operador: "Operador", abertoEm: "2026-08-30T12:00:00.000Z" },
    resumo: {
      totalRecebido: 12,
      recebidoDinheiro: 12,
      recebidoPorForma: { Dinheiro: 12 },
      canceladoPorForma: { Dinheiro: 12 },
      canceladoDinheiro: 12,
      suprimentos: 5,
      sangrias: 3,
      cancelamentos: 12,
    },
    movimentos: [
      { id: 11, tipo: "sangria", valor: 3, descricao: "Retirada", quando: "2026-08-30T13:00:00.000Z" },
      { id: 12, tipo: "suprimento", valor: 5, descricao: "Troco", quando: "2026-08-30T13:05:00.000Z" },
      // CASO REAL: só se cancela pedido que foi PAGO, então o recebimento e o
      // cancelamento são do MESMO pedido e o recebimento tem id menor (foi gravado
      // antes). O extrato condensa os dois numa linha "Venda cancelada", e é essa
      // linha, não a do cancelamento, que o operador vê.
      { id: 13, tipo: "recebimento", pedidoId: 90, numero: 7, cliente: "Cliente", forma: "Dinheiro", valor: 12, quando: "2026-08-30T13:10:00.000Z", estornavel: true },
      { id: 14, tipo: "cancelamento", pedidoId: 90, numero: 7, cliente: "Cliente", forma: "Dinheiro", valor: 12, quando: "2026-08-30T13:15:00.000Z" },
      { id: 15, tipo: "recebimento", pedidoId: 91, numero: 8, cliente: "Cliente", forma: "Dinheiro", valor: 12, quando: "2026-08-30T13:20:00.000Z", estornavel: true },
    ],
  });

  assert.match(html, /Venda cancelada/, "a fixture precisa exercitar a linha condensada, que e o caso real");

  const botoes = [...html.matchAll(/class="[^"]*\bcaixa-reimprimir\b[^"]*"[^>]*data-id="(\d+)"/g)]
    .map((m) => Number(m[1]));
  // 14 = o cancelamento, alcancado pela linha condensada "Venda cancelada". Sem isso
  // a reimpressao de cancelamento fica inalcancavel pela tela.
  assert.deepEqual(botoes.sort((a, b) => a - b), [11, 12, 14]);
  assert.doesNotMatch(html, /caixa-reimprimir[^>]*data-id="15"/, "recebimento comum nao tem comprovante proprio");
  assert.equal((html.match(/cx-row-abertura/g) || []).length, 1, "saldo inicial precisa continuar sem botao");
});

// D-03 poe estorno FORA do escopo: ele nao tem comprovante nem toggle. A linha
// condensada de venda estornada passa pelo mesmo caminho novo que alcanca o
// cancelamento escondido, entao precisa de guarda propria para nao vazar o icone.
test("venda estornada nao ganha icone de reimpressao", () => {
  const html = renderizarCaixa({
    restaurante: "Restaurante Teste",
    formasPagamento: ["Dinheiro"],
    caixa: { id: 1, fundoTroco: 100, operador: "Operador", abertoEm: "2026-08-30T12:00:00.000Z" },
    resumo: {
      totalRecebido: 12, recebidoDinheiro: 12, recebidoPorForma: { Dinheiro: 12 },
      canceladoPorForma: { Dinheiro: 12 }, canceladoDinheiro: 12,
      suprimentos: 0, sangrias: 0, cancelamentos: 12,
    },
    movimentos: [
      { id: 21, tipo: "recebimento", pedidoId: 95, numero: 9, cliente: "Cliente", forma: "Dinheiro", valor: 12, quando: "2026-08-30T13:00:00.000Z", estornavel: true },
      { id: 22, tipo: "estorno", pedidoId: 95, numero: 9, cliente: "Cliente", forma: "Dinheiro", valor: 12, quando: "2026-08-30T13:05:00.000Z" },
    ],
  });

  assert.match(html, /Venda estornada/, "a fixture precisa exercitar a linha condensada de estorno");
  assert.doesNotMatch(html, /caixa-reimprimir/, "estorno nao tem comprovante: nenhum icone pode aparecer");
});
