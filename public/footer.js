// Footer institucional compartilhado (landing, termos, privacidade).
// Puxa os dados públicos da plataforma (preenchidos na aba Configurações Master)
// e preenche: nome, linha de copyright, redes sociais e endereço/telefone.
// Colunas dinâmicas vazias são ocultadas — sem placeholder falso.
//
// Páginas podem definir window.onPlataformaData(dados, limpo) ANTES de carregar
// este script para reaproveitar o mesmo fetch (ex.: identidade nos Termos).
(function () {
  var limpo = function (s) { return String(s).replace(/[<>]/g, ""); };

  function link(url, prefixo) {
    var u = String(url).trim();
    if (!/^https?:\/\//i.test(u)) u = prefixo + u.replace(/^@/, "");
    return u;
  }

  fetch("/api/plataforma/publico")
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (d) {
      d = d || {};

      // Nome da marca
      var nomeEl = document.getElementById("lp-footer-nome");
      if (nomeEl && d.nomeFantasia) nomeEl.textContent = limpo(d.nomeFantasia);

      // Linha de copyright (Razão Social + CNPJ embutidos)
      var partes = ["© 2026 " + limpo(d.razaoSocial || d.nomeFantasia || "Nymbus Lab")];
      if (d.cnpj) partes.push("CNPJ " + limpo(d.cnpj));
      partes.push("Todos os direitos reservados.");
      var copyEl = document.getElementById("lp-footer-copy");
      if (copyEl) copyEl.textContent = partes.join(" · ");

      // Coluna de contato à direita: redes sociais + endereço/telefone empilhados.
      // Cada bloco some se vazio; a coluna inteira some se não houver nada.
      var social = document.getElementById("lp-footer-social");
      var html = "";
      if (social) {
        if (d.facebook) html += '<a href="' + link(d.facebook, "https://facebook.com/") + '" target="_blank" rel="noopener"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>Facebook</a>';
        if (d.instagram) html += '<a href="' + link(d.instagram, "https://instagram.com/") + '" target="_blank" rel="noopener"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>Instagram</a>';
        social.innerHTML = html;
        var blocoRedes = document.getElementById("lp-footer-redes-bloco");
        if (blocoRedes && !html) blocoRedes.style.display = "none";
      }

      var info = document.getElementById("lp-footer-info");
      var ihtml = "";
      if (info) {
        if (d.endereco) ihtml += '<div class="lp-footer-bloco"><h4>Endereço</h4><p>' + limpo(d.endereco) + "</p></div>";
        if (d.telefone) ihtml += '<div class="lp-footer-bloco"><h4>Telefone</h4><p>' + limpo(d.telefone) + "</p></div>";
        info.innerHTML = ihtml;
      }

      var colContato = document.getElementById("lp-footer-contato");
      if (colContato && !html && !ihtml) colContato.style.display = "none";

      // Gancho para conteúdo específico da página (identidade nos Termos/Privacidade)
      if (typeof window.onPlataformaData === "function") window.onPlataformaData(d, limpo);
    })
    .catch(function () { /* footer fica como está */ });
})();
