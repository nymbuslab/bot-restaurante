const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resumoCaixa, calcularDiferenca, ehDinheiro, totalContagem, esperadoEletronico, totalEmCaixa } = require("../src/caixa-calc");

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

test("resumoCaixa: venda a prazo é informativa (não conta na conferência)", () => {
  const movsFiado = [
    { tipo: "recebimento", forma_pagamento: "Dinheiro", valor: 40 },
    { tipo: "venda_prazo", forma_pagamento: "A Prazo", valor: 100 }, // NÃO conta
  ];
  const r = resumoCaixa({ fundo_troco: 0 }, movsFiado);
  assert.equal(r.vendasPrazo, 100);
  assert.equal(r.totalRecebido, 40);            // fiado fora
  assert.equal(r.recebidoDinheiro, 40);
  assert.equal(r.esperadoEspecie, 40);          // fundo 0 + 40, sem os 100
  assert.equal(totalEmCaixa({ fundo_troco: 0 }, r), 40); // fiado não infla o caixa
});
