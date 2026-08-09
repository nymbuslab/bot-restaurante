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

  // ---- Biblioteca de grupos (cardapio.grupos) ----
  // Grupo: { id, nome, padrao:{obrigatorio,min,max}, opcoes:[{id,nome,preco}] }.
  // O id é ESTÁVEL: renomear não gera id novo (é a âncora da ficha técnica de
  // Insumos). As OPÇÕES moram aqui; a REGRA efetiva mora no vínculo do item,
  // pra Marmitex P/M/G usarem a mesma lista escolhendo 1, 2 e 3.
  function normalizarRegra(r) {
    const o = r && typeof r === "object" ? r : {};
    const min = Math.max(0, parseInt(o.min, 10) || 0);
    let max = Math.max(0, parseInt(o.max, 10) || 0);
    if (max > 0 && max < min) max = min; // regra impossível de satisfazer sobe ao mínimo
    return { obrigatorio: !!o.obrigatorio, min: min, max: max };
  }

  function normalizarBiblioteca(lista) {
    if (!Array.isArray(lista)) return [];
    const out = [];
    lista.forEach(function (g) {
      if (!g || typeof g !== "object") return;
      const id = String(g.id == null ? "" : g.id).trim();
      if (!id) return; // sem id não há como vincular
      const opcoes = [];
      (Array.isArray(g.opcoes) ? g.opcoes : []).forEach(function (o) {
        if (!o || typeof o !== "object") return;
        const oid = String(o.id == null ? "" : o.id).trim();
        const nome = String(o.nome == null ? "" : o.nome).trim();
        if (!oid || !nome) return;
        opcoes.push({ id: oid, nome: nome, preco: Math.max(0, Number(o.preco) || 0) });
      });
      if (!opcoes.length) return; // grupo sem opção não existe
      out.push({
        id: id,
        nome: String(g.nome == null ? "" : g.nome).trim(),
        padrao: normalizarRegra(g.padrao),
        opcoes: opcoes,
      });
    });
    return out;
  }

  // Expande item.grupos ([{id, obrigatorio?, min?, max?}]) na forma concreta.
  // Opções sempre da biblioteca; regra do item (ou o padrão do grupo, quando o
  // item não define). Vínculo órfão é ignorado. Ordem = ordem do array do item.
  function resolverGrupos(item, biblioteca) {
    const porId = {};
    normalizarBiblioteca(biblioteca).forEach(function (g) { porId[g.id] = g; });
    const vinculos = item && Array.isArray(item.grupos) ? item.grupos : [];
    const out = [];
    vinculos.forEach(function (v) {
      if (!v || typeof v !== "object") return;
      const g = porId[String(v.id == null ? "" : v.id).trim()];
      if (!g) return;
      const temRegra = v.min != null || v.max != null || v.obrigatorio != null;
      const regra = temRegra ? normalizarRegra(v) : g.padrao;
      out.push({
        id: g.id, nome: g.nome,
        obrigatorio: regra.obrigatorio, min: regra.min, max: regra.max,
        opcoes: g.opcoes,
      });
    });
    return out;
  }

  return {
    normalizarGrupos: normalizarGrupos,
    avaliarComposicao: avaliarComposicao,
    normalizarBiblioteca: normalizarBiblioteca,
    resolverGrupos: resolverGrupos,
  };
});
