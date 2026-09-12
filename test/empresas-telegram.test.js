// ============================================================
// TESTES — link de Telegram em src/empresas.js
//  - temRelatoriosTelegram: gate de plano do Plano Completo (mesma fonte de
//    temCaixa), nunca abre para emp nulo/inativo/essencial.
//  - buscarPorCodigoVinculacaoTelegram: consulta SQL no config->'telegram',
//    devolve o slug ou null, sem nunca lançar.
//
// Env dummy é o mesmo preâmbulo de test/sessao-revogacao.test.js: sem as chaves,
// src/supabase.js LANÇA no require e o arquivo inteiro morre no CI. Os testes
// stubam db.query (nada toca o banco de verdade).
// ============================================================
const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "anon-dummy";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-dummy";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://u:p@localhost:5432/db";
const db = require("../src/db");
const empresas = require("../src/empresas");

// Com um stub de db.query no lugar, roda os testes sem tocar o banco real.
const dbOriginal = db.query;
function comQueryFake(fake) {
  db.query = fake;
  return () => { db.query = dbOriginal; };
}

// ---------------------------------------------------------------------------
// T-01.07 — temRelatoriosTelegram (mesma regra dos gates do Completo)
// ---------------------------------------------------------------------------
test("T-01.07 temRelatoriosTelegram segue a mesma regra de temCaixa/temPdv", () => {
  const completo = { plano: "completo", assinaturaStatus: "active", ativo: true };
  const essencial = { plano: "essencial", assinaturaStatus: "active", ativo: true };
  assert.equal(empresas.temRelatoriosTelegram(completo), true);
  assert.equal(empresas.temRelatoriosTelegram(essencial), false);
  assert.equal(
    empresas.temRelatoriosTelegram(completo),
    empresas.temCaixa(completo),
    "fonte única: deve ser exatamente a regra de temCaixa"
  );
});

test("T-01.07 retorna false para emp nulo, inativo ou plano essencial", () => {
  assert.equal(empresas.temRelatoriosTelegram(null), false);
  assert.equal(empresas.temRelatoriosTelegram(undefined), false);
  const suspenso = { plano: "completo", assinaturaStatus: "active", ativo: false };
  assert.equal(empresas.temRelatoriosTelegram(suspenso), false);
});

// ---------------------------------------------------------------------------
// T-01.08 — buscarPorCodigoVinculacaoTelegram
// ---------------------------------------------------------------------------
test("T-01.08 a query filtra por config->'telegram'->>'codigoVinculacao' = $1", async () => {
  const chamadas = [];
  const restaurar = comQueryFake(async (sql, params) => {
    chamadas.push({ sql, params });
    return { rows: [{ slug: "padaria-x" }] };
  });
  try {
    const slug = await empresas.buscarPorCodigoVinculacaoTelegram("abc123");
    assert.equal(slug, "padaria-x");
    assert.equal(chamadas.length, 1);
    assert.match(chamadas[0].sql, /config->'telegram'->>'codigoVinculacao'\s*=\s*\$1/);
    assert.deepEqual(chamadas[0].params, ["abc123"]);
  } finally { restaurar(); }
});

test("T-01.08 devolve null quando nenhum tenant tem o código, sem lançar", async () => {
  const restaurar = comQueryFake(async () => ({ rows: [] }));
  try {
    assert.equal(await empresas.buscarPorCodigoVinculacaoTelegram("codigo-desconhecido"), null);
  } finally { restaurar(); }
});

test("T-01.08 código vazio/nulo nem consulta o banco", async () => {
  let chamou = false;
  const restaurar = comQueryFake(async () => { chamou = true; return { rows: [{ slug: "x" }] }; });
  try {
    assert.equal(await empresas.buscarPorCodigoVinculacaoTelegram(null), null);
    assert.equal(await empresas.buscarPorCodigoVinculacaoTelegram(""), null);
    assert.equal(chamou, false, "sem código, não existe o que procurar");
  } finally { restaurar(); }
});