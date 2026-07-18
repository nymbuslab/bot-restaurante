// ============================================================
// Acessibilidade — focus-trap global de modais.
//
// Mantém o Tab dentro do modal/drawer aberto mais acima, para o foco não
// escapar para a página atrás do overlay (WCAG 2.4.3). É PURAMENTE ADITIVO:
// só age na tecla Tab, e apenas quando há um overlay conhecido de fato visível
// na tela. Não abre, fecha nem altera nenhum modal. Os modais que já tratam o
// próprio Tab (fechamento de caixa, confirmar) seguem funcionando — o resultado
// é o mesmo (idempotente).
//
// Carregado em admin.html, admin-master.html e cardapio.html.
// ============================================================
(function () {
  // Wrappers de modal/overlay/drawer usados nas 3 telas (união).
  var SEL = [
    ".modal-overlay", ".pdv-modal", ".cd-modal", ".cd-sheet", ".mesa-painel",
    "#fcOverlay", "#editor-overlay", "#cartao-overlay", "#pedido-overlay",
    "#qr-overlay", "#upsell-overlay", "#novo-pedido-overlay", "#item-del-overlay",
    "#tenant-overlay", "#del-overlay", "#criar-overlay"
  ].join(",");
  var FOCAVEIS = 'a[href],button:not([disabled]),input:not([disabled]),' +
    'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

  // Visível = renderizado E dentro da viewport. A interseção com a viewport
  // distingue "modal aberto" de "drawer deslizado pra fora" (que segue no DOM).
  function visivel(el) {
    if (!el || el.hidden) return false;
    var s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
    var r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh;
  }

  // Overlay aberto mais acima: maior z-index; empate fica com o último no DOM.
  function modalTopo() {
    var els = Array.prototype.slice.call(document.querySelectorAll(SEL)).filter(visivel);
    if (!els.length) return null;
    var topo = null, zt = -Infinity;
    els.forEach(function (el) {
      var z = parseInt(getComputedStyle(el).zIndex, 10);
      if (isNaN(z)) z = 0;
      if (z >= zt) { zt = z; topo = el; }
    });
    return topo;
  }

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var modal = modalTopo();
    if (!modal) return;
    var foc = Array.prototype.slice.call(modal.querySelectorAll(FOCAVEIS)).filter(visivel);
    if (!foc.length) return;
    var primeiro = foc[0], ultimo = foc[foc.length - 1], ativo = document.activeElement;
    if (!modal.contains(ativo)) { e.preventDefault(); primeiro.focus(); return; }
    if (e.shiftKey && ativo === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && ativo === ultimo) { e.preventDefault(); primeiro.focus(); }
  });
})();
