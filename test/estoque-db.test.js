const { test } = require("node:test");
const assert = require("node:assert/strict");
const estoqueDb = require("../src/estoque-db");
const db = require("../src/db");

function fakeClient() {
  const calls = [];
  return { calls, async query(sql, params) { calls.push({ sql, params }); return { rows: [], rowCount: 1 }; } };
}

const MOV = [
  { itemId: "a1", variacaoId: null, quantidade: -2, saldoDepois: 1, descricao: "Espeto", unidade: "un" },
  { itemId: "a4", variacaoId: "v1", quantidade: -1, saldoDepois: 3, descricao: "Marmitex (P)", unidade: "un" },
];

test("registrarTx: um INSERT só, com todos os movimentos", async () => {
  const c = fakeClient();
  const n = await estoqueDb.registrarTx(c, "emp-uuid", MOV, { tipo: "venda", pedidoId: 7, numero: 12 });
  assert.equal(n, 2);
  assert.equal(c.calls.length, 1);
  assert.match(c.calls[0].sql, /INSERT INTO estoque_movimentos/i);
  assert.equal(c.calls[0].params.length, 2 * 12);
  assert.equal(c.calls[0].params[0], "emp-uuid");
  assert.equal(c.calls[0].params[3], "venda");
});

test("registrarTx: lista vazia não toca o banco", async () => {
  const c = fakeClient();
  assert.equal(await estoqueDb.registrarTx(c, "emp-uuid", [], { tipo: "venda" }), 0);
  assert.equal(c.calls.length, 0);
});

test("registrarTx: movimento de quantidade zero é descartado", async () => {
  const c = fakeClient();
  const n = await estoqueDb.registrarTx(c, "emp-uuid",
    [{ itemId: "a1", variacaoId: null, quantidade: 0, saldoDepois: 3, descricao: "x", unidade: "un" }],
    { tipo: "ajuste" });
  assert.equal(n, 0);
  assert.equal(c.calls.length, 0);
});

test("registrarTx: tipo desconhecido é recusado", async () => {
  const c = fakeClient();
  await assert.rejects(() => estoqueDb.registrarTx(c, "emp-uuid", MOV, { tipo: "chute" }), /tipo/i);
});

test("esquecer: limpa o cache de empresa_id para o slug", async () => {
  const origQuery = db.query;
  let queryCount = 0;
  try {
    db.query = async (sql, params) => {
      if (sql.includes("SELECT id FROM empresas")) queryCount++;
      return { rows: [{ id: "uuid-123" }], rowCount: 1 };
    };
    const slug = "test-slug-for-cache";
    const dir = `/some/path/${slug}`;

    // Primeira chamada deve consultar o banco
    await estoqueDb.empresaId(dir);
    assert.equal(queryCount, 1, "primeira chamada deve fazer query");

    // Segunda chamada deve usar o cache (sem query)
    await estoqueDb.empresaId(dir);
    assert.equal(queryCount, 1, "segunda chamada deve usar cache");

    // Limpar cache
    estoqueDb.esquecer(slug);

    // Terceira chamada deve consultar novamente (cache limpo)
    await estoqueDb.empresaId(dir);
    assert.equal(queryCount, 2, "terceira chamada após esquecer deve fazer query de novo");
  } finally {
    db.query = origQuery;
  }
});
