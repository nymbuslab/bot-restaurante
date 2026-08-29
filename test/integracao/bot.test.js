// ---------------------------------------------------------------------------
// SIMULADOR DO BOT — máquina de estados real, sem WhatsApp.
//
// O WhatsApp real não entra em teste automatizado: conectar Baileys em rotina de
// CI arrisca derrubar sessão viva e pode queimar número. O que esta bateria
// precisa provar é o contrato que o painel oferece na aba Simulador: saudação,
// link limpo do cardápio, atalho para atendente e reset de sessão.
// ---------------------------------------------------------------------------

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");

const PUBLIC_URL_ANTERIOR = process.env.PUBLIC_URL;
const PUBLIC_URL_TESTE = "https://pedidos-teste.invalid";

let loja;

before(async () => {
  process.env.PUBLIC_URL = PUBLIC_URL_TESTE;
  loja = await tenant.criarEmpresa("bot");
  await tenant.prepararLoja(loja);
});

after(async () => {
  if (PUBLIC_URL_ANTERIOR === undefined) delete process.env.PUBLIC_URL;
  else process.env.PUBLIC_URL = PUBLIC_URL_ANTERIOR;
  await app.derrubar();
  await tenant.limparTudo();
});

async function resetar() {
  const r = await app.pedir("/api/simulador/reset", { token: loja.token, corpo: {} });
  assert.equal(r.status, 200, "reset do simulador respondeu " + r.status);
}

async function falar(mensagem) {
  const r = await app.pedir("/api/simulador/mensagem", { token: loja.token, corpo: { mensagem } });
  assert.equal(r.status, 200, "simulador respondeu " + r.status + ": " + JSON.stringify(r.corpo));
  return r.corpo;
}

test("o simulador saúda, manda o link limpo do cardápio e volta ao menu", async () => {
  await resetar();

  const inicio = await falar("oi");
  assert.equal(inicio.estado, "MENU");
  assert.match(inicio.respostas.join("\n"), new RegExp(loja.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(inicio.respostas.join("\n"), /1\* - Fazer pedido/);

  const pedido = await falar("1");
  assert.equal(pedido.estado, "MENU");
  assert.match(pedido.respostas.join("\n"), new RegExp(PUBLIC_URL_TESTE + "/c/" + loja.slug));
  assert.doesNotMatch(pedido.respostas.join("\n"), /\?p=/, "o bot não deve voltar a gerar link com token");

  const menu = await falar("menu");
  assert.equal(menu.estado, "MENU");
  assert.match(menu.respostas.join("\n"), /Falar com atendente/);
});

test("o simulador entra e sai do modo atendente sem o bot responder no meio", async () => {
  await resetar();
  await falar("oi");

  const atendente = await falar("2");
  assert.equal(atendente.estado, "ATENDENTE");
  assert.match(atendente.respostas.join("\n"), /atendente/i);

  const silencio = await falar("tem alguém?");
  assert.equal(silencio.estado, "ATENDENTE");
  assert.deepEqual(silencio.respostas, []);

  const menu = await falar("menu");
  assert.equal(menu.estado, "MENU");
  assert.match(menu.respostas.join("\n"), /Fazer pedido/);
});
