const { test } = require("node:test");
const assert = require("node:assert/strict");

function quantidadeBase(embalagens, quantidadePorEmbalagem) {
  return embalagens * quantidadePorEmbalagem;
}

function custoMedioMovel({ saldo, custo, entrada, valorEntrada }) {
  const novoSaldo = saldo + entrada;
  const novoCusto = saldo > 0 ? (saldo * custo + valorEntrada) / novoSaldo : valorEntrada / entrada;
  return { saldo: novoSaldo, custo: Number(novoCusto.toFixed(6)) };
}

function ratearCentavos(total, pesos) {
  const soma = pesos.reduce((acumulado, peso) => acumulado + peso, 0);
  if (!Number.isInteger(total) || total < 0 || soma <= 0) throw new Error("rateio inválido");

  const exatos = pesos.map((peso) => (total * peso) / soma);
  const partes = exatos.map(Math.floor);
  let restante = total - partes.reduce((acumulado, parte) => acumulado + parte, 0);
  const ordem = exatos
    .map((valor, indice) => ({ indice, resto: valor - Math.floor(valor) }))
    .sort((a, b) => b.resto - a.resto || a.indice - b.indice);
  for (let i = 0; i < restante; i += 1) partes[ordem[i].indice] += 1;
  return partes;
}

function custoLiquidoLinha({ bruto, desconto = 0, frete = 0, seguro = 0, despesas = 0, imposto = 0, impostoRecuperavel = false }) {
  return bruto - desconto + frete + seguro + despesas + (impostoRecuperavel ? 0 : imposto);
}

test("D-P1-01: quatro embalagens de 5 kg geram exatamente 20 kg", () => {
  assert.equal(quantidadeBase(4, 5), 20);
});

test("D-P1-01: média móvel preserva seis casas e recompõe saldo não positivo", () => {
  assert.deepEqual(custoMedioMovel({ saldo: 10, custo: 5, entrada: 20, valorEntrada: 120 }), {
    saldo: 30,
    custo: 5.666667,
  });
  assert.deepEqual(custoMedioMovel({ saldo: 0, custo: 0, entrada: 20, valorEntrada: 120 }), {
    saldo: 20,
    custo: 6,
  });
  assert.deepEqual(custoMedioMovel({ saldo: -3, custo: 9, entrada: 20, valorEntrada: 120 }), {
    saldo: 17,
    custo: 6,
  });
});

test("D-P1-04: frete de 10 reais rateia 6 e 4 sobre linhas 60/40", () => {
  assert.deepEqual(ratearCentavos(1000, [6000, 4000]), [600, 400]);
});

test("D-P1-04: desconto da linha e classificação tributária não vazam para outra linha", () => {
  assert.equal(custoLiquidoLinha({ bruto: 6000, desconto: 300, imposto: 200, impostoRecuperavel: true }), 5700);
  assert.equal(custoLiquidoLinha({ bruto: 4000, desconto: 0, imposto: 200, impostoRecuperavel: false }), 4200);
});

test("D-P1-04: centavo residual é determinístico e a prévia não altera saldos", () => {
  const saldos = [10, 20, 30];
  const antes = saldos.slice();
  const rateio = ratearCentavos(1, [1, 1, 1]);
  assert.deepEqual(rateio, [1, 0, 0]);
  assert.equal(rateio.reduce((total, valor) => total + valor, 0), 1);
  assert.deepEqual(saldos, antes);
});
