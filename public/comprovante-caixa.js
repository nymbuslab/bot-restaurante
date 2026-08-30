// Montagem PURA de comprovantes avulsos do caixa (termica 80mm, 48 colunas).
// Dual-mode: window.ComprovanteCaixa no browser; module.exports no node --test.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ComprovanteCaixa = api;
})(typeof self !== "undefined" ? self : this, function () {
  const LARGURA = 48;

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
  function quebrar(txt, larg) {
    const w = larg || LARGURA;
    const linhas = [];
    let atual = "";
    String(txt || "").split(/\s+/).filter(Boolean).forEach((p) => {
      while (p.length > w) {
        if (atual) { linhas.push(atual); atual = ""; }
        linhas.push(p.slice(0, w));
        p = p.slice(w);
      }
      if (!atual) atual = p;
      else if ((atual + " " + p).length <= w) atual += " " + p;
      else { linhas.push(atual); atual = p; }
    });
    if (atual) linhas.push(atual);
    return linhas;
  }
  function dataHoraBR(iso) {
    try {
      const d = iso ? new Date(iso) : new Date();
      const tz = "America/Sao_Paulo";
      const data = d.toLocaleDateString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" });
      const hora = d.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
      return data + " - " + hora;
    } catch (_) { return ""; }
  }
  function tipoTitulo(tipo) {
    if (tipo === "sangria") return "SANGRIA";
    if (tipo === "suprimento") return "SUPRIMENTO";
    if (tipo === "cancelamento") return "CANCELAMENTO";
    return String(tipo || "MOVIMENTO").toUpperCase();
  }
  function sinalDe(tipo) {
    return tipo === "sangria" || tipo === "cancelamento" ? "- " : "";
  }

  function montarComprovanteCaixa(d) {
    d = d || {};
    const tipo = String(d.tipo || "");
    const linhas = [];
    linhas.push(centro(String(d.restaurante || "Caixa").toUpperCase()));
    linhas.push(centro("COMPROVANTE DE CAIXA"));
    linhas.push(centro(tipoTitulo(tipo)));
    linhas.push(sep("="));
    if (d.caixaId != null) linhas.push(linhaValor("Caixa #" + d.caixaId, dataHoraBR(d.criadoEm)));
    else linhas.push(dataHoraBR(d.criadoEm));
    if (d.operador) linhas.push("Operador: " + d.operador);
    if (d.pedidoNumero != null) linhas.push("Pedido #" + d.pedidoNumero);
    else if (d.pedidoId != null) linhas.push("Pedido ID: " + d.pedidoId);
    if (d.mesa) linhas.push("Mesa: " + d.mesa);
    if (d.forma) linhas.push("Forma: " + d.forma);
    if (Array.isArray(d.formas) && d.formas.length > 1) {
      linhas.push("Formas:");
      d.formas.forEach((f) => linhas.push(linhaValor("  " + (f.forma || "Outros"), "- R$ " + fmtBR(f.valor))));
    }
    linhas.push(sep("-"));
    linhas.push(linhaValor("Valor", sinalDe(tipo) + "R$ " + fmtBR(d.valor)));
    if (d.descricao) quebrar("Motivo: " + d.descricao, LARGURA).forEach((l) => linhas.push(l));
    linhas.push(sep("="));
    linhas.push(centro("CONFERENCIA DO CAIXA"));
    return linhas.join("\n");
  }

  return { montarComprovanteCaixa, fmtBR };
});
