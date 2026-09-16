const { test } = require("node:test");
const assert = require("node:assert/strict");
const estoqueDb = require("../src/estoque-db");
const db = require("../src/db");

function stub(handler) {
  const chamadas = [];
  const antes = db.query;
  db.query = async (sql, params) => {
    chamadas.push({ sql, params });
    if (/FROM empresas/i.test(sql)) return { rows: [{ id: "emp-uuid" }] };
    return handler ? handler(sql, params) : { rows: [] };
  };
  return { chamadas, restaurar: () => { db.query = antes; } };
}

test("listarGeral: sem filtro nenhum não filtra por item_id nem tipo", async () => {
  const { chamadas, restaurar } = stub();
  try {
    await estoqueDb.listarGeral("/x/slug-geral-1", {});
    const q = chamadas.find((c) => /FROM estoque_movimentos/i.test(c.sql));
    assert.doesNotMatch(q.sql, /item_id/i);
    assert.doesNotMatch(q.sql, /tipo = ANY/i);
    assert.equal(q.params[0], "emp-uuid");
  } finally { restaurar(); }
});

test("listarGeral: com tipos, o SQL tem tipo = ANY($n) com os valores certos", async () => {
  const { chamadas, restaurar } = stub();
  try {
    await estoqueDb.listarGeral("/x/slug-geral-2", { tipos: ["entrada", "perda"] });
    const q = chamadas.find((c) => /FROM estoque_movimentos/i.test(c.sql));
    assert.match(q.sql, /tipo = ANY\(\$2\)/);
    assert.deepEqual(q.params[1], ["entrada", "perda"]);
  } finally { restaurar(); }
});

test("listarGeral: com desde/ate, o SQL tem a cláusula de data certa (fuso BR)", async () => {
  const { chamadas, restaurar } = stub();
  try {
    await estoqueDb.listarGeral("/x/slug-geral-3", { desde: "2026-09-01", ate: "2026-09-10" });
    const q = chamadas.find((c) => /FROM estoque_movimentos/i.test(c.sql));
    assert.match(q.sql, /criado_em >= \(\$2::date\)/);
    assert.match(q.sql, /criado_em < \(\$3::date \+ 1\)/);
    assert.deepEqual(q.params.slice(1, 3), ["2026-09-01", "2026-09-10"]);
  } finally { restaurar(); }
});

test("listarGeral: com periodo hoje/7dias, o SQL usa janela relativa ao fuso BR, sem parâmetro de data", async () => {
  const { chamadas, restaurar } = stub();
  try {
    await estoqueDb.listarGeral("/x/slug-geral-4", { periodo: "hoje" });
    const q = chamadas.find((c) => /FROM estoque_movimentos/i.test(c.sql));
    assert.match(q.sql, /America\/Sao_Paulo/);
    assert.match(q.sql, /now\(\) AT TIME ZONE/);
    assert.equal(q.params.length, 2); // empId + limite, nada de data como parâmetro
  } finally { restaurar(); }
});

test("listarGeral: cursor antes/antesId filtra por (criado_em, id), ordenado DESC", async () => {
  const { chamadas, restaurar } = stub();
  try {
    await estoqueDb.listarGeral("/x/slug-geral-5", { tipos: ["entrada", "perda"], antes: "2026-09-10T12:00:00.000Z", antesId: 900 });
    const q = chamadas.find((c) => /FROM estoque_movimentos/i.test(c.sql));
    assert.match(q.sql, /ORDER BY criado_em DESC, id DESC/i);
    assert.match(q.sql, /\(criado_em, id\) < \(\$3::timestamptz, \$4::bigint\)/);
    assert.equal(q.params[2], "2026-09-10T12:00:00.000Z");
    assert.equal(q.params[3], 900);
  } finally { restaurar(); }
});

test("listarGeral: devolve as linhas mapeadas (mapRow)", async () => {
  const linhaCrua = {
    id: 1, item_id: "a1", variacao_id: null, tipo: "entrada", quantidade: 5, saldo_depois: 10,
    descricao: "Compra", unidade: "un", pedido_id: null, numero: null, obs: null,
    criado_em: "2026-09-10T12:00:00.000Z",
  };
  const { restaurar } = stub((sql) => (/FROM estoque_movimentos/i.test(sql) ? { rows: [linhaCrua] } : { rows: [] }));
  try {
    const linhas = await estoqueDb.listarGeral("/x/slug-geral-6", {});
    assert.equal(linhas.length, 1);
    assert.equal(linhas[0].itemId, "a1");
    assert.equal(linhas[0].tipo, "entrada");
    assert.equal(linhas[0].quantidade, 5);
  } finally { restaurar(); }
});

test("listarGeral: limite é clampado entre 1 e 100", async () => {
  const { chamadas, restaurar } = stub();
  try {
    await estoqueDb.listarGeral("/x/slug-geral-7", { limite: 500 });
    const q = chamadas.find((c) => /FROM estoque_movimentos/i.test(c.sql));
    assert.equal(q.params[q.params.length - 1], 100);
  } finally { restaurar(); }
});
