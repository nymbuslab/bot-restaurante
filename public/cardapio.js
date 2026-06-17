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
    return l.id + "|" + (l.opcionais || []).map(function (o) { return o.nome; }).sort().join(",") + "|" + (l.observacao || "");
  }
  function precoUnit(l) {
    return (Number(l.preco) || 0) + (l.opcionais || []).reduce(function (s, o) { return s + (Number(o.preco) || 0); }, 0);
  }
  function precoLinha(l) { return precoUnit(l) * l.qtd; }
  function subtotal() { return carrinho.reduce(function (s, l) { return s + precoLinha(l); }, 0); }
  function totalItens() { return carrinho.reduce(function (s, l) { return s + l.qtd; }, 0); }

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

    var cats = (DADOS.cardapio.categorias || []);
    catAtiva = cats.length ? cats[0].nome : null;
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
    if (cats.length <= 1) { nav.hidden = true; return; }
    nav.hidden = false;
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
    var cat = cats.filter(function (c) { return c.nome === catAtiva; })[0] || cats[0];
    return cat ? [cat] : [];
  }

  function renderItens() {
    var grid = $("cdGrid");
    grid.innerHTML = "";
    var grupos = itensVisiveis();
    var qtd = grupos.reduce(function (s, g) { return s + g.itens.length; }, 0);
    $("cdVazio").hidden = qtd > 0;
    grupos.forEach(function (g) {
      if (g.nome && grupos.length > 1) {
        var h = document.createElement("div");
        h.className = "cd-cat-titulo";
        h.textContent = g.nome;
        grid.appendChild(h);
      }
      g.itens.forEach(function (it) {
        grid.appendChild(cardItem(it));
      });
    });
  }

  function cardItem(it) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "cd-card";
    var img = it.imagem
      ? '<img class="cd-card-img" src="' + esc(it.imagem) + '" alt="" loading="lazy" />'
      : '<div class="cd-card-img vazia" aria-hidden="true">🍽</div>';
    card.innerHTML =
      img +
      '<div class="cd-card-corpo">' +
        '<h3 class="cd-card-nome">' + esc(it.nome) + "</h3>" +
        (it.desc ? '<p class="cd-card-desc">' + esc(it.desc) + "</p>" : "") +
        '<div class="cd-card-rodape">' +
          '<span class="cd-card-preco">' + money(it.preco) + "</span>" +
          '<span class="cd-add">+ Adicionar</span>' +
        "</div>" +
      "</div>";
    card.addEventListener("click", function () { abrirModal(it); });
    return card;
  }

  // ---------- Modal de item ----------
  var modalItem = null, modalQtd = 1, modalSel = [];

  function abrirModal(it) {
    modalItem = it; modalQtd = 1; modalSel = [];
    var ops = it.opcionais || [];
    var html =
      '<button class="cd-x" type="button" data-close="modal" aria-label="Fechar">×</button>' +
      (it.imagem ? '<img class="cd-modal-img" src="' + esc(it.imagem) + '" alt="" />' : "") +
      "<h2>" + esc(it.nome) + "</h2>" +
      (it.desc ? '<p class="cd-modal-desc">' + esc(it.desc) + "</p>" : "") +
      (it.composicao ? '<div class="cd-modal-comp">' + esc(formatComp(it.composicao)) + "</div>" : "");
    if (ops.length) {
      html += '<div class="cd-modal-ops"><p class="cd-ops-titulo">Opcionais</p>';
      ops.forEach(function (o, i) {
        html +=
          '<label class="cd-op">' +
            '<input type="checkbox" data-op="' + i + '" />' +
            '<span class="cd-op-nome">' + esc(o.nome) + "</span>" +
            (o.preco ? '<span class="cd-op-preco">+ ' + money(o.preco) + "</span>" : "") +
          "</label>";
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
    caixa.querySelectorAll("[data-op]").forEach(function (chk) {
      chk.addEventListener("change", function () {
        var i = +chk.getAttribute("data-op");
        if (chk.checked) modalSel.push(i); else modalSel = modalSel.filter(function (x) { return x !== i; });
        atualizarPrecoModal();
      });
    });
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

  function atualizarPrecoModal() {
    if (!modalItem) return;
    var ops = modalItem.opcionais || [];
    var unit = (Number(modalItem.preco) || 0) + modalSel.reduce(function (s, i) { return s + (Number(ops[i] && ops[i].preco) || 0); }, 0);
    $("cdModalAdd").textContent = "Adicionar · " + money(unit * modalQtd);
  }

  function confirmarModal() {
    var ops = modalItem.opcionais || [];
    addLinha({
      id: modalItem.id,
      nome: modalItem.nome,
      preco: Number(modalItem.preco) || 0,
      opcionais: modalSel.map(function (i) { return { nome: ops[i].nome, preco: Number(ops[i].preco) || 0 }; }),
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
      var ops = (l.opcionais || []).length ? '<p class="cd-linha-ops">' + esc(l.opcionais.map(function (o) { return o.nome; }).join(", ")) + "</p>" : "";
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

  function irCheckout() {
    if (!carrinho.length) { abrirSheet(); return; }
    fechar("sheet");
    tipoEntrega = "Entrega";
    pagamentoSel = (DADOS.pagamentos || [])[0] || "";
    renderCheckout();
    mostrarView("checkout");
  }

  function temEntrega() { return tipoEntrega === "Entrega"; }
  function taxa() { return temEntrega() ? (Number(DADOS.taxaEntrega) || 0) : 0; }
  function totalPedido() { return subtotal() + taxa(); }
  function pagDinheiro() { return /dinheiro/i.test(pagamentoSel || ""); }

  function renderCheckout() {
    var pags = DADOS.pagamentos || [];
    var v = $("cdViewCheckout");
    var resumo = carrinho.map(function (l) {
      var ops = (l.opcionais || []).length ? ' <span style="color:var(--text-secondary)">(' + esc(l.opcionais.map(function (o) { return o.nome; }).join(", ")) + ")</span>" : "";
      return '<div class="cd-resumo-linha"><span><span class="q">' + l.qtd + "x</span> " + esc(l.nome) + ops + '</span><span>' + money(precoLinha(l)) + "</span></div>";
    }).join("");

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
          '<button type="button" data-tipo="Entrega" class="ativo">Entrega</button>' +
          '<button type="button" data-tipo="Retirada">Retirada</button>' +
        "</div>" +
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
      bloco.innerHTML = '<div class="cd-retirada-info">📍 Retirada no local' + (end ? ": <strong>" + esc(end) + "</strong>" : "") + "</div>";
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
      '<p class="cd-erro-campo" id="cdErrEnd" hidden></p></div>';
    if (window.EnderecoCep) {
      window.EnderecoCep.ligarBuscaCep({ cep: "cdCep", hint: "cdCepHint", hintClass: "cd-hint", logradouro: "cdLogradouro", numero: "cdNumero", bairro: "cdBairro", cidade: "cdCidade", uf: "cdUf" });
    }
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
    if (temEntrega()) {
      var logr = ($("cdLogradouro").value || "").trim();
      var num = ($("cdNumero").value || "").trim();
      var cidade = ($("cdCidade").value || "").trim();
      if (!logr || !num || !cidade) { erro("cdErrEnd", "Preencha rua, número e cidade."); ok = false; }
      endereco = window.EnderecoCep ? window.EnderecoCep.comporEndereco({
        logradouro: logr, numero: num, bairro: ($("cdBairro").value || "").trim(),
        complemento: ($("cdCompl").value || "").trim(), cidade: cidade, uf: ($("cdUf").value || "").trim(), cep: ($("cdCep").value || "").trim(),
      }) : logr + ", " + num;
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
      pagamento: pagamentoSel,
      troco: troco,
      observacao: ($("cdObsPedido").value || "").trim(),
      itens: carrinho.map(function (l) {
        return { id: l.id, qtd: l.qtd, opcionais: (l.opcionais || []).map(function (o) { return o.nome; }), observacao: l.observacao || "" };
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
