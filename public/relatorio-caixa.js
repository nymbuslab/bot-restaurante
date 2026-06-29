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
  function fmtBR(n) { return (Number(n) || 0).toFixed(2).replace(".", ","); }
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
    const formas = d.formas || [];
    const formaDin = d.formaDinheiro || "Dinheiro";
    const L = [];

    L.push(centro("*" + String(d.restaurante || "Caixa").toUpperCase() + "*"));
    L.push(centro("FECHAMENTO DE CAIXA"));
    L.push(centro(dataHoraBR(d.abertoEm) + "  ->  " + dataHoraBR(d.fechadoEm)));
    if (d.operador) L.push(centro("Operador: " + d.operador));
    L.push(sep("="));

    // VENDAS — dinheiro + cada forma eletrônica configurada + "Outros" (legado)
    L.push("VENDAS");
    L.push(linhaValor(formaDin, "R$ " + fmtBR(recebido[formaDin] || 0)));
    const contadas = new Set([formaDin]);
    formas.forEach((f) => {
      L.push(linhaValor(f, "R$ " + fmtBR(recebido[f] || 0)));
      contadas.add(f);
    });
    let outros = 0;
    for (const k in recebido) if (!contadas.has(k)) outros += Number(recebido[k]) || 0;
    if (outros > 0) L.push(linhaValor("Outros", "R$ " + fmtBR(outros)));
    L.push(sep("-"));

    // Movimentos
    const totalCancelado = Number(d.totalCancelado) || 0;
    L.push(linhaValor("Saldo Inicial", "R$ " + fmtBR(d.fundoTroco)));
    L.push(linhaValor("Suprimento", "R$ " + fmtBR(d.suprimentos)));
    L.push(linhaValor("Retirada", "- R$ " + fmtBR(d.sangrias)));
    if (totalCancelado > 0) L.push(linhaValor("Cancelamentos", "- R$ " + fmtBR(totalCancelado)));
    L.push(sep("-"));

    let totalVendas = 0;
    for (const k in recebido) totalVendas += Number(recebido[k]) || 0; // vendas BRUTAS
    const totalCaixa = (Number(d.fundoTroco) || 0) + (Number(d.suprimentos) || 0)
      + totalVendas - (Number(d.sangrias) || 0) - totalCancelado;
    L.push(linhaValor("Total de Vendas", "R$ " + fmtBR(totalVendas)));
    if (totalCancelado > 0) L.push(linhaValor("(-) Cancelado", "- R$ " + fmtBR(totalCancelado)));
    L.push(linhaValor("Total em Caixa", "R$ " + fmtBR(totalCaixa)));
    L.push(sep("="));

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
