// Montagem PURA do relatório de fechamento de caixa (térmica 80mm, 48 colunas).
// Dual-mode: window.Relatorio no browser; module.exports no node --test.
// Helpers de formatação espelham public/comanda.js (duplicados de propósito p/
// não acoplar os dois módulos de impressão; comanda.js segue intacto).
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Relatorio = api;
})(typeof self !== "undefined" ? self : this, function () {
  const LARGURA = 48;
  // Formato BR único (espelha public/dinheiro.js): milhar com ponto — "1.234,56".
  function fmtBR(n) {
    n = Number(n) || 0;
    var neg = n < 0 ? "-" : "";
    var cents = Math.round(Math.abs(n) * 100);
    var dec = String(cents % 100).padStart(2, "0");
    return neg + Math.floor(cents / 100).toLocaleString("pt-BR") + "," + dec;
  }
  function sep(ch) { return (ch || "-").repeat(LARGURA); }
  function centro(txt) {
    const t = String(txt || "");
    if (t.length >= LARGURA) return t.slice(0, LARGURA);
    return " ".repeat(Math.floor((LARGURA - t.length) / 2)) + t;
  }
  function linhaValor(rotulo, valor) {
    let r = String(rotulo || "");
    const v = String(valor || "");
    const maxR = Math.max(1, LARGURA - v.length - 1);
    if (r.length > maxR) r = r.slice(0, maxR);
    return r + " ".repeat(Math.max(1, LARGURA - r.length - v.length)) + v;
  }
  function dataHoraBR(iso) {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    } catch (_) { return ""; }
  }

  function montarRelatorioFechamento(d) {
    d = d || {};
    const recebido = d.recebidoPorForma || {};
    const cancelado = d.canceladoPorForma || {};
    const recebidoPrazo = d.recebidoPrazoPorForma || {};
    const canceladoPrazo = d.canceladoPrazoPorForma || {};
    const formas = d.formas || [];
    const formaDin = d.formaDinheiro || "Dinheiro";
    // VENDAS DO DIA líquidas por forma: recebido − recebido a prazo (fiado) − cancelados
    // (líquidos) NAQUELA forma. O fiado recebido é COBRANÇA de dívida, não venda de hoje,
    // então sai daqui e vai para a seção RECEBIMENTOS A PRAZO (mas conta no Total em Caixa).
    const liquido = (f) => (Number(recebido[f]) || 0) - (Number(recebidoPrazo[f]) || 0)
      - ((Number(cancelado[f]) || 0) - (Number(canceladoPrazo[f]) || 0));
    const liquidoPrazo = (f) => (Number(recebidoPrazo[f]) || 0) - (Number(canceladoPrazo[f]) || 0);
    const L = [];

    L.push(centro("*" + String(d.restaurante || "Caixa").toUpperCase() + "*"));
    L.push(centro("FECHAMENTO DE CAIXA"));
    L.push(centro(dataHoraBR(d.abertoEm) + "  ->  " + dataHoraBR(d.fechadoEm)));
    if (d.operador) L.push(centro("Operador: " + d.operador));
    L.push(sep("="));

    // VENDAS — dinheiro + cada forma eletrônica configurada + "Outros" (legado), LÍQUIDAS
    L.push("VENDAS");
    L.push(linhaValor(formaDin, "R$ " + fmtBR(liquido(formaDin))));
    const contadas = new Set([formaDin]);
    formas.forEach((f) => {
      L.push(linhaValor(f, "R$ " + fmtBR(liquido(f))));
      contadas.add(f);
    });
    let outros = 0;
    for (const k in recebido) if (!contadas.has(k)) outros += liquido(k);
    if (outros > 0) L.push(linhaValor("Outros", "R$ " + fmtBR(outros)));
    L.push(sep("-"));

    // Movimentos
    L.push(linhaValor("Saldo Inicial", "R$ " + fmtBR(d.fundoTroco)));
    L.push(linhaValor("Suprimento", "R$ " + fmtBR(d.suprimentos)));
    L.push(linhaValor("Retirada", "- R$ " + fmtBR(d.sangrias)));
    L.push(sep("-"));

    let totalVendas = 0;
    for (const k in recebido) totalVendas += liquido(k); // vendas do dia LÍQUIDAS (sem fiado, sem cancelados)
    let totalPrazo = 0;
    for (const k in recebidoPrazo) totalPrazo += liquidoPrazo(k); // fiado recebido no turno
    const totalCaixa = (Number(d.fundoTroco) || 0) + (Number(d.suprimentos) || 0)
      + totalVendas + totalPrazo - (Number(d.sangrias) || 0);
    L.push(linhaValor("Total de Vendas", "R$ " + fmtBR(totalVendas)));
    L.push(linhaValor("Total em Caixa", "R$ " + fmtBR(totalCaixa)));
    L.push(sep("="));

    // RECEBIMENTOS A PRAZO (fiado recebido no turno) — cobrança de dívida, não venda de
    // hoje: separado das VENDAS, mas conta no Total em Caixa (o dinheiro está na gaveta).
    if (totalPrazo > 0.005) {
      L.push("RECEBIMENTOS A PRAZO (FIADO)");
      if (liquidoPrazo(formaDin) > 0.005) L.push(linhaValor(formaDin, "R$ " + fmtBR(liquidoPrazo(formaDin))));
      const contadasP = new Set([formaDin]);
      formas.forEach((f) => { contadasP.add(f); if (liquidoPrazo(f) > 0.005) L.push(linhaValor(f, "R$ " + fmtBR(liquidoPrazo(f)))); });
      let outrosP = 0;
      for (const k in recebidoPrazo) if (!contadasP.has(k)) outrosP += liquidoPrazo(k);
      if (outrosP > 0.005) L.push(linhaValor("Outros", "R$ " + fmtBR(outrosP)));
      L.push(linhaValor("Total recebido a prazo", "R$ " + fmtBR(totalPrazo)));
      L.push(sep("="));
    }

    // VENDAS A PRAZO (fiado) — informativo: aconteceram no turno mas NÃO entram na
    // conferência (o dinheiro entra na baixa, não agora).
    if (Number(d.vendasPrazo) > 0) {
      L.push("VENDAS A PRAZO (FIADO)");
      L.push(linhaValor("Total (nao conta no fechamento)", "R$ " + fmtBR(d.vendasPrazo)));
      L.push(sep("="));
    }

    // CANCELAMENTOS (detalhe) — rastro anti-fraude: cada pedido pago cancelado.
    const cancs = Array.isArray(d.cancelamentos) ? d.cancelamentos : [];
    if (cancs.length) {
      L.push("CANCELAMENTOS");
      cancs.forEach((c) => {
        const rotulo = (c.descricao || "Cancelamento") + (c.forma ? " (" + c.forma + ")" : "");
        L.push(linhaValor(rotulo, "- R$ " + fmtBR(c.valor)));
      });
      L.push(sep("="));
    }

    // FECHAMENTO OPERADOR — dinheiro contado + eletrônico informado
    L.push("FECHAMENTO OPERADOR");
    const elet = d.eletronicoPorForma || {};
    L.push(linhaValor(formaDin, "R$ " + fmtBR(d.contadoDinheiro)));
    let totalElet = 0;
    formas.forEach((f) => {
      const v = Number(elet[f]) || 0; totalElet += v;
      L.push(linhaValor(f, "R$ " + fmtBR(v)));
    });
    L.push(sep("-"));
    const totalOperador = (Number(d.contadoDinheiro) || 0) + totalElet;
    const dif = totalOperador - totalCaixa;
    L.push(linhaValor("Total", "R$ " + fmtBR(totalOperador)));
    const estado = dif === 0 ? "CONFERIDO" : (dif > 0 ? "SOBROU" : "FALTOU");
    L.push(centro(estado));
    const sinal = dif > 0 ? "+ R$ " : (dif < 0 ? "- R$ " : "R$ ");
    L.push(linhaValor("Diferença", sinal + fmtBR(Math.abs(dif))));
    L.push(sep("="));

    return L.join("\n");
  }

  return { montarRelatorioFechamento, fmtBR };
});
