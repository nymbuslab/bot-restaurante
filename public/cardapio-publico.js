// ============================================================
// CARDÁPIO DIGITAL PÚBLICO — vitrine (somente leitura) por slug.
// Sem auth. Lê o slug do path (/c/:slug) e busca em /api/c/:slug.
// CSP estrita: nada inline, todo DOM montado com textContent (anti-XSS).
// ============================================================

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };

  // slug do path: /c/<slug>  → último segmento não-vazio.
  var slug = (location.pathname.split("/").filter(Boolean).pop() || "").trim();

  function moeda(v) {
    var n = Number(v);
    if (!isFinite(n)) return "";
    return "R$ " + n.toFixed(2).replace(".", ",");
  }

  // Mostra um estado textual único (carregando / indisponível / vazio).
  function estado(msg) {
    var el = $("cd-estado");
    el.textContent = msg;
    el.style.display = "";
    $("cd-categorias").innerHTML = "";
  }

  // Composição serializada ("Grupo:\n* item") → linhas legíveis (texto puro).
  function linhasComposicao(texto) {
    return String(texto || "")
      .split("\n")
      .map(function (l) { return l.trim(); })
      .filter(Boolean)
      .map(function (l) { return l.replace(/^\*\s*/, "• ").replace(/:$/, ""); });
  }

  // Opcionais serializados ("nome | preco" por linha) → [{nome, preco}].
  function parseOpcionais(texto) {
    return String(texto || "")
      .split("\n")
      .map(function (l) { return l.trim(); })
      .filter(Boolean)
      .map(function (l) {
        var p = l.split("|");
        return { nome: (p[0] || "").trim(), preco: parseFloat((p[1] || "").replace(",", ".")) || 0 };
      })
      .filter(function (o) { return o.nome; });
  }

  function elItem(item) {
    var card = document.createElement("article");
    card.className = "cd-item";

    if (item.imagem) {
      var img = document.createElement("img");
      img.className = "cd-item-foto";
      img.src = item.imagem;
      img.alt = item.nome || "";
      img.loading = "lazy";
      card.appendChild(img);
    }

    var corpo = document.createElement("div");
    corpo.className = "cd-item-corpo";

    var topo = document.createElement("div");
    topo.className = "cd-item-topo";
    var nome = document.createElement("h3");
    nome.className = "cd-item-nome";
    nome.textContent = item.nome || "";
    var preco = document.createElement("span");
    preco.className = "cd-item-preco";
    preco.textContent = moeda(item.preco);
    topo.appendChild(nome);
    topo.appendChild(preco);
    corpo.appendChild(topo);

    if (item.desc) {
      var d = document.createElement("p");
      d.className = "cd-item-desc";
      d.textContent = item.desc;
      corpo.appendChild(d);
    }

    var comp = linhasComposicao(item.composicao);
    if (comp.length) {
      var ul = document.createElement("ul");
      ul.className = "cd-item-comp";
      comp.forEach(function (l) {
        var li = document.createElement("li");
        li.textContent = l;
        ul.appendChild(li);
      });
      corpo.appendChild(ul);
    }

    var opc = parseOpcionais(item.opcionais);
    if (opc.length) {
      var ad = document.createElement("p");
      ad.className = "cd-item-add";
      ad.textContent = "Adicionais: " + opc.map(function (o) {
        return o.preco ? o.nome + " (+" + moeda(o.preco) + ")" : o.nome;
      }).join(", ");
      corpo.appendChild(ad);
    }

    card.appendChild(corpo);
    return card;
  }

  function render(data) {
    // Cabeçalho
    document.title = (data.restaurante && data.restaurante.nome) ? data.restaurante.nome + " — Cardápio" : "Cardápio";
    $("cd-nome").textContent = (data.restaurante && data.restaurante.nome) || "Cardápio";
    var info = [];
    if (data.restaurante && data.restaurante.endereco) info.push(data.restaurante.endereco);
    if (data.restaurante && data.restaurante.telefone) info.push(data.restaurante.telefone);
    $("cd-info").textContent = info.join(" · ");
    $("cd-fechado").style.display = data.aberto === false ? "" : "none";

    var cats = (data.categorias || []).filter(function (c) { return c.itens && c.itens.length; });
    if (!cats.length) { estado("Cardápio em atualização. Volte em instantes."); return; }

    $("cd-estado").style.display = "none";
    var wrap = $("cd-categorias");
    wrap.innerHTML = "";
    cats.forEach(function (cat) {
      var sec = document.createElement("section");
      sec.className = "cd-cat";
      var h = document.createElement("h2");
      h.className = "cd-cat-nome";
      h.textContent = cat.nome || "";
      sec.appendChild(h);
      var grid = document.createElement("div");
      grid.className = "cd-grid";
      cat.itens.forEach(function (it) { grid.appendChild(elItem(it)); });
      sec.appendChild(grid);
      wrap.appendChild(sec);
    });
  }

  if (!slug) { estado("Cardápio não encontrado."); return; }

  fetch("/api/c/" + encodeURIComponent(slug))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.disponivel) { estado("Cardápio indisponível no momento."); return; }
      render(data);
    })
    .catch(function () { estado("Não foi possível carregar o cardápio."); });
})();
