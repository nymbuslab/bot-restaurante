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

  // Avalia as escolhas do cliente contra os grupos JÁ RESOLVIDOS.
  // `escolhas` = [{ grupo: <grupoId>, opcoes: [<opcaoId>] }].
  // A saída sai no formato LEGADO do pedido de propósito: opção sem custo vira
  // composicao, opção paga vira opcional. Assim comanda, relatórios e
  // itens_venda seguem inalterados.
  function avaliarEscolhas(resolvidos, escolhas) {
    const grupos = Array.isArray(resolvidos) ? resolvidos : [];
    const porGrupo = {};
    (Array.isArray(escolhas) ? escolhas : []).forEach(function (e) {
      if (e && e.grupo != null) porGrupo[String(e.grupo)] = Array.isArray(e.opcoes) ? e.opcoes : [];
    });
    const composicao = [];
    const opcionais = [];
    const pendencias = [];
    let addUnit = 0;
    grupos.forEach(function (g) {
      const porOpcao = {};
      g.opcoes.forEach(function (o) { porOpcao[o.id] = o; });
      const escolhidas = porGrupo[g.id] || [];
      const validas = [];
      const vistos = {};
      escolhidas.forEach(function (oid) {
        const k = String(oid == null ? "" : oid).trim();
        if (!porOpcao[k] || vistos[k]) return; // id de outro grupo, inexistente ou repetido
        vistos[k] = true;
        validas.push(porOpcao[k]);
      });
      const min = g.obrigatorio ? Math.max(1, g.min) : g.min;
      const max = g.max > 0 ? g.max : g.opcoes.length;
      if (validas.length < min) {
        pendencias.push(g.nome + ": escolha " + (min === 1 ? "1 opção" : "ao menos " + min + " opções"));
        return;
      }
      if (validas.length > max) {
        pendencias.push(g.nome + ": escolha no máximo " + max);
        return;
      }
      const semCusto = [];
      validas.forEach(function (o) {
        if (o.preco > 0) { opcionais.push({ nome: o.nome, preco: o.preco, qtd: 1 }); addUnit += o.preco; }
        else semCusto.push(o.nome);
      });
      if (semCusto.length) composicao.push({ grupo: g.nome, itens: semCusto });
    });
    return {
      valido: pendencias.length === 0,
      pendencias: pendencias,
      addUnit: addUnit,
      composicao: composicao,
      opcionais: opcionais,
    };
  }

  // ---- Conversão do formato legado para a biblioteca ----
  function normalizarChave(s) {
    return String(s == null ? "" : s).trim().toLowerCase();
  }

  // Identidade de um grupo: nome + regra + opções (nome|preço) na ordem.
  // Dois itens com a MESMA lista viram um grupo só; qualquer divergência
  // (preço, ordem, regra) gera grupo separado, pra conversão não misturar nada.
  function chaveGrupo(nome, padrao, opcoes) {
    const r = normalizarRegra(padrao);
    return [
      normalizarChave(nome),
      r.obrigatorio ? "1" : "0", r.min, r.max,
      opcoes.map(function (o) { return normalizarChave(o.nome) + "|" + (Number(o.preco) || 0).toFixed(2); }).join(","),
    ].join("::");
  }

  // Lê o texto legado de opcionais ("Nome | 3.00\n..."), espelhando o
  // parseOpcionais de src/cardapio-web.js.
  function lerOpcionaisLegado(texto) {
    if (!texto || !String(texto).trim()) return [];
    const lista = [];
    String(texto).split("\n").forEach(function (linha) {
      const l = linha.trim().replace(/^[*\-•]\s*/, "");
      if (!l) return;
      const partes = l.split("|");
      const nome = partes[0].trim();
      let preco = 0;
      if (partes.length >= 2) preco = parseFloat(partes[1].replace(",", ".").replace(/[^\d.]/g, "")) || 0;
      if (nome) lista.push({ nome: nome, preco: preco });
    });
    return lista;
  }

  // Converte o cardápio inteiro de um tenant. `novoId(prefixo)` gera os ids
  // (injetado pra ficar determinístico no teste). NÃO apaga composicao nem
  // opcionais: a conversão é reversível.
  function converterCardapio(cardapio, novoId) {
    const itens = cardapio && Array.isArray(cardapio.itens) ? cardapio.itens : [];
    const grupos = [];
    const porChave = {};
    const nomesUsados = {};
    let criados = 0, reusados = 0, sufixados = 0;

    function obterGrupo(nome, padrao, opcoes) {
      const chave = chaveGrupo(nome, padrao, opcoes);
      if (porChave[chave]) { reusados++; return porChave[chave]; }
      let nomeFinal = String(nome == null ? "" : nome).trim() || "Grupo";
      const base = normalizarChave(nomeFinal);
      if (nomesUsados[base]) { nomesUsados[base]++; nomeFinal = nomeFinal + " " + nomesUsados[base]; sufixados++; }
      else nomesUsados[base] = 1;
      const g = {
        id: novoId("g_"),
        nome: nomeFinal,
        padrao: normalizarRegra(padrao),
        opcoes: opcoes.map(function (o) { return { id: novoId("o_"), nome: o.nome, preco: Number(o.preco) || 0 }; }),
      };
      grupos.push(g);
      porChave[chave] = g;
      criados++;
      return g;
    }

    const saida = itens.map(function (item) {
      if (!item || typeof item !== "object") return item;
      if (Array.isArray(item.grupos)) return item; // já convertido, não remexe
      const vinculos = [];
      normalizarGrupos(item.composicao).forEach(function (c) {
        const opcoes = c.itens.map(function (n) { return { nome: n, preco: 0 }; });
        const padrao = { obrigatorio: c.obrigatorio, min: c.min, max: c.max };
        const g = obterGrupo(c.nome, padrao, opcoes);
        vinculos.push({ id: g.id, obrigatorio: g.padrao.obrigatorio, min: g.padrao.min, max: g.padrao.max });
      });
      const ops = lerOpcionaisLegado(item.opcionais);
      if (ops.length) {
        const g = obterGrupo("Complementos", { obrigatorio: false, min: 0, max: 0 }, ops);
        vinculos.push({ id: g.id, obrigatorio: false, min: 0, max: 0 });
      }
      if (!vinculos.length) return item;
      const novo = {};
      Object.keys(item).forEach(function (k) { novo[k] = item[k]; }); // legado preservado
      novo.grupos = vinculos;
      return novo;
    });

    return { grupos: grupos, itens: saida, criados: criados, reusados: reusados, sufixados: sufixados };
  }

  return {
    normalizarGrupos: normalizarGrupos,
    avaliarComposicao: avaliarComposicao,
    normalizarBiblioteca: normalizarBiblioteca,
    resolverGrupos: resolverGrupos,
    avaliarEscolhas: avaliarEscolhas,
    chaveGrupo: chaveGrupo,
    converterCardapio: converterCardapio,
  };
});
