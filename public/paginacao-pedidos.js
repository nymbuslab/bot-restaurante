// ============================================================
// "Carregar mais" da lista de Pedidos (painel do dono) — helpers
// puros e testáveis de contagem visível.
// contagemInicial: quantos pedidos mostrar de cara.
// proximaContagem: quantos mostrar após um clique em "Carregar mais".
// temMais: ainda há pedidos além dos visíveis?
// Dual-mode: window.PaginacaoPedidos no browser, module.exports no Node (testes).
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.PaginacaoPedidos = api;
})(this, function () {
  function contagemInicial(total, limiteInicial) {
    return Math.min(total, limiteInicial);
  }

  function proximaContagem(atual, incremento, total) {
    return Math.min(atual + incremento, total);
  }

  function temMais(visivel, total) {
    return visivel < total;
  }

  return { contagemInicial, proximaContagem, temMais };
});