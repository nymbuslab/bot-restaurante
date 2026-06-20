// Orquestra a impressão térmica pelo navegador (window.print + container oculto).
(function (global) {
  function setArea(texto) {
    const area = document.getElementById("area-impressao");
    if (!area) return;
    const pre = document.createElement("pre");
    pre.className = "cupom-print";
    pre.textContent = texto;
    area.replaceChildren(pre);
  }

  function imprimirTexto(texto) {
    setArea(texto);
    window.print();
  }

  // Imprime as 2 vias. cortarEntreVias=false → 1 trabalho (vias juntas com tracejado).
  // cortarEntreVias=true → 2 trabalhos (guilhotina corta entre elas).
  // window.print() é SÍNCRONO/bloqueante (retorna só quando o diálogo fecha), então
  // chamamos em sequência — sem depender de `afterprint` (que também dispara no
  // cancelamento e acumularia listeners em cliques repetidos).
  function imprimir(pedido, config) {
    if (!global.Comanda) return;
    const { cozinha, cupom } = global.Comanda.montarComanda(pedido, config);
    const cortar = !!(config && config.impressao && config.impressao.cortarEntreVias);
    if (!cortar) {
      const tracejado = "\n\n   ✂- - - - - - - - - - - - - -\n\n";
      imprimirTexto(cozinha + tracejado + cupom);
      return;
    }
    imprimirTexto(cozinha);
    imprimirTexto(cupom);
  }

  global.Impressao = { imprimir };
})(window);
