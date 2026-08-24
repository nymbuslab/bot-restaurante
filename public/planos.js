// ============================================================
// PLANOS — mapa PURO dos planos comerciais (sem dependências → testável
// isolado, ver test/planos.test.js). Fonte única de nome/valor de cada plano e
// do mapeamento price_id (Stripe) → plano.
//
// Dual-mode (Node/browser), como `pagamentos.js` e `horario.js`: mora em
// `public/` porque as TELAS precisam do mesmo número que o servidor cobra. Antes
// era só do servidor, e cada tela que mostrava preço mantinha a própria cópia
// escrita à mão — o painel, o checkout e o master. Um reajuste aqui deixaria as
// três anunciando o valor velho, inclusive na hora de autorizar a cobrança.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.Planos = factory();
})(typeof self !== "undefined" ? self : this, function () {
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

  // "R$ 99,00" a partir do valor do plano; "—" quando o plano é desconhecido.
  function precoPlano(valorMes) {
    return valorMes == null ? "—" : "R$ " + Number(valorMes).toFixed(2).replace(".", ",");
  }

  // Nome e valor de um plano, com nome de reserva se a chave não existir.
  function infoDoPlano(chave) {
    return PLANO_INFO[chave] || { nome: chave === "completo" ? "Plano Completo" : "Plano Essencial", valorMes: null };
  }

  return { PLANO_INFO: PLANO_INFO, planoDoPrice: planoDoPrice, precoPlano: precoPlano, infoDoPlano: infoDoPlano };
});
