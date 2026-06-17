// ============================================================
// CARDÁPIO DIGITAL PÚBLICO — vitrine (somente leitura) por slug.
// Categorias como cards com ícone ("Todos" + uma por categoria) que FILTRAM;
// busca ao vivo; cards estilo iFood com bottom-sheet de detalhe. Sem auth.
// CSP estrita: nada inline; DOM com textContent (anti-XSS).
// ============================================================

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var slug = (location.pathname.split("/").filter(Boolean).pop() || "").trim();

  var CATS = [];        // categorias com itens (índice = ci)
  var secEls = [];      // <section> por categoria
  var catCards = [];    // card de categoria por ci
  var todosCard = null; // card "Todos" (ci = -1)

  function moeda(v) {
    var n = Number(v);
    if (!isFinite(n)) return "";
    return "R$ " + n.toFixed(2).replace(".", ",");
  }
  function linhasComposicao(texto) {
    return String(texto || "").split("\n")
      .map(function (l) { return l.trim(); }).filter(Boolean)
      .map(function (l) { return l.replace(/^\*\s*/, "").replace(/:$/, ""); });
  }
  function parseOpcionais(texto) {
    return String(texto || "").split("\n")
      .map(function (l) { return l.trim(); }).filter(Boolean)
      .map(function (l) {
        var p = l.split("|");
        return { nome: (p[0] || "").trim(), preco: parseFloat((p[1] || "").replace(",", ".")) || 0 };
      })
      .filter(function (o) { return o.nome; });
  }

  // ---- Ícones (SVG inline, currentColor) por palavra-chave da categoria ----
  function svg(inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  var ICON = {
    grid: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'),
    cup: svg('<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>'),
    box: svg('<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
    flame: svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'),
    pizza: svg('<path d="M15 11h.01"/><path d="M11 15h.01"/><path d="M16 16h.01"/><path d="m2 16 20 6-6-20A20 20 0 0 0 2 16"/><path d="M5.71 17.11a17.04 17.04 0 0 1 11.4-11.4"/>'),
    icecream: svg('<path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11"/><path d="M17 7A5 5 0 0 0 7 7"/><path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4"/>'),
    utensils: svg('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h1"/><path d="M21 15v7"/>')
  };
  function iconeCategoria(nome) {
    var n = (nome || "").toLowerCase();
    if (/bebida|suco|refri|drink|cerveja|chopp|\bagua\b|água|caf[eé]|ch[aá]|vinho|lata/.test(n)) return ICON.cup;
    if (/combo|kit|promo/.test(n)) return ICON.box;
    if (/espeto|churrasc|grelhad|carne|picanha|frango|file|fil[eé]|costela|porco/.test(n)) return ICON.flame;
    if (/pizza/.test(n)) return ICON.pizza;
    if (/sobremesa|doce|a[cç]a[ií]|sorvete|gelad|pudim|milk/.test(n)) return ICON.icecream;
    return ICON.utensils;
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

  function elCatCard(svgIcone, label, ci) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "cd-cat-card";
    card.innerHTML = svgIcone;
    var lbl = document.createElement("span");
    lbl.className = "cd-cat-lbl";
    lbl.textContent = label;
    card.appendChild(lbl);
    card.addEventListener("click", function () { selecionarCategoria(ci); });
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

    // Cards de categoria: "Todos" + uma por categoria
    var catsWrap = $("cd-cats"); catsWrap.innerHTML = ""; catCards = [];
    todosCard = elCatCard(ICON.grid, "Todos", -1);
    catsWrap.appendChild(todosCard);

    // Seções
    var cont = $("cd-categorias"); cont.innerHTML = ""; secEls = [];
    CATS.forEach(function (cat, ci) {
      var card = elCatCard(iconeCategoria(cat.nome), cat.nome || "Itens", ci);
      catsWrap.appendChild(card);
      catCards[ci] = card;

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

    marcarAtivoCard(-1);
    ligarBusca();
  }

  // Marca o card ativo e o traz para a área visível do scroller horizontal.
  function marcarAtivoCard(ci) {
    if (todosCard) todosCard.classList.toggle("ativo", ci === -1);
    catCards.forEach(function (c, i) { if (c) c.classList.toggle("ativo", i === ci); });
    var alvo = ci === -1 ? todosCard : catCards[ci];
    var cw = $("cd-cats");
    if (alvo && cw) {
      var left = cw.scrollLeft + alvo.getBoundingClientRect().left - cw.getBoundingClientRect().left - 16;
      cw.scrollTo({ left: left, behavior: "smooth" });
    }
  }

  // Filtra as seções: -1 = Todas; senão só a categoria escolhida. Limpa a busca.
  function selecionarCategoria(ci) {
    marcarAtivoCard(ci);
    $("cd-busca").value = "";
    secEls.forEach(function (sec, i) {
      if (!sec) return;
      sec.querySelectorAll(".cd-item").forEach(function (c) { c.style.display = ""; });
      sec.style.display = (ci === -1 || i === ci) ? "" : "none";
    });
    $("cd-vazio").style.display = "none";
  }

  function ligarBusca() {
    $("cd-busca").addEventListener("input", function () {
      var q = this.value.trim().toLowerCase();
      marcarAtivoCard(-1); // buscar volta para a visão "Todos"
      var algum = false;
      secEls.forEach(function (sec) {
        if (!sec) return;
        var vis = 0;
        sec.querySelectorAll(".cd-item").forEach(function (card) {
          var ok = !q || card.dataset.busca.indexOf(q) !== -1;
          card.style.display = ok ? "" : "none";
          if (ok) vis++;
        });
        sec.style.display = vis > 0 ? "" : "none";
        if (vis > 0) algum = true;
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
