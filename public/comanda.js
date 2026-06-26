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
  // Quebra um texto em linhas <= larg sem cortar palavra no meio. Palavra maior
  // que a largura (ex.: URL) é fatiada em pedaços para não estourar a coluna.
  function quebrar(txt, larg) {
    const w = larg || LARGURA;
    const linhas = [];
    let atual = "";
    String(txt || "").split(/\s+/).filter(Boolean).forEach((p) => {
      while (p.length > w) { // palavra gigante (ex.: URL) → fatia em pedaços de w
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
  // Mensagem padrão do rodapé do cupom quando o tenant não personaliza.
  const RODAPE_PADRAO = "Obrigado pela preferência! Volte sempre.";
  // "Rótulo" à esquerda + "valor" à direita, preenchendo a largura.
  // Trunca o rótulo se o conjunto passar de LARGURA, para não quebrar a linha
  // (o que jogaria o valor pra linha de baixo, desalinhando) com nomes longos.
  function linhaValor(rotulo, valor) {
    let r = String(rotulo || "");
    const v = String(valor || "");
    const maxR = Math.max(1, LARGURA - v.length - 1);
    if (r.length > maxR) r = r.slice(0, maxR);
    const espaco = Math.max(1, LARGURA - r.length - v.length);
    return r + " ".repeat(espaco) + v;
  }
  function dataHoraBR(iso) {
    try {
      const d = new Date(iso);
      const tz = "America/Sao_Paulo";
      const data = d.toLocaleDateString("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric" });
      const hora = d.toLocaleTimeString("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
      return data + " - " + hora; // dd/mm/yyyy - HH:MM
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
    const itensCoz = pedido.itens || [];
    if (!itensCoz.length) linhas.push("(sem itens)");
    itensCoz.forEach((i) => {
      linhas.push((i.qtd || 1) + "x " + (i.nome || ""));
      (i.composicao || []).forEach((c) => {
        if (c && c.itens && c.itens.length) linhas.push("   " + (c.grupo ? c.grupo + ": " : "") + c.itens.join(", "));
      });
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

  function montarCupom(pedido, config, extras) {
    extras = extras || {};
    const rest = (config && config.restaurante) || {};
    const nome = rest.nome || "Pedido";
    const extrasDe = (i) => (i.opcionais || []).reduce((s, o) => s + (o.preco || 0) * (o.qtd || 1), 0);
    const subtotal = (pedido.itens || []).reduce((acc, i) => acc + ((i.preco || 0) + extrasDe(i)) * (i.qtd || 1), 0);
    const taxa = Number(pedido.taxaEntrega) || 0;
    const linhas = [];
    // Cabeçalho (branding): nome em destaque + endereço (sem o CEP) e, numa linha
    // só, CEP + telefone — dos dados da empresa.
    linhas.push(centro(nome.toUpperCase()));
    let endStr = (rest.endereco || "").trim();
    let cep = "";
    const mCep = endStr.match(/·\s*CEP\s*(\S+)\s*$/i); // o endereço composto termina em " · CEP 00000-000"
    if (mCep) { cep = mCep[1]; endStr = endStr.replace(/\s*·\s*CEP\s*\S+\s*$/i, "").trim(); }
    if (!cep && rest.cep) cep = String(rest.cep).replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2");
    if (endStr) quebrar(endStr, LARGURA).forEach((l) => linhas.push(centro(l)));
    const cepTel = [];
    if (cep) cepTel.push("CEP " + cep);
    if (rest.telefone && String(rest.telefone).trim()) cepTel.push("Tel: " + String(rest.telefone).trim());
    if (cepTel.length) linhas.push(centro(cepTel.join("  ")));
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
    const itensCup = pedido.itens || [];
    if (!itensCup.length) linhas.push("(sem itens)");
    itensCup.forEach((i) => {
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
    // Rodapé (marketing): mensagem personalizável + chamada pro cardápio digital.
    const imp = (config && config.impressao) || {};
    const msg = imp.rodape != null && String(imp.rodape).trim() ? String(imp.rodape).trim() : RODAPE_PADRAO;
    quebrar(msg, LARGURA).forEach((l) => linhas.push(centro(l)));
    if (extras.linkCardapio && String(extras.linkCardapio).trim()) {
      const link = String(extras.linkCardapio).trim().replace(/^https?:\/\//, "");
      linhas.push("");
      linhas.push(centro("Peça pelo cardápio digital:"));
      quebrar(link, LARGURA).forEach((l) => linhas.push(centro(l)));
    }
    return linhas.join("\n");
  }

  function montarComanda(pedido, config, extras) {
    return { cozinha: montarCozinha(pedido, config), cupom: montarCupom(pedido, config, extras) };
  }

  return { montarComanda, montarCozinha, montarCupom, fmtBR };
});
