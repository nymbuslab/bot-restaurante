require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const db = require("../../src/db");
const equipe = require("../../src/equipe-db");
const app = require("./ajuda/app");
const harness = require("./ajuda/estoque-custos");

let liberada;
let semEquipe;
let inadimplente;
let sessaoEstoque;

async function criarSessao(empresa, sufixo, pin = "1234") {
  const funcionario = await equipe.criarFuncionario(empresa.slug, {
    nome: "Funcionário " + sufixo,
    pin,
    perfil: "caixa",
  });
  const dispositivo = await equipe.autorizarDispositivo(empresa.slug, { nome: "PDV " + sufixo });
  return equipe.iniciarSessao(empresa.slug, {
    funcionarioId: funcionario.id,
    pin,
    dispositivoToken: dispositivo.token,
  });
}

before(async () => {
  const migration = path.join(__dirname, "..", "..", "supabase", "migrations", "20260915090000_equipe_permissoes.sql");
  await db.query(fs.readFileSync(migration, "utf8"));

  liberada = await harness.criarParDeTenants("principal-auth").then((par) => par.primeiro);
  semEquipe = await harness.criarParDeTenants("principal-sem-equipe").then((par) => par.primeiro);
  inadimplente = await harness.criarParDeTenants("principal-inadimplente").then((par) => par.primeiro);

  await db.query("update empresas set equipe_habilitada = true where slug = any($1::text[])", [
    [liberada.slug, inadimplente.slug],
  ]);
  await db.query("update empresas set assinatura_status = 'past_due' where slug = $1", [inadimplente.slug]);

  liberada.sessao = await criarSessao(liberada, "liberado");
  const funcionarioEstoque = await equipe.criarFuncionario(liberada.slug, {
    nome: "Funcionário Estoque",
    pin: "5678",
    perfil: "estoque_compras",
  });
  const dispositivoEstoque = await equipe.autorizarDispositivo(liberada.slug, { nome: "Tablet Estoque" });
  sessaoEstoque = await equipe.iniciarSessao(liberada.slug, {
    funcionarioId: funcionarioEstoque.id,
    pin: "5678",
    dispositivoToken: dispositivoEstoque.token,
  });
  semEquipe.sessao = await criarSessao(semEquipe, "sem-equipe");
  inadimplente.sessao = await criarSessao(inadimplente, "inadimplente");
});

after(async () => {
  await app.derrubar();
  await harness.limparTudo();
});

test("o JWT do dono preserva o acesso atual", async () => {
  const resposta = await app.pedir("/api/status", { token: liberada.token });
  assert.equal(resposta.status, 200);
});

test("a sessão opaca de funcionário habilitado resolve o mesmo tenant", async () => {
  const resposta = await app.pedir("/api/status", { token: liberada.sessao.token });
  assert.equal(resposta.status, 200);
});

test("funcionário sem elegibilidade recebe 403 e com assinatura inativa recebe 402", async () => {
  const semFlag = await app.pedir("/api/status", { token: semEquipe.sessao.token });
  const semPagamento = await app.pedir("/api/status", { token: inadimplente.sessao.token });
  assert.equal(semFlag.status, 403);
  assert.equal(semPagamento.status, 402);
});

test("sessão inativa por quinze minutos retorna 401 sem renovar o último acesso", async () => {
  const expirada = await criarSessao(liberada, "expirado", "4321");
  const instante = new Date("2026-09-14T10:00:00.000Z");
  await db.query("update equipe_sessoes set ultimo_acesso_em = $1 where id = $2", [instante, expirada.id]);

  const resposta = await app.pedir("/api/status", { token: expirada.token });
  assert.equal(resposta.status, 401);

  const persistida = await db.query(
    "select ultimo_acesso_em, revogada_em from equipe_sessoes where id = $1",
    [expirada.id]
  );
  assert.equal(persistida.rows[0].ultimo_acesso_em.toISOString(), instante.toISOString());
  assert.ok(persistida.rows[0].revogada_em, "a sessão expirada deveria ficar revogada");
});

test("chamadas diretas respeitam a matriz de permissões das áreas atuais", async () => {
  const tokenCaixa = liberada.sessao.token;

  const pedidos = await app.pedir("/api/pedidos", { token: tokenCaixa });
  const mesas = await app.pedir("/api/mesas", { token: tokenCaixa });
  const caixa = await app.pedir("/api/caixa", { token: tokenCaixa });
  const pdv = await app.pedir("/api/pdv/frete", { token: tokenCaixa, corpo: {} });
  assert.equal(pedidos.status, 200);
  assert.equal(mesas.status, 200);
  assert.equal(caixa.status, 200);
  assert.notEqual(pdv.status, 403, "Caixa possui pdv.operar");

  for (const [area, rota, opcoes] of [
    ["estoque", "/api/estoque", {}],
    ["relatórios", "/api/dashboard", {}],
    ["catálogo", "/api/cardapio", { metodo: "PUT", corpo: {} }],
    ["configuração", "/api/config", { metodo: "PUT", corpo: {} }],
    ["conta", "/api/conta", {}],
  ]) {
    const resposta = await app.pedir(rota, Object.assign({ token: tokenCaixa }, opcoes));
    assert.equal(resposta.status, 403, `${area} aceitou perfil sem permissão`);
  }

  assert.equal((await app.pedir("/api/estoque", { token: sessaoEstoque.token })).status, 200);
  assert.equal((await app.pedir("/api/pedidos", { token: sessaoEstoque.token })).status, 403);
});
