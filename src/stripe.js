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

const SECRET = process.env.STRIPE_SECRET_KEY || "";
const PRICE_ID = process.env.STRIPE_PRICE_ID || "";
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

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

// Cria (ou reusa) o Customer do tenant e abre a Checkout Session de assinatura.
async function criarCheckout({ slug, nome, email, stripeCustomerId, baseUrl }) {
  let customer = stripeCustomerId;
  if (!customer) {
    const c = await stripe.customers.create({ email, name: nome, metadata: { slug } });
    customer = c.id;
    await empresas.atualizarAssinatura(slug, { stripeCustomerId: customer });
  }
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

// Cancela imediatamente a assinatura no Stripe. O webhook subscription.deleted
// confirma o estado no tenant depois; aqui só disparamos o cancelamento.
async function cancelarAssinatura(stripeSubscriptionId) {
  if (!stripe || !stripeSubscriptionId) return false;
  await stripe.subscriptions.cancel(stripeSubscriptionId);
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
  await empresas.atualizarAssinatura(slug, {
    status,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
    trialAte: paraISO(sub.trial_end),
    proximaCobranca: paraISO(periodEnd),
  });
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
  stripe, CONFIGURADO, PRICE_ID,
  criarCheckout, criarPortal, verificarEvento, tratarEvento,
  listarFaturas, cancelarAssinatura,
};
