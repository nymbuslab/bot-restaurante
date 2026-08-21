const { test } = require("node:test");
const assert = require("node:assert/strict");
const dbMod = require("../src/db");
const caixa = require("../src/caixa");

// ---------------------------------------------------------------------------
// O caixa tem que ser reconferido SOB TRAVA, dentro da transação.
//
// `receberPedido` e `registrarMovimento` liam o caixa aberto antes de qualquer
// transação e usavam aquele id até o fim. Entre a leitura e a gravação cabe um
// `fecharCaixa` inteiro: o movimento entra num turno que já foi conferido,
// relatado e impresso, e o relatório guardado passa a divergir do que está no
// banco. `venderLocal` já fazia certo (relê com FOR UPDATE lá dentro); estas
// duas ficaram para trás.
//
// A sangria tinha um agravante: nenhuma transação. O teto era calculado fora,
// então duas sangrias simultâneas liam o mesmo saldo, as duas passavam, e o
// dinheiro em gaveta ficava negativo — impossível de conferir no fechamento.
// ---------------------------------------------------------------------------

// Monta um dublê que responde às queries e registra tudo. `caixaSob` é o que a
// releitura travada devolve: `null` simula o caixa fechado no meio do caminho.
function montar({ caixaSob = { id: 9, aberto_em: new Date(), fundo_troco: 0 }, movimentos = [] } = {}) {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (/SELECT id FROM empresas/i.test(sql)) return { rows: [{ id: "emp-uuid" }] };
      if (/FROM caixas/i.test(sql) && /FOR UPDATE/i.test(sql)) return { rows: caixaSob ? [caixaSob] : [] };
      if (/FROM caixas/i.test(sql)) return { rows: [{ id: 9, aberto_em: new Date(), fundo_troco: 0, status: "aberto" }] };
      if (/FROM caixa_movimentos/i.test(sql)) return { rows: movimentos };
      if (/FROM pedidos/i.test(sql)) {
        return { rows: [{ id: 41, recebido_em: null, total: 30, origem: "web", status: "novo" }] };
      }
      return { rows: [{ id: 1 }], rowCount: 1 };
    },
    release() {},
  };
  return { calls, client };
}

function comDb(client, fn) {
  const oPool = dbMod.pool, oQuery = dbMod.query;
  dbMod.pool = { connect: async () => client };
  dbMod.query = async (sql, params) => client.query(sql, params);
  return fn().finally(() => { dbMod.pool = oPool; dbMod.query = oQuery; });
}

test("receberPedido: relê o caixa sob trava dentro da transação", async () => {
  const { calls, client } = montar();
  await comDb(client, () =>
    caixa.receberPedido("/x/tenant-cx", 41, { pagamentos: [{ forma: "PIX", valor: 30 }] })
  );
  const sqls = calls.map((q) => q.sql);
  const iBegin = sqls.findIndex((s) => /^\s*BEGIN/i.test(s));
  const iTrava = sqls.findIndex((s) => /FROM caixas[\s\S]*FOR UPDATE/i.test(s));
  const iMov = sqls.findIndex((s) => /INSERT INTO caixa_movimentos/i.test(s));
  assert.ok(iTrava > -1, "precisa reler o caixa com FOR UPDATE");
  assert.ok(iBegin < iTrava && iTrava < iMov, "a releitura fica DENTRO da transação, antes de gravar");
});

test("receberPedido: caixa fechado no meio do caminho aborta o recebimento", async () => {
  const { calls, client } = montar({ caixaSob: null });
  await comDb(client, async () => {
    await assert.rejects(
      () => caixa.receberPedido("/x/tenant-cx", 41, { pagamentos: [{ forma: "PIX", valor: 30 }] }),
      /caixa foi fechado|Abra o caixa/i
    );
  });
  assert.equal(calls.filter((q) => /INSERT INTO caixa_movimentos/i.test(q.sql)).length, 0);
});

test("registrarMovimento: sangria roda em transação e trava o caixa", async () => {
  const { calls, client } = montar({ movimentos: [{ tipo: "recebimento", forma_pagamento: "Dinheiro", valor: 100 }] });
  await comDb(client, () => caixa.registrarMovimento("/x/tenant-cx", { tipo: "sangria", valor: 50, descricao: "banco" }));
  const sqls = calls.map((q) => q.sql);
  assert.ok(sqls.some((s) => /^\s*BEGIN/i.test(s)), "sangria precisa de transação");
  assert.ok(sqls.some((s) => /^\s*COMMIT/i.test(s)));
  const iTrava = sqls.findIndex((s) => /FROM caixas[\s\S]*FOR UPDATE/i.test(s));
  const iTeto = sqls.findIndex((s) => /FROM caixa_movimentos/i.test(s));
  const iIns = sqls.findIndex((s) => /INSERT INTO caixa_movimentos/i.test(s));
  assert.ok(iTrava > -1 && iTrava < iTeto, "o teto tem que ser lido DEPOIS da trava");
  assert.ok(iTeto < iIns, "e antes de gravar");
});

test("registrarMovimento: sangria maior que a gaveta continua barrada", async () => {
  const { calls, client } = montar({ movimentos: [{ tipo: "recebimento", forma_pagamento: "Dinheiro", valor: 10 }] });
  await comDb(client, async () => {
    await assert.rejects(
      () => caixa.registrarMovimento("/x/tenant-cx", { tipo: "sangria", valor: 500 }),
      /maior que o dinheiro em caixa/i
    );
  });
  assert.equal(calls.filter((q) => /INSERT INTO caixa_movimentos/i.test(q.sql)).length, 0);
});

test("registrarMovimento: caixa fechado no meio aborta a sangria", async () => {
  const { calls, client } = montar({ caixaSob: null });
  await comDb(client, async () => {
    await assert.rejects(
      () => caixa.registrarMovimento("/x/tenant-cx", { tipo: "sangria", valor: 5 }),
      /caixa foi fechado|Abra o caixa/i
    );
  });
  assert.equal(calls.filter((q) => /INSERT INTO caixa_movimentos/i.test(q.sql)).length, 0);
});

test("registrarMovimento: suprimento não precisa do teto, mas grava na transação", async () => {
  const { calls, client } = montar();
  await comDb(client, () => caixa.registrarMovimento("/x/tenant-cx", { tipo: "suprimento", valor: 200, descricao: "troco" }));
  const sqls = calls.map((q) => q.sql);
  assert.ok(sqls.some((s) => /^\s*BEGIN/i.test(s)));
  assert.ok(sqls.some((s) => /INSERT INTO caixa_movimentos/i.test(s)));
});
