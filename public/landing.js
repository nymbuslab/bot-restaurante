// Já logado? O cookie de presença "sess" (legível) indica sessão ativa. Se houver,
// tenta retomar via /api/refresh e vai direto pro painel — o dono logado não fica
// na landing pública. Após logout o cookie some e a landing volta ao normal.
(function retomarSessao() {
  var temSessao = document.cookie.split(";").some(function (c) { return c.trim() === "sess=1"; });
  if (!temSessao) return;
  fetch("/api/refresh", { method: "POST" })
    .then(function (r) {
      if (!r.ok) return;
      // Onboarding incompleto → retoma o cadastro; senão, painel (espelha o login).
      return r.json().then(function (d) {
        location.replace(d && d.onboardingConcluido === false ? "cadastro.html" : "admin.html");
      });
    })
    .catch(function () { /* fica na landing */ });
})();

// Reveal ao rolar: adiciona .visivel quando o bloco entra na tela.
// Respeita prefers-reduced-motion (mostra tudo direto, sem animação).
(function () {
  var reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var alvos = document.querySelectorAll(".lp-reveal");
  if (reduz || !("IntersectionObserver" in window)) {
    alvos.forEach(function (el) { el.classList.add("visivel"); });
    return;
  }
  var obs = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("visivel"); obs.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  alvos.forEach(function (el) { obs.observe(el); });
})();
