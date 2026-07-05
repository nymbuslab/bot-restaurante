const { test } = require("node:test");
const assert = require("node:assert/strict");
const { montarDashboard } = require("../src/dashboard-calc");

// hojeBR fixo → determinístico (sem Date.now). "Hoje" = 05/07/2026.
const raw = {
  hojeBR: "2026-07-05",
  diario: [
    { dia: "2026-07-05", valor: 100, qtd: 2 }, // hoje
    { dia: "2026-07-04", valor: 50,  qtd: 1 }, // ontem
    { dia: "2026-06-30", valor: 30,  qtd: 1 }, // 5 dias atrás (dentro dos 7)
    { dia: "2026-06-20", valor: 999, qtd: 1 }, // fora dos 30? não: 15 dias — conta na série, não nas janelas curtas
  ],
  mensal: [
    { mes: "2026-07", valor: 180 },
    { mes: "2026-06", valor: 500 },
    { mes: "2025-08", valor: 12 }, // 11 meses atrás (limite inferior)
  ],
  mes: { fat: 180, ativos: 4, cancel: 1, total: 5 },
  canais: [{ canal: "WhatsApp", valor: 120 }, { canal: "Balcão", valor: 60 }],
  pagamentos: [{ forma: "Pix", qtd: 3 }, { forma: "Dinheiro", qtd: 1 }],
  itens: [
    { item_id: "1", descricao: "X-Burguer", qtd: 5, valor: 100 },
    { item_id: "2", descricao: "Coca",      qtd: 3, valor: 30 },
    { item_id: null, descricao: "Item solto", qtd: 1, valor: 5 },
    { item_id: "1", descricao: "X-Burguer", qtd: 2, valor: 40 }, // mescla por descrição
  ],
};
const cardapio = {
  categorias: [
    { nome: "Lanches", itens: [{ id: 1, nome: "X-Burguer" }] },
    { nome: "Bebidas", itens: [{ id: 2, nome: "Coca" }] },
  ],
};

test("série diária: 30 pontos, último é hoje, valores mapeados e gaps zerados", () => {
  const d = montarDashboard(raw, cardapio);
  assert.equal(d.serieDia.length, 30);
  assert.equal(d.serieDia[29].rotulo, "05/07");
  assert.equal(d.serieDia[29].valor, 100);
  assert.equal(d.serieDia[28].rotulo, "04/07");
  assert.equal(d.serieDia[28].valor, 50);
  const d0703 = d.serieDia.find((x) => x.rotulo === "03/07");
  assert.equal(d0703.valor, 0); // dia sem venda → zero
});

test("série mensal: 12 pontos, rótulos abreviados, limite de 11 meses atrás", () => {
  const d = montarDashboard(raw, cardapio);
  assert.equal(d.serieMes.length, 12);
  assert.equal(d.serieMes[11].rotulo, "Jul de 2026");
  assert.equal(d.serieMes[11].valor, 180);
  assert.equal(d.serieMes[10].rotulo, "Jun de 2026");
  assert.equal(d.serieMes[10].valor, 500);
  assert.equal(d.serieMes[0].rotulo, "Ago de 2025");
  assert.equal(d.serieMes[0].valor, 12);
});

test("janelas de venda: hoje / ontem / 7 dias / mês", () => {
  const d = montarDashboard(raw, cardapio);
  assert.equal(d.vendas.hoje, 100);
  assert.equal(d.vendas.ontem, 50);
  assert.equal(d.vendas.sete, 180); // 100 (hoje) + 50 (ontem) + 30 (06/30, dentro dos 7)
  assert.equal(d.vendas.mes, 180);
});

test("legendas de data", () => {
  const d = montarDashboard(raw, cardapio);
  assert.equal(d.labels.hoje, "05/07/2026");
  assert.equal(d.labels.ontem, "04/07/2026");
  assert.equal(d.labels.sete, "29/06 a 05/07");
  assert.equal(d.labels.mes, "Julho de 2026");
});

test("top 10: mescla por descrição e ordena por faturamento", () => {
  const d = montarDashboard(raw, cardapio);
  assert.deepEqual(d.top10, [
    { nome: "X-Burguer", valor: 140 }, // 100 + 40
    { nome: "Coca", valor: 30 },
    { nome: "Item solto", valor: 5 },
  ]);
});

test("ranking de grupos: mapeia item → categoria, item sem categoria vira Outros", () => {
  const d = montarDashboard(raw, cardapio);
  assert.deepEqual(d.ranking, [
    { nome: "Lanches", qtd: 7 }, // X-Burguer 5 + 2
    { nome: "Bebidas", qtd: 3 },
    { nome: "Outros", qtd: 1 },  // item_id null e não bate por nome
  ]);
});

test("visão geral: ticket, taxa de cancelamento, canais % e pagamento %", () => {
  const d = montarDashboard(raw, cardapio);
  assert.equal(d.visao.ticket, 45);      // 180 / 4
  assert.equal(d.visao.taxaCanc, 20);    // 1 / 5
  assert.deepEqual(d.visao.canais, [
    { nome: "WhatsApp", pct: 67 },        // 120/180
    { nome: "Balcão", pct: 33 },          // 60/180
  ]);
  assert.deepEqual(d.visao.pagamento, { nome: "Pix", pct: 75 }); // 3/4
});

test("guardas: entrada vazia não quebra (sem divisão por zero, pagamento null)", () => {
  const d = montarDashboard({}, null);
  assert.equal(d.serieDia.length, 30);
  assert.equal(d.serieMes.length, 12);
  assert.equal(d.vendas.hoje, 0);
  assert.equal(d.vendas.mes, 0);
  assert.equal(d.visao.ticket, 0);
  assert.equal(d.visao.taxaCanc, 0);
  assert.deepEqual(d.visao.canais, []);
  assert.equal(d.visao.pagamento, null);
  assert.deepEqual(d.top10, []);
  assert.deepEqual(d.ranking, []);
});
