// ============================================================
// CARDÁPIO DIGITAL PÚBLICO — vitrine (somente leitura) por slug.
// Estilo iFood: header, busca, chips de categoria roláveis (scrollspy),
// cards e bottom-sheet de detalhe. Sem auth. Slug do path (/c/:slug).
// CSP estrita: nada inline; DOM com textContent (anti-XSS).
// ============================================================

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var slug = (location.pathname.split("/").filter(Boolean).pop() || "").trim();

  var CATS = [];      // categorias com itens (índice = ci usado nos cards/chips)
  var secEls = [];    // <section> por categoria
  var chipEls = [];   // <button.chip> por categoria
  var travaSpy = false;

  function moeda(v) {
    var n = Number(v);
    if (!isFinite(n)) return "";
    return "R$ " + n.toFixed(2).replace(".", ",");
  }

  // Composição serializada ("Grupo:\n* item") → linhas legíveis.
  function linhasComposicao(texto) {
    return String(texto || "").split("\n")
      .map(function (l) { return l.trim(); }).filter(Boolean)
      .map(function (l) { return l.replace(/^\*\s*/, "").replace(/:$/, ""); });
  }

  // Opcionais serializados ("nome | preco") → [{nome, preco}].
  function parseOpcionais(texto) {
    return String(texto || "").split("\n")
      .map(function (l) { return l.trim(); }).filter(Boolean)
      .map(function (l) {
        var p = l.split("|");
        return { nome: (p[0] || "").trim(), preco: parseFloat((p[1] || "").replace(",", ".")) || 0 };
      })
      .filter(function (o) { return o.nome; });
  }

  function estado(msg) {
    var el = $("cd-estado");
    el.textContent = msg;
    el.style.display = "";
    $("cd-categorias").innerHTML = "";
    $("cd-bar").style.display = "none";
    $("cd-vazio").style.display = "none";
  }

  function skeleton() {
    var um = '<div class="cd-skel-item"><div class="cd-skel-corpo">'
      + '<div class="cd-shimmer cd-skel-line" style="width:55%"></div>'
      + '<div class="cd-shimmer cd-skel-line" style="width:85%"></div>'
      + '<div class="cd-shimmer cd-skel-line" style="width:30%;margin-top:6px"></div>'
      + '</div><div class="cd-shimmer cd-skel-foto"></div></div>';
    $("cd-estado").innerHTML = um + um + um + um;
    $("cd-estado").style.display = "";
  }

  var ICONE_SEM_FOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

  function elCard(item, ci, ii) {
    var card = document.createElement("article");
    card.className = "cd-item";
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.dataset.busca = ((item.nome || "") + " " + (item.desc || "")).toLowerCase();

    var corpo = document.createElement("div");
    corpo.className = "cd-item-corpo";
    var nome = document.createElement("h3");
    nome.className = "cd-item-nome";
    nome.textContent = item.nome || "";
    corpo.appendChild(nome);
    if (item.desc) {
      var d = document.createElement("p");
      d.className = "cd-item-desc";
      d.textContent = item.desc;
      corpo.appendChild(d);
    }
    var preco = document.createElement("span");
    preco.className = "cd-item-preco";
    preco.textContent = moeda(item.preco);
    corpo.appendChild(preco);
    card.appendChild(corpo);

    if (item.imagem) {
      var img = document.createElement("img");
      img.className = "cd-item-foto";
      img.src = item.imagem;
      img.alt = item.nome || "";
      img.loading = "lazy";
      card.appendChild(img);
    } else {
      var ph = document.createElement("div");
      ph.className = "cd-item-foto-ph";
      ph.innerHTML = ICONE_SEM_FOTO;
      card.appendChild(ph);
    }

    var abrir = function () { abrirSheet(ci, ii); };
    card.addEventListener("click", abrir);
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(); }
    });
    return card;
  }

  function render(data) {
    document.title = (data.restaurante && data.restaurante.nome) ? data.restaurante.nome + " — Cardápio" : "Cardápio";
    $("cd-nome").textContent = (data.restaurante && data.restaurante.nome) || "Cardápio";
    var info = [];
    if (data.restaurante && data.restaurante.endereco) info.push(data.restaurante.endereco);
    if (data.restaurante && data.restaurante.telefone) info.push(data.restaurante.telefone);
    $("cd-info").textContent = info.join("  ·  ");

    var st = $("cd-status");
    if (data.aberto === false) { st.textContent = "Fechado no momento"; st.className = "cd-status fechado"; }
    else { st.textContent = "Aberto agora"; st.className = "cd-status aberto"; }
    st.style.display = "";

    CATS = (data.categorias || []).filter(function (c) { return c.itens && c.itens.length; });
    if (!CATS.length) { estado("Cardápio em atualização. Volte em instantes."); return; }

    $("cd-estado").style.display = "none";
    $("cd-bar").style.display = "";

    var chipsWrap = $("cd-chips"); chipsWrap.innerHTML = ""; chipEls = [];
    var cont = $("cd-categorias"); cont.innerHTML = ""; secEls = [];

    CATS.forEach(function (cat, ci) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cd-chip";
      chip.textContent = cat.nome || "Itens";
      chip.addEventListener("click", function () { irPara(ci); });
      chipsWrap.appendChild(chip);
      chipEls[ci] = chip;

      var sec = document.createElement("section");
      sec.className = "cd-cat";
      sec.id = "cd-cat-" + ci;
      var h = document.createElement("h2");
      h.className = "cd-cat-head";
      h.textContent = cat.nome || "";
      sec.appendChild(h);
      var list = document.createElement("div");
      list.className = "cd-list";
      cat.itens.forEach(function (it, ii) { list.appendChild(elCard(it, ci, ii)); });
      sec.appendChild(list);
      cont.appendChild(sec);
      secEls[ci] = sec;
    });

    if (chipEls[0]) chipEls[0].classList.add("ativo");
    iniciarScrollspy();
    ligarBusca();
  }

  // Rola horizontalmente os chips até deixar o ativo visível (nunca rola a página).
  function trazerChip(ci) {
    var cw = $("cd-chips"), chip = chipEls[ci];
    if (!cw || !chip) return;
    var alvo = cw.scrollLeft + chip.getBoundingClientRect().left - cw.getBoundingClientRect().left - 16;
    cw.scrollTo({ left: alvo, behavior: "smooth" });
  }

  function marcarAtivo(ci) {
    chipEls.forEach(function (c, i) { if (c) c.classList.toggle("ativo", i === ci); });
    trazerChip(ci);
  }

  // Clique no chip: marca + rola a página até a seção (com trava breve no spy).
  function irPara(ci) {
    marcarAtivo(ci);
    travaSpy = true;
    if (secEls[ci]) secEls[ci].scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(function () { travaSpy = false; }, 650);
  }

  function iniciarScrollspy() {
    if (!("IntersectionObserver" in window)) return;
    var obs = new IntersectionObserver(function (entries) {
      if (travaSpy) return;
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var ci = parseInt(e.target.id.replace("cd-cat-", ""), 10);
          marcarAtivo(ci);
        }
      });
    }, { rootMargin: "-120px 0px -72% 0px", threshold: 0 });
    secEls.forEach(function (s) { if (s) obs.observe(s); });
  }

  function ligarBusca() {
    $("cd-busca").addEventListener("input", function () {
      var q = this.value.trim().toLowerCase();
      var algum = false;
      secEls.forEach(function (sec, ci) {
        if (!sec) return;
        var visiveis = 0;
        sec.querySelectorAll(".cd-item").forEach(function (card) {
          var ok = !q || card.dataset.busca.indexOf(q) !== -1;
          card.style.display = ok ? "" : "none";
          if (ok) visiveis++;
        });
        var mostra = visiveis > 0;
        sec.style.display = mostra ? "" : "none";
        if (chipEls[ci]) chipEls[ci].style.display = mostra ? "" : "none";
        if (mostra) algum = true;
      });
      $("cd-vazio").style.display = algum ? "none" : "";
    });
  }

  // ---- Bottom-sheet de detalhe ----
  function secLista(titulo, linhas) {
    var sec = document.createElement("div");
    sec.className = "cd-sheet-sec";
    var h = document.createElement("h4");
    h.textContent = titulo;
    sec.appendChild(h);
    var ul = document.createElement("ul");
    linhas.forEach(function (l) { var li = document.createElement("li"); li.textContent = l; ul.appendChild(li); });
    sec.appendChild(ul);
    return sec;
  }

  function abrirSheet(ci, ii) {
    var item = CATS[ci] && CATS[ci].itens[ii];
    if (!item) return;
    var foto = $("cd-sheet-foto");
    if (item.imagem) { foto.src = item.imagem; foto.alt = item.nome || ""; foto.style.display = ""; }
    else { foto.removeAttribute("src"); foto.style.display = "none"; }
    $("cd-sheet-nome").textContent = item.nome || "";
    $("cd-sheet-preco").textContent = moeda(item.preco);
    var desc = $("cd-sheet-desc");
    if (item.desc) { desc.textContent = item.desc; desc.style.display = ""; } else { desc.style.display = "none"; }

    var extra = $("cd-sheet-extra"); extra.innerHTML = "";
    var comp = linhasComposicao(item.composicao);
    if (comp.length) extra.appendChild(secLista("O que vem", comp));
    var opc = parseOpcionais(item.opcionais);
    if (opc.length) extra.appendChild(secLista("Adicionais", opc.map(function (o) {
      return o.preco ? o.nome + "  (+" + moeda(o.preco) + ")" : o.nome;
    })));

    var ov = $("cd-sheet-overlay");
    ov.classList.add("aberto");
    $("cd-sheet").scrollTop = 0;
    document.body.style.overflow = "hidden";
  }

  function fecharSheet() {
    $("cd-sheet-overlay").classList.remove("aberto");
    document.body.style.overflow = "";
  }

  $("cd-sheet-fechar").addEventListener("click", fecharSheet);
  $("cd-sheet-overlay").addEventListener("click", function (e) { if (e.target === this) fecharSheet(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") fecharSheet(); });

  // ---- Boot ----
  if (!slug) { estado("Cardápio não encontrado."); return; }
  skeleton();
  fetch("/api/c/" + encodeURIComponent(slug))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.disponivel) { estado("Cardápio indisponível no momento."); return; }
      render(data);
    })
    .catch(function () { estado("Não foi possível carregar o cardápio."); });
})();
