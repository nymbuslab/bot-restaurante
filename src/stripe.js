// ============================================================
// STRIPE — assinatura paga (1 plano + trial de 7 dias, só cartão).
//
// Centraliza o client do Stripe e a lógica de billing:
//  - criarCheckout: abre a Checkout Session de assinatura (cobra cartão,
//    inicia trial de 7 dias; o Stripe cobra sozinho no fim do trial).
//  - criarPortal: abre o Customer Portal (trocar cartão / cancelar / faturas).
//  - verificarEvento + tratarEvento: webhook — atualiza o estado do tenant e
//    liga/desliga o bot conforme a assinatura.
//
// O estado de billing vive em colunas de `empresas` (ver src/empresas.js).
// `ativo` (suspensão manual do admin) NÃO é tocado aqui.
// ============================================================

const Stripe = require("stripe");
const empresas = require("./empresas");
const multiBot = require("./multi-bot");
const { PLANO_INFO, planoDoPrice } = require("./planos");

const SECRET = process.env.STRIPE_SECRET_KEY || "";
const PRICE_ID = process.env.STRIPE_PRICE_ID || "";                       // Plano Essencial
const PRICE_ID_COMPLETO = process.env.STRIPE_PRICE_ID_COMPLETO || "";     // Plano Completo
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || ""; // público, vai pro front

// Mapa price_id → plano (essencial|completo), resolvido com os preços do .env.
function planoDeSubscription(sub) {
  const priceId = sub && sub.items && sub.items.data && sub.items.data[0]
    && sub.items.data[0].price && sub.items.data[0].price.id;
  return planoDoPrice(priceId, { essencial: PRICE_ID, completo: PRICE_ID_COMPLETO });
}

// Sem chave + preço, as rotas de assinatura respondem 503 (igual ao super-admin).
const CONFIGURADO = Boolean(SECRET && PRICE_ID);
const stripe = SECRET ? new Stripe(SECRET) : null;

if (!CONFIGURADO) {
  console.warn("⚠️  Stripe não configurado (defina STRIPE_SECRET_KEY e STRIPE_PRICE_ID). Rotas /api/assinatura/* desativadas.");
}

// Status do Stripe → nosso assinatura_status (nenhuma|trialing|active|past_due|canceled).
function mapStatus(s) {
  switch (s) {
    case "trialing": return "trialing";
    case "active":   return "active";
    case "past_due":
    case "unpaid":   return "past_due";
    case "canceled":
    case "incomplete_expired": return "canceled";
    default:         return "nenhuma"; // incomplete, paused
  }
}

// Epoch (segundos) do Stripe → ISO, ou null.
function paraISO(epoch) {
  return epoch ? new Date(epoch * 1000).toISOString() : null;
}

// Garante o Customer do tenant no Stripe (cria se não existir) e devolve o id.
async function garantirCustomer({ slug, nome, email, stripeCustomerId }) {
  if (stripeCustomerId) return stripeCustomerId;
  const c = await stripe.customers.create({ email, name: nome, metadata: { slug } });
  await empresas.atualizarAssinatura(slug, { stripeCustomerId: c.id });
  return c.id;
}

// ---- Checkout PRÓPRIO (Stripe Elements) ----
// Coleta o cartão via SetupIntent (sem cobrar) e só depois cria a assinatura,
// para que o acesso (trialing) só seja liberado COM cartão na conta.

// Passo 1: cria o SetupIntent e devolve o que o front precisa pro Payment Element.
async function criarSetupIntent({ slug, nome, email, stripeCustomerId }) {
  const customer = await garantirCustomer({ slug, nome, email, stripeCustomerId });
  const si = await stripe.setupIntents.create({
    customer,
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { slug },
  });
  return { clientSecret: si.client_secret, publishableKey: PUBLISHABLE_KEY };
}

// Passo 2: com o cartão já confirmado pelo front, define-o como padrão do Customer
// e cria a assinatura (trial 7d). Idempotente: não duplica se já houver assinatura viva.
async function ativarAssinaturaComSetup({ slug, setupIntentId, stripeCustomerId, stripeSubscriptionId }) {
  const si = await stripe.setupIntents.retrieve(setupIntentId);
  if (si.status !== "succeeded") throw new Error("Cartão ainda não confirmado.");
  if (si.customer !== stripeCustomerId) throw new Error("Cartão não pertence a este cliente.");
  const pm = si.payment_method;
  if (!pm) throw new Error("Nenhum cartão associado ao checkout.");

  // Cartão padrão do Customer → é o que o Stripe cobra no fim do trial.
  await stripe.customers.update(stripeCustomerId, {
    invoice_settings: { default_payment_method: pm },
  });

  // Já tem assinatura ativa/trial/atraso? Não cria outra (só aplica o estado atual).
  if (stripeSubscriptionId) {
    const atual = await stripe.subscriptions.retrieve(stripeSubscriptionId).catch(() => null);
    if (atual && ["trialing", "active", "past_due"].includes(atual.status)) {
      await aplicarSubscription(slug, atual, stripeCustomerId);
      return atual;
    }
  }

  const sub = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: PRICE_ID }],
    trial_period_days: 7,
    default_payment_method: pm,
    metadata: { slug },
  });
  await aplicarSubscription(slug, sub, stripeCustomerId);
  return sub;
}

// Cria (ou reusa) o Customer do tenant e abre a Checkout Session HOSPEDADA
// (fallback; o fluxo padrão agora é o checkout próprio acima).
async function criarCheckout({ slug, nome, email, stripeCustomerId, baseUrl }) {
  const customer = await garantirCustomer({ slug, nome, email, stripeCustomerId });
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    subscription_data: { trial_period_days: 7, metadata: { slug } },
    payment_method_types: ["card"],
    metadata: { slug },
    success_url: `${baseUrl}/admin.html?assinatura=ok`,
    cancel_url: `${baseUrl}/admin.html?assinatura=cancelado`,
  });
  return session.url;
}

// ---- Gestão de cartões no painel (sem o portal hospedado) ----

// Lista os cartões do Customer + marca qual é o padrão (o que o Stripe cobra).
async function listarCartoes(stripeCustomerId) {
  if (!stripe || !stripeCustomerId) return [];
  const cust = await stripe.customers.retrieve(stripeCustomerId);
  const padraoId = cust && cust.invoice_settings && cust.invoice_settings.default_payment_method;
  const r = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: "card" });
  return r.data.map((pm) => ({
    id: pm.id,
    marca: pm.card ? pm.card.brand : "card",     // visa, mastercard, ...
    ultimos4: pm.card ? pm.card.last4 : "",
    mes: pm.card ? pm.card.exp_month : null,
    ano: pm.card ? pm.card.exp_year : null,
    padrao: pm.id === padraoId,
  }));
}

// SetupIntent avulso para ADICIONAR um cartão a um Customer já existente
// (sem criar assinatura). Reusa o fluxo do Payment Element do checkout.
async function criarSetupIntentCartao(stripeCustomerId) {
  if (!stripeCustomerId) throw new Error("Cliente sem assinatura iniciada.");
  const si = await stripe.setupIntents.create({
    customer: stripeCustomerId,
    usage: "off_session",
    payment_method_types: ["card"],
  });
  return { clientSecret: si.client_secret, publishableKey: PUBLISHABLE_KEY };
}

// Define um cartão como padrão: no Customer (faturas futuras) E na assinatura
// viva (cobrança da próxima fatura). O PM precisa pertencer ao Customer.
async function definirCartaoPadrao({ stripeCustomerId, stripeSubscriptionId, paymentMethodId }) {
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (!pm || pm.customer !== stripeCustomerId) throw new Error("Cartão não pertence a este cliente.");
  await stripe.customers.update(stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
  if (stripeSubscriptionId) {
    await stripe.subscriptions.update(stripeSubscriptionId, { default_payment_method: paymentMethodId }).catch(() => {});
  }
  return true;
}

// Remove (detach) um cartão. Trava: não pode ser o padrão nem o último cartão,
// para o tenant nunca ficar sem forma de cobrança.
async function removerCartao({ stripeCustomerId, paymentMethodId }) {
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (!pm || pm.customer !== stripeCustomerId) throw new Error("Cartão não pertence a este cliente.");
  const cust = await stripe.customers.retrieve(stripeCustomerId);
  const padraoId = cust && cust.invoice_settings && cust.invoice_settings.default_payment_method;
  if (paymentMethodId === padraoId) throw new Error("Defina outro cartão como padrão antes de remover este.");
  const lista = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: "card" });
  if (lista.data.length <= 1) throw new Error("Você precisa manter ao menos um cartão cadastrado.");
  await stripe.paymentMethods.detach(paymentMethodId);
  return true;
}

// Abre o Customer Portal (gerenciar cartão/cancelamento/faturas).
async function criarPortal({ stripeCustomerId, baseUrl }) {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${baseUrl}/admin.html`,
  });
  return session.url;
}

// Lista as faturas recentes do customer (histórico de pagamento p/ o painel master).
async function listarFaturas(stripeCustomerId, limite = 12) {
  if (!stripe || !stripeCustomerId) return [];
  const r = await stripe.invoices.list({ customer: stripeCustomerId, limit: limite });
  return r.data.map((f) => ({
    id: f.id,
    numero: f.number || null,
    data: paraISO(f.created),
    valor: (f.amount_paid || f.amount_due || 0) / 100,
    moeda: (f.currency || "brl").toUpperCase(),
    status: f.status, // draft | open | paid | void | uncollectible
    pago: f.status === "paid",
    url: f.hosted_invoice_url || null,
    pdf: f.invoice_pdf || null,
  }));
}

// True quando o erro do Stripe é "assinatura já não existe / já cancelada" —
// nesses casos as operações abaixo são idempotentes (o objetivo já está atingido).
function jaResolvida(e) {
  return e && (e.code === "resource_missing" ||
    /no such subscription|already (been )?canceled/i.test(e.message || ""));
}

// Cancela imediatamente a assinatura no Stripe. O webhook subscription.deleted
// confirma o estado no tenant depois; aqui só disparamos o cancelamento.
// Idempotente: se a assinatura já não existe/foi cancelada, retorna sem erro.
async function cancelarAssinatura(stripeSubscriptionId) {
  if (!stripe || !stripeSubscriptionId) return false;
  try {
    await stripe.subscriptions.cancel(stripeSubscriptionId);
  } catch (e) {
    if (jaResolvida(e)) return true;
    throw e;
  }
  return true;
}

// Pausa a cobrança da assinatura SEM cancelá-la (reversível). Usada ao SUSPENDER
// um tenant: enquanto pausada, as faturas do período são anuladas (behavior:void),
// então o cartão não é cobrado. `retomarAssinatura` desfaz. Idempotente.
async function pausarAssinatura(stripeSubscriptionId) {
  if (!stripe || !stripeSubscriptionId) return false;
  try {
    await stripe.subscriptions.update(stripeSubscriptionId, {
      pause_collection: { behavior: "void" },
    });
  } catch (e) {
    if (jaResolvida(e)) return true;
    throw e;
  }
  return true;
}

// Retoma a cobrança de uma assinatura pausada (usada ao REATIVAR um tenant).
async function retomarAssinatura(stripeSubscriptionId) {
  if (!stripe || !stripeSubscriptionId) return false;
  try {
    await stripe.subscriptions.update(stripeSubscriptionId, { pause_collection: "" });
  } catch (e) {
    if (jaResolvida(e)) return true;
    throw e;
  }
  return true;
}

// Verifica a assinatura do webhook (raw body + header stripe-signature).
function verificarEvento(rawBody, assinaturaHeader) {
  return stripe.webhooks.constructEvent(rawBody, assinaturaHeader, WEBHOOK_SECRET);
}

// Resolve o slug a partir do Customer do Stripe (fallback quando não há metadata).
async function slugDoCustomer(customerId) {
  const emp = await empresas.buscarPorStripeCustomer(customerId);
  return emp ? emp.slug : null;
}

// Aplica o estado de uma subscription do Stripe ao tenant (grava + liga/desliga bot).
async function aplicarSubscription(slug, sub, customerId) {
  const status = mapStatus(sub.status);
  const periodEnd = sub.current_period_end
    || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end);
  const dados = {
    status,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
    trialAte: paraISO(sub.trial_end),
    proximaCobranca: paraISO(periodEnd),
  };
  // Plano vem do preço da assinatura; só grava se reconhecido (não rebaixa por engano).
  const plano = planoDeSubscription(sub);
  if (plano) dados.plano = plano;
  await empresas.atualizarAssinatura(slug, dados);
  // Sem acesso → derruba o bot (a religação é manual pelo painel quando reativar).
  if (status === "past_due" || status === "canceled" || status === "nenhuma") {
    await multiBot.desconectar(slug).catch(() => {});
  }
}

// Reage a um evento JÁ verificado do webhook.
async function tratarEvento(event) {
  const obj = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const slug = obj.metadata && obj.metadata.slug;
      if (slug && obj.subscription) {
        const sub = await stripe.subscriptions.retrieve(obj.subscription);
        await aplicarSubscription(slug, sub, obj.customer);
      }
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const slug = (obj.metadata && obj.metadata.slug) || (await slugDoCustomer(obj.customer));
      if (slug) await aplicarSubscription(slug, obj, obj.customer);
      break;
    }

    case "invoice.paid": {
      const slug = await slugDoCustomer(obj.customer);
      if (slug && obj.subscription) {
        const sub = await stripe.subscriptions.retrieve(obj.subscription);
        await aplicarSubscription(slug, sub, obj.customer);
      }
      break;
    }

    case "invoice.payment_failed": {
      const slug = await slugDoCustomer(obj.customer);
      if (slug) {
        await empresas.atualizarAssinatura(slug, { status: "past_due" });
        await multiBot.desconectar(slug).catch(() => {});
      }
      break;
    }

    default:
      // Evento não tratado: ignora (Stripe envia muitos tipos).
      break;
  }
}

module.exports = {
  stripe, CONFIGURADO, PRICE_ID, PRICE_ID_COMPLETO, PUBLISHABLE_KEY, PLANO_INFO, planoDoPrice,
  criarCheckout, criarPortal, verificarEvento, tratarEvento,
  listarFaturas, cancelarAssinatura, pausarAssinatura, retomarAssinatura,
  garantirCustomer, criarSetupIntent, ativarAssinaturaComSetup,
  listarCartoes, criarSetupIntentCartao, definirCartaoPadrao, removerCartao,
};
