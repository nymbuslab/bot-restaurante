require("./ajuda/ambiente");
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const db = require("../../src/db");
const app = require("./ajuda/app");
const harness = require("./ajuda/estoque-custos");
let lojas, funcionario, dispositivo, sessao;
before(async () => {
  for (const nome of ["20260915090000_equipe_permissoes.sql", "20260915100000_auditoria_operacional.sql"]) {
    const arquivo = path.join(__dirname, "../../supabase/migrations", nome);
    if (fs.existsSync(arquivo)) await db.query(fs.readFileSync(arquivo, "utf8"));
  }
  lojas = await harness.criarParDeTenants("equipe-homologacao");
  await db.query("update empresas set equipe_habilitada = true where slug = $1", [lojas.primeiro.slug]);
});
after(async () => { await app.derrubar(); await harness.limparTudo(); });
test("flag desligada preserva tenant legado e barra gestão e login premium", async () => {
  assert.equal((await app.pedir("/api/equipe", { token: lojas.segundo.token })).status, 403);
  assert.equal((await app.pedir("/api/equipe/sessoes/pin", { corpo: { slug: lojas.segundo.slug, pin: "2468" } })).status, 403);
  assert.equal((await app.pedir("/api/config", { token: lojas.segundo.token })).status, 200);
});
test("criação, login e negação ficam vinculados ao ator sem segredos", async () => {
  const criada = await app.pedir("/api/equipe", { token: lojas.primeiro.token, corpo: { nome: "Operador teste", perfil: "atendimento", pin: "2468" } });
  assert.equal(criada.status, 201); funcionario = criada.corpo.funcionario;
  dispositivo = (await app.pedir("/api/equipe/dispositivos/autorizar", { token: lojas.primeiro.token, corpo: { nome: "Teste" } })).corpo.dispositivo;
  const entrada = await app.pedir("/api/equipe/sessoes/pin", { corpo: { slug: lojas.primeiro.slug, funcionarioId: funcionario.id, dispositivoToken: dispositivo.token, pin: "2468" } });
  assert.equal(entrada.status, 201); sessao = entrada.corpo.sessao;
  assert.equal((await app.pedir("/api/mesas/00000000-0000-0000-0000-000000000001/pagar", { token: sessao.token, corpo: {} })).status, 403);
  const lista = await app.pedir("/api/equipe/atividades", { token: lojas.primeiro.token });
  assert.equal(lista.status, 200);
  assert.ok(lista.corpo.eventos.some(e => e.evento === "funcionario_criado" && e.atorTipo === "dono"));
  assert.ok(lista.corpo.eventos.some(e => e.evento === "sessao_iniciada" && e.atorId === funcionario.id));
  assert.ok(lista.corpo.eventos.some(e => e.evento === "permissao_negada" && e.atorId === funcionario.id));
  const texto = JSON.stringify(lista.corpo);
  for (const segredo of [sessao.token, dispositivo.token, '"pin"', "pin_hash", "token_hash"]) assert.ok(!texto.includes(segredo));
  assert.equal((await app.pedir("/api/equipe/atividades", { token: sessao.token })).status, 403);
});
test("revogação corta sessão, evento aparece e filtros/cursor não misturam tenants", async () => {
  assert.equal((await app.pedir(`/api/equipe/dispositivos/${dispositivo.id}`, { token: lojas.primeiro.token, metodo: "DELETE" })).status, 204);
  assert.equal((await app.pedir("/api/equipe/principal", { token: sessao.token })).status, 401);
  const filtro = await app.pedir("/api/equipe/atividades?evento=dispositivo_revogado&limite=1", { token: lojas.primeiro.token });
  assert.equal(filtro.status, 200);
  assert.equal(filtro.corpo.eventos[0].detalhe.dispositivoId, dispositivo.id);
  const primeira = (await app.pedir("/api/equipe/atividades?limite=1", { token: lojas.primeiro.token })).corpo;
  assert.ok(primeira.proximoCursor);
  const segunda = (await app.pedir("/api/equipe/atividades?limite=1&cursor=" + primeira.proximoCursor, { token: lojas.primeiro.token })).corpo;
  assert.notEqual(primeira.eventos[0].id, segunda.eventos[0].id);
  assert.equal((await db.query("select count(*)::int as n from auditoria_operacional where empresa_id = (select id from empresas where slug = $1)", [lojas.segundo.slug])).rows[0].n, 0);
});
test("falha ao registrar auditoria reverte a edição real do funcionário", async () => {
  const auditoria = require("../../src/auditoria-operacional");
  const equipe = require("../../src/equipe-db");
  const registrar = auditoria.registrar;
  auditoria.registrar = async () => { throw new Error("Auditoria indisponível no teste"); };
  try {
    await assert.rejects(equipe.atualizarFuncionario(lojas.primeiro.slug, funcionario.id, { nome: "Não persistir" }, { tipo: "dono" }), /Auditoria indisponível/);
    assert.equal((await db.query("select nome from equipe_funcionarios where id=$1", [funcionario.id])).rows[0].nome, "Operador teste");
  } finally { auditoria.registrar = registrar; }
});
test("evento e mutação compartilham rollback", async () => {
  const auditoria = require("../../src/auditoria-operacional");
  const client = await db.pool.connect();
  try {
    await client.query("begin");
    const empresaId = (await client.query("select id from empresas where slug=$1", [lojas.primeiro.slug])).rows[0].id;
    await client.query("update equipe_funcionarios set nome='Rollback teste' where empresa_id=$1 and id=$2", [empresaId, funcionario.id]);
    await auditoria.registrar(client, { empresaId, ator: { tipo: "dono" }, evento: "teste_rollback", detalhe: { funcionarioId: funcionario.id, pin: "nao_gravar" } });
    await client.query("rollback");
    assert.equal((await db.query("select count(*)::int as n from auditoria_operacional where empresa_id=$1 and evento='teste_rollback'", [empresaId])).rows[0].n, 0);
    assert.equal((await db.query("select nome from equipe_funcionarios where id=$1", [funcionario.id])).rows[0].nome, "Operador teste");
  } finally { await client.query("rollback"); client.release(); }
});
test("filtros inválidos são recusados e o filtro de ator mantém isolamento", async () => {
  for (const filtro of ["cursor=9999999999999999999", "desde=2026-02-30", "limite=101", "desde=2026-09-15&ate=2026-09-01"]) {
    assert.equal((await app.pedir("/api/equipe/atividades?" + filtro, { token: lojas.primeiro.token })).status, 400);
  }
  const lista = await app.pedir("/api/equipe/atividades?atorId=" + funcionario.id, { token: lojas.primeiro.token });
  assert.ok(lista.corpo.eventos.length > 0);
  assert.ok(lista.corpo.eventos.every(e => e.atorId === funcionario.id));
  await db.query("update empresas set equipe_habilitada=true where slug=$1", [lojas.segundo.slug]);
  const outra = await app.pedir("/api/equipe/atividades?atorId=" + funcionario.id, { token: lojas.segundo.token });
  assert.equal(outra.status, 200);
  assert.deepEqual(outra.corpo.eventos, []);
  await db.query("update empresas set equipe_habilitada=false where slug=$1", [lojas.segundo.slug]);
});
