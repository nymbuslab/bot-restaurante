// Impressão térmica pelo navegador: abre um modal de PRÉ-VISUALIZAÇÃO das 2 vias
// e imprime UMA via por vez (1 via = 1 trabalho → a impressora corta no fim de cada).
(function (global) {
  let vias = { cozinha: "", cupom: "" };

  // Renderiza o texto da via no container oculto e dispara o diálogo de impressão.
  // O @media print esconde tudo (inclusive o modal) e imprime só #area-impressao.
  function imprimirTexto(texto) {
    const area = document.getElementById("area-impressao");
    if (!area) return;
    const pre = document.createElement("pre");
    pre.className = "cupom-print";
    pre.textContent = texto;
    area.replaceChildren(pre);
    window.print();
  }

  function fecharPreview() {
    const overlay = document.getElementById("impressao-overlay");
    if (overlay) overlay.style.display = "none";
  }

  // Abre o modal mostrando as 2 vias renderizadas (prévia legível na tela).
  function abrirPreview(pedido, config) {
    if (!global.Comanda) return;
    vias = global.Comanda.montarComanda(pedido, config);
    const overlay = document.getElementById("impressao-overlay");
    const titulo = document.getElementById("impressao-titulo");
    const prevCoz = document.getElementById("impressao-prev-cozinha");
    const prevCup = document.getElementById("impressao-prev-cupom");
    if (titulo) titulo.textContent = "Imprimir pedido #" + (pedido.numero || "");
    if (prevCoz) prevCoz.textContent = vias.cozinha;
    if (prevCup) prevCup.textContent = vias.cupom;
    if (overlay) overlay.style.display = "flex";
  }

  function ligar() {
    const bCoz = document.getElementById("impressao-btn-cozinha");
    const bCup = document.getElementById("impressao-btn-cupom");
    const bX = document.getElementById("impressao-fechar");
    const ov = document.getElementById("impressao-overlay");
    if (bCoz) bCoz.addEventListener("click", () => imprimirTexto(vias.cozinha));
    if (bCup) bCup.addEventListener("click", () => imprimirTexto(vias.cupom));
    if (bX) bX.addEventListener("click", fecharPreview);
    if (ov) ov.addEventListener("mousedown", (e) => { if (e.target === ov) fecharPreview(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && ov && ov.style.display === "flex") fecharPreview();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligar);
  else ligar();

  global.Impressao = { abrirPreview };
})(window);
