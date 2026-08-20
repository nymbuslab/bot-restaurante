const { test } = require("node:test");
const assert = require("node:assert/strict");
const estoqueDb = require("../src/estoque-db");
const db = require("../src/db");

function fakeClient() {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      // INSERT ... RETURNING id: devolve um id canned por linha inserida (params
      // vêm em blocos de 12 por movimento — ver estoque-db.registrarTx).
      if (/INSERT INTO estoque_movimentos/i.test(sql)) {
        const n = params.length / 12;
        return { rows: Array.from({ length: n }, (_, i) => ({ id: 100 + i })) };
      }
      return { rows: [], rowCount: 1 };
    },
  };
}

const MOV = [
  { itemId: "a1", variacaoId: null, quantidade: -2, saldoDepois: 1, descricao: "Espeto", unidade: "un" },
  { itemId: "a4", variacaoId: "v1", quantidade: -1, saldoDepois: 3, descricao: "Marmitex (P)", unidade: "un" },
];

test("registrarTx: um INSERT só, com todos os movimentos, devolve os ids inseridos", async () => {
  const c = fakeClient();
  const ids = await estoqueDb.registrarTx(c, "emp-uuid", MOV, { tipo: "venda", pedidoId: 7, numero: 12 });
  assert.equal(ids.length, 2);
  assert.deepEqual(ids, [100, 101]); // ids canned da resposta do RETURNING
  assert.equal(c.calls.length, 1);
  assert.match(c.calls[0].sql, /INSERT INTO estoque_movimentos/i);
  assert.match(c.calls[0].sql, /RETURNING id/i);
  assert.equal(c.calls[0].params.length, 2 * 12);
  assert.equal(c.calls[0].params[0], "emp-uuid");
  assert.equal(c.calls[0].params[3], "venda");
});

test("registrarTx: lista vazia não toca o banco e devolve []", async () => {
  const c = fakeClient();
  assert.deepEqual(await estoqueDb.registrarTx(c, "emp-uuid", [], { tipo: "venda" }), []);
  assert.equal(c.calls.length, 0);
});

test("registrarTx: movimento de quantidade zero é descartado e devolve []", async () => {
  const c = fakeClient();
  const ids = await estoqueDb.registrarTx(c, "emp-uuid",
    [{ itemId: "a1", variacaoId: null, quantidade: 0, saldoDepois: 3, descricao: "x", unidade: "un" }],
    { tipo: "ajuste" });
  assert.deepEqual(ids, []);
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

// ---------------------------------------------------------------------------
// Cursor da paginação: `criado_em` sozinho perde linha.
//
// A ordenação é `criado_em DESC, id DESC`, mas o cursor comparava só a data.
// `registrarTx` carimba `new Date()` (milissegundo) e uma venda grava vários
// movimentos no mesmo laço, então empate de carimbo é rotina: os movimentos que
// dividem o carimbo da borda da página somem do extrato. O cursor tem que
// desempatar pelo mesmo critério da ordenação.
// ---------------------------------------------------------------------------

test("listar: o cursor desempata por id, igual à ordenação", async () => {
  const chamadas = [];
  const antes = db.query;
  db.query = async (sql, params) => {
    chamadas.push({ sql, params });
    if (/FROM empresas/i.test(sql)) return { rows: [{ id: "emp-uuid" }] };
    return { rows: [] };
  };
  try {
    await estoqueDb.listar("/x/slug-cursor", { itemId: "a1", antes: "2026-08-20T12:00:00.000Z", antesId: 500 });
    const q = chamadas.find((c) => /FROM estoque_movimentos/i.test(c.sql));
    assert.match(q.sql, /ORDER BY criado_em DESC, id DESC/i);
    // O par (criado_em, id) tem que ser comparado junto, senão empate na borda some.
    assert.match(q.sql, /\(criado_em, id\) <|criado_em < \$\d+ OR \(criado_em = \$\d+ AND id </i);
  } finally { db.query = antes; }
});
