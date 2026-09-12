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

  // Estado do caixa no fechamento (D-08): a MESMA fórmula de CONFERIDO/SOBROU/
  // FALTOU usada pelo cupom impresso, exportada para o Telegram não divergir do
  // papel em nenhum caso de borda. Devolve { estado, diferenca }, onde
  // `diferenca` é operador − conferência (positiva = sobrou, negativa = faltou).
  function estadoCaixa(totalOperador, totalConferencia) {
    const op = Number(totalOperador) || 0;
    const conf = Number(totalConferencia) || 0;
    const diferenca = Math.round((op - conf) * 100) / 100;
    const bateu = Math.abs(diferenca) < 0.005;
    return {
      estado: bateu ? "CONFERIDO" : (diferenca > 0 ? "SOBROU" : "FALTOU"),
      diferenca,
    };
  }

  function montarRelatorioFechamento(d) {
    d = d || {};
    const recebido = d.recebidoPorForma || {};
    const cancelado = d.canceladoPorForma || {};
    const formas = d.formas || [];
    const formaDin = d.formaDinheiro || "Dinheiro";
    // Vendas LÍQUIDAS por forma: o recebido menos o que foi cancelado NAQUELA forma.
    // Assim a linha de cada forma reflete o que de fato entrou (ex.: Pix cancelado
    // não infla o Pix). O rastro dos cancelamentos fica na seção CANCELAMENTOS.
    const liquido = (f) => (Number(recebido[f]) || 0) - (Number(cancelado[f]) || 0);
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
    for (const k in recebido) totalVendas += liquido(k); // vendas LÍQUIDAS (já sem cancelados)
    const dinheiroEmCaixa = (Number(d.fundoTroco) || 0) + (Number(d.suprimentos) || 0)
      + liquido(formaDin) - (Number(d.sangrias) || 0);
    const totalConferencia = (Number(d.fundoTroco) || 0) + (Number(d.suprimentos) || 0)
      + totalVendas - (Number(d.sangrias) || 0);
    L.push(linhaValor("Total de Vendas", "R$ " + fmtBR(totalVendas)));
    L.push(linhaValor("Dinheiro em Caixa", "R$ " + fmtBR(dinheiroEmCaixa)));
    L.push(linhaValor("Total Conferencia", "R$ " + fmtBR(totalConferencia)));
    L.push(sep("="));

    // CANCELAMENTOS/ESTORNOS (detalhe) — rastro anti-fraude: cada dedução do caixa.
    const cancs = Array.isArray(d.cancelamentos) ? d.cancelamentos : [];
    if (cancs.length) {
      L.push("CANCELAMENTOS/ESTORNOS");
      cancs.forEach((c) => {
        const rotulo = (c.descricao || "Cancelamento/estorno") + (c.forma ? " (" + c.forma + ")" : "");
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
    // Estado reutilizado do helper (D-08): o Telegram mostra o MESMO veredito
    // que o cupom físico. A tolerância de arredondamento segue aqui (float
    // 0,1+0,2 não pode virar "R$ -0,00").
    const st = estadoCaixa(totalOperador, totalConferencia);
    L.push(linhaValor("Total", "R$ " + fmtBR(totalOperador)));
    L.push(centro(st.estado));
    const bateu = Math.abs(st.diferenca) < 0.005;
    const sinal = bateu ? "R$ " : (st.diferenca > 0 ? "+ R$ " : "- R$ ");
    L.push(linhaValor("Diferença", sinal + fmtBR(bateu ? 0 : Math.abs(st.diferenca))));
    L.push(sep("="));

    return L.join("\n");
  }

  return { montarRelatorioFechamento, fmtBR, estadoCaixa };
});
