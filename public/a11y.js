// ============================================================
// Acessibilidade — foco de modais (global).
//
// Faz DUAS coisas, para todos os overlays conhecidos (lista SEL), sem que cada
// modal precise tratar foco na mão:
//
// 1. FOCO AO ABRIR — quando um overlay fica visível, joga o foco pro 1º elemento
//    focável VISÍVEL dentro dele (a checagem `visivel` ignora, ex., o botão de
//    fechar escondido por `display:none`). Resolve o caso do modal que abria mas
//    deixava o foco na tela de trás (o usuário tinha que clicar pra "ativar").
//    Só age na ABERTURA e só se o foco ainda não estiver dentro — modais que já
//    se focam (fechamento de caixa, confirmar, drawer da mesa) não são mexidos.
// 2. FOCUS-TRAP — mantém o Tab dentro do modal/drawer aberto mais acima, pro foco
//    não escapar pra página atrás do overlay (WCAG 2.4.3).
//
// É PURAMENTE ADITIVO: não abre nem fecha modal, e nunca mexe no foco ao FECHAR
// (não atrapalha o retorno de foco de quem trata isso). Padrão único: ao abrir
// um modal NÃO escrever `.focus()` na mão — isto cuida do foco inicial.
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

  // --- Foco ao abrir ------------------------------------------------------
  // Observa a abertura dos overlays (hidden/class/style) e joga o foco pra
  // dentro. Deferido (rAF) p/ rodar depois do render; agenda no máx. 1 vez.
  var focoPendente = false;
  function focarModalAoAbrir() {
    focoPendente = false;
    var modal = modalTopo();
    if (!modal) return;
    var ativo = document.activeElement;
    if (ativo && ativo !== document.body && modal.contains(ativo)) return; // já focado dentro
    var foc = Array.prototype.slice.call(modal.querySelectorAll(FOCAVEIS)).filter(visivel);
    var alvo = foc[0];
    if (!alvo) { // sem focável: foca o container p/ Tab/Esc/leitor funcionarem
      if (!modal.hasAttribute("tabindex")) modal.setAttribute("tabindex", "-1");
      alvo = modal;
    }
    try { alvo.focus(); } catch (_) {}
  }
  function agendarFocoModal() {
    if (focoPendente) return;
    focoPendente = true;
    (window.requestAnimationFrame || window.setTimeout)(focarModalAoAbrir, 0);
  }
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      // só reage quando um overlay conhecido ACABA de ficar visível (abertura)
      if (t.nodeType === 1 && t.matches && t.matches(SEL) && visivel(t)) { agendarFocoModal(); return; }
    }
  }).observe(document.body, { attributes: true, attributeFilter: ["hidden", "class", "style"], subtree: true });
})();
