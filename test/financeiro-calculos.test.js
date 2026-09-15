const { test } = require("node:test");
const assert = require("node:assert/strict");

function distribuirParcelas(totalCentavos, quantidade) {
  const base = Math.floor(totalCentavos / quantidade);
  const restante = totalCentavos - base * quantidade;
  return Array.from({ length: quantidade }, (_, indice) => base + (indice < restante ? 1 : 0));
}

function movimentosTransferencia(valorCentavos, vinculo) {
  return [
    { tipo: "transferencia_saida", valor_centavos: -valorCentavos, vinculo },
    { tipo: "transferencia_entrada", valor_centavos: valorCentavos, vinculo },
  ];
}

function simularConfirmacao(estado, { entrada, valorEntrada, parcelas }) {
  if (entrada <= 0) throw new Error("entrada inválida");
  if (parcelas.reduce((total, valor) => total + valor, 0) !== valorEntrada) {
    throw new Error("parcelas não fecham o valor da entrada");
  }

  const novoSaldo = estado.saldo + entrada;
  const valorEntradaReais = valorEntrada / 100;
  const novoCusto = estado.saldo > 0
    ? (estado.saldo * estado.custo + valorEntradaReais) / novoSaldo
    : valorEntradaReais / entrada;
  return {
    documento: "confirmada",
    saldo: novoSaldo,
    custo: Number(novoCusto.toFixed(6)),
    parcelas: parcelas.slice(),
  };
}

test("parcelas fecham o total em centavos sem resíduo", () => {
  const parcelas = distribuirParcelas(10001, 3);
  assert.deepEqual(parcelas, [3334, 3334, 3333]);
  assert.equal(parcelas.reduce((total, valor) => total + valor, 0), 10001);
});

test("transferência reduz a origem e aumenta o destino pelo mesmo vínculo", () => {
  const movimentos = movimentosTransferencia(10000, "transferencia-1");
  assert.equal(movimentos.reduce((total, movimento) => total + movimento.valor_centavos, 0), 0);
  assert.equal(movimentos[0].vinculo, movimentos[1].vinculo);
});

test("confirmação simulada altera documento, estoque, custo e parcelas de forma atômica", () => {
  const inicial = { documento: "rascunho", saldo: 10, custo: 5, parcelas: [] };
  const confirmado = simularConfirmacao(inicial, { entrada: 20, valorEntrada: 12000, parcelas: [6000, 6000] });
  assert.deepEqual(confirmado, { documento: "confirmada", saldo: 30, custo: 5.666667, parcelas: [6000, 6000] });
  assert.deepEqual(inicial, { documento: "rascunho", saldo: 10, custo: 5, parcelas: [] });
});

test("falha em qualquer parte mantém todo o estado original", () => {
  const inicial = { documento: "rascunho", saldo: 10, custo: 5, parcelas: [] };
  assert.throws(
    () => simularConfirmacao(inicial, { entrada: -1, valorEntrada: 12000, parcelas: [12000] }),
    /entrada inválida/
  );
  assert.deepEqual(inicial, { documento: "rascunho", saldo: 10, custo: 5, parcelas: [] });
});
