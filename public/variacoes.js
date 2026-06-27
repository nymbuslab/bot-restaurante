// ============================================================
// Variações do item — opções com PREÇO e ESTOQUE próprios
// (ex.: "Refrigerantes 350ml" → Coca/Guaraná/Água, cada um com seu
// preço e estoque). O cliente escolhe várias COM QUANTIDADE; o preço
// soma; cada variação dá baixa no seu próprio estoque.
//
// - normalizarVariacoes: whitelist/coação ([{id,nome,preco,estoque?,estoqueMinimo?}]).
// - precoAPartir: menor preço entre as variações (p/ o card "a partir de R$ X").
// - avaliarVariacoes: valida as escolhas do cliente (≥1, clamp qtd, ids válidos) e soma.
// - todasEsgotadas: item com variações todas controladas e zeradas.
//
// Reusa o motor de estoque (Estoque.statusEstoque/temControle) — mesma
// semântica do item (sem estoque = ilimitado, 0 = esgotado). Variação é
// sempre "un". Dual-mode: window.Variacoes no browser; module.exports no Node.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(require("./estoque"));
  } else {
    root.Variacoes = factory(typeof window !== "undefined" ? window.Estoque : null);
  }
})(typeof self !== "undefined" ? self : this, function (Estoque) {
  const MAX_QTD = 99;

  function _controlada(v) { return !!(Estoque && Estoque.temControle(v)); }
  function _esgotada(v) { return !!(Estoque && Estoque.statusEstoque(v).esgotado); }

  // Normaliza a lista de variações (whitelist + coação de tipos). Descarta sem nome.
  // `estoque`/`estoqueMinimo` só entram se controlados (não vazios). `id` é preservado
  // como veio (o editor é quem gera ids estáveis) — NÃO gera id aqui para o id não
  // mudar a cada projeção do servidor (o estoque é casado por esse id).
  function normalizarVariacoes(lista) {
    if (!Array.isArray(lista)) return [];
    const out = [];
    lista.forEach(function (v) {
      if (!v || typeof v !== "object") return;
      const nome = String(v.nome == null ? "" : v.nome).trim();
      if (!nome) return;
      const out1 = {
        id: String(v.id == null ? "" : v.id),
        nome: nome,
        preco: Math.max(0, Number(String(v.preco == null ? 0 : v.preco).replace(",", ".")) || 0),
      };
      if (v.estoque !== undefined && v.estoque !== null && v.estoque !== "") {
        out1.estoque = Math.max(0, parseInt(v.estoque, 10) || 0);
        if (v.estoqueMinimo !== undefined && v.estoqueMinimo !== null && v.estoqueMinimo !== "") {
          out1.estoqueMinimo = Math.max(0, parseInt(v.estoqueMinimo, 10) || 0);
        }
      }
      out.push(out1);
    });
    return out;
  }

  // Menor preço entre as variações disponíveis (não esgotadas); se todas esgotadas,
  // cai pro menor de todas (o item ficará esgotado via todasEsgotadas). null se não há.
  function precoAPartir(item) {
    const vs = normalizarVariacoes(item && item.variacoes);
    if (!vs.length) return null;
    const disp = vs.filter(function (v) { return !_esgotada(v); });
    const pool = disp.length ? disp : vs;
    let min = null;
    pool.forEach(function (v) { if (min === null || v.preco < min) min = v.preco; });
    return min;
  }

  // true se o item tem variações e TODAS são controladas e zeradas. Se qualquer
  // variação é ilimitada (sem estoque), nunca fica "tudo esgotado".
  function todasEsgotadas(item) {
    const vs = normalizarVariacoes(item && item.variacoes);
    if (!vs.length) return false;
    return vs.every(function (v) { return _controlada(v) && _esgotada(v); });
  }

  // Avalia as escolhas do cliente. `escolhas` = [{ id, qtd }]. Mantém só ids
  // existentes, soma/dedupe por id, clampa qtd em 1..MAX_QTD. Regra: item COM
  // variações exige ≥1 escolhida (senão o total seria 0). Retorna soma (addUnit).
  function avaliarVariacoes(item, escolhas) {
    const vs = normalizarVariacoes(item && item.variacoes);
    const mapa = {};
    vs.forEach(function (v) { if (v.id) mapa[v.id] = v; });
    const porId = {};
    (Array.isArray(escolhas) ? escolhas : []).forEach(function (e) {
      if (!e || e.id == null) return;
      const id = String(e.id);
      if (!(id in mapa)) return; // ignora id desconhecido (anti-fraude)
      const q = Math.max(1, parseInt(e.qtd, 10) || 1);
      porId[id] = Math.min(MAX_QTD, (porId[id] || 0) + q);
    });
    const selecoes = [];
    let addUnit = 0;
    Object.keys(porId).forEach(function (id) {
      const v = mapa[id];
      selecoes.push({ id: id, nome: v.nome, preco: v.preco, qtd: porId[id] });
      addUnit += v.preco * porId[id];
    });
    const pendencias = [];
    if (vs.length && selecoes.length === 0) pendencias.push("Escolha ao menos 1 opção");
    return { valido: pendencias.length === 0, selecoes: selecoes, pendencias: pendencias, addUnit: addUnit };
  }

  return {
    normalizarVariacoes: normalizarVariacoes,
    precoAPartir: precoAPartir,
    todasEsgotadas: todasEsgotadas,
    avaliarVariacoes: avaliarVariacoes,
  };
});
