// ---------------------------------------------------------------------------
// STRIPE TEST-MODE — checkout próprio + webhook assinado.
//
// Usa só chaves `sk_test`/`pk_test`, preços `price_...` do ambiente de teste e
// `whsec_...`. A Stripe recomenda usar PaymentMethod de teste como
// `pm_card_visa` em código automatizado, sem número real de cartão.
// ---------------------------------------------------------------------------

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const Stripe = require("stripe");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");
const empresas = require("../../src/empresas");

function stripeTesteConfigurado() {
  return /^sk_test_?/.test(process.env.STRIPE_SECRET_KEY || "") &&
    /^pk_test_?/.test(process.env.STRIPE_PUBLISHABLE_KEY || "") &&
    /^price_/.test(process.env.STRIPE_PRICE_ID || "") &&
    /^price_/.test(process.env.STRIPE_PRICE_ID_COMPLETO || "") &&
    /^whsec_/.test(process.env.STRIPE_WEBHOOK_SECRET || "");
}

const TEM_STRIPE_TESTE = stripeTesteConfigurado();
const stripe = TEM_STRIPE_TESTE ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const ids = { customer: new Set(), subscription: new Set() };

let loja;

before(async () => {
  loja = await tenant.criarEmpresa("stripe");
});

after(async () => {
  if (stripe) {
    const emp = loja && await empresas.buscarPorSlug(loja.slug).catch(() => null);
    if (emp && emp.stripeSubscriptionId) ids.subscription.add(emp.stripeSubscriptionId);
    if (emp && emp.stripeCustomerId) ids.customer.add(emp.stripeCustomerId);

    for (const id of ids.subscription) {
      await stripe.subscriptions.cancel(id).catch((e) => {
        if (!/No such subscription|already.*canceled/i.test(e.message || "")) {
          console.error("AVISO: falha ao cancelar subscription Stripe de teste:", e.message);
        }
      });
    }
    for (const id of ids.customer) {
      await stripe.customers.del(id).catch((e) => {
        if (!/No such customer/i.test(e.message || "")) {
          console.error("AVISO: falha ao apagar customer Stripe de teste:", e.message);
        }
      });
    }
  }
  await app.derrubar();
  await tenant.limparTudo();
});

function setupIntentId(clientSecret) {
  const m = String(clientSecret || "").match(/^(seti_[^_]+(?:_[^_]+)*)_secret_/);
  return m && m[1];
}

async function assinaturaAtual() {
  const r = await app.pedir("/api/assinatura", { token: loja.token });
  assert.equal(r.status, 200, "assinatura respondeu " + r.status + ": " + JSON.stringify(r.corpo));
  return r.corpo;
}

async function esperarEvento(tipo, objectId) {
  for (let i = 0; i < 12; i++) {
    const lista = await stripe.events.list({ type: tipo, limit: 20 });
    const achado = lista.data.find((e) => e.data && e.data.object && e.data.object.id === objectId);
    if (achado) return achado;
    await new Promise((ok) => setTimeout(ok, 500));
  }
  throw new Error("evento Stripe não apareceu na lista: " + tipo + " / " + objectId);
}

async function enviarWebhook(evento) {
  const { base } = await app.subir();
  const payload = JSON.stringify(evento);
  const assinatura = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  const r = await fetch(base + "/api/stripe/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": assinatura,
    },
    body: payload,
  });
  const texto = await r.text();
  let corpo = texto;
  try { corpo = JSON.parse(texto); } catch (_) {}
  return { status: r.status, corpo, texto };
}

test("checkout próprio cria assinatura de teste e webhook assinado reaplica o estado", {
  skip: TEM_STRIPE_TESTE ? false : "Stripe test-mode não configurado no .env.test",
}, async () => {
  const essencial = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID);
  const completo = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID_COMPLETO);
  assert.ok(essencial.recurring, "STRIPE_PRICE_ID precisa ser preço recorrente");
  assert.ok(completo.recurring, "STRIPE_PRICE_ID_COMPLETO precisa ser preço recorrente");

  const inicio = await app.pedir("/api/assinatura/setup-intent", {
    token: loja.token,
    corpo: { plano: "completo" },
  });
  assert.equal(inicio.status, 200, "setup-intent respondeu " + inicio.status + ": " + JSON.stringify(inicio.corpo));
  assert.equal(inicio.corpo.publishableKey, process.env.STRIPE_PUBLISHABLE_KEY);
  assert.match(inicio.corpo.clientSecret || "", /^seti_.*_secret_/);

  const seti = setupIntentId(inicio.corpo.clientSecret);
  assert.ok(seti, "não consegui extrair o id do SetupIntent");

  const empComCustomer = await empresas.buscarPorSlug(loja.slug);
  assert.ok(empComCustomer.stripeCustomerId, "setup-intent precisa gravar o customer no tenant");
  ids.customer.add(empComCustomer.stripeCustomerId);

  // `criarEmpresa` libera o tenant como cortesia para os outros testes. Aqui a
  // assinatura precisa sair do Stripe, então removemos o override manual antes
  // de confirmar o checkout.
  await empresas.atualizarAssinatura(loja.slug, { status: "nenhuma", plano: "essencial" });

  await stripe.setupIntents.confirm(seti, { payment_method: "pm_card_visa" });

  const confirmar = await app.pedir("/api/assinatura/confirmar", {
    token: loja.token,
    corpo: { setupIntentId: seti, plano: "completo" },
  });
  assert.equal(confirmar.status, 200, "confirmar respondeu " + confirmar.status + ": " + JSON.stringify(confirmar.corpo));
  assert.deepEqual(confirmar.corpo, { ok: true });

  const depoisCheckout = await assinaturaAtual();
  assert.equal(depoisCheckout.status, "trialing");
  assert.equal(depoisCheckout.plano, "completo");
  assert.equal(depoisCheckout.acessoLiberado, true);

  const empComSub = await empresas.buscarPorSlug(loja.slug);
  assert.ok(empComSub.stripeSubscriptionId, "confirmar precisa gravar a subscription no tenant");
  ids.subscription.add(empComSub.stripeSubscriptionId);

  // Agora prova a rota de webhook de verdade: bagunça o estado local e deixa um
  // evento real, listado pela API da Stripe, restaurar status/plano/customer/sub.
  await empresas.atualizarAssinatura(loja.slug, {
    status: "nenhuma",
    plano: "essencial",
    stripeSubscriptionId: null,
  });

  const evento = await esperarEvento("customer.subscription.created", empComSub.stripeSubscriptionId);
  const webhook = await enviarWebhook(evento);
  assert.equal(webhook.status, 200, "webhook respondeu " + webhook.status + ": " + webhook.texto);
  assert.equal(webhook.corpo.received, true);

  const depoisWebhook = await assinaturaAtual();
  assert.equal(depoisWebhook.status, "trialing");
  assert.equal(depoisWebhook.plano, "completo");
  assert.equal(depoisWebhook.acessoLiberado, true);

  const repetido = await enviarWebhook(evento);
  assert.equal(repetido.status, 200);
  assert.equal(repetido.corpo.duplicado, true, "segunda entrega do mesmo event.id deve cair no dedup");
});
