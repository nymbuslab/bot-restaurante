require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const db = require("../../src/db");
const app = require("./ajuda/app");
const harness = require("./ajuda/estoque-custos");

let loja;
let funcionario;
let dispositivo;

before(async () => {
  const migration = path.join(__dirname, "..", "..", "supabase", "migrations", "20260915090000_equipe_permissoes.sql");
  await db.query(fs.readFileSync(migration, "utf8"));
  loja = await harness.criarParDeTenants("equipe-rotas").then((par) => par.primeiro);
  await db.query("update empresas set equipe_habilitada = true where slug = $1", [loja.slug]);
});

after(async () => {
  await app.derrubar();
  await harness.limparTudo();
});

test("o dono cria e lista funcionário pelas rotas reais", async () => {
  const criada = await app.pedir("/api/equipe", {
    token: loja.token,
    corpo: { nome: "Operador do caixa", pin: "2468", perfil: "caixa", inatividadeMinutos: 5 },
  });
  assert.equal(criada.status, 201);
  funcionario = criada.corpo.funcionario;
  assert.equal(funcionario.inatividadeMinutos, 5);

  const lista = await app.pedir("/api/equipe", { token: loja.token });
  assert.equal(lista.status, 200);
  assert.ok(lista.corpo.funcionarios.some((item) => item.id === funcionario.id));
});

test("autorizar dispositivo devolve segredo uma vez e permite login por PIN", async () => {
  const autorizacao = await app.pedir("/api/equipe/dispositivos/autorizar", {
    token: loja.token,
    corpo: { nome: "PDV principal" },
  });
  assert.equal(autorizacao.status, 201);
  assert.ok(autorizacao.corpo.dispositivo.token);
  dispositivo = autorizacao.corpo.dispositivo;

  const login = await app.pedir("/api/equipe/sessoes/pin", {
    corpo: {
      slug: loja.slug,
      funcionarioId: funcionario.id,
      pin: "2468",
      dispositivoToken: dispositivo.token,
    },
  });
  assert.equal(login.status, 201);
  assert.ok(login.corpo.sessao.token);

  const principal = await app.pedir("/api/equipe/principal", { token: login.corpo.sessao.token });
  assert.equal(principal.status, 200);
  assert.equal(principal.corpo.ator.tipo, "funcionario");
  assert.equal(principal.corpo.ator.id, funcionario.id);
});

test("PIN repetido vira 409, cinco erros viram 429 e o dono desbloqueia", async () => {
  const repetido = await app.pedir("/api/equipe", {
    token: loja.token,
    corpo: { nome: "Outro caixa", pin: "2468", perfil: "caixa" },
  });
  assert.equal(repetido.status, 409);

  for (let tentativa = 1; tentativa <= 5; tentativa += 1) {
    const falha = await app.pedir("/api/equipe/sessoes/pin", {
      corpo: {
        slug: loja.slug,
        funcionarioId: funcionario.id,
        pin: "0000",
        dispositivoToken: dispositivo.token,
      },
    });
    assert.equal(falha.status, tentativa === 5 ? 429 : 401);
  }

  const desbloquear = await app.pedir(`/api/equipe/${funcionario.id}/desbloquear`, {
    token: loja.token,
    corpo: {},
  });
  assert.equal(desbloquear.status, 200);
});

test("funcionário não autoriza dispositivos nem altera acesso exclusivo", async () => {
  const login = await app.pedir("/api/equipe/sessoes/pin", {
    corpo: {
      slug: loja.slug,
      funcionarioId: funcionario.id,
      pin: "2468",
      dispositivoToken: dispositivo.token,
    },
  });
  const tokenFuncionario = login.corpo.sessao.token;

  const autorizar = await app.pedir("/api/equipe/dispositivos/autorizar", {
    token: tokenFuncionario,
    corpo: { nome: "Não permitido" },
  });
  const assinatura = await app.pedir("/api/assinatura", { token: tokenFuncionario });
  assert.equal(autorizar.status, 403);
  assert.equal(assinatura.status, 403);
});
