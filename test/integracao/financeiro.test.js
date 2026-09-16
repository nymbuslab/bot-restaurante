// ============================================================
// FINANCEIRO — transferências e conciliação manual. T-04.04 (Sprint 04).
//
// Contas e movimento básico (implantação/pagamento) são cobertos por
// financeiro-contas.test.js (T-04.03). Este arquivo cobre a parte nova desta
// task: transferência vinculada, estorno e conciliação, por HTTP.
// ============================================================

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");
const financeiroDb = require("../../src/financeiro-db");

let loja;

before(async () => {
  loja = await tenant.criarEmpresa("financeiro-transf", { plano: "completo" });
});

after(async () => {
  await app.derrubar();
  await tenant.limparTudo();
});

async function criarContaHttp(nome, saldoInicial = 0) {
  const r = await app.pedir("/api/financeiro/contas", { token: loja.token, corpo: { nome, saldoInicial } });
  assert.equal(r.status, 201, "setup: criar conta " + nome);
  return r.corpo.conta;
}

test("transferir 100 reduz a origem em 100, aumenta o destino em 100 e compartilha um vínculo", async () => {
  const origem = await criarContaHttp("Conta Origem", 500);
  const destino = await criarContaHttp("Conta Destino", 200);

  const r = await app.pedir("/api/financeiro/transferencias", {
    token: loja.token,
    corpo: { contaOrigemId: origem.id, contaDestinoId: destino.id, valor: 100, descricao: "Repasse" },
  });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.debito.valor, -100);
  assert.equal(r.corpo.credito.valor, 100);
  assert.equal(r.corpo.debito.vinculoId, r.corpo.credito.vinculoId, "débito e crédito compartilham o mesmo vínculo");

  const origemDepois = await app.pedir(`/api/financeiro/contas/${origem.id}`, { token: loja.token });
  const destinoDepois = await app.pedir(`/api/financeiro/contas/${destino.id}`, { token: loja.token });
  assert.equal(origemDepois.corpo.conta.saldo, 400);
  assert.equal(destinoDepois.corpo.conta.saldo, 300);
});

test("falha no crédito (conta destino arquivada) reverte também o débito — nenhuma conta fica parcialmente atualizada", async () => {
  const origem = await criarContaHttp("Conta Origem Rollback", 300);
  const destino = await criarContaHttp("Conta Destino Arquivada", 0);
  const arquivar = await app.pedir(`/api/financeiro/contas/${destino.id}/arquivar`, { token: loja.token, metodo: "POST", corpo: {} });
  assert.equal(arquivar.status, 200);

  const r = await app.pedir("/api/financeiro/transferencias", {
    token: loja.token,
    corpo: { contaOrigemId: origem.id, contaDestinoId: destino.id, valor: 100 },
  });
  assert.equal(r.status, 409, "conta destino arquivada recusa o crédito");

  const origemDepois = await app.pedir(`/api/financeiro/contas/${origem.id}`, { token: loja.token });
  assert.equal(origemDepois.corpo.conta.saldo, 300, "débito da origem foi revertido pelo ROLLBACK");

  const extrato = await app.pedir(`/api/financeiro/contas/${origem.id}/movimentos`, { token: loja.token });
  assert.ok(!extrato.corpo.movimentos.some((m) => m.tipo === "transferencia_debito"), "nenhum movimento órfão de débito ficou gravado");
});

test("transferir para a mesma conta é recusado (400)", async () => {
  const conta = await criarContaHttp("Conta Sozinha", 50);
  const r = await app.pedir("/api/financeiro/transferencias", {
    token: loja.token, corpo: { contaOrigemId: conta.id, contaDestinoId: conta.id, valor: 10 },
  });
  assert.equal(r.status, 400);
});

test("estorno registra ator, aponta para o movimento original e não edita a linha original", async () => {
  const conta = await criarContaHttp("Conta Estorno", 200);
  const pagamento = await app.pedir(`/api/financeiro/contas/${conta.id}/movimentos`, {
    token: loja.token, corpo: { tipo: "pagamento", valor: -50, descricao: "Pagamento a fornecedor" },
  });
  assert.equal(pagamento.status, 201);
  const movimentoId = pagamento.corpo.movimento.id;

  const estorno = await app.pedir(`/api/financeiro/movimentos/${movimentoId}/estornar`, {
    token: loja.token, corpo: { motivo: "Pagamento em duplicidade" },
  });
  assert.equal(estorno.status, 201);
  assert.equal(estorno.corpo.estorno.valor, 50);
  assert.equal(estorno.corpo.estorno.estornoDe, movimentoId);
  assert.equal(estorno.corpo.estorno.atorTipo, "dono");

  const contaDepois = await app.pedir(`/api/financeiro/contas/${conta.id}`, { token: loja.token });
  assert.equal(contaDepois.corpo.conta.saldo, 200, "50 debitado + 50 estornado volta ao saldo original");

  const original = await app.pedir(`/api/financeiro/contas/${conta.id}/movimentos`, { token: loja.token });
  const linhaOriginal = original.corpo.movimentos.find((m) => m.id === movimentoId);
  assert.equal(linhaOriginal.valor, -50, "o movimento original não foi editado");
});

test("estornar o mesmo movimento duas vezes é recusado (409)", async () => {
  const conta = await criarContaHttp("Conta Estorno Duplo", 100);
  const pagamento = await app.pedir(`/api/financeiro/contas/${conta.id}/movimentos`, {
    token: loja.token, corpo: { tipo: "pagamento", valor: -20 },
  });
  const movimentoId = pagamento.corpo.movimento.id;

  const primeiro = await app.pedir(`/api/financeiro/movimentos/${movimentoId}/estornar`, { token: loja.token, corpo: {} });
  assert.equal(primeiro.status, 201);
  const segundo = await app.pedir(`/api/financeiro/movimentos/${movimentoId}/estornar`, { token: loja.token, corpo: {} });
  assert.equal(segundo.status, 409);
});

test("conciliação marca o movimento sem alterar valor nem saldo_depois", async () => {
  const conta = await criarContaHttp("Conta Conciliação", 100);
  const pagamento = await app.pedir(`/api/financeiro/contas/${conta.id}/movimentos`, {
    token: loja.token, corpo: { tipo: "pagamento", valor: -40 },
  });
  const movimentoId = pagamento.corpo.movimento.id;
  const valorAntes = pagamento.corpo.movimento.valor;
  const saldoDepoisAntes = pagamento.corpo.movimento.saldoDepois;

  const conciliar = await app.pedir(`/api/financeiro/movimentos/${movimentoId}/conciliar`, {
    token: loja.token, corpo: { conciliado: true },
  });
  assert.equal(conciliar.status, 200);
  assert.equal(conciliar.corpo.movimento.conciliado, true);
  assert.equal(conciliar.corpo.movimento.valor, valorAntes);
  assert.equal(conciliar.corpo.movimento.saldoDepois, saldoDepoisAntes);
  assert.ok(conciliar.corpo.movimento.conciliadoEm);
});

test("403 sem o plano (exigePdv) — dono de tenant Plano Essencial", async () => {
  const semPlano = await tenant.criarEmpresa("financeiro-essencial");
  const r = await app.pedir("/api/financeiro/contas", { token: semPlano.token });
  assert.equal(r.status, 403);
});

test("função transferir (chamada direta) também reverte em falha — nenhuma conta parcialmente atualizada", async () => {
  const origem = await financeiroDb.criarConta(loja.dir, { nome: "Direta Origem", saldoInicial: 80 }, { tipo: "dono" });
  await assert.rejects(
    () => financeiroDb.transferir(loja.dir, { contaOrigemId: origem.id, contaDestinoId: 99999999, valor: 30 }, { tipo: "dono" }),
    (e) => e.codigo === "CONTA_NAO_ENCONTRADA"
  );
  const origemDepois = await financeiroDb.buscarConta(loja.dir, origem.id);
  assert.equal(origemDepois.saldo, 80, "conta destino inexistente: débito da origem não pode ter sobrado");
});
