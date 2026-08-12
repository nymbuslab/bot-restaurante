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

  // TIPO do grupo — são duas coisas diferentes, não variações da mesma:
  //  - "composicao": o que vai DENTRO do prato. O cliente ESCOLHE entre as opções
  //    (rádio/caixa), sem preço e sem quantidade. Sai no pedido em `composicao`.
  //  - "complemento": o extra que ele ACRESCENTA. Tem preço e quantidade livre
  //    (stepper). Sai no pedido em `opcionais`, com `qtd`.
  // Grupo antigo sem `tipo` é inferido pelo preço, que era como a conversão separava.
  function tipoDoGrupo(g, opcoes) {
    const t = String((g && g.tipo) || "").trim().toLowerCase();
    if (t === "complemento" || t === "composicao") return t;
    return opcoes.some(function (o) { return o.preco > 0; }) ? "complemento" : "composicao";
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
      const tipo = tipoDoGrupo(g, opcoes);
      out.push({
        id: id,
        nome: String(g.nome == null ? "" : g.nome).trim(),
        tipo: tipo,
        padrao: normalizarRegra(g.padrao),
        // Composição não tem preço: é escolha do que vem no prato, não acréscimo.
        opcoes: tipo === "composicao"
          ? opcoes.map(function (o) { return { id: o.id, nome: o.nome, preco: 0 }; })
          : opcoes,
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
        id: g.id, nome: g.nome, tipo: g.tipo,
        obrigatorio: regra.obrigatorio, min: regra.min, max: regra.max,
        opcoes: g.opcoes,
      });
    });
    return out;
  }

  // Escolha do cliente: aceita o id solto (quantidade 1) ou { id, qtd }.
  function normalizarEscolha(e) {
    if (e && typeof e === "object") {
      return { id: String(e.id == null ? "" : e.id).trim(), qtd: Math.max(1, parseInt(e.qtd, 10) || 1) };
    }
    return { id: String(e == null ? "" : e).trim(), qtd: 1 };
  }

  // Avalia as escolhas do cliente contra os grupos JÁ RESOLVIDOS.
  // `escolhas` = [{ grupo: <grupoId>, opcoes: [<opcaoId> | { id, qtd }] }].
  // Quem manda na saída é o TIPO do grupo, não o preço da opção: composição vira
  // `composicao` (escolha, 1 por opção) e complemento vira `opcionais` (com `qtd`).
  // O formato de saída é o LEGADO de propósito — comanda, relatórios e itens_venda
  // seguem inalterados.
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
      // Sem `tipo` (grupo montado à mão ou dado antigo), infere pelo preço — nunca
      // deixa opção paga cair na composição, que sairia de graça.
      const ehComplemento = g.tipo
        ? g.tipo === "complemento"
        : g.opcoes.some(function (o) { return o.preco > 0; });
      const validas = [];
      const vistos = {};
      (porGrupo[g.id] || []).forEach(function (raw) {
        const e = normalizarEscolha(raw);
        if (!porOpcao[e.id] || vistos[e.id]) return; // id de outro grupo, inexistente ou repetido
        vistos[e.id] = true;
        // Composição é ESCOLHA (1 por opção); complemento é ACRÉSCIMO (quantidade livre).
        validas.push({ opcao: porOpcao[e.id], qtd: ehComplemento ? Math.min(99, e.qtd) : 1 });
      });
      // Composição conta escolhas; complemento conta unidades.
      const total = ehComplemento
        ? validas.reduce(function (s, v) { return s + v.qtd; }, 0)
        : validas.length;
      const min = g.obrigatorio ? Math.max(1, g.min) : g.min;
      const max = g.max > 0 ? g.max : 0; // 0 = sem limite
      if (total < min) {
        pendencias.push(g.nome + ": escolha " + (min === 1 ? "1 opção" : "ao menos " + min + " opções"));
        return;
      }
      if (max > 0 && total > max) {
        pendencias.push(g.nome + ": no máximo " + max + (ehComplemento ? (max === 1 ? " unidade" : " unidades") : ""));
        return;
      }
      if (ehComplemento) {
        validas.forEach(function (v) {
          opcionais.push({ nome: v.opcao.nome, preco: v.opcao.preco, qtd: v.qtd });
          addUnit += v.opcao.preco * v.qtd;
        });
      } else if (validas.length) {
        composicao.push({ grupo: g.nome, itens: validas.map(function (v) { return v.opcao.nome; }) });
      }
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
  // Aceita os dois formatos: o real (itens dentro de cardapio.categorias[])
  // e a lista plana cardapio.itens. Devolve `categorias` reconstruídas quando
  // a entrada era aninhada (null quando plana) e `itens` sempre plano.
  function converterCardapio(cardapio, novoId) {
    const raiz = cardapio && typeof cardapio === "object" ? cardapio : {};
    const categorias = Array.isArray(raiz.categorias) ? raiz.categorias : null;
    const grupos = [];
    const porChave = {};
    const nomesUsados = {};
    let criados = 0, reusados = 0, sufixados = 0;

    function obterGrupo(nome, tipo, padrao, opcoes) {
      const chave = chaveGrupo(nome, padrao, opcoes);
      if (porChave[chave]) { reusados++; return porChave[chave]; }
      let nomeFinal = String(nome == null ? "" : nome).trim() || "Grupo";
      const base = normalizarChave(nomeFinal);
      if (nomesUsados[base]) { nomesUsados[base]++; nomeFinal = nomeFinal + " " + nomesUsados[base]; sufixados++; }
      else nomesUsados[base] = 1;
      const g = {
        id: novoId("g_"),
        nome: nomeFinal,
        tipo: tipo,   // a origem já diz o tipo: composicao do prato x opcionais pagos
        padrao: normalizarRegra(padrao),
        opcoes: opcoes.map(function (o) { return { id: novoId("o_"), nome: o.nome, preco: Number(o.preco) || 0 }; }),
      };
      grupos.push(g);
      porChave[chave] = g;
      criados++;
      return g;
    }

    function converterItem(item) {
      if (!item || typeof item !== "object") return item;
      if (Array.isArray(item.grupos)) return item; // já convertido, não remexe
      const vinculos = [];
      normalizarGrupos(item.composicao).forEach(function (c) {
        const opcoes = c.itens.map(function (n) { return { nome: n, preco: 0 }; });
        const padrao = { obrigatorio: c.obrigatorio, min: c.min, max: c.max };
        const g = obterGrupo(c.nome, "composicao", padrao, opcoes);
        vinculos.push({ id: g.id, obrigatorio: g.padrao.obrigatorio, min: g.padrao.min, max: g.padrao.max });
      });
      const ops = lerOpcionaisLegado(item.opcionais);
      if (ops.length) {
        const g = obterGrupo("Complementos", "complemento", { obrigatorio: false, min: 0, max: 0 }, ops);
        vinculos.push({ id: g.id, obrigatorio: false, min: 0, max: 0 });
      }
      if (!vinculos.length) return item;
      const novo = {};
      Object.keys(item).forEach(function (k) { novo[k] = item[k]; }); // legado preservado
      novo.grupos = vinculos;
      return novo;
    }

    let catsSaida = null;
    const itensSaida = [];
    if (categorias) {
      catsSaida = categorias.map(function (cat) {
        if (!cat || typeof cat !== "object" || !Array.isArray(cat.itens)) return cat;
        const nova = {};
        Object.keys(cat).forEach(function (k) { nova[k] = cat[k]; });
        nova.itens = cat.itens.map(converterItem);
        nova.itens.forEach(function (i) { itensSaida.push(i); });
        return nova;
      });
    } else {
      (Array.isArray(raiz.itens) ? raiz.itens : []).forEach(function (i) {
        itensSaida.push(converterItem(i));
      });
    }

    return {
      grupos: grupos,
      categorias: catsSaida,
      itens: itensSaida,
      criados: criados,
      reusados: reusados,
      sufixados: sufixados,
    };
  }

  return {
    normalizarGrupos: normalizarGrupos,
    normalizarBiblioteca: normalizarBiblioteca,
    resolverGrupos: resolverGrupos,
    avaliarEscolhas: avaliarEscolhas,
    chaveGrupo: chaveGrupo,
    converterCardapio: converterCardapio,
  };
});
