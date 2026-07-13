const { test } = require("node:test");
const assert = require("node:assert/strict");
const Relatorio = require("../public/relatorio-caixa");

function dadosBase() {
  return {
    restaurante: "Meu Restaurante",
    abertoEm: "2026-06-20T17:02:00.000Z",
    fechadoEm: "2026-06-20T22:15:00.000Z",
    operador: "Ricardo Silva",
    formaDinheiro: "Dinheiro",
    formas: ["Cartão", "Pix"],
    recebidoPorForma: { Dinheiro: 100, Cartão: 50, Pix: 30 },
    fundoTroco: 50, suprimentos: 20, sangrias: 10,
    contadoDinheiro: 160,
    eletronicoPorForma: { Cartão: 50, Pix: 30 },
  };
}

test("relatório: seções, vendas por forma e totais agregados", () => {
  const txt = Relatorio.montarRelatorioFechamento(dadosBase());
  assert.match(txt, /FECHAMENTO DE CAIXA/);
  assert.match(txt, /Operador: Ricardo Silva/);
  assert.match(txt, /VENDAS/);
  assert.match(txt, /Dinheiro\s+R\$ 100,00/);
  assert.match(txt, /Cartão\s+R\$ 50,00/);
  assert.match(txt, /Pix\s+R\$ 30,00/);
  assert.match(txt, /Saldo Inicial\s+R\$ 50,00/);
  assert.match(txt, /Suprimento\s+R\$ 20,00/);
  assert.match(txt, /Retirada\s+- R\$ 10,00/);
  assert.match(txt, /Total de Vendas\s+R\$ 180,00/);
  assert.match(txt, /Total em Caixa\s+R\$ 240,00/);
  assert.match(txt, /FECHAMENTO OPERADOR/);
  assert.match(txt, /Total\s+R\$ 240,00/);
  assert.match(txt, /CONFERIDO/);
  assert.match(txt, /Diferença\s+R\$ 0,00/);
});

test("relatório: SOBROU quando operador conta a mais", () => {
  const d = dadosBase(); d.contadoDinheiro = 170; // +10
  const txt = Relatorio.montarRelatorioFechamento(d);
  assert.match(txt, /SOBROU/);
  assert.match(txt, /Diferença\s+\+ R\$ 10,00/);
});

test("relatório: FALTOU quando operador conta a menos", () => {
  const d = dadosBase(); d.contadoDinheiro = 150; // -10
  const txt = Relatorio.montarRelatorioFechamento(d);
  assert.match(txt, /FALTOU/);
  assert.match(txt, /Diferença\s+- R\$ 10,00/);
});

test("relatório: forma configurada sem venda aparece como 0,00", () => {
  const d = dadosBase();
  d.formas = ["Cartão", "Pix", "Vale"]; // Vale sem venda
  const txt = Relatorio.montarRelatorioFechamento(d);
  assert.match(txt, /Vale\s+R\$ 0,00/);
});

test("relatório: recebimento de forma fora da lista vira 'Outros'", () => {
  const d = dadosBase();
  d.recebidoPorForma = { Dinheiro: 100, Cartão: 50, Pix: 30, Cheque: 5 };
  const txt = Relatorio.montarRelatorioFechamento(d);
  assert.match(txt, /Outros\s+R\$ 5,00/);
});

test("relatório: cancelamento em dinheiro sai da linha da forma e do total (líquido)", () => {
  const d = dadosBase();
  d.canceladoPorForma = { Dinheiro: 30 };                 // pedido pago em dinheiro cancelado
  d.totalCancelado = 30;
  d.cancelamentos = [{ descricao: "Cancelamento pedido #7", forma: "Dinheiro", valor: 30 }];
  d.contadoDinheiro = 130; // 160 - 30 devolvidos
  const txt = Relatorio.montarRelatorioFechamento(d);
  assert.match(txt, /Dinheiro\s+R\$ 70,00/);              // 100 recebido - 30 cancelado = LÍQUIDO
  assert.match(txt, /Total de Vendas\s+R\$ 150,00/);      // 180 bruto - 30 cancelado
  assert.match(txt, /Total em Caixa\s+R\$ 210,00/);       // 240 - 30
  assert.match(txt, /CANCELAMENTOS/);
  assert.match(txt, /Cancelamento pedido #7 \(Dinheiro\)\s+- R\$ 30,00/);
  assert.match(txt, /CONFERIDO/);                         // 130 dinheiro + 80 elet = 210
});

test("relatório: recebimento a prazo (fiado) sai das VENDAS e vira seção própria, mas conta no caixa", () => {
  const d = dadosBase();
  // Dos R$ 30 de Pix e R$ 100 de dinheiro recebidos, parte é fiado recebido (cobrança de dívida).
  d.recebidoPorForma = { Dinheiro: 100, Cartão: 50, Pix: 34 }; // Pix 30 venda + 4 fiado
  d.recebidoPrazoPorForma = { Pix: 4, Dinheiro: 6 };           // fiado recebido: 4 Pix + 6 dinheiro
  const txt = Relatorio.montarRelatorioFechamento(d);
  // VENDAS mostra só a venda do dia: Pix 30 (34 − 4), Dinheiro 94 (100 − 6).
  assert.match(txt, /Pix\s+R\$ 30,00/);
  assert.match(txt, /Dinheiro\s+R\$ 94,00/);
  assert.match(txt, /Total de Vendas\s+R\$ 174,00/);          // 184 recebido − 10 fiado
  // Seção separada de recebimentos a prazo.
  assert.match(txt, /RECEBIMENTOS A PRAZO \(FIADO\)/);
  assert.match(txt, /Total recebido a prazo\s+R\$ 10,00/);
  // Total em Caixa continua com tudo (fiado está na gaveta): 50+20+174+10−10 = 244.
  assert.match(txt, /Total em Caixa\s+R\$ 244,00/);
});

test("relatório: cancelamento de Pix não infla a linha do Pix (líquido por forma)", () => {
  const d = dadosBase();
  // Recebeu Pix 17 (cancelado) + Pix 30 = 47 bruto; líquido = 30. Reproduz o caso real.
  d.recebidoPorForma = { Dinheiro: 100, Cartão: 50, Pix: 47 };
  d.canceladoPorForma = { Pix: 17 };
  d.totalCancelado = 17;
  d.cancelamentos = [{ descricao: "Cancelamento pedido #86", forma: "Pix", valor: 17 }];
  d.eletronicoPorForma = { Cartão: 50, Pix: 30 }; // operador conta o Pix real (30)
  const txt = Relatorio.montarRelatorioFechamento(d);
  assert.match(txt, /Pix\s+R\$ 30,00/);                   // LÍQUIDO, não os 47 brutos
  assert.match(txt, /Total de Vendas\s+R\$ 180,00/);      // 197 bruto - 17 = 180
  assert.match(txt, /Total em Caixa\s+R\$ 240,00/);       // 50+20+180-10
  assert.match(txt, /CANCELAMENTOS/);
  assert.match(txt, /Cancelamento pedido #86 \(Pix\)\s+- R\$ 17,00/);
  assert.match(txt, /CONFERIDO/);                         // 160 din + 80 elet = 240
});
