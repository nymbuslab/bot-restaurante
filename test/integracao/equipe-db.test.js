require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const db = require("../../src/db");
const equipe = require("../../src/equipe-db");
const harness = require("./ajuda/estoque-custos");

let primeiro;
let segundo;

before(async () => {
  const migration = path.join(__dirname, "..", "..", "supabase", "migrations", "20260915090000_equipe_permissoes.sql");
  await db.query(fs.readFileSync(migration, "utf8"));
  ({ primeiro, segundo } = await harness.criarParDeTenants("equipe-db"));
});

after(async () => {
  await harness.limparTudo();
});

test("funcionário só inicia sessão em dispositivo válido do próprio tenant", async () => {
  const funcionario = await equipe.criarFuncionario(primeiro.slug, {
    nome: "João do Caixa",
    pin: "1234",
    perfil: "caixa",
  });
  const dispositivoA = await equipe.autorizarDispositivo(primeiro.slug, { nome: "PDV A" });
  const dispositivoB = await equipe.autorizarDispositivo(segundo.slug, { nome: "PDV B" });

  await assert.rejects(
    equipe.iniciarSessao(primeiro.slug, {
      funcionarioId: funcionario.id,
      pin: "1234",
      dispositivoToken: dispositivoB.token,
    }),
    /dispositivo não autorizado/i
  );

  const sessao = await equipe.iniciarSessao(primeiro.slug, {
    funcionarioId: funcionario.id,
    pin: "1234",
    dispositivoToken: dispositivoA.token,
  });
  assert.ok(sessao.token);
  assert.equal(sessao.funcionario.id, funcionario.id);

  const persistida = await db.query("select token_hash from equipe_sessoes where id = $1", [sessao.id]);
  assert.notEqual(persistida.rows[0].token_hash, sessao.token);
});

test("cinco erros bloqueiam quinze minutos e o dono pode liberar", async () => {
  const funcionario = await equipe.criarFuncionario(primeiro.slug, {
    nome: "Maria do Estoque",
    pin: "5678",
    perfil: "estoque_compras",
  });
  const dispositivo = await equipe.autorizarDispositivo(primeiro.slug, { nome: "Tablet Estoque" });

  for (let tentativa = 1; tentativa <= 5; tentativa += 1) {
    await assert.rejects(
      equipe.iniciarSessao(primeiro.slug, {
        funcionarioId: funcionario.id,
        pin: "0000",
        dispositivoToken: dispositivo.token,
      }),
      tentativa === 5 ? /bloqueado por 15 minutos/i : /PIN incorreto/i
    );
  }

  const estado = await db.query(
    "select tentativas_pin, bloqueado_ate from equipe_funcionarios where id = $1",
    [funcionario.id]
  );
  assert.equal(estado.rows[0].tentativas_pin, 5);
  assert.ok(estado.rows[0].bloqueado_ate > new Date());

  await equipe.desbloquearFuncionario(primeiro.slug, funcionario.id);
  const liberado = await db.query(
    "select tentativas_pin, bloqueado_ate from equipe_funcionarios where id = $1",
    [funcionario.id]
  );
  assert.equal(liberado.rows[0].tentativas_pin, 0);
  assert.equal(liberado.rows[0].bloqueado_ate, null);
});

test("revogar dispositivo encerra o acesso da sessão", async () => {
  const funcionario = await equipe.criarFuncionario(primeiro.slug, {
    nome: "Ana Atendimento",
    pin: "9012",
    perfil: "atendimento",
  });
  const dispositivo = await equipe.autorizarDispositivo(primeiro.slug, { nome: "Balcão" });
  const sessao = await equipe.iniciarSessao(primeiro.slug, {
    funcionarioId: funcionario.id,
    pin: "9012",
    dispositivoToken: dispositivo.token,
  });

  assert.ok(await equipe.resolverSessao(sessao.token));
  await equipe.revogarDispositivo(primeiro.slug, dispositivo.id);
  assert.equal(await equipe.resolverSessao(sessao.token), null);
});
