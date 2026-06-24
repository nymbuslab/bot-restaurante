// ============================================================
// CARDÁPIO WEB (/c/:slug) — lógica da página pública.
// Lê o slug de location.pathname e o token de ?p=, busca GET /api/c/:slug,
// monta cardápio/carrinho/checkout e envia o pedido (POST — Fase 3).
// JS externo (CSP scriptSrc 'self'); sem handlers inline. Reusa window.Dinheiro
// e window.EnderecoCep. Carrinho persiste em localStorage por slug.
// ============================================================
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var money = function (reais) { return window.Dinheiro ? window.Dinheiro.comPrefixo(reais) : "R$ " + Number(reais || 0).toFixed(2); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var SLUG = (location.pathname.match(/\/c\/([^/?#]+)/) || [])[1] || "";
  var TOKEN = new URLSearchParams(location.search).get("p") || "";
  var CHAVE_CART = "cd-cart:" + SLUG;

  var DADOS = null;        // resposta do GET /api/c/:slug
  var carrinho = [];       // [{ id, nome, preco, opcionais:[{nome,preco}], observacao, qtd }]
  var catAtiva = null;
  var busca = "";

  // ---------- Carrinho (persistência) ----------
  function carregarCarrinho() {
    try { carrinho = JSON.parse(localStorage.getItem(CHAVE_CART) || "[]") || []; } catch (e) { carrinho = []; }
    if (!Array.isArray(carrinho)) carrinho = [];
  }
  function salvarCarrinho() {
    try { localStorage.setItem(CHAVE_CART, JSON.stringify(carrinho)); } catch (e) { /* ignora */ }
  }
  function assinatura(l) {
    return l.id + "|" + (l.opcionais || []).map(function (o) { return o.nome + ":" + (o.qtd || 1); }).sort().join(",") + "|" + (l.observacao || "");
  }
  function precoUnit(l) {
    return (Number(l.preco) || 0) + (l.opcionais || []).reduce(function (s, o) { return s + (Number(o.preco) || 0) * (o.qtd || 1); }, 0);
  }
  // Rótulo de um adicional ("2x Ovo" / "Bacon").
  function opTxt(o) { return (o.qtd > 1 ? o.qtd + "x " : "") + o.nome; }
  function precoLinha(l) { return precoUnit(l) * l.qtd; }
  function subtotal() { return carrinho.reduce(function (s, l) { return s + precoLinha(l); }, 0); }
  function totalItens() { return carrinho.reduce(function (s, l) { return s + l.qtd; }, 0); }
  // Item "só no local" (apenasLocal) — não sai para entrega.
  function itemEhSoLocal(id) {
    var cats = (DADOS.cardapio && DADOS.cardapio.categorias) || [];
    for (var i = 0; i < cats.length; i++) {
      var its = cats[i].itens || [];
      for (var j = 0; j < its.length; j++) {
        if (its[j].id === id && its[j].apenasLocal) return true;
      }
    }
    return false;
  }
  function carrinhoTemSoLocal() {
    return carrinho.some(function (l) { return itemEhSoLocal(l.id); });
  }

  function addLinha(nova) {
    var sig = assinatura(nova);
    var ex = carrinho.filter(function (l) { return assinatura(l) === sig; })[0];
    if (ex) ex.qtd += nova.qtd; else carrinho.push(nova);
    salvarCarrinho();
    atualizarBadge();
  }

  // ---------- Init ----------
  function iniciar() {
    carregarCarrinho();
    if (!SLUG) { return mostrarIndisponivel(); }
    fetch("/api/c/" + encodeURIComponent(SLUG))
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("erro")); })
      .then(function (d) {
        if (!d || d.disponivel === false) return mostrarIndisponivel();
        DADOS = d;
        montar();
      })
      .catch(mostrarIndisponivel);
  }

  function mostrarIndisponivel() {
    $("cdLoading").hidden = true;
    $("cdIndisponivel").hidden = false;
  }

  function montar() {
    $("cdLoading").hidden = true;
    $("cdMain").hidden = false;
    document.title = "Cardápio · " + (DADOS.restaurante.nome || "");
    $("cdNome").textContent = DADOS.restaurante.nome || "Cardápio";
    var st = $("cdStatus");
    st.textContent = DADOS.aberto ? "Aberto" : "Fechado";
    st.className = "cd-status " + (DADOS.aberto ? "aberto" : "fechado");

    catAtiva = null; // abre na aba "Todos"
    renderCategorias();
    renderItens();
    atualizarBadge();
    ligarEventos();
  }

  // ---------- Cardápio ----------
  function renderCategorias() {
    var cats = DADOS.cardapio.categorias || [];
    var nav = $("cdCats");
    nav.innerHTML = "";
    if (!cats.length) { nav.hidden = true; return; }
    nav.hidden = false;
    // Aba "Todos" (catAtiva === null): lista todas as categorias de uma vez.
    var todos = document.createElement("button");
    todos.type = "button";
    todos.className = "cd-chip" + (catAtiva === null && !busca ? " ativo" : "");
    todos.textContent = "Todos";
    todos.addEventListener("click", function () { catAtiva = null; busca = ""; $("cdBusca").value = ""; renderCategorias(); renderItens(); });
    nav.appendChild(todos);
    cats.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cd-chip" + (c.nome === catAtiva && !busca ? " ativo" : "");
      b.textContent = c.nome;
      b.addEventListener("click", function () { catAtiva = c.nome; busca = ""; $("cdBusca").value = ""; renderCategorias(); renderItens(); });
      nav.appendChild(b);
    });
  }

  function itensVisiveis() {
    var cats = DADOS.cardapio.categorias || [];
    if (busca) {
      var q = busca.toLowerCase();
      var achados = [];
      cats.forEach(function (c) {
        c.itens.forEach(function (it) {
          if ((it.nome || "").toLowerCase().indexOf(q) !== -1 || (it.desc || "").toLowerCase().indexOf(q) !== -1) {
            achados.push(it);
          }
        });
      });
      return [{ nome: null, itens: achados }];
    }
    if (catAtiva === null) {
      // aba "Todos": seção "Destaques" no topo + todas as categorias empilhadas.
      var destaques = [];
      // clona o item + anexa a categoria (rótulo do card lateral), sem mutar o original
      cats.forEach(function (c) { c.itens.forEach(function (it) { if (it.destaque) destaques.push(Object.assign({}, it, { _cat: c.nome })); }); });
      var grupos = cats.slice();
      if (destaques.length) grupos.unshift({ nome: "Destaques", itens: destaques, hero: true });
      return grupos;
    }
    var cat = cats.filter(function (c) { return c.nome === catAtiva; })[0] || cats[0];
    return cat ? [cat] : [];
  }

  function renderItens() {
    var grid = $("cdGrid");
    grid.innerHTML = "";
    var grupos = itensVisiveis();
    var qtd = grupos.reduce(function (s, g) { return s + g.itens.length; }, 0);
    $("cdVazio").hidden = qtd > 0;
    grid.classList.toggle("cd-anim", !busca); // cascata só fora da busca
    var idx = 0;
    grupos.forEach(function (g) {
      if (g.hero) { renderDestaques(g.itens); return; } // vitrine especial dos destaques
      if (g.nome) {
        var h = document.createElement("div");
        h.className = "cd-cat-titulo";
        h.textContent = g.nome;
        grid.appendChild(h);
      }
      g.itens.forEach(function (it) {
        var c = cardItem(it);
        if (!busca) c.style.animationDelay = (Math.min(idx, 16) * 0.035).toFixed(3) + "s";
        grid.appendChild(c);
        idx++;
      });
    });
  }

  // Vitrine de Destaques: 1 card hero grande + até 2 cards laterais.
  function renderDestaques(items) {
    var wrap = document.createElement("div");
    wrap.className = "cd-destaques-wrap";
    var h = document.createElement("h2");
    h.className = "cd-destaques-titulo";
    h.textContent = "Destaques";
    wrap.appendChild(h);
    var row = document.createElement("div");
    row.className = "cd-destaques";
    row.appendChild(heroCard(items[0]));
    var side = items.slice(1, 3);
    if (side.length) {
      var col = document.createElement("div");
      col.className = "cd-destaques-side";
      side.forEach(function (it) { col.appendChild(featCard(it)); });
      row.appendChild(col);
    }
    wrap.appendChild(row);
    $("cdGrid").appendChild(wrap);
  }

  // Card hero: imagem grande de fundo + nome/descrição/preço sobre a imagem.
  function heroCard(it) {
    var kg = it.unidade === "kg";
    var naoAdd = it.esgotado || kg;
    var el = document.createElement(naoAdd ? "div" : "button");
    if (!naoAdd) el.type = "button";
    el.className = "cd-hero" + (it.esgotado ? " cd-card-esgotado" : "");
    var bg = it.imagem
      ? '<img class="cd-hero-img" src="' + esc(it.imagem) + '" alt="" />'
      : '<div class="cd-hero-img vazia" aria-hidden="true">' + ICON_SEM_FOTO + "</div>";
    var selo = it.esgotado
      ? '<span class="cd-card-selo esgotado">Esgotado</span>'
      : '<span class="cd-card-selo destaque">' + ICON_ESTRELA + " Destaque</span>";
    el.innerHTML =
      bg +
      '<div class="cd-hero-grad"></div>' +
      '<div class="cd-hero-corpo">' +
        '<div class="cd-hero-selos">' + selo + (it.apenasLocal ? '<span class="cd-card-selo local">Só no local</span>' : "") + "</div>" +
        '<h3 class="cd-hero-nome">' + esc(it.nome) + "</h3>" +
        (it.desc ? '<p class="cd-hero-desc">' + esc(it.desc) + "</p>" : "") +
        '<div class="cd-hero-rodape">' +
          '<span class="cd-hero-preco">' + money(it.preco) + (kg ? "/kg" : "") + "</span>" +
          (naoAdd ? "" : '<span class="cd-add cd-hero-add">+ Adicionar</span>') +
        "</div>" +
      "</div>";
    if (!naoAdd) el.addEventListener("click", function () { abrirModal(it); });
    return el;
  }

  // Card lateral da vitrine: imagem no topo + categoria/nome/descrição/preço + botão "+".
  function featCard(it) {
    var kg = it.unidade === "kg";
    var naoAdd = it.esgotado || kg;
    var el = document.createElement(naoAdd ? "div" : "button");
    if (!naoAdd) el.type = "button";
    el.className = "cd-feat" + (it.esgotado ? " cd-card-esgotado" : "");
    var selos = "";
    if (it.esgotado) selos += '<span class="cd-card-selo esgotado">Esgotado</span>';
    if (it.apenasLocal) selos += '<span class="cd-card-selo local">Só no local</span>';
    if (kg && !it.esgotado) selos += '<span class="cd-card-selo balcao">Pesado no balcão</span>';
    var selosHtml = selos ? '<div class="cd-card-selos">' + selos + "</div>" : "";
    var media = it.imagem
      ? '<div class="cd-feat-media"><img src="' + esc(it.imagem) + '" alt="" loading="lazy" />' + selosHtml + "</div>"
      : '<div class="cd-feat-media vazia" aria-hidden="true">' + ICON_SEM_FOTO + selosHtml + "</div>";
    el.innerHTML =
      media +
      '<div class="cd-feat-corpo">' +
        (it._cat ? '<span class="cd-feat-eyebrow">' + esc(it._cat) + "</span>" : "") +
        '<h3 class="cd-feat-nome">' + esc(it.nome) + "</h3>" +
        (it.desc ? '<p class="cd-feat-desc">' + esc(it.desc) + "</p>" : "") +
        '<div class="cd-feat-rodape">' +
          '<span class="cd-card-preco">' + money(it.preco) + (kg ? "/kg" : "") + "</span>" +
          (naoAdd ? "" : '<span class="cd-feat-add" aria-hidden="true">+</span>') +
        "</div>" +
      "</div>";
    if (!naoAdd) el.addEventListener("click", function () { abrirModal(it); });
    return el;
  }

  // ícone (sem foto) — placeholder dentro da mídia do card
  var ICON_SEM_FOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
  var ICON_ESTRELA = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  function cardItem(it) {
    var kg = it.unidade === "kg";
    var naoAdd = it.esgotado || kg;
    var card = document.createElement(naoAdd ? "div" : "button");
    if (!naoAdd) card.type = "button";
    card.className = "cd-card" + (it.esgotado ? " cd-card-esgotado" : "") + (kg && !it.esgotado ? " cd-card-kg" : "");
    // selos flutuantes sobre a imagem (empilham no canto superior esquerdo)
    var selos = "";
    if (it.esgotado) selos += '<span class="cd-card-selo esgotado">Esgotado</span>';
    if (it.destaque && !it.esgotado) selos += '<span class="cd-card-selo destaque">' + ICON_ESTRELA + " Destaque</span>";
    if (it.apenasLocal) selos += '<span class="cd-card-selo local">Só no local</span>';
    if (kg && !it.esgotado) selos += '<span class="cd-card-selo balcao">Pesado no balcão</span>';
    var selosHtml = selos ? '<div class="cd-card-selos">' + selos + "</div>" : "";
    var media = it.imagem
      ? '<div class="cd-card-media"><img src="' + esc(it.imagem) + '" alt="" loading="lazy" />' + selosHtml + "</div>"
      : '<div class="cd-card-media vazia" aria-hidden="true">' + ICON_SEM_FOTO + selosHtml + "</div>";
    card.innerHTML =
      media +
      '<div class="cd-card-corpo">' +
        '<h3 class="cd-card-nome">' + esc(it.nome) + "</h3>" +
        (it.desc ? '<p class="cd-card-desc">' + esc(it.desc) + "</p>" : "") +
        '<div class="cd-card-rodape">' +
          '<span class="cd-card-preco">' + money(it.preco) + (kg ? "/kg" : "") + "</span>" +
          (naoAdd ? "" : '<span class="cd-add">+ Adicionar</span>') +
        "</div>" +
      "</div>";
    if (!naoAdd) card.addEventListener("click", function () { abrirModal(it); });
    return card;
  }

  // ---------- Modal de item ----------
  var modalItem = null, modalQtd = 1, modalOps = []; // modalOps[i] = quantidade do adicional i

  function abrirModal(it) {
    var ops = it.opcionais || [];
    modalItem = it; modalQtd = 1; modalOps = ops.map(function () { return 0; });
    var html =
      '<button class="cd-x" type="button" data-close="modal" aria-label="Fechar">×</button>' +
      (it.imagem ? '<img class="cd-modal-img" src="' + esc(it.imagem) + '" alt="" />' : "") +
      "<h2>" + esc(it.nome) + "</h2>" +
      (it.desc ? '<p class="cd-modal-desc">' + esc(it.desc) + "</p>" : "") +
      (it.composicao ? '<div class="cd-modal-comp">' + esc(formatComp(it.composicao)) + "</div>" : "");
    if (ops.length) {
      html += '<div class="cd-modal-ops"><p class="cd-ops-titulo">Adicionais</p>';
      ops.forEach(function (o, i) {
        html +=
          '<div class="cd-op">' +
            '<span class="cd-op-nome">' + esc(o.nome) + "</span>" +
            (o.preco ? '<span class="cd-op-preco">+ ' + money(o.preco) + "</span>" : "") +
            '<div class="cd-op-qtd">' +
              '<button type="button" data-opdec="' + i + '" aria-label="Menos">−</button>' +
              '<span data-opqtd="' + i + '">0</span>' +
              '<button type="button" data-opinc="' + i + '" aria-label="Mais">+</button>' +
            "</div>" +
          "</div>";
      });
      html += "</div>";
    }
    html +=
      '<label class="cd-campo"><span>Observação (opcional)</span>' +
        '<textarea id="cdModalObs" rows="2" maxlength="200" placeholder="Ex.: sem cebola, ponto da carne…"></textarea></label>' +
      '<div class="cd-modal-rodape">' +
        '<div class="cd-qtd"><button type="button" data-qtd="-1" aria-label="Menos">−</button>' +
        '<span id="cdModalQtd">1</span>' +
        '<button type="button" data-qtd="1" aria-label="Mais">+</button></div>' +
        '<button id="cdModalAdd" class="cd-btn cd-btn-primary" type="button"></button>' +
      "</div>";

    var caixa = $("cdModalCaixa");
    caixa.innerHTML = html;
    caixa.scrollTop = 0;
    caixa.querySelectorAll("[data-opinc]").forEach(function (b) { b.addEventListener("click", function () { mudarOp(+b.getAttribute("data-opinc"), 1); }); });
    caixa.querySelectorAll("[data-opdec]").forEach(function (b) { b.addEventListener("click", function () { mudarOp(+b.getAttribute("data-opdec"), -1); }); });
    caixa.querySelectorAll("[data-qtd]").forEach(function (b) {
      b.addEventListener("click", function () {
        modalQtd = Math.max(1, Math.min(50, modalQtd + (+b.getAttribute("data-qtd"))));
        $("cdModalQtd").textContent = modalQtd;
        atualizarPrecoModal();
      });
    });
    $("cdModalAdd").addEventListener("click", confirmarModal);
    atualizarPrecoModal();
    $("cdModal").hidden = false;
  }

  function mudarOp(i, delta) {
    modalOps[i] = Math.max(0, Math.min(10, (modalOps[i] || 0) + delta));
    var span = $("cdModalCaixa").querySelector('[data-opqtd="' + i + '"]');
    if (span) span.textContent = modalOps[i];
    atualizarPrecoModal();
  }

  function atualizarPrecoModal() {
    if (!modalItem) return;
    var ops = modalItem.opcionais || [];
    var add = ops.reduce(function (s, o, i) { return s + (Number(o.preco) || 0) * (modalOps[i] || 0); }, 0);
    $("cdModalAdd").textContent = "Adicionar · " + money(((Number(modalItem.preco) || 0) + add) * modalQtd);
  }

  function confirmarModal() {
    var ops = modalItem.opcionais || [];
    var escolhidos = [];
    ops.forEach(function (o, i) {
      if (modalOps[i] > 0) escolhidos.push({ nome: o.nome, preco: Number(o.preco) || 0, qtd: modalOps[i] });
    });
    addLinha({
      id: modalItem.id,
      nome: modalItem.nome,
      preco: Number(modalItem.preco) || 0,
      opcionais: escolhidos,
      observacao: ($("cdModalObs").value || "").trim(),
      qtd: modalQtd,
    });
    fechar("modal");
  }

  function formatComp(texto) {
    return String(texto || "").split("\n").map(function (l) {
      l = l.trim();
      if (!l) return "";
      if (l.slice(-1) === ":") return l.slice(0, -1);
      return "• " + l.replace(/^[*\-•]\s*/, "");
    }).filter(Boolean).join("\n");
  }

  // ---------- Carrinho (badge + sheet) ----------
  function atualizarBadge() {
    var n = totalItens();
    var c = $("cdCartCount");
    c.textContent = n;
    c.hidden = n === 0;
  }

  function abrirSheet() { renderSheet(); $("cdSheet").hidden = false; }

  function renderSheet() {
    var cont = $("cdSheetItens");
    cont.innerHTML = "";
    if (!carrinho.length) {
      cont.innerHTML = '<div class="cd-sheet-vazio">Seu carrinho está vazio.<br>Adicione itens do cardápio.</div>';
      $("cdSheetRodape").hidden = true;
      return;
    }
    carrinho.forEach(function (l, idx) {
      var div = document.createElement("div");
      div.className = "cd-linha";
      var ops = (l.opcionais || []).length ? '<p class="cd-linha-ops">' + esc(l.opcionais.map(opTxt).join(", ")) + "</p>" : "";
      var obs = l.observacao ? '<p class="cd-linha-obs">📝 ' + esc(l.observacao) + "</p>" : "";
      div.innerHTML =
        '<div class="cd-linha-corpo">' +
          '<p class="cd-linha-nome">' + esc(l.nome) + "</p>" + ops + obs +
          '<div class="cd-qtd" style="margin-top:8px">' +
            '<button type="button" data-dec="' + idx + '" aria-label="Menos">−</button>' +
            "<span>" + l.qtd + "</span>" +
            '<button type="button" data-inc="' + idx + '" aria-label="Mais">+</button>' +
          "</div>" +
        "</div>" +
        '<div class="cd-linha-dir">' +
          '<button class="cd-lixo" type="button" data-rm="' + idx + '" aria-label="Remover">🗑</button>' +
          '<span class="cd-linha-preco">' + money(precoLinha(l)) + "</span>" +
        "</div>";
      cont.appendChild(div);
    });
    cont.querySelectorAll("[data-inc]").forEach(function (b) { b.addEventListener("click", function () { mudarQtd(+b.getAttribute("data-inc"), 1); }); });
    cont.querySelectorAll("[data-dec]").forEach(function (b) { b.addEventListener("click", function () { mudarQtd(+b.getAttribute("data-dec"), -1); }); });
    cont.querySelectorAll("[data-rm]").forEach(function (b) { b.addEventListener("click", function () { carrinho.splice(+b.getAttribute("data-rm"), 1); salvarCarrinho(); atualizarBadge(); renderSheet(); }); });
    $("cdSheetRodape").hidden = false;
    $("cdSheetTotal").textContent = money(subtotal());
  }

  function mudarQtd(idx, delta) {
    var l = carrinho[idx];
    if (!l) return;
    l.qtd += delta;
    if (l.qtd <= 0) carrinho.splice(idx, 1);
    salvarCarrinho();
    atualizarBadge();
    renderSheet();
  }

  // ---------- Views ----------
  function mostrarView(nome) {
    $("cdViewCardapio").hidden = nome !== "cardapio";
    $("cdViewCheckout").hidden = nome !== "checkout";
    $("cdViewSucesso").hidden = nome !== "sucesso";
    window.scrollTo(0, 0);
  }

  // ---------- Checkout ----------
  var tipoEntrega = "Entrega";
  var pagamentoSel = "";
  var freteRaio = null; // resultado do POST .../frete no modo raio: {entrega_disponivel, distancia_km, valor_frete, foraDaArea}

  function irCheckout() {
    if (!carrinho.length) { abrirSheet(); return; }
    fechar("sheet");
    tipoEntrega = "Entrega";
    pagamentoSel = (DADOS.pagamentos || [])[0] || "";
    renderCheckout();
    mostrarView("checkout");
  }

  function temEntrega() { return tipoEntrega === "Entrega"; }
  function modoRaio() { return !!(DADOS.frete && DADOS.frete.modo === "raio"); }
  function taxa() {
    if (!temEntrega()) return 0;
    if (modoRaio()) return (freteRaio && freteRaio.entrega_disponivel) ? (Number(freteRaio.valor_frete) || 0) : 0;
    var ff = DADOS.frete ? DADOS.frete.taxaFixa : undefined;
    return Number(ff != null ? ff : DADOS.taxaEntrega) || 0;
  }
  function totalPedido() { return subtotal() + taxa(); }
  function pagDinheiro() { return /dinheiro/i.test(pagamentoSel || ""); }

  function renderCheckout() {
    var pags = DADOS.pagamentos || [];
    var v = $("cdViewCheckout");
    var resumo = carrinho.map(function (l) {
      var sub = "";
      if ((l.opcionais || []).length) {
        sub += '<div class="cd-resumo-add-titulo">Adicionais</div>';
        sub += l.opcionais.map(function (o) { return '<div class="cd-resumo-add">- ' + esc(opTxt(o)) + "</div>"; }).join("");
      }
      if (l.observacao) sub += '<div class="cd-resumo-obs">📝 ' + esc(l.observacao) + "</div>";
      return '<div class="cd-resumo-linha">' +
        '<div class="cd-resumo-esq"><div><span class="q">' + l.qtd + "x</span> " + esc(l.nome) + "</div>" + sub + "</div>" +
        '<span class="cd-resumo-preco">' + money(precoLinha(l)) + "</span>" +
      "</div>";
    }).join("");

    var soLocal = carrinhoTemSoLocal();
    if (soLocal) tipoEntrega = "Retirada"; // item só-local força Retirada

    v.innerHTML =
      '<button id="cdVoltar" class="cd-voltar" type="button">← Voltar ao cardápio</button>' +
      '<h1 class="cd-title">Finalizar pedido</h1>' +
      '<p class="cd-sub">Confirme seus dados — o pedido vai pro WhatsApp do restaurante.</p>' +
      (DADOS.aberto ? "" : '<div class="cd-aviso-fechado" style="margin-bottom:14px">⚠ O restaurante está <strong>fechado</strong> agora — não é possível enviar o pedido.</div>') +
      '<div class="cd-resumo"><h2>Resumo</h2>' + resumo +
        '<div class="cd-resumo-tax" id="cdLinhaTaxa"></div>' +
        '<div class="cd-resumo-tot"><span>Total</span><span id="cdResumoTotal"></span></div>' +
      "</div>" +
      '<form id="cdForm" class="cd-form" novalidate>' +
        '<div class="cd-tipo">' +
          '<button type="button" data-tipo="Entrega"' + (soLocal ? ' class="cd-tipo-off" disabled' : (tipoEntrega === "Entrega" ? ' class="ativo"' : "")) + ">Entrega</button>" +
          '<button type="button" data-tipo="Retirada"' + (tipoEntrega === "Retirada" ? ' class="ativo"' : "") + ">Retirada</button>" +
        "</div>" +
        (soLocal ? '<p class="cd-tipo-nota">Seu carrinho tem itens vendidos só no local — disponível apenas para <strong>Retirada</strong>.</p>' : "") +
        '<label class="cd-campo"><span>Nome</span><input id="cdNomeCli" type="text" placeholder="Seu nome" autocomplete="name" /><p class="cd-erro-campo" id="cdErrNome" hidden></p></label>' +
        '<label class="cd-campo"><span>Telefone (WhatsApp)</span><input id="cdTel" type="tel" inputmode="tel" placeholder="(11) 99999-9999" autocomplete="tel" /><p class="cd-erro-campo" id="cdErrTel" hidden></p></label>' +
        '<div id="cdBlocoEndereco"></div>' +
        '<div class="cd-campo"><span>Forma de pagamento</span><div class="cd-pags" id="cdPags">' +
          pags.map(function (p) { return '<label class="cd-pag' + (p === pagamentoSel ? " ativo" : "") + '"><input type="radio" name="pag" value="' + esc(p) + '"' + (p === pagamentoSel ? " checked" : "") + " />" + esc(p) + "</label>"; }).join("") +
        "</div></div>" +
        '<div id="cdBlocoTroco"></div>' +
        '<label class="cd-campo"><span>Observação do pedido (opcional)</span><textarea id="cdObsPedido" rows="2" maxlength="300" placeholder="Algo sobre o pedido todo?"></textarea></label>' +
        '<p class="cd-erro-campo" id="cdErrGeral" hidden></p>' +
        '<button id="cdEnviar" class="cd-btn cd-btn-primary" type="submit"' + (DADOS.aberto ? "" : " disabled") + ">Enviar pedido</button>" +
      "</form>";

    // listeners
    $("cdVoltar").addEventListener("click", function () { mostrarView("cardapio"); });
    v.querySelectorAll("[data-tipo]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.disabled) return; // Entrega bloqueada por item só-local
        tipoEntrega = b.getAttribute("data-tipo");
        v.querySelectorAll("[data-tipo]").forEach(function (x) { x.classList.toggle("ativo", x === b); });
        renderEndereco();
        atualizarTotais();
      });
    });
    $("cdTel").addEventListener("input", function (e) { e.target.value = maskTel(e.target.value); });
    $("cdPags").addEventListener("change", function (e) {
      if (e.target.name === "pag") {
        pagamentoSel = e.target.value;
        v.querySelectorAll(".cd-pag").forEach(function (l) { l.classList.toggle("ativo", l.contains(e.target) && e.target.checked); });
        renderTroco();
      }
    });
    $("cdForm").addEventListener("submit", function (e) { e.preventDefault(); enviarPedido(); });

    renderEndereco();
    renderTroco();
    atualizarTotais();
  }

  function renderEndereco() {
    var bloco = $("cdBlocoEndereco");
    if (!temEntrega()) {
      var end = DADOS.restaurante.endereco;
      bloco.innerHTML = '<div class="cd-retirada-info"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> Retirada no local' + (end ? ": <strong>" + esc(end) + "</strong>" : "") + "</div>";
      return;
    }
    bloco.innerHTML =
      '<div class="cd-campo"><span>Endereço de entrega</span>' +
      '<div class="cd-endereco">' +
        '<input id="cdCep" class="full" inputmode="numeric" maxlength="9" placeholder="CEP" autocomplete="postal-code" />' +
        '<input id="cdLogradouro" class="full" placeholder="Rua / Avenida" autocomplete="address-line1" />' +
        '<input id="cdNumero" placeholder="Número" />' +
        '<input id="cdBairro" placeholder="Bairro" />' +
        '<input id="cdCidade" placeholder="Cidade" />' +
        '<input id="cdUf" maxlength="2" placeholder="UF" />' +
        '<input id="cdCompl" class="full" placeholder="Complemento (opcional)" />' +
      "</div>" +
      '<p class="cd-hint" id="cdCepHint">Digite o CEP para preencher automaticamente.</p>' +
      (modoRaio() ? '<div class="cd-frete-status" id="cdFreteStatus"></div>' : "") +
      '<p class="cd-erro-campo" id="cdErrEnd" hidden></p></div>';
    if (window.EnderecoCep) {
      window.EnderecoCep.ligarBuscaCep({ cep: "cdCep", hint: "cdCepHint", hintClass: "cd-hint", logradouro: "cdLogradouro", numero: "cdNumero", bairro: "cdBairro", cidade: "cdCidade", uf: "cdUf" });
    }
    // Frete por raio: recalcula ao completar CEP + número.
    if (modoRaio()) {
      freteRaio = null;
      var recalcFrete = function () { calcularFreteRaioFront(); };
      $("cdNumero").addEventListener("blur", recalcFrete);
      $("cdNumero").addEventListener("change", recalcFrete);
      $("cdCep").addEventListener("blur", function () { if (($("cdNumero").value || "").trim()) recalcFrete(); });
    }
  }

  // Modo raio: chama o backend (CEP+número) pra calcular o frete e atualiza o status/total.
  function calcularFreteRaioFront() {
    var st = $("cdFreteStatus");
    if (!st) return;
    var cep = ($("cdCep").value || "").replace(/\D/g, "");
    var num = ($("cdNumero").value || "").trim();
    if (cep.length !== 8 || !num) { freteRaio = null; st.innerHTML = ""; atualizarTotais(); return; }
    st.innerHTML = '<span class="cd-frete-calc">Calculando frete…</span>';
    fetch("/api/c/" + encodeURIComponent(SLUG) + "/frete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cep: cep, numero: num, complemento: ($("cdCompl").value || "").trim() }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) { freteRaio = j; renderFreteStatus(j); atualizarTotais(); })
      .catch(function () { freteRaio = null; st.innerHTML = '<span class="cd-frete-erro">Não foi possível calcular o frete. Tente de novo.</span>'; atualizarTotais(); });
  }

  function renderFreteStatus(j) {
    var st = $("cdFreteStatus");
    if (!st) return;
    if (j && j.entrega_disponivel) {
      var km = j.distancia_km != null ? String(j.distancia_km).replace(".", ",") : "?";
      st.innerHTML = '<span class="cd-frete-ok">✓ Entrega disponível · ~' + km + " km · Frete " + money(Number(j.valor_frete) || 0) + "</span>";
      return;
    }
    var msg = (j && j.mensagem) || "Endereço fora da área de entrega.";
    var extra = (j && j.foraDaArea === "retirada") ? ' <button type="button" class="cd-frete-retirar" id="cdBtnRetirar">Mudar para retirada</button>' : "";
    st.innerHTML = '<span class="cd-frete-fora">⚠ ' + esc(msg) + "</span>" + extra;
    var br = $("cdBtnRetirar");
    if (br) br.addEventListener("click", function () {
      tipoEntrega = "Retirada";
      var v = $("cdViewCheckout");
      v.querySelectorAll("[data-tipo]").forEach(function (x) { x.classList.toggle("ativo", x.getAttribute("data-tipo") === "Retirada"); });
      renderEndereco();
      atualizarTotais();
    });
  }

  function renderTroco() {
    var bloco = $("cdBlocoTroco");
    if (!pagDinheiro()) { bloco.innerHTML = ""; return; }
    bloco.innerHTML = '<label class="cd-campo"><span>Troco para (opcional)</span><input id="cdTroco" inputmode="numeric" placeholder="0,00" /></label>';
    if (window.Dinheiro) window.Dinheiro.mascarar("cdTroco");
  }

  function atualizarTotais() {
    var lt = $("cdLinhaTaxa");
    if (lt) lt.innerHTML = temEntrega() && taxa() > 0 ? "<span>Taxa de entrega</span><span>" + money(taxa()) + "</span>" : "";
    var rt = $("cdResumoTotal");
    if (rt) rt.textContent = money(totalPedido());
  }

  function maskTel(raw) {
    var d = String(raw || "").replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  function erro(id, msg) {
    var e = $(id);
    if (e) { e.textContent = msg; e.hidden = !msg; }
  }

  function enviarPedido() {
    if (!DADOS.aberto) return;
    erro("cdErrNome", ""); erro("cdErrTel", ""); erro("cdErrEnd", ""); erro("cdErrGeral", "");
    var nome = ($("cdNomeCli").value || "").trim();
    var tel = ($("cdTel").value || "").replace(/\D/g, "");
    var ok = true;
    if (nome.length < 2) { erro("cdErrNome", "Informe seu nome."); ok = false; }
    if (tel.length < 10) { erro("cdErrTel", "Telefone inválido."); ok = false; }

    var endereco = "";
    var enderecoCampos = null;
    if (temEntrega()) {
      var logr = ($("cdLogradouro").value || "").trim();
      var num = ($("cdNumero").value || "").trim();
      var cidade = ($("cdCidade").value || "").trim();
      if (!logr || !num || !cidade) { erro("cdErrEnd", "Preencha rua, número e cidade."); ok = false; }
      enderecoCampos = {
        cep: ($("cdCep").value || "").trim(), logradouro: logr, numero: num,
        complemento: ($("cdCompl").value || "").trim(), bairro: ($("cdBairro").value || "").trim(),
        cidade: cidade, uf: ($("cdUf").value || "").trim(),
      };
      endereco = window.EnderecoCep ? window.EnderecoCep.comporEndereco(enderecoCampos) : logr + ", " + num;
      // Frete por raio: exige cálculo OK (dentro da área) antes de enviar.
      if (ok && modoRaio() && (!freteRaio || !freteRaio.entrega_disponivel)) {
        erro("cdErrEnd", "Confirme o CEP e o número para calcular o frete — ou o endereço está fora da área de entrega.");
        ok = false;
      }
    }
    if (!pagamentoSel) { erro("cdErrGeral", "Escolha a forma de pagamento."); ok = false; }
    if (!ok) return;

    var troco = null;
    if (pagDinheiro() && $("cdTroco") && window.Dinheiro) {
      var t = window.Dinheiro.valor("cdTroco");
      troco = t > 0 ? t : null;
    }

    var payload = {
      token: TOKEN,
      cliente: nome,
      telefone: tel,
      tipoEntrega: tipoEntrega,
      endereco: endereco,
      enderecoCampos: enderecoCampos,
      pagamento: pagamentoSel,
      troco: troco,
      observacao: ($("cdObsPedido").value || "").trim(),
      itens: carrinho.map(function (l) {
        return { id: l.id, qtd: l.qtd, opcionais: (l.opcionais || []).map(function (o) { return { nome: o.nome, qtd: o.qtd || 1 }; }), observacao: l.observacao || "" };
      }),
    };

    var btn = $("cdEnviar");
    btn.disabled = true; btn.textContent = "Enviando…";
    fetch("/api/c/" + encodeURIComponent(SLUG) + "/pedido", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j && res.j.erro ? res.j.erro : "Falha ao enviar o pedido.");
        carrinho = []; salvarCarrinho(); atualizarBadge();
        var num = res.j && res.j.numero;
        $("cdSucessoMsg").textContent = num
          ? "Pedido #" + num + " recebido! O restaurante já foi avisado e vai confirmar pelo WhatsApp."
          : "Recebemos seu pedido! O restaurante vai confirmar pelo WhatsApp.";
        mostrarView("sucesso");
      })
      .catch(function (e) {
        erro("cdErrGeral", e.message || "Não foi possível enviar. Tente novamente.");
        btn.disabled = false; btn.textContent = "Enviar pedido";
      });
  }

  // ---------- Eventos globais ----------
  function fechar(qual) { $(qual === "modal" ? "cdModal" : "cdSheet").hidden = true; }

  function ligarEventos() {
    $("cdCartBtn").addEventListener("click", abrirSheet);
    $("cdIrCheckout").addEventListener("click", irCheckout);
    $("cdNovoPedido").addEventListener("click", function () { mostrarView("cardapio"); });
    $("cdBusca").addEventListener("input", function (e) { busca = (e.target.value || "").trim(); renderCategorias(); renderItens(); });
    document.querySelectorAll("[data-close]").forEach(function (el) {
      el.addEventListener("click", function () { fechar(el.getAttribute("data-close")); });
    });
    // delegação p/ overlays/botões criados dentro do modal
    $("cdModal").addEventListener("click", function (e) {
      var alvo = e.target.closest ? e.target.closest("[data-close]") : null;
      if (alvo) fechar("modal");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { fechar("modal"); fechar("sheet"); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
