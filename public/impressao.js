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
  // cortarEntreVias=true → 2 trabalhos encadeados (guilhotina corta entre elas).
  function imprimir(pedido, config) {
    if (!global.Comanda) return;
    const { cozinha, cupom } = global.Comanda.montarComanda(pedido, config);
    const cortar = !!(config && config.impressao && config.impressao.cortarEntreVias);
    if (!cortar) {
      const tracejado = "\n\n   ✂- - - - - - - - - - - - - -\n\n";
      imprimirTexto(cozinha + tracejado + cupom);
      return;
    }
    // 2 trabalhos: imprime a cozinha; ao terminar, imprime o cupom.
    const aoTerminar = () => {
      window.removeEventListener("afterprint", aoTerminar);
      imprimirTexto(cupom);
    };
    window.addEventListener("afterprint", aoTerminar);
    imprimirTexto(cozinha);
  }

  global.Impressao = { imprimir };
})(window);
