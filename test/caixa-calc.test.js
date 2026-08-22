const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resumoCaixa, calcularDiferenca, ehDinheiro, totalContagem, esperadoEletronico, totalEmCaixa, esperadoPorForma } = require("../src/caixa-calc");

const caixa = { fundo_troco: 100 };
const movs = [
  { tipo: "recebimento", forma_pagamento: "Dinheiro", valor: 50 },
  { tipo: "recebimento", forma_pagamento: "dinheiro", valor: 30 }, // case-insensitive
  { tipo: "recebimento", forma_pagamento: "Pix", valor: 20 },
  { tipo: "suprimento", valor: 10 },
  { tipo: "sangria", valor: 25 },
];

test("resumoCaixa: agrega por forma, dinheiro e esperado em espécie", () => {
  const r = resumoCaixa(caixa, movs);
  assert.equal(r.totalRecebido, 100);
  assert.equal(r.recebidoDinheiro, 80);        // 50 + 30
  assert.equal(r.recebidoPorForma["Pix"], 20);
  assert.equal(r.suprimentos, 10);
  assert.equal(r.sangrias, 25);
  // fundo 100 + dinheiro 80 + suprimento 10 − sangria 25 = 165
  assert.equal(r.esperadoEspecie, 165);
});

test("resumoCaixa: caixa sem movimentos = só o fundo", () => {
  const r = resumoCaixa({ fundo_troco: 70 }, []);
  assert.equal(r.totalRecebido, 0);
  assert.equal(r.recebidoDinheiro, 0);
  assert.equal(r.esperadoEspecie, 70);
});

test("calcularDiferenca: sobra/falta/zero", () => {
  assert.equal(calcularDiferenca(165, 170), 5);   // sobra
  assert.equal(calcularDiferenca(165, 160), -5);  // falta
  assert.equal(calcularDiferenca(165, 165), 0);
});

test("ehDinheiro: case-insensitive, ignora espaços", () => {
  assert.equal(ehDinheiro(" Dinheiro "), true);
  assert.equal(ehDinheiro("DINHEIRO"), true);
  assert.equal(ehDinheiro("Pix"), false);
  assert.equal(ehDinheiro(null), false);
});

test("totalContagem: soma cédulas×qtd (centavos→reais), sem erro de float", () => {
  const c = { "10000": 1, "2000": 2, "100": 3, "5": 3 }; // 100 + 40 + 3 + 0,15
  assert.equal(totalContagem(c), 143.15);
});

test("totalContagem: vazio/sem qtd = 0", () => {
  assert.equal(totalContagem({}), 0);
  assert.equal(totalContagem({ "10000": 0 }), 0);
});

test("esperadoEletronico: total recebido menos o que entrou em dinheiro", () => {
  assert.equal(esperadoEletronico({ totalRecebido: 180, recebidoDinheiro: 100 }), 80);
});

test("totalEmCaixa: fundo + suprimento + vendas - sangria - cancelamentos", () => {
  const c = { fundo_troco: 50 };
  const r = { totalRecebido: 180, suprimentos: 20, sangrias: 10, cancelamentos: 30 };
  assert.equal(totalEmCaixa(c, r), 210); // 50 + 180 + 20 - 10 - 30
});

test("resumoCaixa: cancelamento deduz por forma do total e da espécie", () => {
  const movsC = [
    { tipo: "recebimento", forma_pagamento: "Dinheiro", valor: 50 },
    { tipo: "recebimento", forma_pagamento: "Pix", valor: 20 },
    { tipo: "cancelamento", forma_pagamento: "Dinheiro", valor: 50 }, // devolve a venda em dinheiro
  ];
  const r = resumoCaixa({ fundo_troco: 100 }, movsC);
  assert.equal(r.totalRecebido, 70);              // bruto: 50 + 20
  assert.equal(r.cancelamentos, 50);              // cancelado
  assert.equal(r.canceladoDinheiro, 50);
  assert.equal(r.canceladoPorForma["Dinheiro"], 50);
  // espécie: 100 + 50 (dinheiro) + 0 - 0 - 50 (cancelado dinheiro) = 100
  assert.equal(r.esperadoEspecie, 100);
  // total em caixa: 100 + 70 - 50 = 120
  assert.equal(totalEmCaixa({ fundo_troco: 100 }, r), 120);
});

test("resumoCaixa: estorno deduz igual ao cancelamento (recebimento errado)", () => {
  const movsE = [
    { tipo: "recebimento", forma_pagamento: "Pix", valor: 40 },      // recebido na forma errada
    { tipo: "estorno", forma_pagamento: "Pix", valor: 40 },          // estornado (some do líquido)
    { tipo: "recebimento", forma_pagamento: "Dinheiro", valor: 40 }, // recebido de novo, certo
  ];
  const r = resumoCaixa({ fundo_troco: 0 }, movsE);
  assert.equal(r.totalRecebido, 80);                 // bruto: 40 + 40
  assert.equal(r.cancelamentos, 40);                 // estorno entra como dedução
  assert.equal(r.canceladoPorForma["Pix"], 40);
  // total em caixa: 0 + 80 - 40 = 40 (só o recebimento correto em dinheiro)
  assert.equal(totalEmCaixa({ fundo_troco: 0 }, r), 40);
  assert.equal(r.recebidoDinheiro, 40);
});

test("esperadoEletronico: desconta o cancelado eletrônico", () => {
  const r = { totalRecebido: 180, recebidoDinheiro: 100, cancelamentos: 30, canceladoDinheiro: 0 };
  // recebido elet = 80; cancelado elet = 30 → 50
  assert.equal(esperadoEletronico(r), 50);
});

test("esperadoPorForma: dinheiro = espécie inteira, resto = recebido líquido; soma = totalEmCaixa", () => {
  const c = { fundo_troco: 100 };
  const movsF = [
    { tipo: "recebimento", forma_pagamento: "Dinheiro", valor: 50 },
    { tipo: "recebimento", forma_pagamento: "Pix", valor: 20 },
    { tipo: "recebimento", forma_pagamento: "Crédito", valor: 40 },
    { tipo: "cancelamento", forma_pagamento: "Pix", valor: 5 }, // cancela parte do Pix
    { tipo: "suprimento", valor: 10 },
    { tipo: "sangria", valor: 25 },
  ];
  const r = resumoCaixa(c, movsF);
  const formas = ["Dinheiro", "Pix", "Crédito", "Débito"]; // Débito configurado sem movimento
  const esp = esperadoPorForma(r, formas);
  // Dinheiro = espécie: 100 + 50 + 10 - 25 - 0 = 135
  assert.equal(esp["Dinheiro"], 135);
  assert.equal(esp["Pix"], 15);      // 20 - 5
  assert.equal(esp["Crédito"], 40);
  assert.equal(esp["Débito"], 0);    // sem movimento → 0,00
  // soma por forma bate com o total em caixa (invariante)
  const somaForma = formas.reduce((s, f) => s + esp[f], 0);
  assert.equal(somaForma, totalEmCaixa(c, r)); // 100 + 110 + 10 - 25 - 5 = 190
});


// ---------------------------------------------------------------------------
// A tela do caixa precisa explicar o "Total em Caixa" que ela mostra.
//
// A legenda dizia "Valor inicial + Suprimentos + Vendas - Sangrias", mas o
// calculo tambem subtrai os CANCELAMENTOS, e o card "Movimentacao do caixa" nao
// os listava em lugar nenhum. Nao e hipotese: a producao tinha 12 cancelamentos
// somando R$ 547,50, nos dois restaurantes. Cada pedido pago cancelado derrubava
// o total sem que a tela explicasse de onde saiu — e quem confere a gaveta nao
// fechava a conta.
//
// A linha de Cancelamentos so aparece quando existe algum no turno, para nao
// poluir o dia normal com um zero que nao diz nada.
// ---------------------------------------------------------------------------

const fsCx = require("fs");
const pathCx = require("path");
const appCx = fsCx.readFileSync(pathCx.join(__dirname, "..", "public", "app.js"), "utf8");

function blocoCaixaAberto() {
  const i = appCx.indexOf("function renderCaixaAberto(");
  assert.ok(i > -1, "renderCaixaAberto não encontrado");
  const fim = appCx.indexOf("\nasync function estornarCaixa", i);
  return appCx.slice(i, fim === -1 ? undefined : fim);
}

test("a legenda do Total em Caixa cita os cancelamentos que ela subtrai", () => {
  const b = blocoCaixaAberto();
  const i = b.indexOf("cx-formula");
  assert.ok(i > -1, "legenda da fórmula não encontrada");
  const legenda = b.slice(i, i + 220);
  assert.match(legenda, /Cancelamentos/i,
    "a conta subtrai cancelamentos; omitir isso na legenda impede conferir a gaveta");
});

test("o card de movimentação mostra os cancelamentos do turno", () => {
  const b = blocoCaixaAberto();
  const i = b.indexOf("Movimenta\u00e7\u00e3o do caixa");
  assert.ok(i > -1);
  const card = b.slice(i, i + 900);
  assert.match(card, /Cancelamentos/,
    "sem a linha, os R$ 547,50 existem só no extrato, misturados com o resto");
  assert.match(card, /cancelamentos\s*>\s*0/,
    "a linha só aparece quando há cancelamento — zero fixo polui o dia normal");
});
