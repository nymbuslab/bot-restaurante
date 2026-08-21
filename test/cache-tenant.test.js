const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// O cache de config/cardápio é POR PROCESSO. `store.getConfig`/`getCardapio` são
// síncronos e LANÇAM se o tenant ainda não foi carregado, então toda rota que lê
// do cache precisa de um `await store.ensure(...)` antes.
//
// Confiar em cada rota lembrar disso não funcionou: eram 29 leituras do cache
// para 16 `ensure`, e `GET /api/dashboard` e `GET /api/mesas` devolviam 500 na
// PRIMEIRA requisição depois de todo deploy (confirmado rodando). O usuário via
// erro, recarregava, funcionava — e ninguém ligava uma coisa à outra.
//
// A garantia passou para o `exigeAuth`, que é por onde toda rota autenticada
// entra. Estes testes guardam essa garantia: são de FONTE porque o middleware
// não é exportado, e exportá-lo só para testar seria pior que a doença.
// ---------------------------------------------------------------------------

const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");

// Corpo do `exigeAuth` (da assinatura até o fecho da função).
function corpoExigeAuth() {
  const i = servidor.indexOf("async function exigeAuth(");
  assert.ok(i > -1, "exigeAuth precisa existir");
  const fim = servidor.indexOf("\n}", i);
  return servidor.slice(i, fim);
}

test("exigeAuth aquece o cache do tenant antes de liberar a rota", () => {
  const corpo = corpoExigeAuth();
  assert.match(corpo, /store\.ensure\(/);
});

test("o aquecimento acontece antes do next(), não depois", () => {
  const corpo = corpoExigeAuth();
  const iEnsure = corpo.indexOf("store.ensure(");
  const iNext = corpo.indexOf("next()");
  assert.ok(iEnsure > -1 && iNext > -1);
  assert.ok(iEnsure < iNext, "aquecer depois do next() não garante nada à rota");
});

test("falha ao aquecer não deixa a requisição sem resposta", () => {
  const corpo = corpoExigeAuth();
  // `ensure` fala com o banco: se rejeitar solto, o Express 4 não captura e a
  // requisição fica pendurada para sempre em vez de responder erro.
  assert.match(corpo, /catch/);
});

test("as rotas públicas do cardápio seguem aquecendo por conta própria", () => {
  // Elas não passam pelo exigeAuth (o cliente não tem login), então a garantia
  // central não as alcança.
  const publicas = servidor.split('app.get("/api/c/:slug"')[1] || "";
  assert.match(publicas.slice(0, 600), /store\.ensure\(/);
});
