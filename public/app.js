// ============================================================
// LÓGICA DO PAINEL (front-end)
// ============================================================

const token = sessionStorage.getItem("token");
if (!token) location.href = "login.html";

const cabecalhos = {
  "Content-Type": "application/json",
  Authorization: "Bearer " + token,
};

// Exibe o nome da empresa no header ao carregar a página
const _nomeEmpresa = sessionStorage.getItem("empresaNome");
document.addEventListener("DOMContentLoaded", () => {
  const h = document.getElementById("headerNome");
  if (h && _nomeEmpresa) h.textContent = "🍴 " + _nomeEmpresa;
});

async function api(metodo, url, corpo) {
  const opc = { method: metodo, headers: cabecalhos };
  if (corpo) opc.body = JSON.stringify(corpo);
  const r = await fetch(url, opc);
  if (r.status === 401) {
    sessionStorage.removeItem("token");
    location.href = "login.html";
    return;
  }
  return r;
}

const $ = (id) => document.getElementById(id);
let cardapioAtual = { categorias: [] };
let configAtual = {};

// Estado do editor de item
let editorCi = -1;
let editorIi = -1;
let editorFotoUrl = "";
let editorComposicao = [];
let editorOpcionais = [];

// ============================================================
// TOAST (substitui flash)
// ============================================================
function toast(msg, tipo = "sucesso") {
  const container = $("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add("saindo");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3800);
}

// Mantém compatibilidade com o código que usava flash()
function flash(id, msg) {
  const el = $(id);
  if (el) {
    el.textContent = msg;
    setTimeout(() => { el.textContent = ""; }, 4000);
  }
  toast(msg, "sucesso");
}

// ============================================================
// MODAL DE CONFIRMAÇÃO (substitui window.confirm)
// ============================================================
function confirmar(titulo, mensagem, txtConfirmar = "Confirmar") {
  return new Promise((resolve) => {
    const overlay = $("modal-overlay");
    $("modal-titulo").textContent = titulo;
    $("modal-mensagem").textContent = mensagem;
    $("modal-confirmar").textContent = txtConfirmar;
    overlay.style.display = "flex";
    overlay.classList.remove("saindo");

    function fechar(resultado) {
      overlay.classList.add("saindo");
      overlay.addEventListener("animationend", () => {
        overlay.style.display = "none";
        overlay.classList.remove("saindo");
      }, { once: true });
      $("modal-cancelar").removeEventListener("click", onCancelar);
      $("modal-confirmar").removeEventListener("click", onConfirmar);
      resolve(resultado);
    }

    function onCancelar() { fechar(false); }
    function onConfirmar() { fechar(true); }

    $("modal-cancelar").addEventListener("click", onCancelar);
    $("modal-confirmar").addEventListener("click", onConfirmar);
  });
}

// ============================================================
// BADGE DE ATENDIMENTO (header)
// ============================================================
function atualizarBadgeAtendimento(aberto) {
  const badge = $("badgeAtendimento");
  const texto = $("badgeAtendimentoTexto");
  badge.style.display = "inline-flex";
  badge.className = "badge-atendimento " + (aberto ? "aberto" : "fechado");
  texto.textContent = aberto ? "Aberto" : "Fechado";
}

// ============================================================
// NAVEGAÇÃO POR ABAS
// ============================================================
document.querySelectorAll("nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("nav button").forEach((b) => b.classList.remove("ativo"));
    document.querySelectorAll(".aba").forEach((a) => a.classList.remove("ativa"));
    btn.classList.add("ativo");
    $("aba-" + btn.dataset.aba).classList.add("ativa");
    if (btn.dataset.aba === "pedidos") carregarPedidos();
    if (btn.dataset.aba === "conexao") atualizarStatus();
  });
});

// Um único handler de logout, reaproveitado pelos botões Sair (sidebar + header mobile).
async function sair() {
  try { await api("POST", "/api/logout"); } catch (e) { /* ignora */ }
  sessionStorage.clear();
  location.href = "login.html";
}
document.querySelectorAll(".btn-sair").forEach((b) => b.addEventListener("click", sair));

// ============================================================
// CONEXÃO (status do bot + QR)
// ============================================================
// Formata um número do WhatsApp ("5511987654321") como "(11) 98765-4321".
function formatarNumeroWa(num) {
  let d = String(num || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return num; // formato inesperado — mostra como veio
  const ddd  = d.slice(0, 2);
  const resto = d.slice(2);
  const meio = resto.length > 8 ? resto.slice(0, 5) : resto.slice(0, 4);
  const fim  = resto.length > 8 ? resto.slice(5)    : resto.slice(4);
  return `(${ddd}) ${meio}-${fim}`;
}

// Estado de carregamento (spinner + texto) dentro do painel de conexão.
function painelCarregando(txt) {
  return `<div class="conexao-estado"><div class="qr-spinner"></div><p class="conexao-estado-txt">${txt}</p></div>`;
}

const SVG_CONECTAR = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
const SVG_RESET = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;

async function atualizarStatus() {
  try {
    const r = await api("GET", "/api/status");
    if (!r) return; // 401 → api() já redirecionou para o login
    const s = await r.json();
    const box = $("statusBox");

    if (s.status === "conectado") {
      box.innerHTML = `
        <div class="conexao-estado conectado">
          <div class="conexao-conectado-cabeca">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span class="conexao-conectado-titulo">Conectado</span>
          </div>
          ${s.numero ? `<p class="conexao-numero">Número: <strong>${formatarNumeroWa(s.numero)}</strong></p>` : ""}
          <div class="conexao-acoes">
            <button class="perigo" id="btnDesconectar">Desconectar</button>
            <button class="secundario" id="btnResetarQR">Gerar novo QR</button>
          </div>
        </div>`;
      $("btnDesconectar").addEventListener("click", desconectarBot);
      $("btnResetarQR").addEventListener("click", resetarBot);

    } else if (s.status === "aguardando_qr" && s.qr) {
      box.innerHTML = `
        <div class="conexao-estado">
          <div class="qr-frame"><img src="${s.qr}" alt="QR Code" class="qr-img" /></div>
          <p class="conexao-estado-txt aguardando">Aguardando leitura do QR Code...</p>
          <button class="secundario mini" id="btnResetarQR">${SVG_RESET} Gerar nova sessão</button>
        </div>`;
      $("btnResetarQR").addEventListener("click", resetarBot);

    } else if (s.status === "iniciando") {
      box.innerHTML = `
        <div class="conexao-estado">
          <div class="qr-spinner"></div>
          <p class="conexao-estado-txt">Gerando QR Code...</p>
          <button class="secundario mini" id="btnResetarQR">${SVG_RESET} Gerar nova sessão</button>
        </div>`;
      $("btnResetarQR").addEventListener("click", resetarBot);

    } else {
      box.innerHTML = `
        <div class="conexao-estado">
          <div class="conexao-icone-grande">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="M5.17 11.75l-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="8" x2="5" y2="8"/><line x1="16" y1="19" x2="16" y2="22"/><line x1="19" y1="16" x2="22" y2="16"/></svg>
          </div>
          <button id="btnConectar">${SVG_CONECTAR} Conectar ao WhatsApp</button>
          <button class="link-discreto" id="btnResetarDesligado">Problemas? Limpar sessão e gerar novo QR</button>
        </div>`;
      $("btnConectar").addEventListener("click", conectarBot);
      $("btnResetarDesligado").addEventListener("click", resetarBot);
    }
  } catch (e) {
    $("statusBox").innerHTML = `<div class="conexao-estado"><p class="conexao-estado-txt">Erro ao obter status.</p></div>`;
  }
}

async function conectarBot() {
  $("statusBox").innerHTML = painelCarregando("Iniciando...");
  await api("POST", "/api/bot/conectar");
  setTimeout(atualizarStatus, 1500);
}

async function desconectarBot() {
  const ok = await confirmar(
    "Desconectar o bot?",
    "O atendimento automático será pausado. Você precisará reconectar manualmente.",
    "Desconectar"
  );
  if (!ok) return;
  await api("POST", "/api/bot/desconectar");
  setTimeout(atualizarStatus, 800);
}

async function resetarBot() {
  const ok = await confirmar(
    "Limpar sessão e gerar novo QR?",
    "Você precisará escanear o QR novamente com o celular.",
    "Limpar sessão"
  );
  if (!ok) return;
  $("statusBox").innerHTML = painelCarregando("Limpando sessão...");
  const r = await api("POST", "/api/bot/resetar");
  if (r && !r.ok) {
    const d = await r.json().catch(() => ({}));
    toast(d.erro || "Não foi possível limpar a sessão. Apague a pasta .wwebjs_auth manualmente.", "erro");
  }
  setTimeout(atualizarStatus, 1200);
}

setInterval(() => {
  if ($("aba-conexao").classList.contains("ativa")) atualizarStatus();
}, 4000);

// ============================================================
// CARDÁPIO
// ============================================================
function moeda(v) { return Number(v || 0).toFixed(2); } // ponto — para value de inputs (parseFloat)
function moedaBR(v) { return Number(v || 0).toFixed(2).replace(".", ","); } // vírgula — para exibição pt-BR

function renderCardapioMetricas() {
  const el = $("cardapioMetricas");
  if (!el) return;
  let totalItens = 0, indisp = 0;
  cardapioAtual.categorias.forEach((cat) => {
    totalItens += cat.itens.length;
    cat.itens.forEach((it) => { if (it.disponivel === false) indisp++; });
  });
  const cards = [
    { label: "Total de itens",  valor: totalItens,
      icone: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/></svg>` },
    { label: "Categorias",      valor: cardapioAtual.categorias.length,
      icone: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 19 8.5 16 17 8 17 5 8.5"/></svg>` },
    { label: "Indisponíveis",   valor: indisp,
      icone: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>` },
  ];
  el.innerHTML = cards.map((c) => `
    <div class="metrica-card">
      <div class="metrica-topo">
        <span class="metrica-label">${c.label}</span>
        <span class="metrica-ico">${c.icone}</span>
      </div>
      <div class="metrica-valor">${c.valor}</div>
    </div>
  `).join("");
}

function renderCardapio() {
  renderCardapioMetricas();
  const c = $("cardapioContainer");
  c.innerHTML = "";
  cardapioAtual.categorias.forEach((cat, ci) => {
    const n = cat.itens.length;
    const badge = n === 1 ? "1 item" : `${n} itens`;
    const div = document.createElement("div");
    div.className = "categoria";
    div.innerHTML = `
      <div class="categoria-cabeca">
        <div class="cat-cabeca-esq">
          <svg class="cat-icone" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
          <input value="${escapar(cat.nome)}" data-cat="${ci}" class="catNome" />
          <span class="cat-badge">${badge}</span>
        </div>
        <button class="perigo mini" data-del-cat="${ci}">Excluir</button>
      </div>
      <div class="cards-grid" data-itens="${ci}"></div>
    `;
    c.appendChild(div);
    const grid = div.querySelector(`[data-itens="${ci}"]`);
    cat.itens.forEach((item, ii) => {
      const card = document.createElement("div");
      card.className = "item-card" + (item.disponivel ? "" : " item-indisp");
      const temFoto = item.imagem && item.imagem !== "";
      const dispTxt = item.disponivel ? "Disponível" : "Indisponível";
      card.innerHTML = `
        <div class="item-card-foto">
          ${temFoto
            ? `<img src="${escapar(item.imagem)}" alt="${escapar(item.nome)}" loading="lazy" />`
            : `<div class="item-card-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>`
          }
        </div>
        <div class="item-card-info">
          <div class="item-card-meta">
            <div class="item-card-linha1">
              <span class="item-card-nome">${escapar(item.nome) || "(sem nome)"}</span>
              <span class="item-card-preco">R$ ${moedaBR(item.preco)}</span>
            </div>
            ${item.desc ? `<p class="item-card-desc">${escapar(item.desc)}</p>` : ""}
          </div>
          <div class="item-card-bottom">
            <label class="item-card-disp">
              <span class="toggle"><input type="checkbox" ${item.disponivel ? "checked" : ""} class="itDisp" data-c="${ci}" data-i="${ii}" /></span>
              <span class="item-card-disp-txt">${dispTxt}</span>
            </label>
            <div class="item-card-acoes">
              <button class="mini" data-edit-item="${ci}-${ii}" aria-label="Editar item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="perigo mini" data-del-item="${ci}-${ii}" aria-label="Excluir item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
    const addCard = document.createElement("button");
    addCard.className = "item-card-add";
    addCard.setAttribute("data-add-item", ci);
    addCard.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>Adicionar item</span>
    `;
    grid.appendChild(addCard);
  });
  ligarEventosCardapio();
}

function ligarEventosCardapio() {
  document.querySelectorAll(".catNome").forEach((el) =>
    el.addEventListener("input", (e) => { cardapioAtual.categorias[e.target.dataset.cat].nome = e.target.value; })
  );
  document.querySelectorAll(".itDisp").forEach((el) =>
    el.addEventListener("change", (e) => { item(e).disponivel = e.target.checked; renderCardapio(); })
  );
  document.querySelectorAll("[data-del-cat]").forEach((el) =>
    el.addEventListener("click", async (e) => {
      const ok = await confirmar("Excluir categoria?", "Todos os itens desta categoria serão removidos.", "Excluir");
      if (ok) {
        cardapioAtual.categorias.splice(+e.target.dataset.delCat, 1);
        renderCardapio();
      }
    })
  );
  document.querySelectorAll("[data-del-item]").forEach((el) =>
    el.addEventListener("click", (e) => {
      const [ci, ii] = e.target.dataset.delItem.split("-").map(Number);
      cardapioAtual.categorias[ci].itens.splice(ii, 1);
      renderCardapio();
    })
  );
  document.querySelectorAll("[data-edit-item]").forEach((el) =>
    el.addEventListener("click", (e) => {
      const [ci, ii] = e.target.dataset.editItem.split("-").map(Number);
      abrirEditorItem(ci, ii);
    })
  );
  document.querySelectorAll("[data-add-item]").forEach((el) =>
    el.addEventListener("click", (e) => {
      abrirEditorItem(+e.target.dataset.addItem, -1);
    })
  );
}

function item(e) {
  return cardapioAtual.categorias[+e.target.dataset.c].itens[+e.target.dataset.i];
}

function novoId() {
  let max = 0;
  cardapioAtual.categorias.forEach((c) => c.itens.forEach((i) => { if (i.id > max) max = i.id; }));
  return max + 1;
}

// ============================================================
// EDITOR DE ITEM (modal)
// ============================================================
function abrirEditorItem(ci, ii) {
  editorCi = ci;
  editorIi = ii;

  // Popula select de categorias, pré-selecionando a categoria de origem
  const sel = $("editor-categoria");
  sel.innerHTML = "";
  cardapioAtual.categorias.forEach((cat, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = cat.nome || "(sem nome)";
    if (idx === ci) opt.selected = true;
    sel.appendChild(opt);
  });

  $("editor-titulo").textContent = ii === -1 ? "Novo item" : "Editar item";
  $("editor-erro").textContent = "";

  if (ii === -1) {
    $("editor-nome").value = "";
    $("editor-preco").value = "";
    $("editor-desc").value = "";
    $("editor-disponivel").checked = true;
    editorFotoUrl = "";
    editorComposicao = [];
    editorOpcionais = [];
  } else {
    const it = cardapioAtual.categorias[ci].itens[ii];
    $("editor-nome").value = it.nome || "";
    $("editor-preco").value = moeda(it.preco);
    $("editor-desc").value = it.desc || "";
    $("editor-disponivel").checked = it.disponivel !== false;
    editorFotoUrl = it.imagem || "";
    editorComposicao = parsearComposicao(it.composicao || "");
    editorOpcionais = parsearOpcionais(it.opcionais || "");
  }
  renderEditorComposicao();
  renderEditorOpcionais();

  atualizarPreviewFoto();

  const overlay = $("editor-overlay");
  overlay.style.display = "flex";
  overlay.classList.remove("saindo");
  setTimeout(() => $("editor-nome").focus(), 80);
}

function fecharEditorItem() {
  const overlay = $("editor-overlay");
  overlay.classList.add("saindo");
  overlay.addEventListener("animationend", () => {
    overlay.style.display = "none";
    overlay.classList.remove("saindo");
  }, { once: true });
  $("editor-foto-input").value = "";
}

function atualizarPreviewFoto() {
  const preview     = $("editor-foto-preview");
  const placeholder = $("editor-foto-placeholder");
  const remover     = $("editor-foto-remover");
  const btn         = $("editor-foto-btn");
  if (editorFotoUrl) {
    preview.src           = editorFotoUrl;
    preview.style.display = "block";
    placeholder.style.display = "none";
    remover.style.display = "";
    btn.textContent = "Trocar foto";
  } else {
    preview.src           = "";
    preview.style.display = "none";
    placeholder.style.display = "flex";
    remover.style.display = "none";
    btn.textContent = "Enviar foto";
  }
}

async function salvarEditorItem() {
  const nome  = $("editor-nome").value.trim();
  const preco = parseFloat($("editor-preco").value);

  if (!nome) {
    $("editor-erro").textContent = "Informe o nome do item.";
    $("editor-nome").focus();
    return;
  }
  if (!preco || preco <= 0) {
    $("editor-erro").textContent = "Informe um preço válido maior que zero.";
    $("editor-preco").focus();
    return;
  }

  $("editor-erro").textContent = "";
  const novoCi = +$("editor-categoria").value;

  const novoItem = {
    id:          editorIi === -1 ? novoId() : cardapioAtual.categorias[editorCi].itens[editorIi].id,
    nome,
    preco,
    desc:        $("editor-desc").value,
    disponivel:  $("editor-disponivel").checked,
    composicao:  serializarComposicao(editorComposicao),
    opcionais:   serializarOpcionais(editorOpcionais),
    imagem:      editorFotoUrl,
  };

  if (editorIi === -1) {
    cardapioAtual.categorias[novoCi].itens.push(novoItem);
  } else if (novoCi !== editorCi) {
    cardapioAtual.categorias[editorCi].itens.splice(editorIi, 1);
    cardapioAtual.categorias[novoCi].itens.push(novoItem);
  } else {
    cardapioAtual.categorias[editorCi].itens[editorIi] = novoItem;
  }

  const btn = $("editor-salvar");
  btn.disabled = true;
  btn.textContent = "Salvando...";

  const r = await api("PUT", "/api/cardapio", cardapioAtual);

  btn.disabled = false;
  btn.textContent = "Salvar alterações";

  if (r && r.ok) {
    toast("✓ Item salvo com sucesso!");
    fecharEditorItem();
    renderCardapio();
  } else {
    $("editor-erro").textContent = "Erro ao salvar. Tente novamente.";
  }
}

// Listeners do editor (fixos — não precisam ser re-ligados a cada render)
$("editor-fechar").addEventListener("click", fecharEditorItem);
$("editor-cancelar").addEventListener("click", fecharEditorItem);
$("editor-salvar").addEventListener("click", salvarEditorItem);
$("editor-overlay").addEventListener("click", (e) => {
  if (e.target === $("editor-overlay")) fecharEditorItem();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("editor-overlay").style.display !== "none") fecharEditorItem();
});

$("editor-foto-btn").addEventListener("click", () => $("editor-foto-input").click());

$("editor-foto-remover").addEventListener("click", () => {
  editorFotoUrl = "";
  $("editor-foto-input").value = "";
  atualizarPreviewFoto();
});

$("editor-foto-input").addEventListener("change", async () => {
  const file = $("editor-foto-input").files[0];
  if (!file) return;

  const btn = $("editor-foto-btn");
  btn.disabled = true;
  btn.textContent = "Enviando...";

  try {
    const form = new FormData();
    form.append("imagem", file);
    const r = await fetch("/api/imagem", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form,
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast(d.erro || "Erro ao enviar a imagem.", "erro");
      return;
    }
    const { url } = await r.json();
    editorFotoUrl = url;
    atualizarPreviewFoto();
  } catch {
    toast("Erro de rede ao enviar a imagem.", "erro");
  } finally {
    btn.disabled = false;
    btn.textContent = editorFotoUrl ? "Trocar foto" : "Enviar foto";
    $("editor-foto-input").value = "";
  }
});

$("editor-comp-add-subgrupo").addEventListener("click", () => {
  editorComposicao.push({ nome: "", itens: [] });
  renderEditorComposicao();
});

// ============================================================
// CONSTRUTOR DE COMPOSIÇÃO
// ============================================================
function parsearComposicao(texto) {
  if (!texto || !texto.trim()) return [];
  const grupos = [];
  let grupoAtual = null;
  for (const linha of texto.split("\n")) {
    const l = linha.trim();
    if (!l) continue;
    if (l.endsWith(":")) {
      grupoAtual = { nome: l.slice(0, -1).trim(), itens: [] };
      grupos.push(grupoAtual);
    } else if (l.startsWith("*")) {
      if (!grupoAtual) { grupoAtual = { nome: "", itens: [] }; grupos.push(grupoAtual); }
      grupoAtual.itens.push(l.slice(1).trim());
    }
  }
  return grupos;
}

function serializarComposicao(grupos) {
  const linhas = [];
  for (const g of grupos) {
    if (g.nome.trim()) linhas.push(g.nome.trim() + ":");
    for (const it of g.itens) {
      if (it.trim()) linhas.push("* " + it.trim());
    }
  }
  return linhas.join("\n");
}

function renderEditorComposicao() {
  const container = $("editor-composicao-builder");
  container.innerHTML = "";

  editorComposicao.forEach((sg, si) => {
    const div = document.createElement("div");
    div.className = "comp-subgrupo";

    const chipsHtml = sg.itens.map((it, ii) =>
      `<span class="comp-chip">${escapar(it)}<button type="button" class="comp-chip-del" data-sg="${si}" data-ii="${ii}" aria-label="Remover">×</button></span>`
    ).join("");

    div.innerHTML = `
      <div class="comp-subgrupo-cabeca">
        <input class="comp-sg-nome" value="${escapar(sg.nome)}" placeholder="Nome do subgrupo" data-sg="${si}" />
        <button type="button" class="perigo mini comp-sg-del" data-sg="${si}" aria-label="Remover subgrupo">×</button>
      </div>
      <div class="comp-chips">${chipsHtml}</div>
      <div class="comp-add-ing">
        <input class="comp-ing-input" placeholder="Adicionar ingrediente..." data-sg="${si}" />
        <button type="button" class="secundario mini comp-ing-btn" data-sg="${si}">Adicionar</button>
      </div>
    `;
    container.appendChild(div);
  });

  // Listeners — re-ligados a cada render; sem vazamento pois o innerHTML é substituído
  container.querySelectorAll(".comp-sg-nome").forEach((el) =>
    el.addEventListener("input", (e) => {
      editorComposicao[+e.target.dataset.sg].nome = e.target.value;
    })
  );

  container.querySelectorAll(".comp-sg-del").forEach((el) =>
    el.addEventListener("click", (e) => {
      editorComposicao.splice(+e.target.dataset.sg, 1);
      renderEditorComposicao();
    })
  );

  container.querySelectorAll(".comp-chip-del").forEach((el) =>
    el.addEventListener("click", (e) => {
      const si = +e.target.dataset.sg, ii = +e.target.dataset.ii;
      editorComposicao[si].itens.splice(ii, 1);
      renderEditorComposicao();
    })
  );

  container.querySelectorAll(".comp-ing-btn").forEach((el) =>
    el.addEventListener("click", (e) => {
      const si = +e.target.dataset.sg;
      const input = container.querySelector(`.comp-ing-input[data-sg="${si}"]`);
      const val = input.value.trim();
      if (!val) return;
      editorComposicao[si].itens.push(val);
      input.value = "";
      renderEditorComposicao();
      // Re-foca o input do mesmo subgrupo após re-render
      const novo = $("editor-composicao-builder").querySelector(`.comp-ing-input[data-sg="${si}"]`);
      if (novo) novo.focus();
    })
  );

  container.querySelectorAll(".comp-ing-input").forEach((el) =>
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        container.querySelector(`.comp-ing-btn[data-sg="${e.target.dataset.sg}"]`).click();
      }
    })
  );
}

// ============================================================
// CONSTRUTOR DE OPCIONAIS
// ============================================================
function parsearOpcionais(texto) {
  if (!texto || !texto.trim()) return [];
  const lista = [];
  for (let linha of texto.split("\n")) {
    linha = linha.trim().replace(/^[*\-•]\s*/, "");
    if (!linha) continue;
    const partes = linha.split("|");
    const nome = partes[0].trim();
    let preco = 0;
    if (partes.length >= 2) preco = parseFloat(partes[1].replace(",", ".").replace(/[^\d.]/g, "")) || 0;
    if (nome) lista.push({ nome, preco });
  }
  return lista;
}

function serializarOpcionais(lista) {
  return lista
    .filter((o) => o.nome.trim())
    .map((o) => o.nome.trim() + " | " + Number(o.preco || 0).toFixed(2))
    .join("\n");
}

function renderEditorOpcionais() {
  const container = $("editor-opcionais-builder");
  container.innerHTML = "";

  editorOpcionais.forEach((op, oi) => {
    const div = document.createElement("div");
    div.className = "opc-linha";
    div.innerHTML = `
      <input class="opc-nome" placeholder="Nome do opcional" value="${escapar(op.nome)}" data-oi="${oi}" />
      <div class="opc-preco-wrap">
        <span class="opc-rs">R$</span>
        <input type="number" class="opc-preco" step="0.01" min="0" placeholder="0,00" value="${Number(op.preco || 0).toFixed(2)}" data-oi="${oi}" />
      </div>
      <button type="button" class="perigo mini opc-del" data-oi="${oi}" aria-label="Remover">×</button>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll(".opc-nome").forEach((el) =>
    el.addEventListener("input", (e) => { editorOpcionais[+e.target.dataset.oi].nome = e.target.value; })
  );

  container.querySelectorAll(".opc-preco").forEach((el) =>
    el.addEventListener("input", (e) => { editorOpcionais[+e.target.dataset.oi].preco = parseFloat(e.target.value) || 0; })
  );

  container.querySelectorAll(".opc-del").forEach((el) =>
    el.addEventListener("click", (e) => {
      editorOpcionais.splice(+e.target.dataset.oi, 1);
      renderEditorOpcionais();
    })
  );
}

$("editor-opc-add").addEventListener("click", () => {
  editorOpcionais.push({ nome: "", preco: 0 });
  renderEditorOpcionais();
  const inputs = $("editor-opcionais-builder").querySelectorAll(".opc-nome");
  if (inputs.length) inputs[inputs.length - 1].focus();
});

$("btnAddCategoria").addEventListener("click", () => {
  cardapioAtual.categorias.push({ id: "cat_" + Date.now(), nome: "Nova categoria", itens: [] });
  renderCardapio();
});

$("btnNovoItem").addEventListener("click", () => {
  if (cardapioAtual.categorias.length === 0) {
    toast("Crie uma categoria antes de adicionar itens.", "erro");
    return;
  }
  abrirEditorItem(0, -1);
});

$("btnSalvarCardapio").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = "Salvando...";
  const r = await api("PUT", "/api/cardapio", cardapioAtual);
  btn.disabled = false;
  btn.textContent = "Salvar cardápio";
  if (r && r.ok) toast("✓ Cardápio salvo! Já está valendo para os clientes.");
});

// ============================================================
// CONFIGURAÇÕES
// ============================================================
const DIAS_SEMANA = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

function renderHorarios() {
  const tbody = $("horariosBody");
  if (!tbody) return;
  const horarios = configAtual.horarios || {};
  tbody.innerHTML = "";
  for (const { key, label } of DIAS_SEMANA) {
    const h = horarios[key] || { abre: "11:00", fecha: "22:00", fechado: false };
    const fechado = !!h.fechado;
    const tr = document.createElement("tr");
    tr.className = "hor-linha" + (fechado ? " hor-fechado" : "");
    tr.innerHTML = `
      <td class="hor-dia" data-label="Dia">${label}</td>
      <td data-label="Abre"><input type="time" id="h_abre_${key}" class="hor-time" value="${h.abre || "11:00"}" ${fechado ? "disabled" : ""} /></td>
      <td data-label="Fecha"><input type="time" id="h_fecha_${key}" class="hor-time" value="${h.fecha || "22:00"}" ${fechado ? "disabled" : ""} /></td>
      <td data-label="Fechado" class="hor-fechado-cel"><label class="switch"><input type="checkbox" id="h_fechado_${key}" ${fechado ? "checked" : ""} /></label></td>`;
    tbody.appendChild(tr);
    tr.querySelector(`#h_fechado_${key}`).addEventListener("change", (e) => {
      const isFechado = e.target.checked;
      tr.querySelector(`#h_abre_${key}`).disabled = isFechado;
      tr.querySelector(`#h_fecha_${key}`).disabled = isFechado;
      tr.classList.toggle("hor-fechado", isFechado);
    });
  }
}

function lerHorariosDoDOM() {
  const horarios = {};
  for (const { key } of DIAS_SEMANA) {
    horarios[key] = {
      abre:    ($(`h_abre_${key}`)  || {}).value || "11:00",
      fecha:   ($(`h_fecha_${key}`) || {}).value || "22:00",
      fechado: !!($(`h_fechado_${key}`) || {}).checked,
    };
  }
  return horarios;
}

function preencherConfig() {
  const c = configAtual;
  $("cfgNome").value = c.restaurante.nome || "";
  $("cfgTelefone").value = c.restaurante.telefone || "";
  $("cfgHorario").value = c.restaurante.horario || "";
  $("cfgEndereco").value = c.restaurante.endereco || "";
  $("cfgAberto").checked = !!c.atendimento.aberto;
  $("cfgTempo").value = c.atendimento.tempoEstimado || "";
  $("cfgTaxaEntrega").value = moeda(c.atendimento.taxaEntrega || 0);
  $("cfgBoasVindas").value = c.mensagens.boasVindas || "";
  $("cfgFechado").value = c.mensagens.fechado || "";
  $("cfgAtendente").value = c.mensagens.atendente || "";
  $("cfgConfirmado").value = c.mensagens.pedidoConfirmado || "";
  $("cfgMsgProntoEntrega").value  = c.mensagens?.pedidoPronto?.entrega  || "";
  $("cfgMsgProntoRetirada").value = c.mensagens?.pedidoPronto?.retirada || "";
  atualizarBadgeAtendimento(!!c.atendimento.aberto);
  atualizarStatusConfig(!!c.atendimento.aberto);
  renderHorarios();
  renderPagamentos();
}

// Sincroniza o chip "Status:" do cabeçalho e o rótulo do toggle com o estado aberto/fechado.
function atualizarStatusConfig(aberto) {
  const chip = $("cfgStatusChip");
  if (chip) {
    chip.textContent = aberto ? "Aberto" : "Fechado";
    chip.className = "cfg-status-chip " + (aberto ? "aberto" : "fechado");
  }
  const lbl = $("cfgAbertoLabel");
  if (lbl) lbl.textContent = aberto ? "ABERTO PARA PEDIDOS" : "FECHADO PARA PEDIDOS";
}

function renderPagamentos() {
  const cont = $("pagamentosContainer");
  cont.innerHTML = "";
  configAtual.pagamentos.forEach((p, i) => {
    const pill = document.createElement("span");
    pill.className = "pag-pill";
    pill.innerHTML = `<span class="pag-pill-txt">${escapar(p)}</span><button type="button" class="pag-pill-del" data-del-pg="${i}" aria-label="Remover">×</button>`;
    cont.appendChild(pill);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "pag-add";
  add.id = "btnAddPagamento";
  add.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Adicionar Método`;
  cont.appendChild(add);

  cont.querySelectorAll("[data-del-pg]").forEach((el) =>
    el.addEventListener("click", (e) => {
      configAtual.pagamentos.splice(+e.currentTarget.dataset.delPg, 1);
      renderPagamentos();
    })
  );
  add.addEventListener("click", adicionarPagamentoInline);
}

// "+ Adicionar Método": insere um input inline que vira pill ao confirmar (Enter/blur).
function adicionarPagamentoInline() {
  const cont = $("pagamentosContainer");
  const existente = cont.querySelector(".pag-input");
  if (existente) { existente.focus(); return; }
  const add = $("btnAddPagamento");
  const input = document.createElement("input");
  input.className = "pag-input";
  input.placeholder = "Nome do método";
  cont.insertBefore(input, add);
  input.focus();
  let confirmado = false;
  const commit = () => {
    if (confirmado) return;
    confirmado = true;
    const v = input.value.trim();
    if (v) configAtual.pagamentos.push(v);
    renderPagamentos();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { confirmado = true; renderPagamentos(); }
  });
  input.addEventListener("blur", commit);
}

$("cfgAberto").addEventListener("change", (e) => {
  atualizarBadgeAtendimento(e.target.checked);
  atualizarStatusConfig(e.target.checked);
});

async function carregarConfig() {
  const r = await api("GET", "/api/config");
  if (r) { configAtual = await r.json(); preencherConfig(); }
}

$("btnDescartarConfig").addEventListener("click", async () => {
  await carregarConfig();
  toast("Alterações descartadas.");
});

$("btnSalvarConfig").addEventListener("click", async (e) => {
  configAtual.restaurante.nome = $("cfgNome").value;
  configAtual.restaurante.telefone = $("cfgTelefone").value;
  configAtual.restaurante.horario = $("cfgHorario").value;
  configAtual.restaurante.endereco = $("cfgEndereco").value;
  configAtual.atendimento.aberto = $("cfgAberto").checked;
  configAtual.atendimento.tempoEstimado = $("cfgTempo").value;
  configAtual.atendimento.taxaEntrega = parseFloat($("cfgTaxaEntrega").value) || 0;
  configAtual.horarios = lerHorariosDoDOM();
  configAtual.mensagens.boasVindas = $("cfgBoasVindas").value;
  configAtual.mensagens.fechado = $("cfgFechado").value;
  configAtual.mensagens.atendente = $("cfgAtendente").value;
  configAtual.mensagens.pedidoConfirmado = $("cfgConfirmado").value;
  if (!configAtual.mensagens.pedidoPronto) configAtual.mensagens.pedidoPronto = {};
  configAtual.mensagens.pedidoPronto.entrega  = $("cfgMsgProntoEntrega").value;
  configAtual.mensagens.pedidoPronto.retirada = $("cfgMsgProntoRetirada").value;
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = "Salvando...";
  const r = await api("PUT", "/api/config", configAtual);
  btn.disabled = false;
  btn.textContent = "Salvar configurações";
  if (r && r.ok) toast("✓ Configurações salvas!");
});

// ============================================================
// PEDIDOS
// ============================================================
let pedidosCache = [];
const filtros = { periodo: "hoje", tipo: "todos", busca: "", dataIni: "", dataFim: "" };

// Paginação da lista
const PEDIDOS_POR_PAGINA = 10;
let paginaPedidos = 1;
let listaPedidosAtual = []; // lista filtrada atual (para paginar sem refazer o cálculo)

// Só busca os pedidos do tenant; o recorte (período/tipo/busca) e as métricas
// são calculados no front em renderPedidos() a partir deste conjunto.
async function carregarPedidos() {
  const r = await api("GET", "/api/pedidos");
  if (!r) return;
  pedidosCache = await r.json();
  renderPedidos();
}

// Intervalo do período selecionado + nº de dias (para a média diária).
function periodoRange() {
  const agora = new Date();
  const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  if (filtros.periodo === "hoje") {
    return { ini: inicioDoDia(agora), fim: agora, dias: 1 };
  }
  if (filtros.periodo === "7dias") {
    const ini = inicioDoDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 6));
    return { ini, fim: agora, dias: 7 };
  }
  // Personalizado
  const di = filtros.dataIni ? new Date(filtros.dataIni + "T00:00:00") : null;
  const df = filtros.dataFim ? new Date(filtros.dataFim + "T23:59:59") : null;
  if (di && df) {
    const dias = Math.max(1, Math.round((inicioDoDia(df) - inicioDoDia(di)) / 86400000) + 1);
    return { ini: di, fim: df, dias };
  }
  return { ini: null, fim: null, dias: 1 }; // custom incompleto: sem limite até escolher datas
}

function noPeriodo(p, range) {
  const t = new Date(p.criadoEm).getTime();
  if (range.ini && t < range.ini.getTime()) return false;
  if (range.fim && t > range.fim.getTime()) return false;
  return true;
}

// Telefone limpo para exibição (nunca o id cru). Formata 55+DDD+número.
function telefoneFmt(p) {
  const d = (p.telefone || "").replace(/\D/g, "");
  if (!d) return "—";
  if (d.length >= 12 && d.startsWith("55")) {
    const ddd = d.slice(2, 4), resto = d.slice(4);
    if (resto.length === 9) return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
    if (resto.length === 8) return `(${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  }
  return d;
}

function tagTipo(p) {
  return p.tipoEntrega === "Entrega"
    ? `<span class="tag tag-entrega">🛵 Entrega</span>`
    : `<span class="tag tag-retirada">🏃 Retirada</span>`;
}

// Data/hora relativa: "Hoje, HH:MM" / "Ontem, HH:MM" / "DD/MM/AAAA, HH:MM" (sem segundos)
function dataHoraFmt(criadoEm) {
  const d = new Date(criadoEm);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const soDia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((soDia(new Date()) - soDia(d)) / 86400000);
  if (diff === 0) return `Hoje, ${hora}`;
  if (diff === 1) return `Ontem, ${hora}`;
  return `${d.toLocaleDateString("pt-BR")}, ${hora}`;
}

// Páginas visíveis com janela em torno da atual (… quando há muitas)
function paginasVisiveis(atual, total) {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, atual, atual - 1, atual + 1]);
  const arr = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  arr.forEach((n, i) => {
    out.push(n);
    if (i < arr.length - 1 && arr[i + 1] - n > 1) out.push("…");
  });
  return out;
}

function paginacaoHtml(total, totalPaginas, ini, qtdNaPagina) {
  if (totalPaginas <= 1) return ""; // cabe tudo numa página → sem paginação
  const de = ini + 1, ate = ini + qtdNaPagina;
  let botoes = `<button class="pag-btn pag-seta" data-pag="${paginaPedidos - 1}" ${paginaPedidos === 1 ? "disabled" : ""} aria-label="Página anterior">‹</button>`;
  for (const n of paginasVisiveis(paginaPedidos, totalPaginas)) {
    botoes += n === "…"
      ? `<span class="pag-reticencias">…</span>`
      : `<button class="pag-btn ${n === paginaPedidos ? "ativo" : ""}" data-pag="${n}">${n}</button>`;
  }
  botoes += `<button class="pag-btn pag-seta" data-pag="${paginaPedidos + 1}" ${paginaPedidos === totalPaginas ? "disabled" : ""} aria-label="Próxima página">›</button>`;
  return `<div class="pedidos-paginacao">
    <span class="pag-info">Mostrando ${de}–${ate} de ${total} pedidos</span>
    <div class="pag-controles">${botoes}</div>
  </div>`;
}

function irParaPagina(n) {
  paginaPedidos = n;
  renderListaPedidos(listaPedidosAtual);
}

// Reaplica a animação de entrada (remove a classe, força reflow, readiciona).
function animarTroca(el) {
  if (!el) return;
  el.classList.remove("fade-troca");
  void el.offsetWidth;
  el.classList.add("fade-troca");
}

// Ícones de tendência (Lucide) para o comparativo do card destaque
const ICO_TREND_UP = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
const ICO_TREND_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`;

// Período imediatamente anterior, de mesma duração (para o comparativo real).
function periodoAnteriorRange(range) {
  if (!range.ini) return { ini: null, fim: null, dias: range.dias };
  const fim = new Date(range.ini.getTime() - 1);
  const ini = new Date(range.ini.getTime() - range.dias * 86400000);
  return { ini, fim, dias: range.dias };
}
function labelComparativo() {
  if (filtros.periodo === "hoje") return "vs ontem";
  if (filtros.periodo === "7dias") return "vs 7 dias anteriores";
  return "vs período anterior";
}

function renderPedidos(animar = false) {
  const range = periodoRange();

  // Conjunto base = período + tipo → define as MÉTRICAS (a busca não entra aqui).
  const base = pedidosCache.filter(
    (p) => noPeriodo(p, range) && (filtros.tipo === "todos" || p.tipoEntrega === filtros.tipo)
  );

  const total = base.length;
  const media = total / range.dias;
  const somaTotais = base.reduce((s, p) => s + (p.total || 0), 0);
  const ticket = total ? somaTotais / total : 0;
  $("metTotal").textContent = total;
  $("metMedia").textContent = media.toFixed(1).replace(".", ",");
  $("metTicket").textContent = "R$ " + moedaBR(ticket);

  // Comparativo REAL vs período anterior equivalente (contagem de pedidos).
  const rangeAnt = periodoAnteriorRange(range);
  const totalAnt = pedidosCache.filter(
    (p) => noPeriodo(p, rangeAnt) && (filtros.tipo === "todos" || p.tipoEntrega === filtros.tipo)
  ).length;
  const compEl = $("metComparativo");
  const trendEl = $("metTrendIcon");
  if (totalAnt > 0) {
    const pct = Math.round(((total - totalAnt) / totalAnt) * 100);
    const sobe = pct >= 0;
    if (compEl) { compEl.textContent = `${sobe ? "↑" : "↓"} ${Math.abs(pct)}% ${labelComparativo()}`; compEl.style.display = ""; }
    if (trendEl) trendEl.innerHTML = sobe ? ICO_TREND_UP : ICO_TREND_DOWN;
  } else {
    if (compEl) compEl.style.display = "none"; // sem base anterior → não mostra %
    if (trendEl) trendEl.innerHTML = ICO_TREND_UP;
  }

  // Lista exibida = base + busca (nome / telefone / nº do pedido).
  const termo = filtros.busca.trim().toLowerCase();
  const digitos = termo.replace(/\D/g, "");
  const lista = !termo ? base : base.filter((p) => {
    if ((p.cliente || "").toLowerCase().includes(termo)) return true;
    if (digitos) {
      if ((p.telefone || "").replace(/\D/g, "").includes(digitos)) return true;
      if (String(p.numero).includes(digitos)) return true;
    }
    return false;
  });

  listaPedidosAtual = lista;
  renderListaPedidos(lista);

  // Fade sutil ao trocar de filtro (período/tipo) — busca e auto-refresh não animam.
  if (animar) {
    animarTroca(document.querySelector(".metricas-cards"));
    animarTroca($("pedidosContainer"));
  }
}

function renderListaPedidos(lista) {
  const cont = $("pedidosContainer");

  if (lista.length === 0) {
    const semNenhum = pedidosCache.length === 0;
    cont.innerHTML = `
      <div class="estado-vazio">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <p>${semNenhum ? "Nenhum pedido recebido ainda" : "Nenhum pedido neste período"}</p>
        <span class="sub">${semNenhum
          ? "Os pedidos aparecem aqui assim que o bot receber o primeiro pelo WhatsApp."
          : "Experimente ampliar o período (7 dias) ou limpar a busca."}</span>
      </div>`;
    return;
  }

  // Paginação: fatia a lista filtrada na página atual
  const totalPaginas = Math.ceil(lista.length / PEDIDOS_POR_PAGINA);
  if (paginaPedidos > totalPaginas) paginaPedidos = totalPaginas;
  if (paginaPedidos < 1) paginaPedidos = 1;
  const ini = (paginaPedidos - 1) * PEDIDOS_POR_PAGINA;
  const pagina = lista.slice(ini, ini + PEDIDOS_POR_PAGINA);

  // Desktop: tabela escaneável
  let tabela = `<table class="pedidos-tabela"><thead><tr>
    <th>Nº Pedido</th><th>Data/hora</th><th>Cliente</th><th>Telefone</th><th>Tipo</th><th class="col-total">Total</th>
    </tr></thead><tbody>`;
  pagina.forEach((p) => {
    tabela += `<tr class="pedido-linha" data-id="${p.id}">
      <td class="ped-num">#${p.numero}</td>
      <td>${escapar(dataHoraFmt(p.criadoEm))}</td>
      <td>${escapar(p.cliente)}</td>
      <td>${escapar(telefoneFmt(p))}</td>
      <td>${tagTipo(p)}</td>
      <td class="ped-total">R$ ${moedaBR(p.total)}</td>
    </tr>`;
  });
  tabela += "</tbody></table>";

  // Mobile: cards condensados
  let cards = `<div class="pedidos-cards">`;
  pagina.forEach((p) => {
    const hora = new Date(p.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    cards += `<div class="pedido-card" data-id="${p.id}">
      <div class="pedido-card-topo">
        <span class="pedido-card-num">#${p.numero} • ${hora}</span>
        ${tagTipo(p)}
      </div>
      <div class="pedido-card-cliente">${escapar(p.cliente)}</div>
      <div class="pedido-card-rodape">
        <span class="sub">${escapar(telefoneFmt(p))}</span>
        <span class="pedido-card-total">R$ ${moedaBR(p.total)}</span>
      </div>
    </div>`;
  });
  cards += "</div>";

  cont.innerHTML = tabela + cards + paginacaoHtml(lista.length, totalPaginas, ini, pagina.length);

  // Linha (desktop) ou card (mobile) → abre o detalhe existente.
  cont.querySelectorAll("[data-id]").forEach((el) =>
    el.addEventListener("click", () => {
      const p = pedidosCache.find((x) => String(x.id) === el.dataset.id);
      if (p) abrirModalPedido(p);
    })
  );

  // Controles de paginação
  cont.querySelectorAll("[data-pag]").forEach((b) =>
    b.addEventListener("click", () => {
      const n = +b.dataset.pag;
      if (n >= 1 && n <= totalPaginas && n !== paginaPedidos) irParaPagina(n);
    })
  );
}

// Handlers dos filtros (recalculam sem refazer fetch; voltam para a página 1).
$("filtroPeriodo").addEventListener("click", (e) => {
  const btn = e.target.closest(".filtro-chip");
  if (!btn) return;
  filtros.periodo = btn.dataset.periodo;
  $("filtroPeriodo").querySelectorAll(".filtro-chip").forEach((b) => b.classList.toggle("ativo", b === btn));
  $("filtroDatas").style.display = filtros.periodo === "custom" ? "" : "none";
  paginaPedidos = 1;
  renderPedidos(true);
});
$("dataIni").addEventListener("change", (e) => { filtros.dataIni = e.target.value; paginaPedidos = 1; renderPedidos(true); });
$("dataFim").addEventListener("change", (e) => { filtros.dataFim = e.target.value; paginaPedidos = 1; renderPedidos(true); });
$("filtroTipo").addEventListener("change", (e) => { filtros.tipo = e.target.value; paginaPedidos = 1; renderPedidos(true); });
$("buscaPedido").addEventListener("input", (e) => { filtros.busca = e.target.value; paginaPedidos = 1; renderPedidos(); });

// Ícones neutros (Lucide) para o detalhe
const ICO_USER = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const ICO_LOCAL = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const ICO_PAG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;

function abrirModalPedido(p) {
  $("pedido-numero").textContent = `Pedido #${p.numero}`;
  $("pedido-quando").textContent = new Date(p.criadoEm).toLocaleString("pt-BR");

  const taxa = p.taxaEntrega || 0;
  const subtotal = p.itens.reduce((acc, i) => {
    const extras = (i.opcionais || []).reduce((s, o) => s + (o.preco || 0), 0);
    return acc + (i.preco + extras) * i.qtd;
  }, 0);

  // Itens como cards de leitura (qtd Nx, nome, opcionais como subitens, preço à direita)
  const itensHtml = p.itens.map((i) => {
    const extras = (i.opcionais || []).reduce((s, o) => s + (o.preco || 0), 0);
    const sub = (i.preco + extras) * i.qtd;
    const opcHtml = (i.opcionais && i.opcionais.length)
      ? `<div class="ped-item-opc">${i.opcionais.map((o) => "+ " + escapar(o.nome)).join("<br>")}</div>`
      : "";
    return `<div class="ped-item">
      <span class="ped-item-qtd">${i.qtd}x</span>
      <div class="ped-item-info">
        <div class="ped-item-nome">${escapar(i.nome)}</div>
        ${opcHtml}
      </div>
      <span class="ped-item-preco">R$ ${moedaBR(sub)}</span>
    </div>`;
  }).join("");

  // Observação agregada dos itens (só aparece se houver alguma; prefixo só com >1 item)
  const comObs = p.itens.filter((i) => i.observacao && i.observacao.trim());
  let obsHtml = "";
  if (comObs.length) {
    const linhas = comObs.map((i) =>
      comObs.length > 1
        ? `<p><strong>${escapar(i.nome)}:</strong> ${escapar(i.observacao)}</p>`
        : `<p>${escapar(i.observacao)}</p>`
    ).join("");
    obsHtml = `<div class="ped-obs"><span class="ped-obs-titulo">Observação</span>${linhas}</div>`;
  }

  const tipoTag = p.tipoEntrega === "Entrega"
    ? `<span class="tag tag-entrega">🛵 Entrega</span>`
    : `<span class="tag tag-retirada">🏃 Retirada</span>`;

  // Entrega: endereço em texto (sem mapa). Retirada: local do restaurante (config) ou balcão.
  let entregaTexto;
  if (p.tipoEntrega === "Entrega") {
    entregaTexto = (p.endereco && p.endereco !== "—")
      ? escapar(p.endereco)
      : `<span class="ped-info-vazio">Endereço não informado</span>`;
  } else {
    const endRest = (configAtual && configAtual.restaurante && configAtual.restaurante.endereco) || "";
    entregaTexto = endRest
      ? `Retirada no local<br><span class="sub">${escapar(endRest)}</span>`
      : "Retirada no balcão";
  }

  $("pedido-detalhe-corpo").innerHTML = `
    <div class="ped-det-grid">
      <div class="ped-det-col">
        <div class="ped-bloco">
          <div class="ped-bloco-titulo">Cliente</div>
          <div class="ped-cliente">
            <div class="ped-cliente-avatar">${ICO_USER}</div>
            <div class="ped-cliente-dados">
              <div class="ped-cliente-nome">${escapar(p.cliente) || "—"}</div>
              <div class="ped-cliente-tel">${escapar(telefoneFmt(p))}</div>
            </div>
          </div>
        </div>
        ${obsHtml}
        <div class="ped-bloco">
          <div class="ped-bloco-titulo">Itens do pedido</div>
          ${itensHtml}
        </div>
      </div>
      <div class="ped-det-col">
        <div class="ped-bloco">
          <div class="ped-bloco-titulo">Entrega</div>
          <div class="ped-linha-info">
            <span class="ped-info-icone">${ICO_LOCAL}</span>
            <div class="ped-info-texto">${entregaTexto}<div class="ped-info-tag">${tipoTag}</div></div>
          </div>
        </div>
        <div class="ped-bloco">
          <div class="ped-bloco-titulo">Pagamento</div>
          <div class="ped-linha-info">
            <span class="ped-info-icone">${ICO_PAG}</span>
            <div class="ped-info-texto">${escapar(p.pagamento) || "—"}</div>
          </div>
        </div>
        <div class="ped-bloco ped-resumo">
          <div class="ped-bloco-titulo">Resumo de valores</div>
          <div class="ped-resumo-linha"><span>Subtotal</span><span>R$ ${moedaBR(subtotal)}</span></div>
          ${taxa > 0 ? `<div class="ped-resumo-linha"><span>Taxa de entrega</span><span>R$ ${moedaBR(taxa)}</span></div>` : ""}
          <div class="ped-resumo-total"><span>Total</span><span>R$ ${moedaBR(p.total)}</span></div>
        </div>
      </div>
    </div>`;

  montarAcoes(p);

  const overlay = $("pedido-overlay");
  overlay.style.display = "flex";
  overlay.classList.remove("saindo");
}

// ---- Avisar cliente ----
function podeAvisar(p) {
  const jid = p.chatId || "";
  const jidReal = jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid");
  const telOk = (p.telefone || "").replace(/\D/g, "").length >= 10;
  return jidReal || telOk; // mesma regra do backend; simulador (sem canal) → false
}

function textoAvisar(p) {
  return p.tipoEntrega === "Entrega"
    ? "Avisar que saiu para entrega"
    : "Avisar que está pronto para retirada";
}

function montarAcoes(p) {
  const cont = $("pedido-acoes");
  if (!cont) return;
  if (!podeAvisar(p)) { cont.innerHTML = ""; return; } // sem canal: não oferece
  if (p.avisadoEm) {
    const quando = new Date(p.avisadoEm).toLocaleString("pt-BR");
    cont.innerHTML = `
      <span class="pedido-avisado">✓ Cliente avisado em ${quando}</span>
      <button class="secundario mini" id="btn-avisar">Avisar novamente</button>`;
  } else {
    cont.innerHTML = `<button id="btn-avisar">${escapar(textoAvisar(p))}</button>`;
  }
  const btn = $("btn-avisar");
  if (btn) btn.addEventListener("click", () => avisarCliente(p));
}

async function avisarCliente(p) {
  const btn = $("btn-avisar");
  if (!btn) return;

  if (p.avisadoEm) {
    const ok = await confirmar(
      "Avisar novamente?",
      "Isso vai enviar OUTRA mensagem de aviso para o cliente no WhatsApp. Deseja continuar?",
      "Enviar novamente"
    );
    if (!ok) return;
  }

  const textoOrig = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Enviando...";

  const r = await api("POST", "/api/pedido/avisar", { pedidoId: p.id });
  if (!r) return; // 401 já tratado pelo api()
  const data = await r.json().catch(() => ({}));

  if (r.ok) {
    p.avisadoEm = data.avisadoEm || new Date().toISOString(); // atualiza o cache (referência)
    toast("✓ Cliente avisado!");
    montarAcoes(p); // re-renderiza no estado "avisado"
  } else {
    const erro = data.erro || "Erro ao avisar o cliente.";
    if (/não conectado|nao conectado/i.test(erro)) {
      toast("WhatsApp não conectado — conecte na aba Conexão para avisar.", "erro");
    } else {
      toast(erro, "erro");
    }
    btn.disabled = false;
    btn.textContent = textoOrig;
  }
}

function fecharModalPedido() {
  const overlay = $("pedido-overlay");
  overlay.classList.add("saindo");
  overlay.addEventListener("animationend", () => {
    overlay.style.display = "none";
    overlay.classList.remove("saindo");
  }, { once: true });
}

$("pedido-fechar").addEventListener("click", fecharModalPedido);
$("pedido-fechar-rodape").addEventListener("click", fecharModalPedido);
$("pedido-overlay").addEventListener("click", (e) => {
  if (e.target === $("pedido-overlay")) fecharModalPedido();
});

$("btnAtualizarPedidos").addEventListener("click", carregarPedidos);

// Auto-refresh de pedidos enquanto a aba estiver ativa
setInterval(() => {
  if ($("aba-pedidos").classList.contains("ativa")) carregarPedidos();
}, 15000);

// ============================================================
// Utilidades + carga inicial
// ============================================================
function escapar(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function altEnterInsere(e, insercao) {
  if (e.key === "Enter" && e.altKey) {
    e.preventDefault();
    const ta = e.target;
    const ini = ta.selectionStart, fim = ta.selectionEnd;
    ta.value = ta.value.slice(0, ini) + insercao + ta.value.slice(fim);
    ta.selectionStart = ta.selectionEnd = ini + insercao.length;
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

// ============================================================
// SIMULADOR DE CONVERSA
// ============================================================
const simChat  = $("simChat");
const simInput = $("simInput");

const SIM_AVATAR = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 17h6"/></svg>`;

function simHora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function simFormatarTexto(txt) {
  return escapar(txt)
    .replace(/\*(.*?)\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>");
}

function simAdicionarMensagemUser(texto) {
  const div = document.createElement("div");
  div.className = "sim-balao-user";
  div.innerHTML = `
    <div class="sim-bubble-user">${escapar(texto)}</div>
    <span class="sim-hora">${simHora()}</span>`;
  simChat.appendChild(div);
  simRolarParaBaixo();
}

function simAdicionarMensagensBot(respostas) {
  for (const r of respostas) {
    if (!r || !r.trim()) continue;
    const div = document.createElement("div");
    div.className = "sim-balao-bot";
    div.innerHTML = `
      <div class="sim-avatar">${SIM_AVATAR}</div>
      <div class="sim-msg-col">
        <span class="sim-msg-nome">Nymbus Bot</span>
        <div class="sim-bubble-bot">${simFormatarTexto(r)}</div>
        <span class="sim-hora">${simHora()}</span>
      </div>`;
    simChat.appendChild(div);
  }
  simRolarParaBaixo();
}

function simMostrarTyping() {
  const div = document.createElement("div");
  div.className = "sim-typing";
  div.id = "simTyping";
  div.innerHTML = `
    <div class="sim-avatar">${SIM_AVATAR}</div>
    <div class="sim-typing-dots"><span></span><span></span><span></span></div>`;
  simChat.appendChild(div);
  simRolarParaBaixo();
  return div;
}

// Total do carrinho: (preço do item + opcionais) × quantidade.
function simTotalCarrinho(carrinho) {
  if (!carrinho || !carrinho.length) return 0;
  return carrinho.reduce((acc, l) => {
    const opc = (l.opcionais || []).reduce((s, o) => s + (o.preco || 0), 0);
    return acc + (((l.preco || 0) + opc) * (l.qtd || 1));
  }, 0);
}

function simAtualizarEstado(estado, carrinho) {
  const etapa = $("simCtxEtapa");
  const itens = $("simCtxItens");
  const total = $("simCtxTotal");
  if (etapa) etapa.textContent = estado || "—";
  if (itens) itens.textContent = carrinho ? carrinho.length : 0;
  if (total) total.textContent = "R$ " + moedaBR(simTotalCarrinho(carrinho));
}

function simRolarParaBaixo() {
  simChat.scrollTop = simChat.scrollHeight;
}

function simAdicionarSeparador(texto) {
  const div = document.createElement("div");
  div.className = "sim-separador";
  div.textContent = texto;
  simChat.appendChild(div);
}

$("simForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = simInput.value.trim();
  if (!msg) return;
  simInput.value = "";
  simInput.disabled = true;

  simAdicionarMensagemUser(msg);

  const typing = simMostrarTyping();

  try {
    const r = await fetch("/api/simulador/mensagem", {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify({ mensagem: msg }),
    });
    const data = await r.json();
    typing.remove();
    simAdicionarMensagensBot(data.respostas || []);
    simAtualizarEstado(data.estado, data.carrinho);
  } catch {
    typing.remove();
    simAdicionarMensagensBot(["⚠️ Erro ao conectar com o servidor."]);
  }

  simInput.disabled = false;
  simInput.focus();
});

$("btnSimReset").addEventListener("click", async () => {
  await fetch("/api/simulador/reset", { method: "POST", headers: cabecalhos });
  simChat.innerHTML = `<div class="sim-hint">Digite <strong>oi</strong> para começar o atendimento.</div>`;
  simAdicionarSeparador("Sessão reiniciada");
  simAtualizarEstado("INICIO", []);
  simInput.focus();
});

// Foca no input ao entrar na aba simulador
document.querySelector("[data-aba='simulador']").addEventListener("click", () => {
  setTimeout(() => simInput.focus(), 80);
});

// Envia com Enter (já é o padrão do form), permite Shift+Enter para nova linha no futuro
simInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("simForm").dispatchEvent(new Event("submit"));
  }
});

async function inicial() {
  carregarPedidos();   // Pedidos é a aba inicial (home)
  atualizarStatus();   // mantém status/badge atualizados
  const rc = await api("GET", "/api/cardapio");
  if (rc) { cardapioAtual = await rc.json(); renderCardapio(); }
  await carregarConfig();
}
inicial();
