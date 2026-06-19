// ============================================================
// PLANOS — mapa PURO dos planos comerciais (sem dependências → testável
// isolado, ver test/planos.test.js). Fonte única de nome/valor de cada plano e
// do mapeamento price_id (Stripe) → plano. Usado por src/stripe.js e
// src/servidor.js (e, no front, os nomes vêm da API, não fixos no HTML).
// ============================================================

// Nome e valor mensal (R$) por plano. Fonte única para exibição.
const PLANO_INFO = {
  essencial: { nome: "Plano Essencial", valorMes: 79 },
  completo:  { nome: "Plano Completo",  valorMes: 99 },
};

// Mapeia um price_id do Stripe para o plano, dados os ids dos dois preços
// (vindos do .env). Retorna "essencial" | "completo" | null (preço desconhecido).
function planoDoPrice(priceId, ids = {}) {
  if (!priceId) return null;
  if (ids.completo && priceId === ids.completo) return "completo";
  if (ids.essencial && priceId === ids.essencial) return "essencial";
  return null;
}

module.exports = { PLANO_INFO, planoDoPrice };
