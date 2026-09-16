require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const db = require("../../src/db");
const app = require("./ajuda/app");
const harness = require("./ajuda/estoque-custos");
const tenant = require("./ajuda/tenant");
const estoqueDb = require("../../src/estoque-db");

let loja;             // plano completo, dono
let semPlano;          // plano essencial, dono
let funcionario;
let tokenSemPermissao; // funcionário perfil "caixa" (sem estoque.ver), na loja

before(async () => {
  const migration = path.join(__dirname, "..", "..", "supabase", "migrations", "20260915090000_equipe_permissoes.sql");
  await db.query(fs.readFileSync(migration, "utf8"));

  loja = await harness.criarParDeTenants("estoque-geral").then((par) => par.primeiro);
  await db.query("update empresas set equipe_habilitada = true where slug = $1", [loja.slug]);
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

  const criada = await app.pedir("/api/equipe", {
    token: loja.token,
    corpo: { nome: "Operador do caixa", pin: "1357", perfil: "caixa" },
  });
  assert.equal(criada.status, 201, "setup: criar funcionário perfil caixa");
  funcionario = criada.corpo.funcionario;

  const autorizacao = await app.pedir("/api/equipe/dispositivos/autorizar", {
    token: loja.token,
    corpo: { nome: "Dispositivo de teste" },
  });
  assert.equal(autorizacao.status, 201, "setup: autorizar dispositivo");

  const login = await app.pedir("/api/equipe/sessoes/pin", {
    corpo: { slug: loja.slug, funcionarioId: funcionario.id, pin: "1357", dispositivoToken: autorizacao.corpo.dispositivo.token },
  });
  assert.equal(login.status, 201, "setup: login por PIN");
  tokenSemPermissao = login.corpo.sessao.token;
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

test("403 com o plano mas SEM a permissão estoque.ver (exigePermissao) — funcionário perfil caixa", async () => {
  const r = await app.pedir("/api/estoque/geral", { token: tokenSemPermissao });
  assert.equal(r.status, 403);
  assert.equal(r.corpo.erro, "Você não tem permissão para esta ação.");
});

test("filtro tipos=entrada,perda devolve só os movimentos desses tipos, no formato { movimentos }", async () => {
  const r = await app.pedir("/api/estoque/geral?tipos=entrada,perda", { token: loja.token });
  assert.equal(r.status, 200);
  assert.ok(r.corpo.movimentos.length >= 2);
  assert.ok(r.corpo.movimentos.every((m) => m.tipo === "entrada" || m.tipo === "perda"));
  assert.ok(!r.corpo.movimentos.some((m) => m.tipo === "venda"));
});
