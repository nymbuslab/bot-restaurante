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
  // A quantidade da variação é POR LINHA do pedido, então multiplica pela
  // quantidade da linha — é o que o preço faz: `(base + variações) * qtd`. Somar
  // só o `qtd` da variação cobrava 3 e baixava 1, e a validação (que usa esta
  // mesma agregação) aceitava vender 3 tendo 2 em estoque.
  //
  // `mapa` entra para o multiplicador seguir a mesma regra do `_agregar`: peso
  // decimal em item por kg, inteiro >= 1 nos demais. Variação em item por kg não
  // é combinação suportada pela tela; o multiplicador vale mesmo assim, para o
  // estoque nunca ficar abaixo do que foi cobrado.
  function _agregarVariacoes(itensPayload, mapa) {
    const pedV = {};
    (itensPayload || []).forEach(function (p) {
      if (!p || p.id == null || !Array.isArray(p.variacoes)) return;
      const base = mapa && mapa[p.id];
      const linha = base && base.unidade === "kg"
        ? Math.max(0, parseFloat(String(p.qtd).replace(",", ".")) || 0)
        : Math.max(1, parseInt(p.qtd, 10) || 1);
      p.variacoes.forEach(function (v) {
        if (!v || v.id == null) return;
        const k = _chaveVar(p.id, v.id);
        pedV[k] = (pedV[k] || 0) + Math.max(1, parseInt(v.qtd, 10) || 1) * linha;
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
    const pedV = _agregarVariacoes(itensPayload, mapa);
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
  // ---- Salvar cardápio sem desfazer venda ----------------------------------
  // O editor manda o cardápio INTEIRO, incluindo produtos que o dono nem abriu:
  // é a cópia que o navegador carregou quando o painel foi aberto. Uma venda que
  // caia nesse meio-tempo era desfeita ao salvar, e o `diffEstoque` ainda
  // registrava como "ajuste / Editor do produto" — número errado com explicação
  // enganosa.
  //
  // Ignorar o estoque do payload não serve: o editor edita saldo de verdade, do
  // produto e de cada variação. A régua é a INTENÇÃO. Vale o que veio só para o
  // item que o dono editou (marcado com `_estoqueEditado` no envio); todo o resto
  // recebe de volta o saldo do banco, que é a versão que as vendas atualizaram.
  //
  // Produto novo (sem par no banco) entra com o que veio. O marcador é transitório
  // e nunca é persistido.
  const MARCA_ESTOQUE = "_estoqueEditado";

  function _saldoDoBanco(alvo, base) {
    const out = Object.assign({}, alvo);
    delete out[MARCA_ESTOQUE];
    delete out.estoque;
    delete out.estoqueMinimo;
    if (base && base.estoque !== undefined) out.estoque = base.estoque;
    if (base && base.estoqueMinimo !== undefined) out.estoqueMinimo = base.estoqueMinimo;
    return out;
  }

  function preservarSaldos(cardapioBanco, cardapioNovo) {
    if (!cardapioNovo) return cardapioNovo;
    const doBanco = {};
    ((cardapioBanco && cardapioBanco.categorias) || []).forEach(function (c) {
      ((c && c.itens) || []).forEach(function (it) { if (it && it.id != null) doBanco[it.id] = it; });
    });
    const categorias = ((cardapioNovo.categorias) || []).map(function (c) {
      if (!c) return c;
      return Object.assign({}, c, {
        itens: ((c.itens) || []).map(function (it) {
          if (!it) return it;
          const base = doBanco[it.id];
          // Sem par no banco = produto novo: nada a preservar.
          if (!base) { const novo = Object.assign({}, it); delete novo[MARCA_ESTOQUE]; return novo; }
          const editado = !!it[MARCA_ESTOQUE];
          const item = editado ? (function () { const o = Object.assign({}, it); delete o[MARCA_ESTOQUE]; return o; })()
                               : _saldoDoBanco(it, base);
          if (Array.isArray(it.variacoes) && it.variacoes.length) {
            const varsBanco = {};
            ((base.variacoes) || []).forEach(function (v) { if (v && v.id != null) varsBanco[v.id] = v; });
            // A variação segue a marca do ITEM: o editor abre o produto inteiro,
            // com os campos de saldo de todas as opções na mesma tela.
            item.variacoes = it.variacoes.map(function (v) {
              if (!v) return v;
              const vb = varsBanco[v.id];
              return (editado || !vb) ? v : _saldoDoBanco(v, vb);
            });
          }
          return item;
        }),
      });
    });
    return Object.assign({}, cardapioNovo, { categorias: categorias });
  }

  // Arredonda respeitando a unidade (kg tem 3 casas; un é inteiro).
  function _round(n, ehKg) {
    return ehKg ? Math.round(n * 1000) / 1000 : Math.round(n);
  }
  // Motor comum da baixa (sinal -1) e da devolução (sinal +1). Devolve uma CÓPIA
  // do cardápio e a lista de movimentos com o saldo resultante de cada um.
  // Saldo nunca fica negativo: o movimento registra o delta EFETIVAMENTE aplicado.
  function _movimentar(cardapio, itensPayload, sinal) {
    const mapa = _mapaItens(cardapio);
    const ped = _agregar(itensPayload, mapa);
    const pedV = _agregarVariacoes(itensPayload, mapa);
    const movimentos = [];
    function aplicar(alvo, pedido, ehKg, itemId, variacaoId, descricao) {
      const atual = Math.max(0, ehKg
        ? (parseFloat(String(alvo.estoque).replace(",", ".")) || 0)
        : (parseInt(alvo.estoque, 10) || 0));
      const novo = _round(Math.max(0, atual + sinal * pedido), ehKg);
      if (novo === atual) return null;
      movimentos.push({
        itemId: itemId, variacaoId: variacaoId,
        quantidade: _round(novo - atual, ehKg), saldoDepois: novo,
        descricao: descricao, unidade: ehKg ? "kg" : "un",
      });
      return novo;
    }
    const categorias = ((cardapio && cardapio.categorias) || []).map(function (c) {
      return Object.assign({}, c, {
        itens: ((c && c.itens) || []).map(function (it) {
          if (!it) return it;
          let novoIt = it;
          if (temControle(it) && ped[it.id]) {
            const ehKg = it.unidade === "kg";
            const novo = aplicar(it, ped[it.id], ehKg, it.id, null, it.nome || "");
            if (novo !== null) novoIt = Object.assign({}, it, { estoque: novo });
          }
          if (Array.isArray(it.variacoes) && it.variacoes.length) {
            let mudou = false;
            const novasVar = it.variacoes.map(function (v) {
              if (!v || v.id == null || !temControle(v)) return v;
              const q = pedV[_chaveVar(it.id, v.id)];
              if (!q) return v;
              const novo = aplicar(v, q, false, it.id, String(v.id), (it.nome || "") + " (" + (v.nome || "") + ")");
              if (novo === null) return v;
              mudou = true;
              return Object.assign({}, v, { estoque: novo });
            });
            if (mudou) novoIt = Object.assign({}, novoIt, { variacoes: novasVar });
          }
          return novoIt;
        }),
      });
    });
    return { cardapio: Object.assign({}, cardapio, { categorias: categorias }), movimentos: movimentos };
  }
  function calcularBaixa(cardapio, itensPayload) { return _movimentar(cardapio, itensPayload, -1); }
  function calcularDevolucao(cardapio, itensPayload) { return _movimentar(cardapio, itensPayload, 1); }
  // Casca compatível: quem só quer o cardápio novo (código antigo) continua chamando.
  function aplicarBaixa(cardapio, itensPayload) { return calcularBaixa(cardapio, itensPayload).cardapio; }
  // Mapa dos saldos do cardápio (item e variação), por chave estável: "itemId" ou
  // "itemId::variacaoId". Por padrão só entra quem está CONTROLADO; com
  // `incluirIlimitados` entram também os sem controle (com `controlado: false` e
  // `quantidade: null`), que é o que `acharSaldo` precisa para a primeira contagem.
  function _mapaSaldos(cardapio, incluirIlimitados) {
    const mapa = {};
    ((cardapio && cardapio.categorias) || []).forEach(function (c) {
      ((c && c.itens) || []).forEach(function (it) {
        if (!it || it.id == null) return;
        if (temControle(it) || incluirIlimitados) {
          const st = statusEstoque(it);
          mapa[String(it.id)] = {
            itemId: it.id, variacaoId: null, controlado: st.controlado,
            quantidade: st.quantidade, minimo: st.minimo,
            descricao: it.nome || "", unidade: it.unidade === "kg" ? "kg" : "un",
          };
        }
        (Array.isArray(it.variacoes) ? it.variacoes : []).forEach(function (v) {
          if (!v || v.id == null) return;
          if (!temControle(v) && !incluirIlimitados) return;
          const stv = statusEstoque(v);
          mapa[_chaveVar(it.id, v.id)] = {
            itemId: it.id, variacaoId: String(v.id), controlado: stv.controlado,
            quantidade: stv.quantidade, minimo: stv.minimo,
            descricao: (it.nome || "") + " (" + (v.nome || "") + ")", unidade: "un",
          };
        });
      });
    });
    return mapa;
  }
  // Localiza um saldo (item ou variação) e devolve { itemId, variacaoId, controlado,
  // quantidade, minimo, descricao, unidade }. null se o id não existe no cardápio.
  // Enxerga também o item ilimitado (é dele que sai a primeira contagem).
  function acharSaldo(cardapio, itemId, variacaoId) {
    const chave = variacaoId == null ? String(itemId) : _chaveVar(itemId, variacaoId);
    return _mapaSaldos(cardapio, true)[chave] || null;
  }
  // Liga o controle num item/variação ainda ilimitado, colocando estoque 0, para a
  // primeira contagem ter de onde partir. Cópia, não muta. Já controlado volta igual.
  function garantirControle(cardapio, itemId, variacaoId) {
    const alvo = String(itemId);
    const categorias = ((cardapio && cardapio.categorias) || []).map(function (c) {
      return Object.assign({}, c, {
        itens: ((c && c.itens) || []).map(function (it) {
          if (!it || String(it.id) !== alvo) return it;
          if (variacaoId == null) {
            return temControle(it) ? it : Object.assign({}, it, { estoque: 0 });
          }
          if (!Array.isArray(it.variacoes)) return it;
          return Object.assign({}, it, {
            variacoes: it.variacoes.map(function (v) {
              if (!v || String(v.id) !== String(variacaoId)) return v;
              return temControle(v) ? v : Object.assign({}, v, { estoque: 0 });
            }),
          });
        }),
      });
    });
    return Object.assign({}, cardapio, { categorias: categorias });
  }
  // Ajuste MANUAL de um único alvo (o item OU a variação, NUNCA os dois): entrada,
  // perda ou contagem lançados na tela de Controle de estoque. Ruling D: um ajuste
  // não é "isso foi vendido" (formato de payload de pedido, agregado por id), é
  // "este saldo mudou" — por isso NÃO reusa calcularBaixa/calcularDevolucao. O
  // motor de venda (`_agregar`) força quantidade mínima 1 pra item "un" (pensado
  // pro carrinho, onde não se pede zero); usar aquele motor aqui com um payload
  // sintético `{ qtd: 0 }` no item pra "não mexer nele" acabava aplicando um
  // movimento fantasma de ±1 no saldo PRÓPRIO do item sempre que ele também
  // tinha estoque controlado além da variação.
  // `ligaControle` (true) liga o controle no alvo (via garantirControle) ANTES
  // de aplicar o delta — caminho da primeira contagem (Correção 2). Cópia, não
  // muta o cardápio recebido; `movimento: null` quando nada mudou de saldo
  // (já no clamp, ou delta zero com controle já ligado).
  function aplicarAjuste(cardapio, opts) {
    const o = opts || {};
    const itemId = o.itemId;
    const variacaoId = o.variacaoId == null ? null : o.variacaoId;
    const delta = Number(o.delta) || 0;
    const base = o.ligaControle ? garantirControle(cardapio, itemId, variacaoId) : (cardapio || { categorias: [] });
    const alvoId = String(itemId);
    let movimento = null;
    function aplicarNoAlvo(alvo, ehKg, idMov, varMov, descricao) {
      const atual = Math.max(0, ehKg
        ? (parseFloat(String(alvo.estoque).replace(",", ".")) || 0)
        : (parseInt(alvo.estoque, 10) || 0));
      const novo = _round(Math.max(0, atual + delta), ehKg);
      if (novo === atual) return null;
      movimento = {
        itemId: idMov, variacaoId: varMov,
        quantidade: _round(novo - atual, ehKg), saldoDepois: novo,
        descricao: descricao, unidade: ehKg ? "kg" : "un",
      };
      return novo;
    }
    const categorias = ((base && base.categorias) || []).map(function (c) {
      return Object.assign({}, c, {
        itens: ((c && c.itens) || []).map(function (it) {
          if (!it || String(it.id) !== alvoId) return it;
          if (variacaoId == null) {
            if (!temControle(it)) return it; // alvo é o item, mas ele não está controlado
            const ehKg = it.unidade === "kg";
            const novo = aplicarNoAlvo(it, ehKg, it.id, null, it.nome || "");
            return novo === null ? it : Object.assign({}, it, { estoque: novo });
          }
          if (!Array.isArray(it.variacoes)) return it;
          let mudou = false;
          const novasVar = it.variacoes.map(function (v) {
            if (!v || String(v.id) !== String(variacaoId) || !temControle(v)) return v;
            const novo = aplicarNoAlvo(v, false, it.id, String(v.id), (it.nome || "") + " (" + (v.nome || "") + ")");
            if (novo === null) return v;
            mudou = true;
            return Object.assign({}, v, { estoque: novo });
          });
          return mudou ? Object.assign({}, it, { variacoes: novasVar }) : it;
        }),
      });
    });
    return { cardapio: Object.assign({}, base, { categorias: categorias }), movimento: movimento };
  }
  // Compara dois cardápios e devolve os movimentos de AJUSTE (o dono mexeu no
  // número pelo editor do item). Desligar o controle NÃO é movimento de saldo:
  // o item passa a ser ilimitado, não a ter uma quantidade diferente.
  function diffEstoque(cardapioAntes, cardapioDepois) {
    const a = _mapaSaldos(cardapioAntes);
    const d = _mapaSaldos(cardapioDepois);
    const movimentos = [];
    Object.keys(d).forEach(function (k) {
      const dep = d[k];
      const ant = a[k];
      const antes = ant ? ant.quantidade : null;
      if (antes === dep.quantidade) return;
      const ehKg = dep.unidade === "kg";
      movimentos.push({
        itemId: dep.itemId, variacaoId: dep.variacaoId,
        quantidade: antes === null ? dep.quantidade : _round(dep.quantidade - antes, ehKg),
        saldoDepois: dep.quantidade, descricao: dep.descricao, unidade: dep.unidade,
      });
    });
    return movimentos;
  }
  // Define o estoque mínimo de um item/variação. Devolve uma CÓPIA do cardápio,
  // ou null se o id não existir. Não mexe no saldo (não é movimento).
  function definirMinimo(cardapio, itemId, variacaoId, minimo) {
    const alvo = String(itemId);
    const min = Math.max(0, Number(minimo) || 0);
    let achou = false;
    const categorias = ((cardapio && cardapio.categorias) || []).map(function (c) {
      return Object.assign({}, c, {
        itens: ((c && c.itens) || []).map(function (it) {
          if (!it || String(it.id) !== alvo) return it;
          if (variacaoId == null) {
            achou = true;
            return Object.assign({}, it, { estoqueMinimo: min });
          }
          if (!Array.isArray(it.variacoes)) return it;
          return Object.assign({}, it, {
            variacoes: it.variacoes.map(function (v) {
              if (!v || String(v.id) !== String(variacaoId)) return v;
              achou = true;
              return Object.assign({}, v, { estoqueMinimo: min });
            }),
          });
        }),
      });
    });
    return achou ? Object.assign({}, cardapio, { categorias: categorias }) : null;
  }
  // Uma linha por SALDO: o item e, quando houver, cada variação (que tem estoque
  // próprio). Item sem controle entra com `controlado: false` para a tela poder
  // oferecer "Controlar" sem obrigar a abrir o editor do produto. Item arquivado
  // não entra (não é mais vendido, saldo dele não interessa ao painel).
  function linhasDeEstoque(cardapio) {
    const linhas = [];
    ((cardapio && cardapio.categorias) || []).forEach(function (c) {
      ((c && c.itens) || []).forEach(function (it) {
        if (!it || it.id == null || it.arquivado) return;
        const temVar = Array.isArray(it.variacoes) && it.variacoes.length > 0;
        const st = statusEstoque(it);
        linhas.push({
          itemId: String(it.id), variacaoId: null, nome: it.nome || "", categoria: (c && c.nome) || "",
          controlado: st.controlado, quantidade: st.quantidade, minimo: st.minimo,
          unidade: st.unidade, esgotado: st.esgotado, baixo: st.baixo, temVariacoes: !!temVar,
        });
        if (!temVar) return;
        it.variacoes.forEach(function (v) {
          if (!v || v.id == null) return;
          const stv = statusEstoque(v);
          linhas.push({
            itemId: String(it.id), variacaoId: String(v.id),
            nome: v.nome || "", categoria: (c && c.nome) || "", pai: it.nome || "",
            controlado: stv.controlado, quantidade: stv.quantidade, minimo: stv.minimo,
            unidade: stv.unidade, esgotado: stv.esgotado, baixo: stv.baixo,
          });
        });
      });
    });
    return linhas;
  }
  return {
    temControle: temControle, statusEstoque: statusEstoque, formatarQtd: formatarQtd, validarEstoque: validarEstoque,
    aplicarBaixa: aplicarBaixa, calcularBaixa: calcularBaixa, calcularDevolucao: calcularDevolucao, diffEstoque: diffEstoque,
    acharSaldo: acharSaldo, garantirControle: garantirControle, aplicarAjuste: aplicarAjuste, linhasDeEstoque: linhasDeEstoque,
    definirMinimo: definirMinimo, preservarSaldos: preservarSaldos, MARCA_ESTOQUE: MARCA_ESTOQUE,
  };
});
