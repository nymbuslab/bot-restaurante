require("./ajuda/ambiente");

const { test, after } = require("node:test");
const assert = require("node:assert/strict");

const ambiente = require("./ajuda/ambiente");
const harness = require("./ajuda/estoque-custos");
const fixtures = require("../fixtures/estoque-custos");

after(async () => {
  await harness.limparTudo();
});

test("recusa destino sem a marca de banco de teste antes da primeira query", () => {
  let consultas = 0;

  assert.throws(
    () => {
      ambiente.validarDestinoDescartavel({
        bancoDeTeste: "0",
        databaseUrl: "postgresql://postgres:senha@db.teste-seguro.supabase.co:5432/postgres",
      });
      consultas += 1;
    },
    /BANCO_DE_TESTE=1/
  );

  assert.equal(consultas, 0);
});

test("cria dois tenants isolados e remove somente as fixtures criadas", async () => {
  const { primeiro, segundo } = await harness.criarParDeTenants("estoque-custos");

  assert.notEqual(primeiro.slug, segundo.slug);
  assert.notEqual(primeiro.email, segundo.email);
  assert.equal(await harness.contarTenantsCriados(), 2);

  await harness.limparTudo();
  assert.equal(await harness.contarTenantsCriados(), 0);
});

test("os builders alimentam dois tenants sem reutilizar identificadores", async () => {
  const { primeiro, segundo } = await harness.criarParDeTenants("fixtures");
  const cenarioA = fixtures.criarCenario({
    semente: "mesmo-documento",
    empresaId: primeiro.slug,
    slug: primeiro.slug,
  });
  const cenarioB = fixtures.criarCenario({
    semente: "mesmo-documento",
    empresaId: segundo.slug,
    slug: segundo.slug,
  });

  for (const caminho of [
    ["atores", "dono"],
    ["atores", "funcionario"],
    ["alvos", "produto"],
    ["alvos", "variacao"],
  ]) {
    assert.notEqual(cenarioA[caminho[0]][caminho[1]].id, cenarioB[caminho[0]][caminho[1]].id);
  }
  for (const chave of ["fornecedor", "compra", "parcela", "conta"]) {
    assert.notEqual(cenarioA[chave].id, cenarioB[chave].id);
  }
});
