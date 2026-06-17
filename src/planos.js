// ============================================================
// PLANOS — registro central dos planos/tiers da plataforma.
//
// Módulo PURO (dados + helpers), sem I/O. Fonte única de verdade do que cada
// plano custa e quais FEATURES libera. Adicionar um plano novo = uma entrada
// aqui (+ o env do price do Stripe) — nada mais precisa mudar de arquitetura.
//
// O tenant guarda só a CHAVE do plano (coluna `empresas.plano`, default 'bot').
// O preço real é amarrado a um Stripe Price (env). O mapa reverso price→plano
// é usado pelo webhook (que recebe o price.id da subscription).
// ============================================================

const PLANOS = {
  bot: {
    chave: "bot",
    nome: "Bot",
    preco: 79,
    precoLabel: "R$ 79,00/mês",
    stripePriceId: process.env.STRIPE_PRICE_ID || "",
    features: { bot: true, cardapioDigital: false },
  },
  digital: {
    chave: "digital",
    nome: "Cardápio Digital",
    preco: 89,
    precoLabel: "R$ 89,00/mês",
    stripePriceId: process.env.STRIPE_PRICE_ID_DIGITAL || "",
    features: { bot: true, cardapioDigital: true },
  },
  // Plano 3 (futuro: pedido no cardápio digital) entra aqui:
  // pedidos: { chave:"pedidos", ..., stripePriceId: process.env.STRIPE_PRICE_ID_PEDIDOS || "",
  //            features:{ bot:true, cardapioDigital:true, pedidoDigital:true } },
};

const PADRAO = "bot";

// Plano por chave; valor desconhecido cai no padrão (nunca retorna undefined).
function get(chave) {
  return PLANOS[chave] || PLANOS[PADRAO];
}

function planoPadrao() {
  return PADRAO;
}

// True se o plano (resolvido com fallback) libera a feature. Como o padrão é
// `bot` e todo plano tem `bot:true`, plano desconhecido ainda mantém o bot.
function temFeature(chave, feature) {
  const p = get(chave);
  return !!(p.features && p.features[feature] === true);
}

// Stripe Price do plano (string vazia se o plano não tiver preço configurado).
function priceIdDe(chave) {
  return get(chave).stripePriceId || "";
}

// Mapa reverso { priceId → chave }, montado uma vez (ignora ids vazios).
const _porPrice = {};
for (const [chave, p] of Object.entries(PLANOS)) {
  if (p.stripePriceId) _porPrice[p.stripePriceId] = chave;
}

// Resolve a chave do plano a partir do Stripe Price id; null se não mapeado.
function planoPorPriceId(priceId) {
  return priceId && _porPrice[priceId] ? _porPrice[priceId] : null;
}

// Lista para a UI (cadastro/assinatura): só planos VENDÁVEIS (com price
// configurado). Nunca expõe nada sensível além de nome/preço/features.
function publico() {
  return Object.values(PLANOS)
    .filter((p) => p.stripePriceId)
    .map((p) => ({
      chave: p.chave,
      nome: p.nome,
      preco: p.preco,
      precoLabel: p.precoLabel,
      features: { ...p.features },
    }));
}

module.exports = { PLANOS, get, planoPadrao, temFeature, priceIdDe, planoPorPriceId, publico };
