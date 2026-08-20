// ============================================================
// Insumos e ficha técnica — lógica pura e testável (etapa 4/4 do split de Produtos).
//
// O SALDO do insumo mora na tabela `insumos` (não no jsonb, ao contrário do estoque
// de produto). Este módulo não fala com banco: ele só calcula QUANTO cada insumo
// deve variar, e quem aplica é o `src/insumos-db.js`, dentro da transação da venda.
//
// A FICHA mora no jsonb, junto de quem ela descreve: `item.ficha` (o que todo
// marmitex leva) e `grupo.opcoes[].ficha` (o que a opção "Frango Grelhado" leva).
// A quantidade é sempre NA UNIDADE DO INSUMO — 0.2 para 200 g de um insumo em kg —
// e a conversão de grama e mililitro acontece na entrada do formulário.
//
// Diferença essencial para `estoque.js`: aqui o saldo PODE ficar negativo. Falta de
// insumo avisa e não bloqueia (decisão do dono), e é o negativo que revela o furo:
// travar em zero esconderia o problema.
//
// Dual-mode: window.Insumos no browser, module.exports no Node.
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.Insumos = api;
})(this, function () {
  // `estoque_movimentos.item_id` é text sem FK e passa a ter DOIS namespaces: id de
  // produto (numérico) e id de insumo (prefixado). O prefixo vive só aqui — nunca
  // escreva "ins_" solto no código.
  const PREFIXO_INSUMO = "ins_";
  const UNIDADES = ["un", "kg", "l"];
  // Fator para a unidade base do insumo. g e ml só existem na DIGITAÇÃO.
  const FATOR = { g: 0.001, kg: 1, ml: 0.001, l: 1, un: 1 };

  function _num(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const n = parseFloat(String(v == null ? "" : v).replace(",", "."));
    return isFinite(n) ? n : 0;
  }
  // Três casas em tudo: é a precisão de grama e de mililitro, e é o que a coluna
  // numeric(14,3) guarda. Arredondar a cada passo evita deriva de float na soma.
  function _r3(n) { return Math.round(n * 1000) / 1000; }

  function chaveMovimento(insumoId) { return PREFIXO_INSUMO + String(insumoId); }
  function ehInsumo(itemId) { return /^ins_\d+$/.test(String(itemId == null ? "" : itemId)); }
  function idDaChave(chave) {
    return ehInsumo(chave) ? parseInt(String(chave).slice(PREFIXO_INSUMO.length), 10) : null;
  }

  // Insumo sem nome não existe. Saldo aceita negativo de propósito; mínimo não.
  function normalizarInsumo(bruto) {
    if (!bruto) return null;
    const nome = String(bruto.nome == null ? "" : bruto.nome).trim();
    if (!nome) return null;
    const temCusto = bruto.custo !== undefined && bruto.custo !== null && bruto.custo !== "";
    return {
      nome: nome,
      unidade: UNIDADES.indexOf(bruto.unidade) >= 0 ? bruto.unidade : "un",
      saldo: _r3(_num(bruto.saldo)),
      minimo: Math.max(0, _r3(_num(bruto.minimo))),
      custo: temCusto ? Math.max(0, Math.round(_num(bruto.custo) * 10000) / 10000) : null,
    };
  }

  // Whitelist da ficha. Linha sem insumo ou com quantidade não-positiva é descartada
  // (quantidade zero não é receita, é lixo de formulário). Insumo repetido SOMA, em
  // vez de virar duas linhas que o dono não consegue distinguir na tela.
  function normalizarFicha(bruto) {
    if (!Array.isArray(bruto)) return [];
    const soma = {};
    const ordem = [];
    bruto.forEach(function (l) {
      if (!l) return;
      const id = parseInt(l.insumoId, 10);
      if (!(id > 0)) return;
      const qtd = _r3(_num(l.qtd));
      if (!(qtd > 0)) return;
      if (soma[id] === undefined) { soma[id] = 0; ordem.push(id); }
      soma[id] = _r3(soma[id] + qtd);
    });
    return ordem.map(function (id) { return { insumoId: id, qtd: soma[id] }; });
  }

  // Converte o que foi DIGITADO para a unidade do insumo (200 g -> 0.2 kg).
  function converterEntrada(valor, de, para) {
    const fDe = FATOR[de] === undefined ? 1 : FATOR[de];
    const fPara = FATOR[para] === undefined ? 1 : FATOR[para];
    return _r3(_num(valor) * fDe / fPara);
  }

  function formatarQtd(q, unidade) {
    const n = Number(q) || 0;
    if (unidade === "kg" || unidade === "l") return String(_r3(n)).replace(".", ",");
    return String(Math.round(n));
  }

  // Quanto cada insumo varia numa venda. Recebe os itens JÁ RECALCULADOS (o mesmo
  // formato que é gravado em `pedidos.itens`), o que faz baixa e devolução lerem a
  // mesma coisa — a devolução acontece horas depois e só tem o pedido salvo.
  //
  // Devolve [{ insumoId, delta }] com delta NEGATIVO (consumo), agregado: o mesmo
  // insumo vindo do produto e de duas opções vira uma linha só, e uma query só.
  // Nunca lança: insumo que não existe mais é problema do banco, não do cálculo.
  function calcularConsumo(itens, cardapio) {
    if (!Array.isArray(itens) || !itens.length || !cardapio) return [];
    const mapaItens = {};
    ((cardapio.categorias) || []).forEach(function (c) {
      ((c && c.itens) || []).forEach(function (it) { if (it && it.id != null) mapaItens[it.id] = it; });
    });
    // Índice opcaoId -> ficha montado UMA vez, não a cada item do carrinho.
    const mapaOpcoes = {};
    ((cardapio.grupos) || []).forEach(function (g) {
      ((g && g.opcoes) || []).forEach(function (o) { if (o && o.id) mapaOpcoes[o.id] = o.ficha; });
    });

    const soma = {};
    const ordem = [];
    function consumir(ficha, mult) {
      normalizarFicha(ficha).forEach(function (l) {
        if (soma[l.insumoId] === undefined) { soma[l.insumoId] = 0; ordem.push(l.insumoId); }
        soma[l.insumoId] = _r3(soma[l.insumoId] + l.qtd * mult);
      });
    }

    itens.forEach(function (p) {
      if (!p) return;
      const base = mapaItens[p.id];
      if (!base) return;                       // item que saiu do cardápio: nada a consumir
      const qtd = _num(p.qtd);
      if (!(qtd > 0)) return;
      // Item por kg: `qtd` é o peso, então a ficha é POR QUILO VENDIDO.
      // Item com variações: a quantidade real está nas variações escolhidas, não em
      // `qtd` (que costuma ser 1). Somar 1x aqui baixaria um terço do consumo real.
      let unidades = 0;
      ((p.variacoes) || []).forEach(function (v) { unidades += Math.max(0, _num(v && v.qtd)); });
      const mult = qtd * (unidades > 0 ? unidades : 1);

      consumir(base.ficha, mult);
      ((p.composicao) || []).forEach(function (c) {
        ((c && c.ids) || []).forEach(function (opId) { consumir(mapaOpcoes[opId], mult); });
      });
      ((p.opcionais) || []).forEach(function (o) {
        if (!o || !o.id) return;
        consumir(mapaOpcoes[o.id], mult * Math.max(1, _num(o.qtd) || 1));
      });
    });

    return ordem
      .map(function (id) { return { insumoId: id, delta: _r3(-soma[id]) }; })
      .filter(function (l) { return l.delta !== 0; });
  }

  return {
    PREFIXO_INSUMO: PREFIXO_INSUMO, UNIDADES: UNIDADES,
    chaveMovimento: chaveMovimento, ehInsumo: ehInsumo, idDaChave: idDaChave,
    normalizarInsumo: normalizarInsumo, normalizarFicha: normalizarFicha,
    converterEntrada: converterEntrada, formatarQtd: formatarQtd,
    calcularConsumo: calcularConsumo,
  };
});
