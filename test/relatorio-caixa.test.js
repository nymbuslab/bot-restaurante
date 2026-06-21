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
