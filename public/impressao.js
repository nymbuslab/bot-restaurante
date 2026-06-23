// Impressão térmica pelo navegador: abre um modal de PRÉ-VISUALIZAÇÃO das 2 vias
// e imprime UMA via por vez (1 via = 1 trabalho → a impressora corta no fim de cada).
(function (global) {
  let vias = { cozinha: "", cupom: "" };
  let impCfg = {}; // config.impressao do tenant (metodo/baud/semAcento)

  // Roteia: serial (Web Serial) se configurado e suportado; senão window.print.
  function imprimirTexto(texto) {
    if (impCfg.metodo === "serial" && global.Serial && global.Serial.suportado()) {
      global.Serial.imprimir(texto, { semAcento: impCfg.semAcento === true, baud: impCfg.baud || 9600, corte: impCfg.corte || "parcial" })
        .catch(function (e) {
          if (typeof global.toast === "function") global.toast((e && e.message) || "Falha na impressão serial — usando o navegador.", "erro");
          else console.warn("impressão serial:", e && e.message);
          imprimirNavegador(texto);
        });
      return;
    }
    imprimirNavegador(texto);
  }

  // Renderiza o texto da via no container oculto e dispara o diálogo de impressão.
  // O @media print esconde tudo (inclusive o modal) e imprime só #area-impressao.
  function imprimirNavegador(texto) {
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

  // Prévia de DOCUMENTO ÚNICO (ex.: relatório de fechamento de caixa).
  function abrirRelatorio(titulo, texto) {
    const overlay = document.getElementById("relatorio-overlay");
    const tEl = document.getElementById("relatorio-titulo");
    const prev = document.getElementById("relatorio-prev");
    if (tEl && titulo) tEl.textContent = titulo;
    if (prev) prev.textContent = texto || "";
    if (overlay) overlay.style.display = "flex";
  }
  function fecharRelatorio() {
    const o = document.getElementById("relatorio-overlay");
    if (o) o.style.display = "none";
  }

  // Abre o modal mostrando as 2 vias renderizadas (prévia legível na tela).
  // extras (opcional): { linkCardapio } — usado no rodapé do cupom.
  function abrirPreview(pedido, config, extras) {
    if (!global.Comanda) return;
    impCfg = (config && config.impressao) || {};
    vias = global.Comanda.montarComanda(pedido, config, extras || {});
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

    const rImp = document.getElementById("relatorio-imprimir");
    const rX = document.getElementById("relatorio-fechar");
    const rOv = document.getElementById("relatorio-overlay");
    const rPrev = document.getElementById("relatorio-prev");
    if (rImp) rImp.addEventListener("click", () => imprimirTexto(rPrev ? rPrev.textContent : ""));
    if (rX) rX.addEventListener("click", fecharRelatorio);
    if (rOv) rOv.addEventListener("mousedown", (e) => { if (e.target === rOv) fecharRelatorio(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && rOv && rOv.style.display === "flex") fecharRelatorio();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligar);
  else ligar();

  global.Impressao = { abrirPreview, abrirRelatorio };
})(window);
