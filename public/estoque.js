// ============================================================
// Estoque do cardápio — lógica pura e testável.
// temControle: o item tem estoque finito (inclui 0)? ausente/""/null = ilimitado.
// statusEstoque: { controlado, esgotado, baixo, quantidade } para selos do painel.
// validarEstoque: o pedido cabe no estoque? (servidor — fonte de verdade)
// aplicarBaixa: desconta o estoque do cardápio após o pedido (cópia, não muta).
// Dual-mode: window.Estoque no browser, module.exports no Node.
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.Estoque = api;
})(this, function () {
  function temControle(item) {
    return !!item && item.estoque !== undefined && item.estoque !== null && item.estoque !== "";
  }
  function statusEstoque(item) {
    if (!temControle(item)) return { controlado: false, esgotado: false, baixo: false, quantidade: null, minimo: 0, unidade: "un" };
    const ehKg = item.unidade === "kg";
    const num = function (v) {
      return ehKg ? (parseFloat(String(v).replace(",", ".")) || 0) : (parseInt(v, 10) || 0);
    };
    const q = Math.max(0, num(item.estoque));
    const min = Math.max(0, num(item.estoqueMinimo));
    return { controlado: true, esgotado: q === 0, baixo: q > 0 && q <= min, quantidade: q, minimo: min, unidade: ehKg ? "kg" : "un" };
  }
  // Formata uma quantidade para exibição: un = inteiro, kg = decimal BR (vírgula).
  function formatarQtd(q, unidade) {
    const n = Number(q) || 0;
    if (unidade === "kg") return String(Math.round(n * 1000) / 1000).replace(".", ",");
    return String(Math.round(n));
  }
  // Soma a quantidade pedida por id (mesmo item em linhas diferentes do carrinho).
  function _agregar(itensPayload) {
    const ped = {};
    (itensPayload || []).forEach(function (p) {
      if (p && p.id != null) ped[p.id] = (ped[p.id] || 0) + Math.max(1, parseInt(p.qtd, 10) || 1);
    });
    return ped;
  }
  function _mapaItens(cardapio) {
    const mapa = {};
    ((cardapio && cardapio.categorias) || []).forEach(function (c) {
      ((c && c.itens) || []).forEach(function (it) { if (it) mapa[it.id] = it; });
    });
    return mapa;
  }
  function validarEstoque(cardapio, itensPayload) {
    const mapa = _mapaItens(cardapio);
    const ped = _agregar(itensPayload);
    for (const id in ped) {
      const base = mapa[id];
      if (!base) continue;
      const st = statusEstoque(base);
      if (!st.controlado) continue;
      if (st.quantidade === 0) return { ok: false, erro: base.nome + " está esgotado." };
      if (ped[id] > st.quantidade) return { ok: false, erro: "Restam só " + st.quantidade + " unidades de " + base.nome + "." };
    }
    return { ok: true, erro: "" };
  }
  function aplicarBaixa(cardapio, itensPayload) {
    const ped = _agregar(itensPayload);
    const categorias = ((cardapio && cardapio.categorias) || []).map(function (c) {
      return Object.assign({}, c, {
        itens: ((c && c.itens) || []).map(function (it) {
          if (!it || !temControle(it) || !ped[it.id]) return it;
          const q = Math.max(0, parseInt(it.estoque, 10) || 0);
          return Object.assign({}, it, { estoque: Math.max(0, q - ped[it.id]) });
        }),
      });
    });
    return Object.assign({}, cardapio, { categorias: categorias });
  }
  return { temControle: temControle, statusEstoque: statusEstoque, formatarQtd: formatarQtd, validarEstoque: validarEstoque, aplicarBaixa: aplicarBaixa };
});
