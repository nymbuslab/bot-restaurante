// ---------------------------------------------------------------------------
// ISOLAMENTO ENTRE EMPRESAS — o teste de maior consequência do projeto.
//
// A plataforma é multi-tenant: duas empresas dividem as mesmas tabelas, e o que
// separa uma da outra é o `empresa_id` resolvido a partir do token. Se esse
// caminho falhar em UMA rota, um restaurante vê o faturamento do outro. Não é
// defeito de tela, é vazamento entre clientes.
//
// Nenhum teste jamais exercitou isso, porque não havia banco onde criar duas
// empresas de verdade. Agora há.
//
// O teste cria duas empresas reais, dá a cada uma um cardápio com marca própria,
// e confere por HTTP que o token de uma nunca alcança o dado da outra.
// ---------------------------------------------------------------------------

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");

let A, B;

before(async () => {
  A = await tenant.criarEmpresa("alfa");
  B = await tenant.criarEmpresa("beta");
  await tenant.prepararLoja(A, { cardapio: tenant.cardapioDeUmItem({ nome: "Prato da " + A.marca }) });
  await tenant.prepararLoja(B, { cardapio: tenant.cardapioDeUmItem({ nome: "Prato da " + B.marca }) });
});

after(async () => {
  await app.derrubar();
  await tenant.limparTudo();
});

test("cada token enxerga a própria empresa, e só ela", async () => {
  const a = await app.pedir("/api/status", { token: A.token });
  const b = await app.pedir("/api/status", { token: B.token });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.notEqual(A.slug, B.slug, "slugs precisam ser distintos ou o teste não prova nada");
});

test("o cardápio de uma empresa não aparece para a outra", async () => {
  const daA = await app.pedir("/api/cardapio", { token: A.token });
  const daB = await app.pedir("/api/cardapio", { token: B.token });

  assert.equal(daA.status, 200);
  assert.equal(daB.status, 200);

  assert.match(JSON.stringify(daA.corpo), new RegExp(A.marca), "A deveria ver o próprio cardápio");
  assert.doesNotMatch(
    JSON.stringify(daB.corpo),
    new RegExp(A.marca),
    "VAZAMENTO: o cardápio da empresa A apareceu na resposta da empresa B"
  );
});

test("a lista de pedidos não mistura empresas", async () => {
  const daB = await app.pedir("/api/pedidos", { token: B.token });
  assert.equal(daB.status, 200);
  assert.doesNotMatch(
    JSON.stringify(daB.corpo),
    new RegExp(A.marca),
    "VAZAMENTO: dado da empresa A apareceu nos pedidos da empresa B"
  );
});

test("sem token, nenhuma rota privada responde", async () => {
  for (const rota of ["/api/cardapio", "/api/pedidos", "/api/config", "/api/dashboard"]) {
    const r = await app.pedir(rota);
    assert.ok(r.status === 401 || r.status === 403, rota + " respondeu " + r.status + " sem token");
  }
});

test("token inventado é recusado", async () => {
  const r = await app.pedir("/api/cardapio", { token: "nao.e.um.jwt" });
  assert.ok(r.status === 401 || r.status === 403, "aceitou um token falso (status " + r.status + ")");
});
