const { test } = require("node:test");
const assert = require("node:assert/strict");

const fixtures = require("./fixtures/estoque-custos");

test("a mesma semente gera o mesmo documento e a mesma chave idempotente", () => {
  const entrada = { semente: "compra-setembro", empresaId: "empresa-a", slug: "restaurante-a" };
  const primeiro = fixtures.criarCenario(entrada);
  const segundo = fixtures.criarCenario(entrada);

  assert.deepEqual(primeiro, segundo);
  assert.equal(primeiro.compra.chave_idempotencia, segundo.compra.chave_idempotencia);
});

test("o cenário cobre as identidades exigidas pelo contrato", () => {
  const cenario = fixtures.criarCenario({
    semente: "contrato-completo",
    empresaId: "empresa-a",
    slug: "restaurante-a",
  });

  assert.ok(cenario.atores.dono.id);
  assert.ok(cenario.atores.funcionario.id);
  assert.equal(cenario.alvos.produto.tipo, "produto");
  assert.equal(cenario.alvos.variacao.tipo, "variacao");
  assert.ok(cenario.fornecedor.id);
  assert.ok(cenario.compra.id);
  assert.ok(cenario.parcela.id);
  assert.ok(cenario.conta.id);
});
