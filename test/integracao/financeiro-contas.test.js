// ============================================================
// FINANCEIRO — contas e razão. T-04.03 (Sprint 04).
//
// Este arquivo cobre CONTAS + IMPLANTAÇÃO + MOVIMENTO BÁSICO. Transferência,
// estorno e conciliação (T-04.04) ficam em financeiro.test.js — nome
// diferente de propósito: o plano original não previa arquivo de teste para
// esta task, e usar o mesmo nome de T-04.04 colidiria.
// ============================================================

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const financeiroDb = require("../../src/financeiro-db");
const tenant = require("./ajuda/tenant");

let lojaA;
let lojaB;

before(async () => {
  lojaA = await tenant.criarEmpresa("financeiro-contas-a");
  lojaB = await tenant.criarEmpresa("financeiro-contas-b");
});

after(async () => {
  await tenant.limparTudo();
});

test("implantação e movimento atualizam saldo e razão no MESMO commit", async () => {
  const conta = await financeiroDb.criarConta(lojaA.dir, { nome: "Conta Principal", saldoInicial: 100 }, { tipo: "dono" });
  assert.equal(conta.saldo, 100);

  const movimentos = await financeiroDb.listarMovimentos(lojaA.dir, conta.id);
  assert.equal(movimentos.length, 1);
  assert.equal(movimentos[0].tipo, "implantacao");
  assert.equal(movimentos[0].valor, 100);
  assert.equal(movimentos[0].saldoDepois, 100);

  const pagamento = await financeiroDb.registrarMovimento(lojaA.dir, conta.id, { tipo: "pagamento", valor: -30, descricao: "Pagamento a fornecedor" }, { tipo: "dono" });
  assert.equal(pagamento.saldoDepois, 70);

  const contaAtual = await financeiroDb.buscarConta(lojaA.dir, conta.id);
  assert.equal(contaAtual.saldo, 70);
});

test("isolamento: contas de um tenant não aparecem para o outro", async () => {
  await financeiroDb.criarConta(lojaA.dir, { nome: "Conta Isolada A" }, { tipo: "dono" });
  await financeiroDb.criarConta(lojaB.dir, { nome: "Conta Isolada B" }, { tipo: "dono" });

  const contasA = await financeiroDb.listarContas(lojaA.dir);
  const contasB = await financeiroDb.listarContas(lojaB.dir);
  assert.ok(contasA.some((c) => c.nome === "Conta Isolada A"));
  assert.ok(!contasA.some((c) => c.nome === "Conta Isolada B"));
  assert.ok(contasB.some((c) => c.nome === "Conta Isolada B"));
  assert.ok(!contasB.some((c) => c.nome === "Conta Isolada A"));
});

test("conta arquivada MANTÉM o extrato e RECUSA novo movimento", async () => {
  const conta = await financeiroDb.criarConta(lojaA.dir, { nome: "Conta a Arquivar", saldoInicial: 50 }, { tipo: "dono" });
  await financeiroDb.arquivarConta(lojaA.dir, conta.id, true);

  // Extrato continua acessível (histórico preservado).
  const movimentos = await financeiroDb.listarMovimentos(lojaA.dir, conta.id);
  assert.equal(movimentos.length, 1);

  // Novo movimento é recusado — a transação some sem alterar saldo.
  await assert.rejects(
    () => financeiroDb.registrarMovimento(lojaA.dir, conta.id, { tipo: "pagamento", valor: -10 }, { tipo: "dono" }),
    (e) => e.codigo === "CONTA_ARQUIVADA"
  );
  const contaDepois = await financeiroDb.buscarConta(lojaA.dir, conta.id);
  assert.equal(contaDepois.saldo, 50, "saldo não deve mudar quando o movimento é recusado");
});

test("saldo da conta equivale ao saldo inicial mais todos os movimentos confirmados", async () => {
  const conta = await financeiroDb.criarConta(lojaA.dir, { nome: "Conta Conferência", saldoInicial: 200 }, { tipo: "dono" });
  await financeiroDb.registrarMovimento(lojaA.dir, conta.id, { tipo: "pagamento", valor: -50 }, { tipo: "dono" });
  await financeiroDb.registrarMovimento(lojaA.dir, conta.id, { tipo: "pagamento", valor: -30 }, { tipo: "dono" });
  await financeiroDb.registrarMovimento(lojaA.dir, conta.id, { tipo: "estorno", valor: 30 }, { tipo: "dono" });

  const movimentos = await financeiroDb.listarMovimentos(lojaA.dir, conta.id, { limite: 100 });
  const somaMovimentos = movimentos.reduce((acc, m) => acc + m.valor, 0);
  const contaAtual = await financeiroDb.buscarConta(lojaA.dir, conta.id);
  assert.equal(contaAtual.saldo, somaMovimentos, "saldo da conta = soma de TODOS os movimentos (implantação incluída)");
  assert.equal(contaAtual.saldo, 200 - 50 - 30 + 30);
});

test("movimento com valor zero é rejeitado (VALOR_INVALIDO)", async () => {
  const conta = await financeiroDb.criarConta(lojaA.dir, { nome: "Conta Valor Zero" }, { tipo: "dono" });
  await assert.rejects(
    () => financeiroDb.registrarMovimento(lojaA.dir, conta.id, { tipo: "pagamento", valor: 0 }, { tipo: "dono" }),
    (e) => e.codigo === "VALOR_INVALIDO"
  );
});
