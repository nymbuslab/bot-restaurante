const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Extrai resumoPedidos + ROTULO_FATURAMENTO + resumoPedidosHtml do app.js real, do
// mesmo jeito que test/caixa-calc.test.js isola os helpers do caixa: sem isso, um
// ajuste de rótulo ou de conta poderia divergir do que a tela realmente renderiza.
function helpersResumoPedidos({ plano = "completo", pagamento = "todos" } = {}) {
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  const i = app.indexOf("function resumoPedidos(");
  const fim = app.indexOf("\nfunction dataHoraFmt", i);
  assert.ok(i > -1 && fim > i, "trecho do resumo de pedidos não encontrado");

  const ctx = {
    planoAtual: plano,
    filtros: { pagamento },
    moedaBR: (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
  vm.runInNewContext(app.slice(i, fim), ctx);
  return ctx;
}

test("resumoPedidos soma o valor cancelado separado do faturamento", () => {
  const { resumoPedidos } = helpersResumoPedidos();
  const r = resumoPedidos([
    { status: "recebido", total: 50 },
    { status: "cancelado", total: 23 },
    { status: "cancelado", total: 7 },
  ]);
  assert.equal(r.pedidos, 1);
  assert.equal(r.faturamento, 50);
  assert.equal(r.cancelados, 2);
  assert.equal(r.valorCancelado, 30);
});

test("filtro Cancelados troca Faturamento por Valor cancelado, no Completo", () => {
  const { resumoPedidosHtml } = helpersResumoPedidos({ plano: "completo", pagamento: "cancelados" });
  const html = resumoPedidosHtml([
    { status: "cancelado", total: 23 },
    { status: "cancelado", total: 7 },
  ]);
  assert.match(html, /Valor cancelado/, "a célula precisa trocar de rótulo neste filtro");
  assert.doesNotMatch(html, />Faturamento</, "o rótulo antigo não pode sobrar no mesmo recorte");
  assert.match(html, /R\$\s*30,00/, "23 + 7 = 30, é o valor cancelado do recorte");
});

test("fora do filtro Cancelados o card continua mostrando Faturamento normal", () => {
  const { resumoPedidosHtml } = helpersResumoPedidos({ plano: "completo", pagamento: "todos" });
  const html = resumoPedidosHtml([{ status: "recebido", total: 50 }]);
  assert.match(html, />Faturamento</);
  assert.doesNotMatch(html, /Valor cancelado/);
});

test("no Essencial a troca de rótulo não se aplica (o seletor fica escondido)", () => {
  const { resumoPedidosHtml } = helpersResumoPedidos({ plano: "essencial", pagamento: "cancelados" });
  const html = resumoPedidosHtml([{ status: "cancelado", total: 23 }]);
  assert.match(html, />Faturamento</, "sem Caixa, o filtro Cancelados nem existe na tela");
  assert.doesNotMatch(html, /Valor cancelado/);
});
