// Helpers PUROS dos grupos de opções (composição selecionável do item).
// Dual-mode: window.Grupos no browser; module.exports no node --test.
// Composição estruturada: [{ nome, obrigatorio, min, max, itens:[string] }].
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Grupos = api;
})(typeof self !== "undefined" ? self : this, function () {
  // Normaliza a composição (whitelist + coação de tipos). Subgrupo sem itens é
  // descartado. Não-array vira [] (defesa contra o formato de texto antigo).
  function normalizarGrupos(composicao) {
    if (!Array.isArray(composicao)) return [];
    const out = [];
    composicao.forEach((g) => {
      if (!g || typeof g !== "object") return;
      const itens = Array.isArray(g.itens)
        ? g.itens.map((x) => String(x == null ? "" : x).trim()).filter(Boolean)
        : [];
      if (!itens.length) return;
      const min = Math.max(0, parseInt(g.min, 10) || 0);
      let max = Math.max(0, parseInt(g.max, 10) || 0);
      if (max > 0 && max < min) max = min; // max < min = subgrupo impossível de satisfazer → sobe ao mínimo
      out.push({
        nome: String(g.nome == null ? "" : g.nome).trim(),
        obrigatorio: !!g.obrigatorio,
        min: min,
        max: max,
        itens: itens,
      });
    });
    return out;
  }

  // Avalia as escolhas do cliente contra as regras do item-base.
  // `escolhas` = [{ grupo, itens:[nome] }]. Mantém só itens existentes no subgrupo,
  // dedupe, e aplica mín/máx/obrigatório. Retorna { valido, selecoes, pendencias }.
  function avaliarComposicao(base, escolhas) {
    const grupos = normalizarGrupos(base && base.composicao);
    const porGrupo = {};
    (Array.isArray(escolhas) ? escolhas : []).forEach((e) => {
      if (e && e.grupo != null) porGrupo[String(e.grupo)] = Array.isArray(e.itens) ? e.itens : [];
    });
    const selecoes = [];
    const pendencias = [];
    grupos.forEach((g) => {
      const escolhidos = porGrupo[g.nome] || [];
      const validos = [];
      escolhidos.forEach((nome) => {
        const n = String(nome == null ? "" : nome).trim();
        if (g.itens.indexOf(n) !== -1 && validos.indexOf(n) === -1) validos.push(n);
      });
      const min = g.obrigatorio ? Math.max(1, g.min) : g.min;
      const max = g.max > 0 ? g.max : g.itens.length;
      if (validos.length < min) {
        pendencias.push(g.nome + ": escolha " + (min === 1 ? "1 opção" : "ao menos " + min + " opções"));
      } else if (validos.length > max) {
        pendencias.push(g.nome + ": escolha no máximo " + max);
      }
      if (validos.length && validos.length >= min && validos.length <= max) {
        selecoes.push({ grupo: g.nome, itens: validos });
      }
    });
    return { valido: pendencias.length === 0, selecoes: selecoes, pendencias: pendencias };
  }

  return { normalizarGrupos: normalizarGrupos, avaliarComposicao: avaliarComposicao };
});
