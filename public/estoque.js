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
  // Com `mapa` (id->item) respeita a unidade: kg soma peso decimal, un soma inteiro.
  function _agregar(itensPayload, mapa) {
    const ped = {};
    (itensPayload || []).forEach(function (p) {
      if (!p || p.id == null) return;
      const base = mapa && mapa[p.id];
      const ehKg = base && base.unidade === "kg";
      const q = ehKg
        ? Math.max(0, parseFloat(String(p.qtd).replace(",", ".")) || 0)
        : Math.max(1, parseInt(p.qtd, 10) || 1);
      ped[p.id] = (ped[p.id] || 0) + q;
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
  // Variações têm estoque próprio. Chave = id_item + "::" + id_variacao. Sempre "un".
  function _chaveVar(idItem, idVar) { return String(idItem) + "::" + String(idVar); }
  function _agregarVariacoes(itensPayload) {
    const pedV = {};
    (itensPayload || []).forEach(function (p) {
      if (!p || p.id == null || !Array.isArray(p.variacoes)) return;
      p.variacoes.forEach(function (v) {
        if (!v || v.id == null) return;
        const k = _chaveVar(p.id, v.id);
        pedV[k] = (pedV[k] || 0) + Math.max(1, parseInt(v.qtd, 10) || 1);
      });
    });
    return pedV;
  }
  function _mapaVariacoes(cardapio) {
    const mapa = {};
    ((cardapio && cardapio.categorias) || []).forEach(function (c) {
      ((c && c.itens) || []).forEach(function (it) {
        if (!it || !Array.isArray(it.variacoes)) return;
        it.variacoes.forEach(function (v) {
          if (v && v.id != null) mapa[_chaveVar(it.id, v.id)] = { variacao: v, itemNome: it.nome };
        });
      });
    });
    return mapa;
  }
  function validarEstoque(cardapio, itensPayload) {
    const mapa = _mapaItens(cardapio);
    const ped = _agregar(itensPayload, mapa);
    for (const id in ped) {
      const base = mapa[id];
      if (!base) continue;
      const st = statusEstoque(base);
      if (!st.controlado) continue;
      if (st.quantidade === 0) return { ok: false, erro: base.nome + " está esgotado." };
      if (ped[id] > st.quantidade) {
        const resta = st.unidade === "kg"
          ? formatarQtd(st.quantidade, "kg") + " kg"
          : st.quantidade + " unidades";
        return { ok: false, erro: "Restam só " + resta + " de " + base.nome + "." };
      }
    }
    // estoque por variação (cada opção do item tem o seu) — sempre "un"
    const mapaV = _mapaVariacoes(cardapio);
    const pedV = _agregarVariacoes(itensPayload);
    for (const k in pedV) {
      const ref = mapaV[k];
      if (!ref) continue;
      const stv = statusEstoque(ref.variacao);
      if (!stv.controlado) continue;
      const rotulo = ref.itemNome + " (" + ref.variacao.nome + ")";
      if (stv.quantidade === 0) return { ok: false, erro: rotulo + " está esgotado." };
      if (pedV[k] > stv.quantidade) return { ok: false, erro: "Restam só " + stv.quantidade + " unidades de " + rotulo + "." };
    }
    return { ok: true, erro: "" };
  }
  function aplicarBaixa(cardapio, itensPayload) {
    const mapa = _mapaItens(cardapio);
    const ped = _agregar(itensPayload, mapa);
    const pedV = _agregarVariacoes(itensPayload);
    const categorias = ((cardapio && cardapio.categorias) || []).map(function (c) {
      return Object.assign({}, c, {
        itens: ((c && c.itens) || []).map(function (it) {
          if (!it) return it;
          let novoIt = it;
          // baixa do item-base (un/kg) — como antes
          if (temControle(it) && ped[it.id]) {
            const ehKg = it.unidade === "kg";
            const q = ehKg
              ? Math.max(0, parseFloat(String(it.estoque).replace(",", ".")) || 0)
              : Math.max(0, parseInt(it.estoque, 10) || 0);
            const novo = Math.max(0, q - ped[it.id]);
            novoIt = Object.assign({}, it, { estoque: ehKg ? Math.round(novo * 1000) / 1000 : novo });
          }
          // baixa por variação (sempre "un") — clona só o que mudou
          if (Array.isArray(it.variacoes) && it.variacoes.length) {
            const novasVar = it.variacoes.map(function (v) {
              if (!v || v.id == null || !temControle(v)) return v;
              const dec = pedV[_chaveVar(it.id, v.id)];
              if (!dec) return v;
              const q = Math.max(0, parseInt(v.estoque, 10) || 0);
              return Object.assign({}, v, { estoque: Math.max(0, q - dec) });
            });
            novoIt = Object.assign({}, novoIt, { variacoes: novasVar });
          }
          return novoIt;
        }),
      });
    });
    return Object.assign({}, cardapio, { categorias: categorias });
  }
  return { temControle: temControle, statusEstoque: statusEstoque, formatarQtd: formatarQtd, validarEstoque: validarEstoque, aplicarBaixa: aplicarBaixa };
});
