// ============================================================
// Extrato geral de estoque (aba Relatórios) — helpers puros e testáveis.
// montarQueryString: monta os query params de GET /api/estoque/geral a partir
// dos filtros escolhidos na tela. Dual-mode: window.ExtratoEstoque no browser,
// module.exports no Node (testes), mesmo padrão de public/busca.js.
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.ExtratoEstoque = api;
})(this, function () {
  // periodo 'hoje'/'7dias': manda o preset, ignora desde/ate (o servidor resolve
  // a janela). periodo 'customizado': manda desde/ate quando informados, sem
  // mandar periodo=customizado (a rota trata a ausência de periodo como custom).
  function montarQueryString(filtro) {
    const f = filtro || {};
    const partes = [];
    const tipos = Array.isArray(f.tipos) ? f.tipos.filter(Boolean) : [];
    if (tipos.length) partes.push("tipos=" + tipos.map(encodeURIComponent).join(","));

    if (f.periodo === "hoje" || f.periodo === "7dias") {
      partes.push("periodo=" + f.periodo);
    } else {
      if (f.desde) partes.push("desde=" + encodeURIComponent(f.desde));
      if (f.ate) partes.push("ate=" + encodeURIComponent(f.ate));
    }

    if (f.limite) partes.push("limite=" + encodeURIComponent(f.limite));
    if (f.antes) partes.push("antes=" + encodeURIComponent(f.antes));
    if (f.antesId != null) partes.push("antesId=" + encodeURIComponent(f.antesId));

    return partes.join("&");
  }

  // Default D-01: só os 4 tipos operacionais marcados (venda/devolução já têm
  // visão própria na aba Pedidos). Novo array a cada chamada — quem recebe é
  // livre para mutar sem afetar outra tela.
  function tiposPadrao() {
    return ["entrada", "perda", "contagem", "ajuste"];
  }

  // Alterna um tipo dentro/fora do array de selecionados, sem duplicar e sem
  // mutar o array recebido (o chamador decide quando re-renderizar).
  function alternarTipo(selecionados, tipo) {
    const atual = Array.isArray(selecionados) ? selecionados : [];
    return atual.includes(tipo) ? atual.filter((t) => t !== tipo) : atual.concat([tipo]);
  }

  return { montarQueryString, tiposPadrao, alternarTipo };
});
