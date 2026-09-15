require("./ajuda/ambiente");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const db = require("../../src/db");

test("consultas do dono aceitam schema sem equipe e respeitam a flag quando presente", async () => {
  const client = await db.pool.connect();
  try {
    await client.query("begin");
    await client.query(`create temporary table empresas (
      id text, user_id text, slug text, nome text, email text, ativo boolean,
      criado_em timestamptz, plano text, assinatura_status text, trial_ate timestamptz,
      proxima_cobranca timestamptz, stripe_customer_id text, stripe_subscription_id text
    ) on commit drop`);
    await client.query("set local search_path = pg_temp, public");
    await client.query("insert into empresas (id, user_id, slug, ativo, plano) values ('loja', 'dono', 'compatibilidade', true, 'completo')");
    const fonte = fs.readFileSync(require.resolve("../../src/empresas"), "utf8");
    const contexto = vm.createContext({
      db: { query: client.query.bind(client) },
      process: { env: { SUPABASE_URL: "https://teste.invalid" } },
      getJWKS: async () => ({ jose: { jwtVerify: async () => ({ payload: { sub: "dono" } }) }, jwks: {} }),
    });
    for (const nome of ["resolverPorToken", "buscarPorSlug"]) {
      const inicio = fonte.indexOf(`async function ${nome}(`);
      const fim = fonte.indexOf("\n}", inicio) + 2;
      vm.runInContext(fonte.slice(inicio, fim), contexto);
    }
    for (const chamada of ["resolverPorToken('jwt')", "buscarPorSlug('compatibilidade')"]) {
      const emp = await vm.runInContext(chamada, contexto);
      assert.equal(emp.slug, "compatibilidade");
      assert.equal(emp.equipeHabilitada, false);
    }
    await client.query("alter table empresas add column equipe_habilitada boolean default false");
    for (const chamada of ["resolverPorToken('jwt')", "buscarPorSlug('compatibilidade')"]) {
      assert.equal((await vm.runInContext(chamada, contexto)).equipeHabilitada, false);
    }
    await client.query("update empresas set equipe_habilitada = true");
    for (const chamada of ["resolverPorToken('jwt')", "buscarPorSlug('compatibilidade')"]) {
      assert.equal((await vm.runInContext(chamada, contexto)).equipeHabilitada, true);
    }
  } finally {
    await client.query("rollback");
    client.release();
  }
});
