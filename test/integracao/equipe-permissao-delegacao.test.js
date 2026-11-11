require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const db = require("../../src/db");
const app = require("./ajuda/app");
const harness = require("./ajuda/estoque-custos");

let loja;

before(async () => {
  const migration = path.join(__dirname, "..", "..", "supabase", "migrations", "20260915090000_equipe_permissoes.sql");
  await db.query(fs.readFileSync(migration, "utf8"));
  loja = await harness.criarParDeTenants("equipe-delegacao").then((par) => par.primeiro);
  await db.query("update empresas set equipe_habilitada = true where slug = $1", [loja.slug]);
});

after(async () => {
  await app.derrubar();
  await harness.limparTudo();
});

async function autenticarFuncionario(funcionarioId, pin) {
  const autorizacao = await app.pedir("/api/equipe/dispositivos/autorizar", {
    token: loja.token,
    corpo: { nome: "Dispositivo de teste" },
  });
  const login = await app.pedir("/api/equipe/sessoes/pin", {
    corpo: { slug: loja.slug, funcionarioId, pin, dispositivoToken: autorizacao.corpo.dispositivo.token },
  });
  return login.corpo.sessao.token;
}

test("gerente não pode restaurar, via PUT sem `perfil`, uma permissão de administrador que ele mesmo não possui", async () => {
  const administrador = await app.pedir("/api/equipe", {
    token: loja.token,
    corpo: { nome: "Administrador restrito", pin: "1111", perfil: "administrador" },
  });
  assert.equal(administrador.status, 201);
  const idAdmin = administrador.corpo.funcionario.id;

  const restringir = await app.pedir(`/api/equipe/${idAdmin}`, {
    metodo: "PUT",
    token: loja.token,
    corpo: { ajustes: [{ permissao: "configuracoes.editar", permitido: false }] },
  });
  assert.equal(restringir.status, 200);
  assert.ok(!restringir.corpo.funcionario.permissoes.includes("configuracoes.editar"));

  const gerenteCriado = await app.pedir("/api/equipe", {
    token: loja.token,
    corpo: { nome: "Gerente", pin: "2222", perfil: "gerente" },
  });
  assert.equal(gerenteCriado.status, 201);
  const tokenGerente = await autenticarFuncionario(gerenteCriado.corpo.funcionario.id, "2222");

  const tentativa = await app.pedir(`/api/equipe/${idAdmin}`, {
    metodo: "PUT",
    token: tokenGerente,
    corpo: { ajustes: [] },
  });
  assert.equal(tentativa.status, 403);

  const confirmacao = await app.pedir("/api/equipe", { token: loja.token });
  const admin = confirmacao.corpo.funcionarios.find((item) => item.id === idAdmin);
  assert.ok(!admin.permissoes.includes("configuracoes.editar"));
});
