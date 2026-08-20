const { test } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/db");

// ---------------------------------------------------------------------------
// O `.env` local aponta para o MESMO Supabase de produção. Um teste que esqueça
// de stubar sai falando com dado real: aconteceu com o teste da transferência de
// mesa, que chamava `db.pool.connect()` por dentro da função e abriu conexão de
// verdade (só não escreveu porque a transação abortou na primeira query).
//
// A trava vive no `src/db.js`, que é o portão único, em vez de depender de cada
// teste lembrar. Estes testes guardam a guarda: se alguém remover a trava, aqui
// quebra antes de a próxima gravação em produção acontecer.
//
// Este arquivo NÃO stuba nada de propósito — é o único que fala com o módulo cru.
// ---------------------------------------------------------------------------

test("db.query é recusado dentro do runner de testes", async () => {
  await assert.rejects(
    async () => db.query("SELECT 1"),
    /banco REAL|produção/i
  );
});

test("db.pool.connect é recusado dentro do runner de testes", () => {
  assert.throws(() => db.pool.connect(), /banco REAL|produção/i);
});

test("a mensagem diz o que fazer, não só que falhou", () => {
  try {
    db.pool.connect();
    assert.fail("deveria ter recusado");
  } catch (e) {
    assert.match(e.message, /Stube/i);                     // o caminho normal
    assert.match(e.message, /PERMITIR_BANCO_EM_TESTE/);    // e a saída consciente
  }
});

test("o pool dublê não tem caminho escondido para o banco", () => {
  // Clonar o Pool real trocando só `connect` deixaria `query` resolvendo pelo
  // protótipo e ainda conectando. O dublê recusa pelos dois lados.
  assert.throws(() => db.pool.query("SELECT 1"), /banco REAL|produção/i);
});
