require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../../src/db");
const app = require("./ajuda/app");
const harness = require("./ajuda/estoque-custos");
const tenant = require("./ajuda/tenant");
const estoqueDb = require("../../src/estoque-db");

let loja;      // plano completo, dono
let semPlano;  // plano essencial, dono

before(async () => {
  loja = await harness.criarParDeTenants("estoque-geral").then((par) => par.primeiro);
  semPlano = await tenant.criarEmpresa("estoque-geral-sem-plano");

  const empId = await estoqueDb.empresaId(loja.dir);
  await estoqueDb.registrarTx(db, empId,
    [{ itemId: "p1", variacaoId: null, quantidade: 5, saldoDepois: 5, descricao: "Compra inicial", unidade: "un" }],
    { tipo: "entrada" });
  await estoqueDb.registrarTx(db, empId,
    [{ itemId: "p1", variacaoId: null, quantidade: -1, saldoDepois: 4, descricao: "Quebrou", unidade: "un" }],
    { tipo: "perda" });
  await estoqueDb.registrarTx(db, empId,
    [{ itemId: "p1", variacaoId: null, quantidade: -2, saldoDepois: 2, descricao: "Venda", unidade: "un" }],
    { tipo: "venda" });
});

after(async () => {
  await app.derrubar();
  await harness.limparTudo();
});

test("200 com movimentos para tenant com Plano Completo e permissão estoque.ver", async () => {
  const r = await app.pedir("/api/estoque/geral", { token: loja.token });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.corpo.movimentos));
  assert.ok(r.corpo.movimentos.length >= 3);
  const linha = r.corpo.movimentos[0];
  assert.ok("itemId" in linha && "tipo" in linha && "quantidade" in linha && "saldoDepois" in linha && "criadoEm" in linha);
});

test("403 sem o plano (exigePdv) — dono de tenant Plano Essencial", async () => {
  const r = await app.pedir("/api/estoque/geral", { token: semPlano.token });
  assert.equal(r.status, 403);
});

test("filtro tipos=entrada,perda devolve só os movimentos desses tipos, no formato { movimentos }", async () => {
  const r = await app.pedir("/api/estoque/geral?tipos=entrada,perda", { token: loja.token });
  assert.equal(r.status, 200);
  assert.ok(r.corpo.movimentos.length >= 2);
  assert.ok(r.corpo.movimentos.every((m) => m.tipo === "entrada" || m.tipo === "perda"));
  assert.ok(!r.corpo.movimentos.some((m) => m.tipo === "venda"));
});
