const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Dedup do webhook do Stripe: marcar como visto só DEPOIS de processar.
//
// O id do evento era adicionado ao Set ANTES de `tratarEvento`. Se o
// processamento falhasse, a rota respondia 500 e o Stripe re-entregava — mas a
// re-entrega batia no dedup, voltava 200 com `duplicado: true`, e o Stripe dava
// o evento por concluído. A cobrança, o cancelamento ou a troca de plano se
// perdiam PARA SEMPRE, em silêncio, e o tenant ficava com a assinatura errada.
//
// A retentativa do Stripe é a única rede de proteção que existe aqui, e o dedup
// estava desarmando ela justamente no caso em que ela importa.
//
// Teste de fonte porque a rota vive dentro do `servidor.js`, que não é
// importável sem subir o app inteiro. Guarda a ORDEM, que é o defeito.
// ---------------------------------------------------------------------------

const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");

function corpoWebhook() {
  const i = servidor.indexOf('app.post("/api/stripe/webhook"');
  assert.ok(i > -1, "a rota do webhook precisa existir");
  const fim = servidor.indexOf("\napp.", i + 10);
  return servidor.slice(i, fim);
}

test("o evento só é marcado como visto depois de processado", () => {
  const c = corpoWebhook();
  const iTrata = c.indexOf("tratarEvento(");
  const iMarca = c.indexOf("stripeEventsVistos.add(");
  assert.ok(iTrata > -1 && iMarca > -1);
  assert.ok(iMarca > iTrata,
    "marcar antes de processar faz a retentativa do Stripe ser descartada como duplicada");
});

test("a checagem de duplicado continua antes do processamento", () => {
  const c = corpoWebhook();
  const iCheca = c.indexOf("stripeEventsVistos.has(");
  const iTrata = c.indexOf("tratarEvento(");
  assert.ok(iCheca > -1 && iCheca < iTrata, "sem isso o dedup não serve para nada");
});

test("falha ao processar continua respondendo 500 para o Stripe re-tentar", () => {
  const c = corpoWebhook();
  assert.match(c, /status\(500\)/);
  assert.match(c, /re-?tenta/i); // o comentário que explica o porquê do 500
});

test("a poda do Set continua existindo (memória não cresce sem limite)", () => {
  const c = corpoWebhook();
  assert.match(c, /size > \d+/);
  assert.match(c, /clear\(\)/);
});
