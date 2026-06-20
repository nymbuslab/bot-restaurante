// Montagem PURA das vias de impressão (comanda da cozinha + cupom do pedido).
// Dual-mode: window.Comanda no browser; module.exports no node --test.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Comanda = api;
})(typeof self !== "undefined" ? self : this, function () {
  const LARGURA = 48;

  function fmtBR(n) {
    return (Number(n) || 0).toFixed(2).replace(".", ",");
  }
  function sep(ch) { return (ch || "-").repeat(LARGURA); }
  function centro(txt) {
    const t = String(txt || "");
    if (t.length >= LARGURA) return t.slice(0, LARGURA);
    const esq = Math.floor((LARGURA - t.length) / 2);
    return " ".repeat(esq) + t;
  }
  // "Rótulo" à esquerda + "valor" à direita, preenchendo a largura.
  function linhaValor(rotulo, valor) {
    const r = String(rotulo || "");
    const v = String(valor || "");
    const espaco = Math.max(1, LARGURA - r.length - v.length);
    return r + " ".repeat(espaco) + v;
  }
  function dataHoraBR(iso) {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    } catch (_) { return ""; }
  }
  function opcionaisLinhas(op) {
    return (op || []).map((o) => {
      const q = (o.qtd && o.qtd > 1) ? o.qtd + "x " : "";
      return "   + " + q + (o.nome || "");
    });
  }

  function montarCozinha(pedido, config) {
    const nome = (config && config.restaurante && config.restaurante.nome) || "Pedido";
    const linhas = [];
    linhas.push(centro("*" + nome.toUpperCase() + "*"));
    linhas.push(centro("COMANDA - COZINHA"));
    linhas.push(sep("="));
    linhas.push(linhaValor("Pedido #" + pedido.numero, dataHoraBR(pedido.criadoEm)));
    linhas.push("Tipo: " + (pedido.tipoEntrega || "").toUpperCase());
    linhas.push(sep("-"));
    (pedido.itens || []).forEach((i) => {
      linhas.push((i.qtd || 1) + "x " + (i.nome || ""));
      opcionaisLinhas(i.opcionais).forEach((l) => linhas.push(l));
      if (i.observacao && i.observacao.trim()) linhas.push("   Obs: " + i.observacao.trim());
      linhas.push("");
    });
    if (linhas[linhas.length - 1] === "") linhas.pop();
    linhas.push(sep("-"));
    if (pedido.observacao && pedido.observacao.trim()) {
      linhas.push("Obs. geral: " + pedido.observacao.trim());
    }
    linhas.push(sep("="));
    return linhas.join("\n");
  }

  function montarCupom(pedido, config) {
    const nome = (config && config.restaurante && config.restaurante.nome) || "Pedido";
    const extrasDe = (i) => (i.opcionais || []).reduce((s, o) => s + (o.preco || 0) * (o.qtd || 1), 0);
    const subtotal = (pedido.itens || []).reduce((acc, i) => acc + ((i.preco || 0) + extrasDe(i)) * (i.qtd || 1), 0);
    const taxa = Number(pedido.taxaEntrega) || 0;
    const linhas = [];
    linhas.push(centro(nome.toUpperCase()));
    linhas.push(centro("CUPOM DO PEDIDO"));
    linhas.push(sep("="));
    linhas.push(linhaValor("Pedido #" + pedido.numero, dataHoraBR(pedido.criadoEm)));
    if (pedido.cliente) linhas.push("Cliente: " + pedido.cliente);
    if (pedido.telefone) linhas.push("Tel: " + pedido.telefone);
    linhas.push("Tipo: " + (pedido.tipoEntrega || "").toUpperCase());
    if (pedido.tipoEntrega === "Entrega" && pedido.endereco && pedido.endereco.trim() && pedido.endereco !== "—") {
      linhas.push("End: " + pedido.endereco.trim());
    }
    linhas.push(sep("-"));
    (pedido.itens || []).forEach((i) => {
      const sub = ((i.preco || 0) + extrasDe(i)) * (i.qtd || 1);
      linhas.push(linhaValor((i.qtd || 1) + "x " + (i.nome || ""), fmtBR(sub)));
      const op = (i.opcionais || []).map((o) => (o.qtd > 1 ? o.qtd + "x " : "") + o.nome).join(" / ");
      if (op) linhas.push("   " + op);
    });
    linhas.push(sep("-"));
    linhas.push(linhaValor("Subtotal:", fmtBR(subtotal)));
    if (taxa > 0) linhas.push(linhaValor("Taxa entrega:", fmtBR(taxa)));
    linhas.push(linhaValor("TOTAL:", fmtBR(pedido.total)));
    if (pedido.pagamento) linhas.push("Pagamento: " + pedido.pagamento);
    linhas.push(sep("="));
    return linhas.join("\n");
  }

  function montarComanda(pedido, config) {
    return { cozinha: montarCozinha(pedido, config), cupom: montarCupom(pedido, config) };
  }

  return { montarComanda, montarCozinha, montarCupom, fmtBR };
});
