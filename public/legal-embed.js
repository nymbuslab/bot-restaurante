// Modo embed (quando aberto em iframe/modal): esconde nav, footer e "voltar".
// Compartilhado por termos.html e privacidade.html. Roda cedo (no <head>) para
// aplicar a classe `embed` antes da pintura, evitando flash do chrome da página.
(function () {
  if (!/[?&#]embed/.test(location.search + location.hash)) return;
  document.documentElement.classList.add("embed");
  document.addEventListener("DOMContentLoaded", function () {
    // Mantém a navegação entre documentos dentro do embed (sem chrome).
    document.querySelectorAll('a[href$="termos.html"], a[href$="privacidade.html"]').forEach(function (a) {
      a.href += (a.href.indexOf("?") < 0 ? "?embed=1" : "&embed=1");
    });
  });
})();
