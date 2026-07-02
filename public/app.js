// ============================================================
// LÓGICA DO PAINEL (front-end)
// ============================================================

// Sessão segura: o refresh token vive num cookie httpOnly (o JS não lê → imune a
// XSS). O access token (JWT, ~1h) fica SÓ aqui na memória, nunca persistido.
let token = null;
let painelSlug = "", painelNome = "";

const cabecalhos = {
  "Content-Type": "application/json",
  Authorization: "",
};

// Limpeza: o assistente de onboarding no painel foi revertido (virou wizard no
// cadastro). Remove qualquer chave residual "onbPasso:*" guardada no navegador.
try {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("onbPasso:"))
    .forEach((k) => localStorage.removeItem(k));
} catch (e) { /* ignora */ }

// Boot da sessão: troca o cookie (refresh token) por um access token em memória
// via /api/refresh. Com "Lembrar de mim", o cookie sobrevive ao fechar o
// navegador → cai direto no painel. Sem cookie válido → volta pro login.
async function iniciarSessao() {
  try {
    const r = await fetch("/api/refresh", { method: "POST" });
    if (!r.ok) { location.href = "login.html"; return false; }
    const d = await r.json();
    token = d.token;
    cabecalhos.Authorization = "Bearer " + token;
    painelSlug = d.slug || "";
    painelNome = d.nome || "";
    CHAVE_PEDIDO_VISTO = "pedidoVisto:" + painelSlug;
    pedidoVistoNumero = Number(localStorage.getItem(CHAVE_PEDIDO_VISTO) || 0);
    const h = document.getElementById("headerNome");
    if (h && painelNome) h.textContent = "Olá, " + painelNome;
    return true;
  } catch (e) { location.href = "login.html"; return false; }
}

// Renova o access token (expira em ~1h) usando o cookie httpOnly (refresh token),
// sem deslogar. Chamadas concorrentes são coalescidas numa única renovação.
let _renovando = null;
function renovarSessao() {
  if (!_renovando) {
    _renovando = (async () => {
      try {
        const r = await fetch("/api/refresh", { method: "POST" }); // cookie vai junto
        if (!r.ok) return false;
        const d = await r.json();
        token = d.token;
        cabecalhos.Authorization = "Bearer " + d.token;
        return true;
      } catch (e) { return false; }
    })().finally(() => { _renovando = null; });
  }
  return _renovando;
}

async function api(metodo, url, corpo) {
  const fazer = () => {
    const opc = { method: metodo, headers: cabecalhos };
    if (corpo) opc.body = JSON.stringify(corpo);
    return fetch(url, opc);
  };
  let r = await fazer();
  if (r.status === 401) {
    // Token expirado: tenta renovar uma vez e repete a requisição.
    if (await renovarSessao()) r = await fazer();
    if (r.status === 401) {
      sessionStorage.clear();
      location.href = "login.html";
      return;
    }
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
let editorVariacoes = [];

// Identidade visual do cardápio (capa + logo) — estado das prévias
let identCapaUrl = "";
let identLogoUrl = "";

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

// Data/hora no header (atualiza sozinha). Mostra "DD/MM • HH:MM".
function atualizarHeaderData() {
  const el = $("headerData");
  if (!el) return;
  const agora = new Date();
  el.textContent = agora.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    + " • " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
atualizarHeaderData();
setInterval(atualizarHeaderData, 30000);

// Dias indexados por getDay() (0=dom) — para o estado real de abertura.
const DIAS_KEY = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
// Estado REAL de abertura agora: respeita o toggle E o horário do dia (espelha o
// estaAberto do backend). O badge do header usa isto, não só o toggle manual.
function lojaAbertaAgora(config) {
  if (!config || !config.atendimento || !config.atendimento.aberto) return false;
  const horarios = config.horarios;
  if (!horarios) return true;
  const agora = new Date();
  const h = horarios[DIAS_KEY[agora.getDay()]];
  if (!h || h.fechado) return false;
  if (!h.abre || !h.fecha) return true;
  const [hA, mA] = h.abre.split(":").map(Number);
  const [hF, mF] = h.fecha.split(":").map(Number);
  const min = agora.getHours() * 60 + agora.getMinutes();
  return min >= hA * 60 + mA && min < hF * 60 + mF;
}

// ============================================================
// NAVEGAÇÃO POR ABAS
// ============================================================
document.querySelectorAll("nav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    // Saindo da aba Pedidos → some o destaque "NOVO" (cliente já viu os pedidos).
    const saindoDePedidos = $("aba-pedidos").classList.contains("ativa") && btn.dataset.aba !== "pedidos";
    if (saindoDePedidos) pedidosNovosDestaque.clear();

    document.querySelectorAll("nav button").forEach((b) => b.classList.remove("ativo"));
    document.querySelectorAll(".aba").forEach((a) => a.classList.remove("ativa"));
    const aj = $("btnAjuda");
    if (aj) aj.classList.remove("ativo");
    btn.classList.add("ativo");
    $("aba-" + btn.dataset.aba).classList.add("ativa");
    if (btn.dataset.aba === "dashboard") carregarDashboard();
    if (btn.dataset.aba === "pedidos") { carregarPedidos(); marcarPedidosVistos(); }
    if (btn.dataset.aba === "assinatura") carregarAssinatura();
    if (btn.dataset.aba === "caixa") carregarCaixa();
    if (btn.dataset.aba === "pdv") carregarPdv();
    if (btn.dataset.aba === "mesas") carregarMesas();
    try { localStorage.setItem("ultimaAba", btn.dataset.aba); } catch (_) {}
  });
});

// Central de Ajuda (FAQ): botão no rodapé da sidebar + atalho no topo (mobile).
function abrirAjuda() {
  document.querySelectorAll("nav button").forEach((b) => b.classList.remove("ativo"));
  document.querySelectorAll(".aba").forEach((a) => a.classList.remove("ativa"));
  const aj = $("btnAjuda");
  if (aj) aj.classList.add("ativo");
  $("aba-ajuda").classList.add("ativa");
  window.scrollTo(0, 0);
}
document.querySelectorAll(".abre-ajuda").forEach((b) => b.addEventListener("click", abrirAjuda));

// ============================================================
// NOTIFICAÇÃO DE PEDIDO NOVO (polling 15s + som + badge + modal)
// ============================================================
let CHAVE_PEDIDO_VISTO = "pedidoVisto:";                         // completada com o slug no boot
let pedidoUltimoNumero = null;                                   // último nº conhecido (servidor)
let pedidoVistoNumero = 0;                                       // nº já visto pelo usuário (lido no boot)
const pedidosNovosDestaque = new Set();                          // nºs a marcar "NOVO" na lista
let novoPedidoNumeroAtual = null;

// Som — respeita o toggle; navegadores bloqueiam autoplay até a 1ª interação,
// então destravamos o áudio no primeiro clique/tecla.
let somHabilitado = localStorage.getItem("somPedido") !== "off"; // default ligado
let audioPedido = null, audioDestravado = false;
try {
  audioPedido = new Audio("/assets/notificacao-pedido.mp3");
  audioPedido.preload = "auto";
} catch (_) { /* sem áudio: badge/modal seguem funcionando */ }

function destravarAudio() {
  if (audioDestravado || !audioPedido) return;
  audioPedido.play().then(() => {
    audioPedido.pause(); audioPedido.currentTime = 0; audioDestravado = true;
  }).catch(() => { /* navegador ainda bloqueou — tenta de novo na próxima interação */ });
}
document.addEventListener("click", destravarAudio);
document.addEventListener("keydown", destravarAudio);

function tocarSomPedido() {
  if (!somHabilitado || !audioPedido) return;
  try { audioPedido.currentTime = 0; audioPedido.play().catch(() => {}); } catch (_) {}
}

// Ícones Lucide (sino ligado/desligado) usados no botão e na pill de som.
const ICON_SINO = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
const ICON_SINO_OFF = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function atualizarBotaoSom() {
  const b = $("btnSomPedido");
  if (!b) return;
  b.innerHTML = somHabilitado ? ICON_SINO : ICON_SINO_OFF;
  b.title = somHabilitado ? "Som de novo pedido: ligado" : "Som de novo pedido: desligado";
  b.setAttribute("aria-pressed", String(somHabilitado));
}
if ($("btnSomPedido")) {
  atualizarBotaoSom();
  $("btnSomPedido").addEventListener("click", () => {
    somHabilitado = !somHabilitado;
    localStorage.setItem("somPedido", somHabilitado ? "on" : "off");
    atualizarBotaoSom();
    if (somHabilitado) tocarSomPedido(); // feedback ao religar
  });
}

function atualizarBadgePedidos() {
  const novos = pedidoUltimoNumero == null ? 0 : Math.max(0, pedidoUltimoNumero - pedidoVistoNumero);
  const badge = $("badge-pedidos");
  if (!badge) return;
  badge.textContent = novos > 9 ? "9+" : String(novos);
  badge.hidden = novos === 0;
}

// Marca tudo como visto (zera o badge da sidebar). Chamado ao abrir a aba Pedidos.
function marcarPedidosVistos() {
  if (pedidoUltimoNumero != null) {
    pedidoVistoNumero = pedidoUltimoNumero;
    localStorage.setItem(CHAVE_PEDIDO_VISTO, String(pedidoVistoNumero));
  }
  atualizarBadgePedidos();
}

// Modal rico de "novo pedido" (cliente, nº, itens e total). Não empilha.
function extrasItemNP(i) { return (i.opcionais || []).reduce((s, o) => s + (o.preco || 0) * (o.qtd || 1), 0); }

function abrirNovoPedido(d) {
  const overlay = $("novo-pedido-overlay");
  if (!overlay || overlay.style.display === "flex") return; // já aberto → não empilha
  novoPedidoNumeroAtual = d.numero;
  $("np-cliente").textContent = d.cliente || "Cliente";
  $("np-numero").textContent = "#" + d.numero;
  const pill = $("np-som-pill");
  pill.innerHTML = (somHabilitado ? ICON_SINO : ICON_SINO_OFF) + " " + (somHabilitado ? "Som de alerta ativo" : "Som desligado");
  pill.classList.toggle("off", !somHabilitado);
  const itens = Array.isArray(d.itens) ? d.itens : [];
  $("np-itens").innerHTML = itens.length
    ? itens.map((i) => {
        const sub = ((i.preco || 0) + extrasItemNP(i)) * (i.qtd || 1);
        return `<div class="np-item">
          <span class="np-item-qtd">${escapar(String(i.qtd || 1))}×</span>
          <span class="np-item-nome">${escapar(i.nome || "")}</span>
          <span class="np-item-preco">R$ ${moedaBR(sub)}</span>
        </div>`;
      }).join("")
    : `<div class="np-item np-item-vazio">Veja os detalhes no pedido.</div>`;
  $("np-total").textContent = "R$ " + moedaBR(d.total || 0);
  const btnNpImp = $("np-imprimir");
  if (btnNpImp) { btnNpImp.hidden = false; marcarImprBloqueado(btnNpImp, planoAtual !== "completo"); }
  overlay.style.display = "flex";
}

function fecharNovoPedido() {
  const overlay = $("novo-pedido-overlay");
  if (overlay) overlay.style.display = "none";
}

async function visualizarNovoPedido() {
  fecharNovoPedido();
  const btn = document.querySelector("nav button[data-aba='pedidos']");
  if (btn) btn.click();                 // troca pra aba Pedidos (carrega lista + marca visto + NOVO)
  await carregarPedidos();
  const p = pedidosCache.find((x) => x.numero === novoPedidoNumeroAtual);
  if (p) abrirModalPedido(p);
}

if ($("np-fechar")) $("np-fechar").addEventListener("click", fecharNovoPedido);
if ($("np-visualizar")) $("np-visualizar").addEventListener("click", visualizarNovoPedido);
// Reimprimir pelo agente: abre o mini-modal p/ o operador escolher a via (evita
// gastar papel reimprimindo as duas sempre). Ao escolher, chama enviaReimpressao.
function reimprimirPedido(id) {
  if (!id) return;
  abrirReimprimirEscolha(id);
}
async function enviaReimpressao(id, via) {
  const r = await api("POST", "/api/pedidos/" + id + "/reimprimir", { via });
  if (r && r.ok) toast("Enviado para impressão.");
  else { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Falha ao reimprimir.", "erro"); }
}
const ICO_REIMP = {
  cozinha: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2v6h6"/><path d="M4 22V4a2 2 0 0 1 2-2h8l6 6v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>',
  cupom: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  ambas: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
};
function abrirReimprimirEscolha(id) {
  const X = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  $("reimprimirCaixa").innerHTML =
    '<button type="button" class="pdv-modal-x" id="reimprimirFechar" aria-label="Fechar">' + X + "</button>" +
    '<h3 class="pdv-modal-titulo">O que reimprimir?</h3>' +
    '<div class="pdv-modal-corpo">' +
      '<p class="sub" style="margin:0 0 12px">Escolha a via para não gastar papel à toa.</p>' +
      '<div class="reimp-opcoes">' +
        '<button type="button" class="reimp-op" data-via="cozinha">' + ICO_REIMP.cozinha + "<span>Comanda (cozinha)</span></button>" +
        '<button type="button" class="reimp-op" data-via="cupom">' + ICO_REIMP.cupom + "<span>Cupom (cliente)</span></button>" +
        '<button type="button" class="reimp-op" data-via="ambas">' + ICO_REIMP.ambas + "<span>Ambas</span></button>" +
      "</div>" +
    "</div>";
  $("reimprimirOverlay").hidden = false;
  const fechar = () => { $("reimprimirOverlay").hidden = true; };
  $("reimprimirFechar").addEventListener("click", fechar);
  $("reimprimirBg").addEventListener("click", fechar);
  $("reimprimirCaixa").querySelectorAll("[data-via]").forEach((b) => b.addEventListener("click", () => {
    fechar();
    enviaReimpressao(id, b.dataset.via);
  }));
}
if ($("np-imprimir")) {
  $("np-imprimir").addEventListener("click", async () => {
    if (planoAtual !== "completo") { abrirUpsell("impressao"); return; }
    await carregarPedidos();
    const p = pedidosCache.find((x) => x.numero === novoPedidoNumeroAtual);
    if (p) reimprimirPedido(p.id);
  });
}

async function checarPedidoNovo() {
  const r = await api("GET", "/api/pedidos/ultimo");
  if (!r) return;
  const d = await r.json().catch(() => null);
  const numero = d && d.numero ? Number(d.numero) : 0;

  // 1ª checagem: estabelece a base sem alertar pedidos que já existiam.
  if (pedidoUltimoNumero == null) {
    pedidoUltimoNumero = numero;
    if (pedidoVistoNumero === 0 || pedidoVistoNumero > numero) pedidoVistoNumero = numero;
    if ($("aba-pedidos").classList.contains("ativa")) marcarPedidosVistos(); // já está na aba
    atualizarBadgePedidos();
    return;
  }

  if (numero > pedidoUltimoNumero) {
    for (let n = pedidoUltimoNumero + 1; n <= numero; n++) pedidosNovosDestaque.add(n);
    pedidoUltimoNumero = numero;
    tocarSomPedido();
    if ($("aba-pedidos").classList.contains("ativa")) {
      carregarPedidos();        // atualiza a lista (linhas novas ganham "NOVO")
      marcarPedidosVistos();    // estando na aba, o badge da sidebar fica zerado
    } else {
      abrirNovoPedido(d);  // modal rico só fora da aba Pedidos
    }
    atualizarBadgePedidos();
  }
}
// O poll de notificação começa em inicial() (depois do boot da sessão).

// Chip de teste grátis no header → abre a aba Assinatura.
const _headerTrial = $("headerTrial");
if (_headerTrial) _headerTrial.addEventListener("click", () => {
  const btn = document.querySelector("nav button[data-aba='assinatura']");
  if (btn) btn.click();
});

// Um único handler de logout, reaproveitado pelos botões Sair (sidebar + header mobile).
async function sair() {
  try { await api("POST", "/api/logout"); } catch (e) { /* ignora */ }
  sessionStorage.clear();
  location.href = "login.html";
}
document.querySelectorAll(".btn-sair").forEach((b) => b.addEventListener("click", sair));

// ============================================================
// ASSINATURA (Stripe) — status, gate e ações de checkout/portal
// ============================================================
let assinaturaAtual = null;
let planoAtual = "essencial"; // plano do tenant (essencial|completo) — gating de features no painel
let pedidoModalAtual = null; // pedido aberto no modal de detalhe (p/ impressão)
const PLANOS_INFO = { essencial: { nome: "Plano Essencial", valor: 79 }, completo: { nome: "Plano Completo", valor: 99 } };

// Upgrade/downgrade de plano (assinatura viva). Confirma, troca no Stripe (proration)
// e recarrega o plano (gating) + a aba Assinatura.
async function trocarPlanoAcao(novoPlano) {
  const info = PLANOS_INFO[novoPlano] || PLANOS_INFO.essencial;
  const ehUpgrade = novoPlano === "completo";
  const recursos = "Mesas e comandas, PDV de balcão, Caixa do dia, frete por raio e impressão de pedidos";
  const msg = ehUpgrade
    ? `Mudar para o ${info.nome} (R$ ${info.valor}/mês)?\n\nA diferença é cobrada proporcionalmente pelo Stripe. Você passa a ter: ${recursos}.`
    : `Mudar para o ${info.nome} (R$ ${info.valor}/mês)?\n\nO ajuste é proporcional. Você deixa de ter: ${recursos}.`;
  if (!window.confirm(msg)) return;
  const r = await api("POST", "/api/assinatura/plano", { plano: novoPlano });
  if (r && r.ok) {
    toast("✓ Plano atualizado!");
    await carregarConta();      // atualiza planoAtual (gating da aba Entrega)
    await carregarAssinatura(); // re-renderiza a aba Assinatura com o novo plano
  } else {
    let d = {};
    try { d = r ? await r.json() : {}; } catch (_) { /* sem corpo */ }
    toast(d.erro || "Não foi possível trocar de plano.", "erro");
  }
}

function diasRestantes(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function fmtDataAssin(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function botaoAssin(texto, onClick, classe = "") {
  const b = document.createElement("button");
  if (classe) b.className = classe;
  b.textContent = texto;
  b.addEventListener("click", onClick);
  return b;
}

async function carregarAssinatura() {
  const r = await api("GET", "/api/assinatura");
  if (!r || !r.ok) return;
  assinaturaAtual = await r.json();
  renderAssinatura(assinaturaAtual);
  aplicarGate(assinaturaAtual);
  carregarCartoes();
  carregarPlataforma();
}

function renderAssinatura(a) {
  const badge = $("assinBadge");
  const info = $("assinInfo");
  const acoes = $("assinAcoes");
  if (!badge || !info || !acoes) return;

  const mapa = {
    trialing: ["Em teste grátis", "trial"],
    active:   ["Ativa", "ok"],
    cortesia: ["Cortesia", "cortesia"],
    past_due: ["Pagamento pendente", "alerta"],
    canceled: ["Cancelada", "alerta"],
    nenhuma:  ["Sem assinatura", "neutro"],
  };
  const [texto, cls] = mapa[a.status] || mapa.nenhuma;
  badge.textContent = texto;
  badge.className = "assin-badge " + cls;

  // Nome e valor do plano vêm da API (não fixos no HTML) — refletem Essencial/Completo.
  const valorMes = a.valorMes || 79;
  const valorTxt = "R$ " + valorMes.toFixed(2).replace(".", ",");
  const nomeEl = $("assinPlanoNome");
  if (nomeEl && a.planoNome) nomeEl.textContent = a.planoNome;
  const valorEl = $("assinPlanoValor");
  if (valorEl) valorEl.textContent = valorTxt;

  // Próximo vencimento no card do plano (trial → fim do teste; ativa → próxima cobrança).
  const venc = $("assinVencimento");
  if (venc) {
    const iso = a.status === "trialing" ? a.trialAte : a.proximaCobranca;
    venc.textContent = iso ? fmtDataAssin(iso) : "—";
  }

  // Histórico de faturas (dados reais do Stripe).
  renderFaturas(a.faturas || []);

  // Chip de teste grátis no header (só durante o trial).
  const chip = $("headerTrial");
  if (chip) {
    if (a.status === "trialing") {
      const d = diasRestantes(a.trialAte);
      chip.textContent = `${d} dia${d === 1 ? "" : "s"} de teste`;
      chip.style.display = "";
    } else {
      chip.style.display = "none";
    }
  }

  if (a.status === "trialing") {
    const d = diasRestantes(a.trialAte);
    info.innerHTML = `Seu teste grátis termina em <strong>${d} dia${d === 1 ? "" : "s"}</strong> (${fmtDataAssin(a.trialAte)}). Depois disso a cobrança de <strong>${valorTxt}/mês</strong> é automática no cartão cadastrado.`;
  } else if (a.status === "active") {
    info.innerHTML = `Assinatura ativa. Próxima cobrança em <strong>${fmtDataAssin(a.proximaCobranca)}</strong> · ${valorTxt}/mês.`;
  } else if (a.status === "cortesia") {
    info.innerHTML = `Acesso liberado pela equipe <strong>Nymbus Lab</strong> (cortesia). Você usa o sistema <strong>sem cobrança</strong> — não é necessário cadastrar cartão.`;
  } else if (a.status === "past_due") {
    info.innerHTML = `Houve um problema com a cobrança. Atualize sua forma de pagamento para manter o bot ativo.`;
  } else if (a.status === "canceled") {
    info.innerHTML = `Sua assinatura foi cancelada. Reative para voltar a usar o bot.`;
  } else {
    info.innerHTML = `Você ainda não ativou o teste grátis de 7 dias.`;
  }

  acoes.innerHTML = "";
  if (a.status === "nenhuma" || a.status === "canceled") {
    acoes.appendChild(botaoAssin("Iniciar teste grátis de 7 dias", iniciarCheckout));
  } else if (a.status === "past_due") {
    acoes.appendChild(botaoAssin("Atualizar pagamento", abrirPortal));
  } else if (a.status === "cortesia") {
    // Cortesia é gerenciada pela equipe (sem assinatura no Stripe). Quem está no
    // Essencial pode assinar o Completo por autoatendimento (checkout) → vira pagante.
    if (a.plano !== "completo") {
      acoes.appendChild(botaoAssin("Assinar o Plano Completo (R$ 99/mês)", () => { location.href = "checkout.html?plano=completo"; }));
    }
  } else {
    acoes.appendChild(botaoAssin("Gerenciar assinatura", abrirPortal, "secundario"));
  }

  // Trocar de plano (upgrade/downgrade) — só com assinatura Stripe viva (trial/ativa).
  if ((a.status === "trialing" || a.status === "active") && a.plano) {
    const outro = a.plano === "completo" ? "essencial" : "completo";
    const infoOutro = PLANOS_INFO[outro];
    const label = (outro === "completo" ? "Fazer upgrade para o " : "Mudar para o ") + infoOutro.nome + " (R$ " + infoOutro.valor + "/mês)";
    acoes.appendChild(botaoAssin(label, () => trocarPlanoAcao(outro), "secundario"));
  }
}

// Histórico de faturas: tabela no desktop, cards no mobile (via CSS).
const STATUS_FATURA = {
  paid:          ["Pago", "ok"],
  open:          ["Em aberto", "alerta"],
  void:          ["Cancelada", "neutro"],
  uncollectible: ["Não paga", "alerta"],
  draft:         ["Rascunho", "neutro"],
};
function renderFaturas(faturas) {
  const lista = $("assinFaturasLista");
  if (!lista) return;
  if (!faturas.length) {
    lista.innerHTML = `<div class="estado-vazio assin-faturas-vazio">
      <p>Nenhuma fatura ainda</p>
      <span class="sub">Suas faturas aparecem aqui após a primeira cobrança.</span>
    </div>`;
    return;
  }
  const cab = `<div class="fatura-item fatura-cab">
    <span>Fatura</span><span>Data</span><span>Valor</span><span>Status</span><span class="fatura-acao-col">PDF</span>
  </div>`;
  const linhas = faturas.map((f) => {
    const [st, scls] = STATUS_FATURA[f.status] || [f.status, "neutro"];
    const numero = f.numero ? `#${escapar(f.numero)}` : `#${escapar(String(f.id).slice(-8))}`;
    const link = f.pdf || f.url;
    const acao = link
      ? `<a class="fatura-baixar" href="${escapar(link)}" target="_blank" rel="noopener" aria-label="Baixar fatura" title="Baixar fatura"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></a>`
      : `<span class="sub">—</span>`;
    return `<div class="fatura-item">
      <span class="fatura-id" data-label="Fatura">${numero}</span>
      <span class="fatura-data" data-label="Data">${fmtDataAssin(f.data)}</span>
      <span class="fatura-valor" data-label="Valor">${Dinheiro.comPrefixo(f.valor)}</span>
      <span data-label="Status"><span class="fatura-status ${scls}">${escapar(st)}</span></span>
      <span class="fatura-acao-col" data-label="PDF">${acao}</span>
    </div>`;
  }).join("");
  lista.innerHTML = cab + linhas;
}

// Info da plataforma (Nymbus): por ora só o WhatsApp de suporte. Mostra o card
// "Precisa de ajuda?" apenas quando há número configurado (nunca botão quebrado).
async function carregarPlataforma() {
  const card = $("assinAjudaCard");
  if (!card) return;
  const r = await api("GET", "/api/plataforma");
  const d = r && r.ok ? await r.json().catch(() => ({})) : {};
  const num = d && d.suporteWhatsapp;
  if (num) {
    const link = `https://wa.me/${String(num).replace(/\D/g, "")}`;
    $("btnSuporte").setAttribute("href", link);
    card.style.display = "";
  } else {
    card.style.display = "none";
  }
}

function aplicarGate(a) {
  const overlay = $("gate-overlay");
  if (!overlay) return;
  if (a.acessoLiberado) { overlay.style.display = "none"; return; }

  const titulo = $("gate-titulo");
  const msg = $("gate-mensagem");
  const acao = $("gate-acao");
  if (a.status === "past_due") {
    titulo.textContent = "Pagamento pendente";
    msg.textContent = "Houve um problema com a cobrança da sua assinatura. Atualize sua forma de pagamento para reativar o bot.";
    acao.textContent = "Atualizar pagamento";
    acao.onclick = abrirPortal;
  } else if (a.status === "canceled") {
    titulo.textContent = "Assinatura cancelada";
    msg.textContent = "Reative sua assinatura para voltar a usar o bot e o painel.";
    acao.textContent = "Reativar assinatura";
    acao.onclick = iniciarCheckout;
  } else {
    titulo.textContent = "Ative seu teste grátis";
    msg.textContent = "Comece com 7 dias grátis. Você só é cobrado a partir do 8º dia — e pode cancelar antes sem custo.";
    acao.textContent = "Iniciar teste grátis de 7 dias";
    acao.onclick = iniciarCheckout;
  }
  overlay.style.display = "flex";
}

function iniciarCheckout(e) {
  if (e && e.currentTarget) e.currentTarget.disabled = true;
  // Checkout próprio (Stripe Elements) com a identidade do site.
  location.href = "checkout.html";
}

async function abrirPortal(e) {
  const btn = e && e.currentTarget;
  if (btn) btn.disabled = true;
  const r = await api("POST", "/api/assinatura/portal");
  if (r && r.ok) {
    const d = await r.json();
    if (d.url) { location.href = d.url; return; }
  }
  toast("Não foi possível abrir o portal de assinatura.", "erro");
  if (btn) btn.disabled = false;
}

const _gateSair = $("gate-sair");
if (_gateSair) _gateSair.addEventListener("click", sair);

// ---- Gestão de cartões (Stripe) no painel ----
const MARCAS_CARTAO = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex", elo: "Elo",
  hipercard: "Hipercard", diners: "Diners", discover: "Discover", jcb: "JCB",
};
function nomeMarca(m) { return MARCAS_CARTAO[m] || (m ? m[0].toUpperCase() + m.slice(1) : "Cartão"); }

async function carregarCartoes() {
  const card = $("assinCartoesCard");
  if (!card) return;
  const r = await api("GET", "/api/assinatura/cartoes");
  if (!r || !r.ok) { card.style.display = "none"; return; }
  const { cartoes } = await r.json();
  // Sem Customer no Stripe (cortesia/sem assinatura) → não há cartões a gerenciar.
  if (!cartoes || !cartoes.length) { card.style.display = "none"; return; }
  card.style.display = "";
  renderCartoes(cartoes);
}

function renderCartoes(cartoes) {
  const lista = $("assinCartoesLista");
  lista.innerHTML = "";
  cartoes.forEach((c) => {
    const exp = c.mes && c.ano ? `${String(c.mes).padStart(2, "0")}/${String(c.ano).slice(-2)}` : "";
    const item = document.createElement("div");
    item.className = "cartao-item" + (c.padrao ? " padrao" : "");
    const acoes = c.padrao
      ? `<span class="cartao-padrao-tag">Padrão</span>`
      : `<button type="button" class="secundario mini" data-padrao="${c.id}">Tornar padrão</button>
         <button type="button" class="perigo mini" data-remover="${c.id}">Remover</button>`;
    item.innerHTML = `
      <div class="cartao-info">
        <svg class="cartao-icone" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        <div class="cartao-texto">
          <span class="cartao-marca">${escapar(nomeMarca(c.marca))} •••• ${escapar(c.ultimos4)}</span>
          ${exp ? `<span class="cartao-exp">Expira ${exp}</span>` : ""}
        </div>
      </div>
      <div class="cartao-item-acoes">${acoes}</div>`;
    lista.appendChild(item);
  });

  lista.querySelectorAll("[data-padrao]").forEach((b) =>
    b.addEventListener("click", () => definirPadrao(b.dataset.padrao, b)));
  lista.querySelectorAll("[data-remover]").forEach((b) =>
    b.addEventListener("click", () => removerCartao(b.dataset.remover, b)));
}

async function definirPadrao(id, btn) {
  btn.disabled = true;
  const r = await api("PATCH", `/api/assinatura/cartoes/${id}/padrao`);
  const d = r ? await r.json().catch(() => ({})) : {};
  if (r && r.ok) { toast("✓ Cartão padrão atualizado!"); await carregarCartoes(); }
  else { toast((d && d.erro) || "Não foi possível definir o cartão padrão.", "erro"); btn.disabled = false; }
}

async function removerCartao(id, btn) {
  const ok = await confirmar("Remover cartão", "Tem certeza que deseja remover este cartão?");
  if (!ok) return;
  btn.disabled = true;
  const r = await api("DELETE", `/api/assinatura/cartoes/${id}`);
  const d = r ? await r.json().catch(() => ({})) : {};
  if (r && r.ok) { toast("✓ Cartão removido."); await carregarCartoes(); }
  else { toast((d && d.erro) || "Não foi possível remover o cartão.", "erro"); btn.disabled = false; }
}

// Modal de adicionar cartão (Payment Element, mesmo visual do checkout).
let _cartaoStripe = null, _cartaoElements = null;
function aparenciaStripe() {
  return {
    theme: "night",
    variables: {
      colorPrimary: "#6344BC", colorBackground: "#222533", colorText: "#F0F2FA",
      colorTextSecondary: "#8B92B3", colorDanger: "#EF4444",
      fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      borderRadius: "10px", spacingUnit: "4px",
    },
  };
}

async function abrirModalCartao() {
  const overlay = $("cartao-overlay");
  const btn = $("cartao-salvar");
  const erro = $("cartao-erro");
  erro.textContent = "";
  btn.disabled = true; btn.textContent = "Carregando…";
  overlay.style.display = "flex";
  $("cartao-payment").innerHTML = "";
  try {
    const r = await api("POST", "/api/assinatura/cartoes/setup-intent");
    if (!r || !r.ok) { erro.textContent = "Não foi possível iniciar a adição do cartão."; return; }
    const { clientSecret, publishableKey } = await r.json();
    _cartaoStripe = Stripe(publishableKey);
    _cartaoElements = _cartaoStripe.elements({ clientSecret, appearance: aparenciaStripe() });
    const pe = _cartaoElements.create("payment", { layout: "tabs" });
    pe.mount("#cartao-payment");
    pe.on("ready", () => { btn.disabled = false; btn.textContent = "Salvar cartão"; });
  } catch (e) {
    erro.textContent = "Erro ao conectar ao servidor.";
  }
}

function fecharModalCartao() {
  $("cartao-overlay").style.display = "none";
  _cartaoStripe = null; _cartaoElements = null;
}

if ($("btnAddCartao")) $("btnAddCartao").addEventListener("click", abrirModalCartao);
if ($("cartao-fechar")) $("cartao-fechar").addEventListener("click", fecharModalCartao);
if ($("cartao-cancelar")) $("cartao-cancelar").addEventListener("click", fecharModalCartao);

if ($("cartao-form")) $("cartao-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!_cartaoStripe || !_cartaoElements) return;
  const btn = $("cartao-salvar");
  const erro = $("cartao-erro");
  erro.textContent = "";
  btn.disabled = true; btn.textContent = "Salvando…";
  const { error, setupIntent } = await _cartaoStripe.confirmSetup({
    elements: _cartaoElements,
    redirect: "if_required",
  });
  if (error) { erro.textContent = error.message || "Não foi possível salvar o cartão."; btn.disabled = false; btn.textContent = "Salvar cartão"; return; }
  if (!setupIntent || setupIntent.status !== "succeeded") {
    erro.textContent = "Não foi possível confirmar o cartão. Tente novamente.";
    btn.disabled = false; btn.textContent = "Salvar cartão"; return;
  }
  fecharModalCartao();
  toast("✓ Cartão adicionado!");
  await carregarCartoes();
});

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
    toast(d.erro || "Não foi possível limpar a sessão. Pare o bot e tente novamente.", "erro");
  }
  setTimeout(atualizarStatus, 1200);
}

setInterval(() => {
  if ($("cfg-sub-conexao").classList.contains("ativa")) atualizarStatus();
}, 4000);

// ============================================================
// CARDÁPIO
// ============================================================
// Exibição monetária pt-BR unificada (ver public/dinheiro.js) — "1.234,56".
function moedaBR(v) { return Dinheiro.formatar(v); }

// Termo da busca da Gestão de Itens (estado de view efêmero — não persistido).
let cardapioBusca = "";
let mostrarArquivados = false;
const SVG_ESTRELA = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> `;

// Modal de item COM vendas (3 botões) → resolve "arquivar" | "excluir" | null.
function modalItemComVendas(nome, vendas) {
  return new Promise((resolve) => {
    const overlay = $("item-del-overlay");
    $("idel-nome").textContent = nome || "(sem nome)";
    $("idel-vendas").textContent = vendas > 0 ? `${vendas} venda${vendas > 1 ? "s" : ""}` : "vendas";
    overlay.style.display = "flex";
    overlay.classList.remove("saindo");
    function fechar(r) {
      overlay.classList.add("saindo");
      overlay.addEventListener("animationend", () => { overlay.style.display = "none"; overlay.classList.remove("saindo"); }, { once: true });
      $("idel-cancelar").removeEventListener("click", onCancel);
      $("idel-excluir").removeEventListener("click", onExcluir);
      $("idel-arquivar").removeEventListener("click", onArquivar);
      resolve(r);
    }
    function onCancel() { fechar(null); }
    function onExcluir() { fechar("excluir"); }
    function onArquivar() { fechar("arquivar"); }
    $("idel-cancelar").addEventListener("click", onCancel);
    $("idel-excluir").addEventListener("click", onExcluir);
    $("idel-arquivar").addEventListener("click", onArquivar);
  });
}

async function salvarCardapioRemoto() {
  const r = await api("PUT", "/api/cardapio", cardapioAtual);
  return !!(r && r.ok);
}

async function excluirItem(ci, ii) {
  const removido = cardapioAtual.categorias[ci].itens.splice(ii, 1)[0];
  renderCardapio();
  if (await salvarCardapioRemoto()) toast("Item excluído.");
  else { cardapioAtual.categorias[ci].itens.splice(ii, 0, removido); renderCardapio(); toast("Erro ao excluir. Tente novamente.", "erro"); }
}

async function arquivarItem(ci, ii, valor) {
  const item = cardapioAtual.categorias[ci].itens[ii];
  const antes = item.arquivado;
  item.arquivado = valor;
  renderCardapio();
  if (await salvarCardapioRemoto()) toast(valor ? "Item arquivado." : "Item restaurado.");
  else { item.arquivado = antes; renderCardapio(); toast("Erro ao salvar. Tente novamente.", "erro"); }
}

async function fluxoExcluirItem(ci, ii) {
  const item = cardapioAtual.categorias[ci].itens[ii];
  let vendas = 0;
  if (item.id != null) {
    const r = await api("GET", `/api/cardapio/item/${item.id}/vendas`);
    if (r && r.ok) { const d = await r.json(); vendas = d.vendas || 0; }
    else vendas = -1; // falha → trata como "com vendas" (mais seguro)
  }
  if (vendas === 0) {
    const ok = await confirmar("Excluir item?", "Esta ação não pode ser desfeita.", "Excluir");
    if (ok) await excluirItem(ci, ii);
    return;
  }
  const escolha = await modalItemComVendas(item.nome, vendas);
  if (escolha === "arquivar") await arquivarItem(ci, ii, true);
  else if (escolha === "excluir") await excluirItem(ci, ii);
}

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
  const termo = cardapioBusca.trim();
  let totalMostrado = 0;
  cardapioAtual.categorias.forEach((cat, ci) => {
    const ativos = cat.itens.filter((it) => !it.arquivado).length;
    const itensCat = cat.itens
      .map((item, ii) => ({ item, ii }))
      .filter(({ item }) => mostrarArquivados || !item.arquivado)
      .filter(({ item }) => Busca.itemCasaBusca(item.nome, termo));
    if (cat.itens.length > 0 && itensCat.length === 0) return; // tem itens mas todos filtrados → some
    totalMostrado += itensCat.length;
    const n = ativos;
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
      <div class="itens-tabela" data-itens="${ci}">
        <div class="il-grid itens-tabela-head">
          <span>Produto</span><span>Preço</span><span>Estoque</span><span>Mínimo</span><span class="il-disp-h">Disponível</span><span></span>
        </div>
      </div>
    `;
    c.appendChild(div);
    const grid = div.querySelector(`[data-itens="${ci}"]`);
    itensCat.forEach(({ item, ii }) => {
      const linha = document.createElement("div");
      linha.className = "il-grid item-linha" + (item.disponivel ? "" : " item-linha--indisp") + (item.arquivado ? " item-linha--arquivado" : "");
      const temFoto = item.imagem && item.imagem !== "";
      const est = Estoque.statusEstoque(item);
      const un = est.unidade;
      const celEst = !est.controlado
        ? `<span class="il-vazio">—</span>`
        : `<span class="il-est ${est.esgotado ? "il-est--zero" : est.baixo ? "il-est--baixo" : "il-est--ok"}">${Estoque.formatarQtd(est.quantidade, un)}<span class="un">${un}</span></span>${est.esgotado ? `<span class="il-chip il-chip--zero">Esgotado</span>` : est.baixo ? `<span class="il-chip il-chip--baixo">Baixo</span>` : ""}`;
      const celMin = !est.controlado
        ? `<span class="il-vazio">—</span>`
        : `<span class="il-min">${Estoque.formatarQtd(est.minimo, un)}<span class="un">${un}</span></span>`;
      linha.innerHTML = `
        <div class="il-produto">
          <div class="il-foto">
            ${temFoto
              ? `<img src="${escapar(item.imagem)}" alt="${escapar(item.nome)}" loading="lazy" />`
              : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`
            }
          </div>
          <div class="il-corpo">
            <span class="il-nome">${escapar(item.nome) || "(sem nome)"}${item.destaque ? ` <span class="il-tag-destaque">${SVG_ESTRELA}Destaque</span>` : ""}${item.apenasLocal ? ` <span class="il-tag-local">Só no local</span>` : ""}${item.arquivado ? ` <span class="il-tag-arq">Arquivado</span>` : ""}</span>
            ${item.desc ? `<span class="il-desc">${escapar(item.desc)}</span>` : ""}
          </div>
        </div>
        <span class="il-preco il-cel" data-label="Preço"><span class="il-cel-val">R$ ${moedaBR(item.preco)}${item.unidade === "kg" ? `<span class="il-un-preco">/kg</span>` : ""}</span></span>
        <span class="il-num il-cel" data-label="Estoque"><span class="il-cel-val">${celEst}</span></span>
        <span class="il-num il-cel" data-label="Mínimo"><span class="il-cel-val">${celMin}</span></span>
        <span class="il-disp il-cel" data-label="Disponível"><span class="toggle"><input type="checkbox" ${item.disponivel ? "checked" : ""} ${item.arquivado ? "disabled" : ""} class="itDisp" data-c="${ci}" data-i="${ii}" /></span></span>
        <span class="il-acoes">
          ${item.arquivado
            ? `<button class="mini" data-restore-item="${ci}-${ii}" aria-label="Restaurar item" title="Restaurar">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>
              </button>`
            : `<button class="mini" data-edit-item="${ci}-${ii}" aria-label="Editar item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>`}
          <button class="perigo mini" data-del-item="${ci}-${ii}" aria-label="Excluir item">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </span>
      `;
      grid.appendChild(linha);
    });
    const addLinha = document.createElement("button");
    addLinha.className = "item-add-linha";
    addLinha.setAttribute("data-add-item", ci);
    addLinha.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>Adicionar item nesta categoria</span>
    `;
    grid.appendChild(addLinha);
  });
  if (termo && totalMostrado === 0) {
    c.innerHTML = `<p class="cardapio-vazio-busca">Nenhum item encontrado para "<strong>${escapar(termo)}</strong>".</p>`;
  }
  ligarEventosCardapio();
}

function ligarEventosCardapio() {
  document.querySelectorAll(".catNome").forEach((el) => {
    el.addEventListener("input", (e) => { cardapioAtual.categorias[e.target.dataset.cat].nome = e.target.value; });
    el.addEventListener("blur", (e) => { // padroniza ao sair do campo (assistivo)
      const v = Texto.tituloPt(e.target.value);
      e.target.value = v;
      cardapioAtual.categorias[e.target.dataset.cat].nome = v;
    });
  });
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
      const [ci, ii] = e.currentTarget.dataset.delItem.split("-").map(Number);
      fluxoExcluirItem(ci, ii);
    })
  );
  document.querySelectorAll("[data-restore-item]").forEach((el) =>
    el.addEventListener("click", (e) => {
      const [ci, ii] = e.currentTarget.dataset.restoreItem.split("-").map(Number);
      arquivarItem(ci, ii, false);
    })
  );
  document.querySelectorAll("[data-edit-item]").forEach((el) =>
    el.addEventListener("click", (e) => {
      const [ci, ii] = e.currentTarget.dataset.editItem.split("-").map(Number);
      abrirEditorItem(ci, ii);
    })
  );
  document.querySelectorAll("[data-add-item]").forEach((el) =>
    el.addEventListener("click", (e) => {
      abrirEditorItem(+e.currentTarget.dataset.addItem, -1);
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

// id único e estável para uma variação (único DENTRO do item; usado p/ casar o estoque
// na baixa). Aleatório porque novoId() repetiria entre cliques síncronos (max+1 fixo).
function novoVarId() {
  return "v" + Math.random().toString(36).slice(2, 9);
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
    $("editor-preco-custo").value = "";
    $("editor-preco").value = "";
    $("editor-desc").value = "";
    $("editor-disponivel").checked = true;
    $("editor-entrega").checked = true;
    $("editor-estoque").value = "";
    $("editor-estoque-min").value = "";
    $("editor-unidade").value = "un";
    $("editor-destaque").checked = false;
    $("editor-cozinha").checked = false;
    editorFotoUrl = "";
    editorComposicao = [];
    editorOpcionais = [];
    editorVariacoes = [];
  } else {
    const it = cardapioAtual.categorias[ci].itens[ii];
    $("editor-nome").value = it.nome || "";
    Dinheiro.setValor("editor-preco-custo", it.precoCusto);
    Dinheiro.setValor("editor-preco", it.preco);
    $("editor-desc").value = it.desc || "";
    $("editor-disponivel").checked = it.disponivel !== false;
    $("editor-entrega").checked = it.apenasLocal !== true;
    $("editor-estoque").value = it.estoque != null ? it.estoque : "";
    $("editor-estoque-min").value = it.estoqueMinimo != null ? it.estoqueMinimo : "";
    $("editor-unidade").value = it.unidade === "kg" ? "kg" : "un";
    $("editor-destaque").checked = it.destaque === true;
    $("editor-cozinha").checked = it.cozinha === true;
    editorFotoUrl = it.imagem || "";
    editorComposicao = (typeof Grupos !== "undefined" ? Grupos.normalizarGrupos(it.composicao) : (Array.isArray(it.composicao) ? it.composicao : []));
    editorOpcionais = parsearOpcionais(it.opcionais || "");
    editorVariacoes = (typeof Variacoes !== "undefined" ? Variacoes.normalizarVariacoes(it.variacoes) : []);
  }
  // Abre na aba Principal
  $("editor-tabs-nav").querySelectorAll(".editor-tab").forEach((t) => t.classList.remove("ativo"));
  $("editor-tabs-nav").querySelector('[data-tab="principal"]').classList.add("ativo");
  document.querySelectorAll(".editor-panel").forEach((p) => p.classList.remove("ativo"));
  document.getElementById("panel-principal").classList.add("ativo");

  renderEditorComposicao();
  renderEditorOpcionais();
  renderEditorVariacoes();
  aplicarUnidadeEditor();

  atualizarPreviewFoto();

  const overlay = $("editor-overlay");
  overlay.style.display = "flex";
  overlay.classList.remove("saindo");
  setTimeout(() => $("editor-nome").focus(), 80);
}

// Item por kg: mostra a dica e desabilita "Disponível para entrega" (não é pedível).
function aplicarUnidadeEditor() {
  const kg = $("editor-unidade").value === "kg";
  $("editor-kg-dica").hidden = !kg;
  $("editor-entrega").disabled = kg;
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
  const preco = Dinheiro.valor("editor-preco");
  const varsNorm = (typeof Variacoes !== "undefined" ? Variacoes.normalizarVariacoes(editorVariacoes) : []);

  if (!nome) {
    $("editor-erro").textContent = "Informe o nome do item.";
    $("editor-nome").focus();
    return;
  }
  // Item COM variações pode ter preço base 0 (o preço vem das variações escolhidas).
  if ((!preco || preco <= 0) && !varsNorm.length) {
    $("editor-erro").textContent = "Informe um preço válido maior que zero (ou adicione variações com preço).";
    $("editor-preco").focus();
    return;
  }

  $("editor-erro").textContent = "";
  const novoCi = +$("editor-categoria").value;

  const precoCusto = Dinheiro.valor("editor-preco-custo");

  const novoItem = {
    id:          editorIi === -1 ? novoId() : cardapioAtual.categorias[editorCi].itens[editorIi].id,
    nome,
    preco,
    desc:        $("editor-desc").value,
    disponivel:  $("editor-disponivel").checked,
    apenasLocal: !$("editor-entrega").checked,
    composicao:  (typeof Grupos !== "undefined" ? Grupos.normalizarGrupos(editorComposicao) : editorComposicao),
    opcionais:   serializarOpcionais(editorOpcionais),
    imagem:      editorFotoUrl,
  };
  if (precoCusto > 0) novoItem.precoCusto = precoCusto;

  const unidade = $("editor-unidade").value === "kg" ? "kg" : "un";
  if (unidade === "kg") novoItem.unidade = "kg";
  if ($("editor-destaque").checked) novoItem.destaque = true;
  if ($("editor-cozinha").checked) novoItem.cozinha = true;
  const estoqueRaw = $("editor-estoque").value.trim();
  const estoqueMinRaw = $("editor-estoque-min").value.trim();
  const parseEst = (s) => unidade === "kg" ? (parseFloat(s.replace(",", ".")) || 0) : (parseInt(s, 10) || 0);
  if (estoqueRaw !== "") novoItem.estoque = Math.max(0, parseEst(estoqueRaw));
  if (estoqueMinRaw !== "") novoItem.estoqueMinimo = Math.max(0, parseEst(estoqueMinRaw));
  if (varsNorm.length) novoItem.variacoes = varsNorm;

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

// Busca do cardápio (fixo — o campo é estático, fora do container re-renderizado,
// por isso o foco não se perde ao digitar).
$("cardapioBusca").addEventListener("input", (e) => {
  cardapioBusca = e.target.value;
  renderCardapio();
});
$("cardapioBusca").addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.target.value = "";
    cardapioBusca = "";
    renderCardapio();
  }
});
$("cardapioMostrarArq").addEventListener("change", (e) => {
  mostrarArquivados = e.target.checked;
  renderCardapio();
});

// Listeners do editor (fixos — não precisam ser re-ligados a cada render)
$("editor-fechar").addEventListener("click", fecharEditorItem);
$("editor-cancelar").addEventListener("click", fecharEditorItem);
$("editor-salvar").addEventListener("click", salvarEditorItem);
$("editor-unidade").addEventListener("change", aplicarUnidadeEditor);
$("editor-overlay").addEventListener("click", (e) => {
  if (e.target === $("editor-overlay")) fecharEditorItem();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("editor-overlay").style.display !== "none") fecharEditorItem();
});
// Navegação entre abas do editor
$("editor-tabs-nav").addEventListener("click", (e) => {
  const tab = e.target.closest(".editor-tab");
  if (!tab) return;
  const tabName = tab.dataset.tab;
  if (!tabName) return;
  $("editor-tabs-nav").querySelectorAll(".editor-tab").forEach((t) => t.classList.remove("ativo"));
  tab.classList.add("ativo");
  document.querySelectorAll(".editor-panel").forEach((p) => p.classList.remove("ativo"));
  const panel = document.getElementById("panel-" + tabName);
  if (panel) panel.classList.add("ativo");
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
  editorComposicao.push({ nome: "", obrigatorio: false, min: 0, max: 0, itens: [] });
  renderEditorComposicao();
});

// ============================================================
// IDENTIDADE VISUAL DO CARDÁPIO (capa + logo)
// Reusa POST /api/imagem (Storage). As URLs ficam na config (restaurante.capa/logo).
// ============================================================
function atualizarPreviewIdentidade() {
  const capaImg = $("identCapaImg"), capaPh = $("identCapaPh");
  if (identCapaUrl) { capaImg.src = identCapaUrl; capaImg.hidden = false; capaPh.hidden = true; }
  else { capaImg.removeAttribute("src"); capaImg.hidden = true; capaPh.hidden = false; }
  $("identCapaBtn").textContent = identCapaUrl ? "Trocar capa" : "Enviar capa";

  const logoImg = $("identLogoImg"), logoPh = $("identLogoPh");
  if (identLogoUrl) { logoImg.src = identLogoUrl; logoImg.hidden = false; logoPh.hidden = true; }
  else { logoImg.removeAttribute("src"); logoImg.hidden = true; logoPh.hidden = false; logoPh.textContent = (($("cfgNome").value || "?").trim()[0] || "?").toUpperCase(); }
  $("identLogoBtn").textContent = identLogoUrl ? "Trocar logo" : "Enviar logo";
}

// Upload genérico de uma imagem da identidade → devolve a URL pública (ou null).
async function enviarImagemIdentidade(file, btn, rotulo) {
  if (!file) return null;
  const txtOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Enviando...";
  try {
    const form = new FormData();
    form.append("imagem", file);
    const r = await fetch("/api/imagem", { method: "POST", headers: { Authorization: "Bearer " + token }, body: form });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast(d.erro || "Erro ao enviar a " + rotulo + ".", "erro");
      return null;
    }
    const { url } = await r.json();
    return url;
  } catch {
    toast("Erro de rede ao enviar a " + rotulo + ".", "erro");
    return null;
  } finally {
    btn.disabled = false;
    btn.textContent = txtOriginal;
  }
}

$("identCapaBtn").addEventListener("click", () => $("identCapaInput").click());
$("identCapaInput").addEventListener("change", async () => {
  const file = $("identCapaInput").files[0];
  $("identCapaInput").value = "";
  const url = await enviarImagemIdentidade(file, $("identCapaBtn"), "capa");
  if (url) { identCapaUrl = url; atualizarPreviewIdentidade(); }
});
$("identCapaRemover").addEventListener("click", () => { identCapaUrl = ""; atualizarPreviewIdentidade(); });

$("identLogoBtn").addEventListener("click", () => $("identLogoInput").click());
$("identLogoInput").addEventListener("change", async () => {
  const file = $("identLogoInput").files[0];
  $("identLogoInput").value = "";
  const url = await enviarImagemIdentidade(file, $("identLogoBtn"), "logo");
  if (url) { identLogoUrl = url; atualizarPreviewIdentidade(); }
});
$("identLogoRemover").addEventListener("click", () => { identLogoUrl = ""; atualizarPreviewIdentidade(); });

// ============================================================
// CONSTRUTOR DE COMPOSIÇÃO
// ============================================================
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
      <div class="comp-sg-regras">
        <label class="comp-sg-obrig-lbl"><input type="checkbox" class="comp-sg-obrig" data-sg="${si}" ${sg.obrigatorio ? "checked" : ""} /> Obrigatório</label>
        <label class="comp-sg-num">mín <input type="number" min="0" class="comp-sg-min" data-sg="${si}" value="${Number(sg.min) || 0}" /></label>
        <label class="comp-sg-num">máx <input type="number" min="0" class="comp-sg-max" data-sg="${si}" value="${Number(sg.max) || 0}" /></label>
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

  container.querySelectorAll(".comp-sg-obrig").forEach((el) =>
    el.addEventListener("change", (e) => {
      editorComposicao[+e.target.dataset.sg].obrigatorio = e.target.checked;
    })
  );
  container.querySelectorAll(".comp-sg-min").forEach((el) =>
    el.addEventListener("input", (e) => {
      editorComposicao[+e.target.dataset.sg].min = Math.max(0, parseInt(e.target.value, 10) || 0);
    })
  );
  container.querySelectorAll(".comp-sg-max").forEach((el) =>
    el.addEventListener("input", (e) => {
      editorComposicao[+e.target.dataset.sg].max = Math.max(0, parseInt(e.target.value, 10) || 0);
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
        <input type="text" inputmode="numeric" class="opc-preco" placeholder="0,00" value="${op.preco ? Dinheiro.formatar(op.preco) : ""}" data-oi="${oi}" />
      </div>
      <button type="button" class="perigo mini opc-del" data-oi="${oi}" aria-label="Remover">×</button>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll(".opc-nome").forEach((el) => {
    el.addEventListener("input", (e) => { editorOpcionais[+e.target.dataset.oi].nome = e.target.value; });
    el.addEventListener("blur", (e) => { // padroniza ao sair do campo (assistivo)
      const v = Texto.tituloPt(e.target.value);
      e.target.value = v;
      editorOpcionais[+e.target.dataset.oi].nome = v;
    });
  });

  container.querySelectorAll(".opc-preco").forEach((el) => {
    Dinheiro.mascarar(el);
    el.addEventListener("input", (e) => { editorOpcionais[+e.target.dataset.oi].preco = Dinheiro.valor(e.target); });
  });

  container.querySelectorAll(".opc-del").forEach((el) =>
    el.addEventListener("click", (e) => {
      editorOpcionais.splice(+e.target.dataset.oi, 1);
      renderEditorOpcionais();
    })
  );
}

// Padroniza o nome do produto ao sair do campo (Title Case PT-BR; assistivo — o save lê este valor).
$("editor-nome").addEventListener("blur", (e) => { e.target.value = Texto.tituloPt(e.target.value); });

$("editor-opc-add").addEventListener("click", () => {
  editorOpcionais.push({ nome: "", preco: 0 });
  renderEditorOpcionais();
  const inputs = $("editor-opcionais-builder").querySelectorAll(".opc-nome");
  if (inputs.length) inputs[inputs.length - 1].focus();
});

// ---- Variações: opções com preço E estoque próprios (ex.: sabores de refrigerante) ----
function renderEditorVariacoes() {
  const container = $("editor-variacoes-builder");
  container.innerHTML = "";
  editorVariacoes.forEach((v, vi) => {
    const div = document.createElement("div");
    div.className = "var-linha";
    div.innerHTML = `
      <input class="var-nome" placeholder="Nome (ex.: Coca-Cola)" value="${escapar(v.nome || "")}" data-vi="${vi}" />
      <div class="opc-preco-wrap"><span class="opc-rs">R$</span>
        <input type="text" inputmode="numeric" class="opc-preco var-preco" placeholder="0,00" value="${v.preco ? Dinheiro.formatar(v.preco) : ""}" data-vi="${vi}" /></div>
      <input class="var-est" inputmode="numeric" placeholder="estoque" value="${escapar(v.estoque != null ? String(v.estoque) : "")}" data-vi="${vi}" />
      <input class="var-estmin" inputmode="numeric" placeholder="mín" value="${escapar(v.estoqueMinimo != null ? String(v.estoqueMinimo) : "")}" data-vi="${vi}" />
      <button type="button" class="mini var-order" data-vi="${vi}" data-dir="up" aria-label="Subir" title="Subir"${vi === 0 ? ' disabled' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
      </button>
      <button type="button" class="mini var-order" data-vi="${vi}" data-dir="down" aria-label="Descer" title="Descer"${vi === editorVariacoes.length - 1 ? ' disabled' : ''}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <button type="button" class="perigo mini var-del" data-vi="${vi}" aria-label="Remover">×</button>
    `;
    container.appendChild(div);
  });
  container.querySelectorAll(".var-order").forEach((el) =>
    el.addEventListener("click", (e) => {
      const vi = +e.currentTarget.dataset.vi;
      const dir = e.currentTarget.dataset.dir;
      const target = dir === "up" ? vi - 1 : vi + 1;
      if (target < 0 || target >= editorVariacoes.length) return;
      [editorVariacoes[vi], editorVariacoes[target]] = [editorVariacoes[target], editorVariacoes[vi]];
      renderEditorVariacoes();
      const inputs = container.querySelectorAll(".var-nome");
      if (inputs[target]) inputs[target].focus();
    })
  );
  container.querySelectorAll(".var-nome").forEach((el) => {
    el.addEventListener("input", (e) => { editorVariacoes[+e.target.dataset.vi].nome = e.target.value; });
    el.addEventListener("blur", (e) => { const val = Texto.tituloPt(e.target.value); e.target.value = val; editorVariacoes[+e.target.dataset.vi].nome = val; });
  });
  container.querySelectorAll(".var-preco").forEach((el) => {
    Dinheiro.mascarar(el);
    el.addEventListener("input", (e) => { editorVariacoes[+e.target.dataset.vi].preco = Dinheiro.valor(e.target); });
  });
  container.querySelectorAll(".var-est").forEach((el) =>
    el.addEventListener("input", (e) => { editorVariacoes[+e.target.dataset.vi].estoque = e.target.value; })
  );
  container.querySelectorAll(".var-estmin").forEach((el) =>
    el.addEventListener("input", (e) => { editorVariacoes[+e.target.dataset.vi].estoqueMinimo = e.target.value; })
  );
  container.querySelectorAll(".var-del").forEach((el) =>
    el.addEventListener("click", (e) => { editorVariacoes.splice(+e.target.dataset.vi, 1); renderEditorVariacoes(); })
  );
}

$("editor-var-add").addEventListener("click", () => {
  editorVariacoes.push({ id: novoVarId(), nome: "", preco: 0 });
  renderEditorVariacoes();
  const inputs = $("editor-variacoes-builder").querySelectorAll(".var-nome");
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

// Monta um texto pt-BR de horário a partir da tabela: agrupa dias seguidos com
// o mesmo abre/fecha e pula os fechados. Ex.: "Nosso atendimento é de *Segunda*
// a *Sexta* das *11:00* às *22:00*; *Sábado* das *11:00* às *23:00*".
function resumirHorarios(horarios) {
  const grupos = [];
  let atual = null;
  for (const { key, label } of DIAS_SEMANA) {
    const h = horarios[key] || {};
    if (h.fechado) { atual = null; continue; } // dia fechado quebra a sequência
    const abre = h.abre || "11:00";
    const fecha = h.fecha || "22:00";
    if (atual && atual.abre === abre && atual.fecha === fecha) {
      atual.fim = label; // estende o grupo
    } else {
      atual = { ini: label, fim: label, abre, fecha };
      grupos.push(atual);
    }
  }
  if (!grupos.length) return "";
  const trechos = grupos.map((g) => {
    const dias = g.ini === g.fim ? `*${g.ini}*` : `de *${g.ini}* a *${g.fim}*`;
    return `${dias} das *${g.abre}* às *${g.fecha}*`;
  });
  return "Nosso atendimento é " + trechos.join("; ");
}

function preencherConfig() {
  const c = configAtual;
  $("cfgNome").value = c.restaurante.nome || "";
  $("cfgTelefone").value = c.restaurante.telefone || "";
  // Identidade visual (capa + logo do cardápio web)
  identCapaUrl = c.restaurante.capa || "";
  identLogoUrl = c.restaurante.logo || "";
  atualizarPreviewIdentidade();
  // Texto de horário é gerado automaticamente da tabela (campo read-only).
  $("cfgHorario").value = resumirHorarios(c.horarios || {}) || c.restaurante.horario || "";
  // Endereço estruturado (CEP + autofill). Tenants antigos só têm a string `endereco`.
  const r = c.restaurante;
  $("cfgCep").value = r.cep || "";
  $("cfgLogradouro").value = r.logradouro || "";
  $("cfgNumero").value = r.numero || "";
  $("cfgBairro").value = r.bairro || "";
  $("cfgComplemento").value = r.complemento || "";
  $("cfgCidade").value = r.cidade || "";
  $("cfgUf").value = r.uf || "";
  const temEstrut = !!(r.logradouro || r.cidade || r.cep);
  const cepHint = $("cfgEnderecoHint");
  if (cepHint) {
    cepHint.className = "cep-hint";
    cepHint.textContent = (!temEstrut && r.endereco)
      ? `Endereço atual: ${r.endereco}. Preencha o CEP para atualizar.`
      : "Digite o CEP para preencher o endereço automaticamente.";
  }
  $("cfgAberto").checked = !!c.atendimento.aberto;
  $("cfgTempo").value = c.atendimento.tempoEstimado || "";
  Dinheiro.setValor("cfgTaxaEntrega", c.atendimento.taxaEntrega || 0);
  // Modo de frete (Entrega): "fixo" (padrão) | "raio". Gating do raio em renderEntregaModo.
  const modo = (c.frete && c.frete.modo) || "fixo";
  const radioModo = document.querySelector(`input[name="freteModo"][value="${modo}"]`);
  if (radioModo) radioModo.checked = true;
  // Config do frete por raio (faixas + fora-da-área).
  const raioCfg = (c.frete && c.frete.raio) || {};
  faixasFrete = Array.isArray(raioCfg.faixas)
    ? raioCfg.faixas.map((f) => ({ ini: Number(f.ini) || 0, fim: Number(f.fim) || 0, valor: Number(f.valor) || 0 }))
    : [];
  if ($("freteForaArea")) $("freteForaArea").value = raioCfg.foraDaArea === "bloqueia" ? "bloqueia" : "retirada";
  renderFaixas();
  renderEntregaModo();
  $("cfgBoasVindas").value = c.mensagens.boasVindas || "";
  $("cfgBoasVindasRetorno").value = c.mensagens.boasVindasRetorno || "";
  $("cfgFechado").value = c.mensagens.fechado || "";
  $("cfgAtendente").value = c.mensagens.atendente || "";
  $("cfgDespedida").value = c.mensagens.despedida || "";
  $("cfgConfirmado").value = c.mensagens.pedidoConfirmado || "";
  $("cfgMsgProntoEntrega").value  = c.mensagens?.pedidoPronto?.entrega  || "";
  $("cfgMsgProntoRetirada").value = c.mensagens?.pedidoPronto?.retirada || "";
  const realAberto = lojaAbertaAgora(c);
  atualizarBadgeAtendimento(realAberto);
  atualizarStatusConfig(!!c.atendimento.aberto);
  atualizarChipStatus(realAberto);
  renderHorarios();
  renderPagamentos();
  renderImpressoraGate(); // sub-aba Impressora: Completo vê o download; Essencial, o upsell
}

// Rótulo da chave (ABERTO/FECHADO PARA PEDIDOS) — reflete só a posição do toggle manual.
function atualizarStatusConfig(toggleAberto) {
  const lbl = $("cfgAbertoLabel");
  if (lbl) lbl.textContent = toggleAberto ? "ABERTO PARA PEDIDOS" : "FECHADO PARA PEDIDOS";
}

// Chip "Status:" do topo — reflete o estado REAL agora (toggle E horário), mesma
// fonte do badge do header, pra os dois nunca se contradizerem.
function atualizarChipStatus(real) {
  const chip = $("cfgStatusChip");
  if (chip) {
    chip.textContent = real ? "Aberto" : "Fechado";
    chip.className = "cfg-status-chip " + (real ? "aberto" : "fechado");
  }
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

// Recalcula AO VIVO o texto de horário (campo read-only) e o badge a partir da
// tabela de horários + toggle. O texto é gerado automaticamente — sem botão.
function sincronizarHorario() {
  const horarios = lerHorariosDoDOM();
  $("cfgHorario").value = resumirHorarios(horarios);
  const real = lojaAbertaAgora({ atendimento: { aberto: $("cfgAberto").checked }, horarios });
  atualizarBadgeAtendimento(real);
  atualizarChipStatus(real);
}

$("cfgAberto").addEventListener("change", (e) => {
  sincronizarHorario();
  atualizarStatusConfig(e.target.checked);
});

// Editar a tabela de horários atualiza o texto exibido ao cliente e o badge.
$("horariosBody").addEventListener("input", sincronizarHorario);
$("horariosBody").addEventListener("change", sincronizarHorario);

async function carregarConfig() {
  const r = await api("GET", "/api/config");
  if (r) { configAtual = await r.json(); preencherConfig(); }
}

// Máscara/busca de CEP (ViaCEP) no campo de endereço das Configurações.
if (window.EnderecoCep) {
  EnderecoCep.ligarBuscaCep({
    cep: "cfgCep", hint: "cfgEnderecoHint",
    logradouro: "cfgLogradouro", numero: "cfgNumero",
    bairro: "cfgBairro", cidade: "cfgCidade", uf: "cfgUf",
  });
}

// Máscara monetária (centavos primeiro) nos campos de dinheiro estáticos.
if (window.Dinheiro) {
  Dinheiro.mascarar("cfgTaxaEntrega");
  Dinheiro.mascarar("editor-preco");
  Dinheiro.mascarar("editor-preco-custo");
}

$("btnDescartarConfig").addEventListener("click", async () => {
  await carregarConfig();
  toast("Alterações descartadas.");
});

$("btnSalvarConfig").addEventListener("click", async (e) => {
  configAtual.restaurante.nome = $("cfgNome").value;
  configAtual.restaurante.telefone = $("cfgTelefone").value;
  // Identidade visual (capa + logo do cardápio web)
  configAtual.restaurante.capa = identCapaUrl || "";
  configAtual.restaurante.logo = identLogoUrl || "";
  // Horário exibido ao cliente é sempre o gerado da tabela (auto).
  configAtual.restaurante.horario = resumirHorarios(lerHorariosDoDOM());
  // Endereço: recompõe a string a partir dos campos estruturados. Se nenhum
  // estiver preenchido, preserva o endereço atual (não apaga legados).
  const endStruct = {
    cep:         $("cfgCep").value.trim(),
    logradouro:  $("cfgLogradouro").value.trim(),
    numero:      $("cfgNumero").value.trim(),
    bairro:      $("cfgBairro").value.trim(),
    complemento: $("cfgComplemento").value.trim(),
    cidade:      $("cfgCidade").value.trim(),
    uf:          $("cfgUf").value.trim().toUpperCase(),
  };
  if (endStruct.logradouro || endStruct.cidade || endStruct.cep) {
    Object.assign(configAtual.restaurante, endStruct);
    configAtual.restaurante.endereco = EnderecoCep.comporEndereco(endStruct);
  }
  configAtual.atendimento.aberto = $("cfgAberto").checked;
  configAtual.atendimento.tempoEstimado = $("cfgTempo").value;
  configAtual.atendimento.taxaEntrega = Dinheiro.valor("cfgTaxaEntrega");
  // Modo de frete. "raio" só é permitido no Plano Completo (servidor também valida em Parte 3).
  const modoSel = (document.querySelector('input[name="freteModo"]:checked') || {}).value || "fixo";
  if (!configAtual.frete) configAtual.frete = {};
  configAtual.frete.modo = (modoSel === "raio" && planoAtual === "completo") ? "raio" : "fixo";
  if (configAtual.frete.modo === "raio") {
    if (!configAtual.frete.raio) configAtual.frete.raio = {};
    configAtual.frete.raio.faixas = lerFaixasDoDOM();           // coordEmpresa/enderecoBase: o servidor preenche
    configAtual.frete.raio.foraDaArea = (($("freteForaArea") || {}).value === "bloqueia") ? "bloqueia" : "retirada";
  }
  configAtual.horarios = lerHorariosDoDOM();
  configAtual.mensagens.boasVindas = $("cfgBoasVindas").value;
  configAtual.mensagens.boasVindasRetorno = $("cfgBoasVindasRetorno").value;
  configAtual.mensagens.fechado = $("cfgFechado").value;
  configAtual.mensagens.atendente = $("cfgAtendente").value;
  configAtual.mensagens.despedida = $("cfgDespedida").value;
  configAtual.mensagens.pedidoConfirmado = $("cfgConfirmado").value;
  if (!configAtual.mensagens.pedidoPronto) configAtual.mensagens.pedidoPronto = {};
  configAtual.mensagens.pedidoPronto.entrega  = $("cfgMsgProntoEntrega").value;
  configAtual.mensagens.pedidoPronto.retirada = $("cfgMsgProntoRetirada").value;
  // A config de impressão (serial/corte/sem-acento) agora vive no app agente; o
  // painel não a edita mais. configAtual.impressao é preservado como veio do banco.
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.textContent = "Salvando...";
  const r = await api("PUT", "/api/config", configAtual);
  btn.disabled = false;
  btn.textContent = "Salvar configurações";
  if (r && r.ok) {
    let aviso = null;
    try { aviso = (await r.json()).avisoFrete; } catch (_) { /* sem corpo */ }
    toast(aviso ? "✓ Salvo — " + aviso : "✓ Configurações salvas!");
  }
});

// ---- Sub-abas das Configurações (Empresa × Bot) ----
document.querySelectorAll(".cfg-subnav button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cfg-subnav button").forEach((b) => b.classList.remove("ativo"));
    document.querySelectorAll(".cfg-sub").forEach((s) => s.classList.remove("ativa"));
    btn.classList.add("ativo");
    $("cfg-sub-" + btn.dataset.sub).classList.add("ativa");
    if (btn.dataset.sub === "conexao") atualizarStatus();
  });
});

// ---- Aba Entrega: modo de frete (fixo | raio) + gating do raio por plano ----
// "Frete por raio" é feature do Plano Completo: pro Essencial aparece com cadeado
// e um upsell (não persiste como raio — o save clampa pra fixo).
function renderEntregaModo() {
  const completo = planoAtual === "completo";
  const lock = $("freteRaioLock");
  const label = $("freteModoRaioLabel");
  if (lock) lock.hidden = completo;
  if (label) label.classList.toggle("bloqueado", !completo);

  const modoVisual = (document.querySelector('input[name="freteModo"]:checked') || {}).value || "fixo";
  // Destaque do card selecionado por classe (não :has, que reavalia o documento
  // inteiro a cada toggle de checkbox e causava flicker no modal).
  document.querySelectorAll(".cfg-frete-modo").forEach((el) => {
    const r = el.querySelector('input[name="freteModo"]');
    el.classList.toggle("selecionado", !!(r && r.checked));
  });
  const ehRaio = modoVisual === "raio";
  const painelFixo = $("fretePainelFixo");
  const painelRaio = $("fretePainelRaio");
  if (painelFixo) painelFixo.hidden = ehRaio;
  if (painelRaio) painelRaio.hidden = !ehRaio;
  // Dentro do painel raio: Completo vê a config (Parte 3); Essencial vê o upsell.
  const upsell = $("freteUpsell");
  const raioConfig = $("freteRaioConfig");
  if (upsell) upsell.hidden = completo;
  if (raioConfig) raioConfig.hidden = !completo;
}

document.querySelectorAll('input[name="freteModo"]').forEach((r) => {
  r.addEventListener("change", renderEntregaModo);
});
// Essencial: clicar na opção "Frete por raio" (bloqueada) abre o card de upgrade
// em vez de selecionar — preventDefault impede o rádio de marcar.
if ($("freteModoRaioLabel")) {
  $("freteModoRaioLabel").addEventListener("click", (e) => {
    if (planoAtual !== "completo") { e.preventDefault(); abrirUpsell("freteRaio"); }
  });
}

// ---- Sub-aba Impressora: Completo vê o download do agente; Essencial vê o upsell ----
function renderImpressoraGate() {
  const completo = planoAtual === "completo";
  const lock = $("impressoraLock");
  const app = $("impressora-app");
  if (lock) lock.hidden = completo;
  if (app) app.hidden = !completo;
}

if ($("btnVerPlanosImpressora")) {
  $("btnVerPlanosImpressora").addEventListener("click", () => {
    abrirUpsell("impressao");
  });
}

// ================= Caixa (Plano Completo) =================
// Exibição BR sem prefixo, padrão único (dinheiro.js) — "1.234,56" com milhar.
// Preserva o sinal (o util usa Math.abs); os chamadores que já põem "−R$" passam positivo.
function fmtBRn(n) { n = Number(n) || 0; return (n < 0 ? "-" : "") + Dinheiro.formatar(n); }

const SVG_CAIXA_REGISTRADORA = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="10" width="18" height="11" rx="1.5"/><path d="M5 10V6a2 2 0 0 1 2-2h7l3 3v3"/><line x1="7" y1="14" x2="9" y2="14"/><line x1="11.5" y1="14" x2="13.5" y2="14"/><line x1="16" y1="14" x2="18" y2="14"/><line x1="7" y1="17.5" x2="9" y2="17.5"/><line x1="11.5" y1="17.5" x2="13.5" y2="17.5"/><line x1="16" y1="17.5" x2="18" y2="17.5"/></svg>`;
const SVG_OPERADOR = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

// Modal acessível com campos (substitui window.prompt). Resolve com um objeto
// { id: valor } ou null se cancelar. Campos `dinheiro` usam a máscara e devolvem
// número; `texto` devolve string. `live(valores)` → texto atualizado a cada tecla.
function modalCaixa({ titulo, info, campos, txtConfirmar = "Confirmar", live }) {
  return new Promise((resolve) => {
    const overlay = $("caixa-modal-overlay");
    $("caixa-modal-titulo").textContent = titulo;
    const infoEl = $("caixa-modal-info");
    infoEl.hidden = !info; if (info) infoEl.textContent = info;
    const liveEl = $("caixa-modal-live"); liveEl.hidden = true; liveEl.textContent = "";
    const cont = $("caixa-modal-campos");
    cont.innerHTML = campos.map((c) =>
      `<div class="campo"><label for="${c.id}">${escapar(c.label)}</label>
        <input id="${c.id}" inputmode="${c.tipo === "dinheiro" ? "numeric" : "text"}" placeholder="${escapar(c.placeholder || "")}" value="${c.tipo === "dinheiro" ? "0,00" : ""}"></div>`
    ).join("");
    campos.forEach((c) => { if (c.tipo === "dinheiro" && window.Dinheiro) Dinheiro.mascarar(c.id); });
    $("caixa-modal-confirmar").textContent = txtConfirmar;

    const lerValores = () => {
      const v = {};
      campos.forEach((c) => { v[c.id] = c.tipo === "dinheiro" ? (window.Dinheiro ? Dinheiro.valor(c.id) : 0) : ($(c.id).value || "").trim(); });
      return v;
    };
    const atualizarLive = () => {
      if (!live) return;
      const txt = live(lerValores());
      liveEl.hidden = !txt; liveEl.textContent = txt || "";
    };
    if (live) cont.querySelectorAll("input").forEach((i) => i.addEventListener("input", atualizarLive));
    atualizarLive();

    overlay.style.display = "flex";
    overlay.classList.remove("saindo");
    const primeiro = cont.querySelector("input"); if (primeiro) primeiro.focus();

    function fechar(resultado) {
      overlay.classList.add("saindo");
      overlay.addEventListener("animationend", () => { overlay.style.display = "none"; overlay.classList.remove("saindo"); }, { once: true });
      document.removeEventListener("keydown", onKey);
      $("caixa-modal-cancelar").removeEventListener("click", onCancelar);
      $("caixa-modal-confirmar").removeEventListener("click", onConfirmar);
      overlay.removeEventListener("mousedown", onOverlay);
      resolve(resultado);
    }
    function onCancelar() { fechar(null); }
    function onConfirmar() { fechar(lerValores()); }
    function onKey(e) { if (e.key === "Escape") fechar(null); else if (e.key === "Enter") { e.preventDefault(); fechar(lerValores()); } }
    function onOverlay(e) { if (e.target === overlay) fechar(null); }
    $("caixa-modal-cancelar").addEventListener("click", onCancelar);
    $("caixa-modal-confirmar").addEventListener("click", onConfirmar);
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("mousedown", onOverlay);
  });
}

async function carregarCaixa() {
  // O gate é decidido pela RESPOSTA da API (autoritativa), não pelo `planoAtual`
  // — que pode ainda não ter carregado na navegação inicial (evita cadeado falso).
  $("caixaLock").hidden = true;
  $("caixaConteudo").hidden = true;
  const r = await api("GET", "/api/caixa");
  if (!r) return; // 401 já redirecionou
  if (r.status === 403) { $("caixaLock").hidden = false; return; } // sem Plano Completo
  $("caixaConteudo").hidden = false;
  if (!r.ok) { $("caixaConteudo").innerHTML = "<p class='sub'>Falha ao carregar o caixa.</p>"; return; }
  renderCaixa(await r.json());
}

function renderCaixa(data) {
  const cont = $("caixaConteudo");
  if (!data.caixa) {
    cont.innerHTML = `
      <form class="caixa-abertura" id="formAbrirCaixa" autocomplete="off">
        <div class="caixa-abertura-cab">
          <span class="caixa-abertura-icone">${SVG_CAIXA_REGISTRADORA}</span>
          <h3>Abertura de Caixa</h3>
          <p class="sub">Inicie seu turno informando os detalhes abaixo.</p>
        </div>

        <div class="campo">
          <label for="caixaOperador">Operador</label>
          <div class="campo-prefixo">
            <span class="campo-prefixo-icone">${SVG_OPERADOR}</span>
            <input id="caixaOperador" type="text" placeholder="Nome de quem abre o turno" value="${escapar(painelNome || "")}">
          </div>
        </div>

        <div class="campo">
          <label for="caixaFundo">Saldo inicial (R$)</label>
          <div class="campo-prefixo">
            <span class="campo-prefixo-moeda">R$</span>
            <input id="caixaFundo" inputmode="numeric" value="0,00">
          </div>
          <p class="campo-ajuda">Insira o valor físico disponível em notas e moedas.</p>
        </div>

        <div class="campo">
          <label for="caixaObs">Observações <span class="campo-opcional">(opcional)</span></label>
          <textarea id="caixaObs" rows="3" placeholder="Ex: Problemas com a impressora, troco reduzido..."></textarea>
        </div>

        <button type="submit" id="btnAbrirCaixa" class="caixa-abertura-btn">
          Abrir Caixa
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </form>`;
    if (window.Dinheiro) Dinheiro.mascarar("caixaFundo");
    $("formAbrirCaixa").addEventListener("submit", (e) => { e.preventDefault(); abrirCaixa(); });
    return;
  }
  renderCaixaAberto(data);
}

async function abrirCaixa() {
  const fundo = window.Dinheiro ? Dinheiro.valor("caixaFundo") : 0;
  const operador = ($("caixaOperador").value || "").trim();
  const obsAbertura = ($("caixaObs").value || "").trim();
  const r = await api("POST", "/api/caixa/abrir", { fundoTroco: fundo, operador, obsAbertura });
  if (r && r.ok) { toast("✓ Caixa aberto!"); carregarCaixa(); }
  else { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Falha ao abrir caixa."); }
}

function renderCaixaAberto(data) {
  const cont = $("caixaConteudo");
  const r = data.resumo;
  const fundo = Number(data.caixa.fundoTroco) || 0;
  const totalRecebido = Number(r.totalRecebido) || 0;
  const recebidoDinheiro = Number(r.recebidoDinheiro) || 0;
  const totalCartaoPix = totalRecebido - recebidoDinheiro;
  const suprimentos = Number(r.suprimentos) || 0;
  const sangrias = Number(r.sangrias) || 0;
  const cancelamentos = Number(r.cancelamentos) || 0;
  const totalEmCaixa = fundo + suprimentos + totalRecebido - sangrias - cancelamentos; // gaveta (esperado geral)
  const totalFaturamento = totalRecebido;

  const dataHoraCurta = (iso) => iso
    ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

  // Vendas por forma: TODAS as formas configuradas (zeradas se não houve venda) +
  // qualquer forma que tenha tido recebimento fora da config + subtotal + dinheiro.
  const formasElet = (data.formasPagamento || []).filter((f) => !ehFormaDinheiro(f));
  Object.keys(r.recebidoPorForma).forEach((f) => {
    if (!ehFormaDinheiro(f) && !formasElet.includes(f)) formasElet.push(f);
  });
  const linhasElet = formasElet
    .map((f) => `<div class="caixa-linha"><span>${escapar(f)}</span><span>R$ ${fmtBRn(r.recebidoPorForma[f] || 0)}</span></div>`)
    .join("");

  // Extrato do turno: recebimentos (estornáveis) + cancelamentos + sangrias/suprimentos.
  const tipoLabel = { recebimento: "Venda", sangria: "Sangria", suprimento: "Suprimento", cancelamento: "Cancelamento", estorno: "Estorno" };
  const ehNeg = (t) => t === "sangria" || t === "cancelamento" || t === "estorno";
  const linhasMov = (data.movimentos || []).map((m) => {
    const neg = ehNeg(m.tipo);
    const rowCls = m.tipo === "recebimento" ? "" : "cx-row-mov" + (neg ? " cx-row-sangria" : "");
    const temPedido = m.tipo === "recebimento" || m.tipo === "cancelamento" || m.tipo === "estorno";
    const num = temPedido ? "#" + (m.numero != null ? m.numero : "—") : "—";
    const cliente = m.tipo === "recebimento" ? escapar(m.cliente || m.descricao || "—")
      : ((m.tipo === "cancelamento" || m.tipo === "estorno") ? escapar(m.cliente || m.descricao || tipoLabel[m.tipo])
        : (m.descricao ? escapar(m.descricao) : "—"));
    const valorTxt = (neg ? "−R$ " : "R$ ") + fmtBRn(m.valor);
    const forma = temPedido ? escapar(m.forma || "—") : "—";
    const acao = m.estornavel
      ? `<button class="secundario mini caixa-estornar" data-id="${m.pedidoId}">Estornar</button>` : "";
    return `<tr class="${rowCls}">
      <td class="cx-td-hora">${dataHoraCurta(m.quando)}</td>
      <td>${num}</td>
      <td>${tipoLabel[m.tipo] || m.tipo}</td>
      <td>${cliente}</td>
      <td class="caixa-tab-valor${neg ? " caixa-tab-neg" : ""}">${valorTxt}</td>
      <td>${forma}</td>
      <td class="caixa-tab-acao">${acao}</td>
    </tr>`;
  }).join("");
  // Saldo inicial (abertura) entra como 1ª linha cronológica → no fim da lista (ordem decrescente).
  const linhaAbertura = fundo > 0 ? `<tr class="cx-row-mov cx-row-abertura">
      <td class="cx-td-hora">${dataHoraCurta(data.caixa.abertoEm)}</td>
      <td>—</td>
      <td>Saldo inicial</td>
      <td>Abertura do caixa</td>
      <td class="caixa-tab-valor">R$ ${fmtBRn(fundo)}</td>
      <td>Dinheiro</td>
      <td class="caixa-tab-acao"></td>
    </tr>` : "";
  const tabelaMov = ((data.movimentos && data.movimentos.length) || fundo > 0)
    ? `<table class="cx-tabela"><thead><tr><th>Hora</th><th>Nº</th><th>Tipo</th><th>Cliente</th><th>Valor</th><th>Forma</th><th></th></tr></thead><tbody>${linhasMov}${linhaAbertura}</tbody></table>`
    : "<p class='sub'>Nenhuma movimentação neste caixa ainda. Receba no detalhe do pedido (aba Pedidos).</p>";

  cont.innerHTML = `
    <div class="cx-header">
      <div>
        <span class="cx-badge">Caixa aberto</span>
        <h2 class="cx-total">Total em Caixa: R$ ${fmtBRn(totalEmCaixa)}</h2>
        <span class="cx-formula">Valor inicial + Suprimentos + Vendas (dinheiro + cartão/Pix) − Sangrias</span>
      </div>
      <div class="cx-header-meta">
        <span>Operador: <b>${data.caixa.operador ? escapar(data.caixa.operador) : "—"}</b></span>
        <span>Aberto em: ${dataHoraCurta(data.caixa.abertoEm)}</span>
      </div>
    </div>

    ${data.caixa.vencido ? `<div class="cx-aviso-vencido">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div>Este caixa é de <b>${new Date(data.caixa.abertoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</b>. Feche-o para iniciar o novo dia — o <b>PDV fica bloqueado</b> até o fechamento.</div>
    </div>` : ""}

    <div class="cx-acoes">
      <div class="cx-acoes-esq">
        <button class="secundario" id="btnSuprimento">Suprimento</button>
        <button class="secundario" id="btnSangria">Sangria</button>
        <button class="secundario" id="btnHistCaixa">Caixas anteriores</button>
      </div>
      <button id="btnFecharCaixa">Fechar caixa</button>
    </div>

    <div class="cx-cards">
      <div class="cx-card">
        <h4 class="cx-card-titulo">Vendas por forma</h4>
        ${linhasElet}
        <div class="caixa-linha caixa-total"><span>Total cartão/Pix</span><span>R$ ${fmtBRn(totalCartaoPix)}</span></div>
        <div class="caixa-linha"><span>Dinheiro</span><span>R$ ${fmtBRn(recebidoDinheiro)}</span></div>
      </div>
      <div class="cx-card">
        <h4 class="cx-card-titulo">Movimentação do caixa</h4>
        <div class="caixa-linha"><span>Valor inicial (troco)</span><span>R$ ${fmtBRn(fundo)}</span></div>
        <div class="caixa-linha"><span>Suprimentos</span><span>R$ ${fmtBRn(suprimentos)}</span></div>
        <div class="caixa-linha"><span>Sangrias</span><span>− R$ ${fmtBRn(sangrias)}</span></div>
        <div class="cx-box">
          <span class="cx-box-rotulo">Total Faturamento</span>
          <span class="cx-box-formula">Total de vendas (todas as formas)</span>
          <span class="cx-box-valor">R$ ${fmtBRn(totalFaturamento)}</span>
        </div>
      </div>
    </div>

    <div class="cx-card cx-tabela-card">${tabelaMov}</div>`;

  cont.querySelectorAll(".caixa-estornar").forEach((b) =>
    b.addEventListener("click", () => estornarCaixa(b.dataset.id)));
  $("btnSangria").addEventListener("click", () => movimentoCaixa("sangria"));
  $("btnSuprimento").addEventListener("click", () => movimentoCaixa("suprimento"));
  $("btnHistCaixa").addEventListener("click", verHistoricoCaixa);
  $("btnFecharCaixa").addEventListener("click", () => renderFechamentoCaixa(data));
}

async function estornarCaixa(id) {
  const r = await api("POST", "/api/caixa/estornar/" + id, {});
  if (r && r.ok) { toast("Estornado."); carregarCaixa(); }
}

async function movimentoCaixa(tipo) {
  const titulo = tipo === "sangria" ? "Sangria (retirar dinheiro)" : "Suprimento (reforçar dinheiro)";
  const vals = await modalCaixa({
    titulo,
    campos: [
      { id: "cxMovValor", label: "Valor", tipo: "dinheiro", placeholder: "0,00" },
      { id: "cxMovMotivo", label: "Motivo (opcional)", tipo: "texto", placeholder: tipo === "sangria" ? "ex.: pagamento de fornecedor" : "ex.: reforço de troco" },
    ],
    txtConfirmar: tipo === "sangria" ? "Registrar sangria" : "Registrar suprimento",
  });
  if (!vals) return;
  if (vals.cxMovValor <= 0) { toast("Informe um valor maior que zero."); return; }
  const r = await api("POST", "/api/caixa/movimento", { tipo, valor: vals.cxMovValor, descricao: vals.cxMovMotivo });
  if (r && r.ok) { toast("✓ Registrado."); carregarCaixa(); }
  else { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Falha."); }
}

// Denominações BRL em centavos (cédulas + moedas), de R$ 200 a R$ 0,05.
const DENOMINACOES = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5];

function ehFormaDinheiro(f) { return /dinheiro/i.test(String(f || "")); }

// Leva à aba Pedidos já filtrada em "A receber" (atalho do bloqueio de fechamento).
function irParaPedidosAReceber() {
  const sel = $("filtroPagamento");
  if (sel) sel.value = "areceber";
  filtros.pagamento = "areceber";
  paginaPedidos = 1;
  const btn = document.querySelector('.sidebar [data-aba="pedidos"]');
  if (btn) btn.click();
}

// Tela de fechamento: contador de cédulas (dinheiro) + lançamentos de cartão/pix.
function renderFechamentoCaixa(data) {
  const cont = $("caixaConteudo");
  const resumo = data.resumo || {};
  const esperadoEspecie = Number(resumo.esperadoEspecie) || 0;
  const esperadoElet = (Number(resumo.totalRecebido) || 0) - (Number(resumo.recebidoDinheiro) || 0);
  const formas = data.formasPagamento || [];
  // Formas eletrônicas = união das configuradas + as que de fato tiveram recebimento
  // neste caixa (ex.: Pix recebido mas fora da config) — evita "Outros" e oferece a
  // forma certa no dropdown. (O relatório usa a mesma regra, no servidor.)
  const eletronicas = formas.filter((f) => !ehFormaDinheiro(f));
  Object.keys((data.resumo && data.resumo.recebidoPorForma) || {}).forEach((f) => {
    if (!ehFormaDinheiro(f) && !eletronicas.includes(f)) eletronicas.push(f);
  });
  const lancamentos = []; // { forma, valor }
  const pendentes = Number(data.pedidosAReceber) || 0; // pedidos delivery/local a receber
  const mesasAbertas = Number(data.mesasAbertas) || 0; // mesas com consumo em aberto
  const bloqueado = pendentes > 0 || mesasAbertas > 0;

  const linhasCedula = DENOMINACOES.map((c) => `
    <tr>
      <td class="fc-ced">R$ ${fmtBRn(c / 100)}</td>
      <td><input class="fc-qtd" inputmode="numeric" data-cent="${c}" value=""></td>
      <td class="fc-tot" data-cent="${c}">R$ 0,00</td>
    </tr>`).join("");

  const opcoesForma = eletronicas.length
    ? eletronicas.map((f) => `<option value="${escapar(f)}">${escapar(f)}</option>`).join("")
    : `<option value="Cartão">Cartão</option>`;

  cont.innerHTML = `
    <div class="fc-wrap">
      <div class="fc-cab">
        <h3>Fechamento de Caixa</h3>
        <span class="sub">Confira o dinheiro da gaveta e os recebimentos eletrônicos do dia${data.caixa && data.caixa.operador ? " · Operador: " + escapar(data.caixa.operador) : ""}</span>
      </div>
      ${mesasAbertas > 0 ? `
      <div class="fc-bloqueio">
        <div class="fc-bloqueio-txt">
          <strong>${mesasAbertas} mesa${mesasAbertas > 1 ? "s" : ""} aberta${mesasAbertas > 1 ? "s" : ""}.</strong>
          <span>Feche as mesas (recebimento na aba Mesas) antes de fechar o caixa.</span>
        </div>
        <button type="button" id="fcVerMesas" class="secundario">Ir para Mesas</button>
      </div>` : ""}
      ${pendentes > 0 ? `
      <div class="fc-bloqueio">
        <div class="fc-bloqueio-txt">
          <strong>${pendentes} pedido${pendentes > 1 ? "s" : ""} com pagamento a receber.</strong>
          <span>Receba os pedidos do dia (aba Pedidos) antes de fechar o caixa.</span>
        </div>
        <button type="button" id="fcVerPedidos" class="secundario">Ver pedido${pendentes > 1 ? "s" : ""} a receber</button>
      </div>` : ""}
      <div class="fc-cols">
        <section class="fc-col">
          <h4>Dinheiro (contagem da gaveta)</h4>
          <table class="fc-tabela"><thead><tr><th>Cédula/Moeda</th><th>Qtd</th><th>Total</th></tr></thead>
            <tbody>${linhasCedula}</tbody></table>
          <div class="fc-rodape">
            <div class="caixa-linha"><span>Contado</span><span id="fcContadoDin">R$ 0,00</span></div>
            <div class="caixa-linha"><span>Esperado</span><span>R$ ${fmtBRn(esperadoEspecie)}</span></div>
            <div class="caixa-linha caixa-total"><span>Diferença</span><span id="fcDifDin" class="fc-dif">R$ 0,00</span></div>
          </div>
        </section>
        <section class="fc-col">
          <h4>Cartões / Pix</h4>
          <div class="fc-add">
            <select id="fcForma">${opcoesForma}</select>
            <input id="fcValor" inputmode="numeric" value="0,00">
            <button type="button" id="fcAdd" class="secundario">+ Adicionar</button>
          </div>
          <div id="fcLista" class="fc-lista"></div>
          <div class="fc-rodape">
            <div class="caixa-linha"><span>Informado</span><span id="fcInformado">R$ 0,00</span></div>
            <div class="caixa-linha"><span>Esperado</span><span>R$ ${fmtBRn(esperadoElet)}</span></div>
            <div class="caixa-linha caixa-total"><span>Diferença</span><span id="fcDifElet" class="fc-dif">R$ 0,00</span></div>
          </div>
        </section>
      </div>
      <div class="fc-acoes">
        <button class="secundario" id="fcCancelar">Cancelar</button>
        <button id="fcFechar"${bloqueado ? " disabled" : ""}>Fechar caixa e imprimir →</button>
      </div>
    </div>`;

  if (window.Dinheiro) Dinheiro.mascarar("fcValor");

  function fmtDif(el, dif) {
    el.classList.remove("fc-sobra", "fc-falta");
    if (dif > 0) { el.textContent = "+R$ " + fmtBRn(dif) + " ▲ sobrou"; el.classList.add("fc-sobra"); }
    else if (dif < 0) { el.textContent = "−R$ " + fmtBRn(-dif) + " ▼ faltou"; el.classList.add("fc-falta"); }
    else { el.textContent = "R$ 0,00 ✓ bateu"; }
  }
  function contagemAtual() {
    const c = {};
    cont.querySelectorAll(".fc-qtd").forEach((i) => {
      const q = parseInt(i.value, 10) || 0;
      if (q > 0) c[i.dataset.cent] = q;
    });
    return c;
  }
  function recalcDinheiro() {
    let total = 0;
    cont.querySelectorAll(".fc-qtd").forEach((i) => {
      const cent = Number(i.dataset.cent); const q = parseInt(i.value, 10) || 0;
      const linha = q * cent / 100; total += linha;
      const td = cont.querySelector(`.fc-tot[data-cent="${cent}"]`);
      if (td) td.textContent = "R$ " + fmtBRn(linha);
    });
    $("fcContadoDin").textContent = "R$ " + fmtBRn(total);
    fmtDif($("fcDifDin"), total - esperadoEspecie);
  }
  function recalcEletronico() {
    const total = lancamentos.reduce((s, l) => s + l.valor, 0);
    $("fcInformado").textContent = "R$ " + fmtBRn(total);
    fmtDif($("fcDifElet"), total - esperadoElet);
  }
  function renderLista() {
    $("fcLista").innerHTML = lancamentos.length
      ? lancamentos.map((l, i) => `<div class="fc-lanc"><span>${escapar(l.forma)}</span><span>R$ ${fmtBRn(l.valor)}</span><button type="button" class="fc-del" data-i="${i}" aria-label="Remover">✕</button></div>`).join("")
      : "<p class='sub'>Nenhum lançamento ainda.</p>";
    $("fcLista").querySelectorAll(".fc-del").forEach((b) =>
      b.addEventListener("click", () => { lancamentos.splice(+b.dataset.i, 1); renderLista(); recalcEletronico(); }));
  }

  cont.querySelectorAll(".fc-qtd").forEach((i) => i.addEventListener("input", recalcDinheiro));
  // Lança o valor e mantém o foco no campo: o operador digita valor + Enter,
  // valor + Enter… sem precisar clicar "Adicionar" nem tirar a mão do teclado.
  function adicionarLancamento() {
    const forma = $("fcForma").value;
    const valor = window.Dinheiro ? Dinheiro.valor("fcValor") : 0;
    if (valor <= 0) { toast("Informe um valor maior que zero."); return; }
    lancamentos.push({ forma, valor });
    if (window.Dinheiro) Dinheiro.setValor("fcValor", 0); else $("fcValor").value = "0,00";
    renderLista(); recalcEletronico();
    $("fcValor").focus();
  }
  $("fcAdd").addEventListener("click", adicionarLancamento);
  $("fcValor").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); adicionarLancamento(); } });
  $("fcCancelar").addEventListener("click", () => carregarCaixa());
  $("fcFechar").addEventListener("click", () => {
    if (mesasAbertas > 0) { toast("Feche as mesas abertas antes de fechar o caixa."); return; }
    if (pendentes > 0) { toast("Receba todos os pedidos antes de fechar o caixa."); return; }
    fecharCaixaFinal(data, contagemAtual(), lancamentos);
  });
  if (pendentes > 0 && $("fcVerPedidos")) $("fcVerPedidos").addEventListener("click", irParaPedidosAReceber);
  if (mesasAbertas > 0 && $("fcVerMesas")) $("fcVerMesas").addEventListener("click", () => {
    const btn = document.querySelector("[data-aba='mesas']"); if (btn) btn.click();
  });

  renderLista(); recalcDinheiro(); recalcEletronico();
}

// Visualização read-only do relatório de fechamento (a impressão é do agente).
function verRelatorio(titulo, texto) {
  const ov = $("relatorio-overlay");
  if (!ov) return;
  if ($("relatorio-titulo")) $("relatorio-titulo").textContent = titulo || "Relatório";
  if ($("relatorio-prev")) $("relatorio-prev").textContent = texto || "";
  ov.style.display = "flex";
}
function fecharRelatorio() { const ov = $("relatorio-overlay"); if (ov) ov.style.display = "none"; }
if ($("relatorio-fechar")) $("relatorio-fechar").addEventListener("click", fecharRelatorio);
if ($("relatorio-overlay")) $("relatorio-overlay").addEventListener("click", (e) => { if (e.target === $("relatorio-overlay")) fecharRelatorio(); });

async function fecharCaixaFinal(data, contagem, lancamentos) {
  // O relatório é montado no SERVIDOR (fonte única e autoritativa); o front só
  // envia a conferência e recebe o texto pronto pra prévia/impressão.
  const r = await api("POST", "/api/caixa/fechar", { contagem, eletronico: lancamentos });
  if (!r || !r.ok) { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Falha ao fechar."); return; }
  const res = await r.json();
  const dif = res.diferenca;
  toast(dif === 0 ? "✓ Caixa fechado, bateu certinho!" : (dif > 0 ? "Caixa fechado. Sobra de R$ " + fmtBRn(dif) : "Caixa fechado. Falta de R$ " + fmtBRn(-dif)));
  if (res.relatorio) verRelatorio("Relatório de fechamento", res.relatorio);
  carregarCaixa();
}

async function verHistoricoCaixa() {
  const box = $("caixaConteudo");
  // Toggle: se já está aberto, fecha (segundo clique).
  const existente = box.querySelector("#caixaHistBox");
  if (existente) { existente.remove(); return; }
  const r = await api("GET", "/api/caixa/historico");
  if (!r || !r.ok) return;
  const lista = await r.json();
  const difTxt = (c) => {
    if (c.diferenca == null) return { txt: "—", cls: "" };
    if (c.diferenca === 0) return { txt: "✓ ok", cls: "chi-ok" };
    return c.diferenca > 0
      ? { txt: "▲ +R$ " + fmtBRn(c.diferenca), cls: "chi-sobra" }
      : { txt: "▼ −R$ " + fmtBRn(-c.diferenca), cls: "chi-falta" };
  };
  const dataHora = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const html = lista.length
    ? lista.slice(0, 3).map((c) => {
        const d = difTxt(c);
        return `<div class="caixa-hist-item" data-id="${c.id}">
          <div class="chi-info">
            <span class="chi-data">${dataHora(c.fechadoEm)}</span>
            <span class="chi-op">${c.operador ? escapar(c.operador) : "—"}</span>
          </div>
          <div class="chi-nums">
            <span>Caixa <b>R$ ${fmtBRn(c.totalEmCaixa || 0)}</b></span>
            <span>Fechado <b>R$ ${fmtBRn(c.contadoTotal || 0)}</b></span>
            <span class="chi-dif ${d.cls}">${d.txt}</span>
          </div>
        </div>`;
      }).join("")
    : "<p class='sub'>Nenhum caixa fechado ainda.</p>";
  const sec = document.createElement("div");
  sec.id = "caixaHistBox";
  sec.className = "caixa-resumo cx-hist";
  box.appendChild(sec);
  sec.innerHTML = `<h4>Caixas anteriores</h4>${lista.length ? "<p class='sub'>Os 3 últimos fechamentos — toque para reabrir o relatório.</p>" : ""}${html}`;
  sec.querySelectorAll(".caixa-hist-item").forEach((el) => {
    const item = lista.find((c) => String(c.id) === el.dataset.id);
    el.addEventListener("click", () => {
      if (item && item.relatorio) {
        verRelatorio("Relatório — " + new Date(item.fechadoEm).toLocaleString("pt-BR"), item.relatorio);
      } else {
        toast("Relatório indisponível para este fechamento.");
      }
    });
  });
  sec.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

if ($("btnVerPlanosCaixa")) {
  $("btnVerPlanosCaixa").addEventListener("click", () => {
    abrirUpsell("caixa");
  });
}

if ($("btnVerPlanos")) {
  $("btnVerPlanos").addEventListener("click", () => {
    abrirUpsell("freteRaio");
  });
}

// ---- Faixas de frete por raio (Plano Completo) ----
let faixasFrete = []; // [{ ini, fim, valor }] em km / reais

function lerFaixasDoDOM() {
  const linhas = [];
  document.querySelectorAll("#freteFaixasBody tr").forEach((tr) => {
    const ini = parseFloat((tr.querySelector(".ff-ini") || {}).value) || 0;
    const fim = parseFloat((tr.querySelector(".ff-fim") || {}).value) || 0;
    const valorId = (tr.querySelector(".ff-valor") || {}).id;
    const valor = (valorId && window.Dinheiro) ? Dinheiro.valor(valorId) : 0;
    linhas.push({ ini, fim, valor });
  });
  return linhas;
}

function renderFaixas() {
  const body = $("freteFaixasBody");
  if (!body) return;
  body.innerHTML = faixasFrete.map((f, i) =>
    "<tr>" +
      '<td><input type="number" class="ff-ini" min="0" step="0.1" value="' + (Number(f.ini) || 0) + '" /></td>' +
      '<td><input type="number" class="ff-fim" min="0" step="0.1" value="' + (Number(f.fim) || 0) + '" /></td>' +
      '<td><input type="text" inputmode="numeric" class="ff-valor" id="ffValor' + i + '" /></td>' +
      '<td><button type="button" class="ff-remover" data-i="' + i + '" aria-label="Remover faixa">✕</button></td>' +
    "</tr>"
  ).join("");
  faixasFrete.forEach((f, i) => {
    if (window.Dinheiro) { Dinheiro.mascarar("ffValor" + i); Dinheiro.setValor("ffValor" + i, Number(f.valor) || 0); }
  });
  body.querySelectorAll(".ff-remover").forEach((b) => {
    b.addEventListener("click", () => {
      faixasFrete = lerFaixasDoDOM();
      faixasFrete.splice(Number(b.dataset.i), 1);
      renderFaixas();
    });
  });
}

if ($("btnAddFaixa")) {
  $("btnAddFaixa").addEventListener("click", () => {
    faixasFrete = lerFaixasDoDOM();
    const ult = faixasFrete[faixasFrete.length - 1];
    const ini = ult ? (Number(ult.fim) || 0) : 0;
    faixasFrete.push({ ini, fim: ini + 2, valor: 0 });
    renderFaixas();
  });
}

// ============================================================
// CONTA DE ACESSO (e-mail/senha de login)
// ============================================================
async function carregarConta() {
  const r = await api("GET", "/api/conta");
  if (r && r.ok) {
    const c = await r.json();
    $("contaEmail").textContent = c.email || "—";
    planoAtual = c.plano || "essencial";
    renderEntregaModo(); // re-renderiza o gating do frete por raio com o plano já conhecido
    renderImpressoraGate(); // gating da sub-aba Impressora
    // Filtro de pagamento na lista de Pedidos só faz sentido no Completo (tem Caixa).
    const fpag = $("filtroPagamento");
    if (fpag) fpag.hidden = planoAtual !== "completo";
  }
}

// Mostra/esconde um form de conta, limpando campos e aviso ao abrir.
function alternarFormConta(formId, mostrar) {
  const form = $(formId);
  if (!form) return;
  form.hidden = !mostrar;
  if (mostrar) {
    form.querySelectorAll("input").forEach((i) => (i.value = ""));
    const aviso = form.querySelector(".aviso");
    if (aviso) { aviso.textContent = ""; aviso.className = "aviso"; }
    const primeiro = form.querySelector("input");
    if (primeiro) primeiro.focus();
  }
}

$("btnTrocarEmail").addEventListener("click", () => {
  alternarFormConta("formSenha", false);
  alternarFormConta("formEmail", $("formEmail").hidden);
});
$("btnTrocarSenha").addEventListener("click", () => {
  alternarFormConta("formEmail", false);
  alternarFormConta("formSenha", $("formSenha").hidden);
});
document.querySelectorAll("[data-cancelar]").forEach((b) =>
  b.addEventListener("click", () => alternarFormConta(b.dataset.cancelar, false))
);

function avisoConta(id, texto, ok) {
  const el = $(id);
  el.textContent = texto;
  el.className = "aviso " + (ok ? "" : "erro");
}

$("formEmail").addEventListener("submit", async (e) => {
  e.preventDefault();
  const novoEmail = $("emailNovo").value.trim();
  const senhaAtual = $("emailSenha").value;
  if (!novoEmail || !senhaAtual) return avisoConta("avisoEmail", "Preencha o novo e-mail e a senha atual.");
  const btn = $("btnSalvarEmail");
  btn.disabled = true; btn.textContent = "Salvando...";
  const r = await api("PATCH", "/api/conta/email", { novoEmail, senhaAtual });
  btn.disabled = false; btn.textContent = "Salvar e-mail";
  const data = r ? await r.json().catch(() => ({})) : {};
  if (r && r.ok) {
    $("contaEmail").textContent = data.email || novoEmail;
    alternarFormConta("formEmail", false);
    toast("✓ E-mail alterado!");
  } else {
    avisoConta("avisoEmail", (data && data.erro) || "Não foi possível alterar o e-mail.");
  }
});

$("formSenha").addEventListener("submit", async (e) => {
  e.preventDefault();
  const senhaAtual = $("senhaAtual").value;
  const novaSenha = $("senhaNova").value;
  const novaSenha2 = $("senhaNova2").value;
  if (!senhaAtual || !novaSenha) return avisoConta("avisoSenha", "Preencha todos os campos.");
  if (novaSenha.length < 6) return avisoConta("avisoSenha", "A nova senha deve ter ao menos 6 caracteres.");
  if (novaSenha !== novaSenha2) return avisoConta("avisoSenha", "As senhas não conferem.");
  const btn = $("btnSalvarSenha");
  btn.disabled = true; btn.textContent = "Salvando...";
  const r = await api("PATCH", "/api/conta/senha", { senhaAtual, novaSenha });
  btn.disabled = false; btn.textContent = "Salvar senha";
  const data = r ? await r.json().catch(() => ({})) : {};
  if (r && r.ok) {
    alternarFormConta("formSenha", false);
    toast("✓ Senha alterada!");
  } else {
    avisoConta("avisoSenha", (data && data.erro) || "Não foi possível alterar a senha.");
  }
});

// ============================================================
// PRIVACIDADE E DADOS (LGPD) — exportar / excluir conta
// ============================================================
$("btnExportarDados").addEventListener("click", async () => {
  const btn = $("btnExportarDados");
  const txt = btn.textContent;
  btn.disabled = true; btn.textContent = "Exportando...";
  try {
    const r = await api("GET", "/api/conta/exportar");
    if (!r || !r.ok) throw new Error();
    const dados = await r.json();
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const slug = (dados.empresa && dados.empresa.slug) || "conta";
    const a = document.createElement("a");
    a.href = url; a.download = "nymbus-dados-" + slug + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("✓ Dados exportados!");
  } catch (e) {
    toast("Não foi possível exportar os dados.", "erro");
  } finally {
    btn.disabled = false; btn.textContent = txt;
  }
});

$("btnAbrirExcluir").addEventListener("click", () => {
  const abrindo = $("formExcluir").hidden;
  alternarFormConta("formExcluir", abrindo);
  $("btnConfirmarExcluir").disabled = true;
  if (abrindo) {
    // Alerta de assinatura ativa: status com cobrança viva no Stripe.
    const st = (assinaturaAtual && assinaturaAtual.status) || "";
    const temAssinatura = ["trialing", "active", "past_due"].includes(st);
    $("excluirAvisoAssinatura").hidden = !temAssinatura;
  }
});
$("excluirConfirma").addEventListener("input", () => {
  $("btnConfirmarExcluir").disabled = $("excluirConfirma").value.trim() !== "EXCLUIR";
});
$("formExcluir").addEventListener("submit", async (e) => {
  e.preventDefault();
  const senhaAtual = $("excluirSenha").value;
  const confirmacao = $("excluirConfirma").value.trim();
  if (confirmacao !== "EXCLUIR") return avisoConta("avisoExcluir", 'Digite "EXCLUIR" para confirmar.');
  if (!senhaAtual) return avisoConta("avisoExcluir", "Informe sua senha atual.");
  const btn = $("btnConfirmarExcluir");
  btn.disabled = true; btn.textContent = "Excluindo...";
  const r = await api("DELETE", "/api/conta", { senhaAtual, confirmacao });
  const data = r ? await r.json().catch(() => ({})) : {};
  if (r && r.ok) {
    sessionStorage.removeItem("token");
    location.href = "/";
  } else {
    btn.disabled = false; btn.textContent = "Excluir permanentemente";
    avisoConta("avisoExcluir", (data && data.erro) || "Não foi possível excluir a conta.");
  }
});

// Ícones de tendência para o comparativo do dashboard
const ICO_TREND_UP = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
const ICO_TREND_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>`;
// ============================================================
// DASHBOARD
// ============================================================
async function carregarDashboard() {
  try {
    const r = await api("GET", "/api/pedidos");
    if (!r) return;
    const pedidos = await r.json();
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

    // (Saudação + status + data agora ficam no header global — sem card no Dashboard.)

    // Visão de Vendas — faturamento por janela. Exclui cancelados (não é venda).
    const vendasAtivas = pedidos.filter((p) => p.status !== "cancelado");
    const fatDe = (lista) => lista.reduce((s, p) => s + (p.total || 0), 0);
    const inicioOntemV = new Date(inicioHoje.getTime() - 86400000);
    const inicio7 = new Date(inicioHoje.getTime() - 6 * 86400000); // últimos 7 dias (inclui hoje)
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const vHoje = fatDe(vendasAtivas.filter((p) => new Date(p.criadoEm) >= inicioHoje));
    const vOntem = fatDe(vendasAtivas.filter((p) => { const d = new Date(p.criadoEm); return d >= inicioOntemV && d < inicioHoje; }));
    const v7 = fatDe(vendasAtivas.filter((p) => new Date(p.criadoEm) >= inicio7));
    const vMes = fatDe(vendasAtivas.filter((p) => new Date(p.criadoEm) >= inicioMes));
    const dataBR = (d) => d.toLocaleDateString("pt-BR");
    const dataCurta = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const setVendaCard = (idVal, valor, idSub, sub) => {
      if ($(idVal)) $(idVal).textContent = "R$ " + moedaBR(valor);
      if ($(idSub)) $(idSub).textContent = sub || "";
    };
    setVendaCard("dashVendasHoje", vHoje, "dashVendasHojeSub", dataBR(inicioHoje));
    setVendaCard("dashVendasOntem", vOntem, "dashVendasOntemSub", dataBR(inicioOntemV));
    setVendaCard("dashVendas7", v7, "dashVendas7Sub", dataCurta(inicio7) + " a " + dataCurta(inicioHoje));
    const mesLabel = agora.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    setVendaCard("dashVendaMes", vMes, "dashVendaMesSub", mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1));

    // ---- Análises: gráficos (30 dias / 12 meses) + widgets do mês ----
    const serieDia = [];
    for (let i = 29; i >= 0; i--) {
      const d0 = new Date(inicioHoje.getTime() - i * 86400000);
      const d1 = new Date(d0.getTime() + 86400000);
      serieDia.push(fatDe(vendasAtivas.filter((p) => { const d = new Date(p.criadoEm); return d >= d0 && d < d1; })));
    }
    renderBarras("dashChartDia", serieDia);
    const serieMes = [];
    for (let i = 11; i >= 0; i--) {
      const m0 = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const m1 = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 1);
      serieMes.push(fatDe(vendasAtivas.filter((p) => { const d = new Date(p.criadoEm); return d >= m0 && d < m1; })));
    }
    renderBarras("dashChartMes", serieMes);

    // Agregados do mês (exclui cancelados). Garante o cardápio p/ mapear o grupo do item.
    const doMes = vendasAtivas.filter((p) => new Date(p.criadoEm) >= inicioMes);
    if (!cardapioAtual || !cardapioAtual.categorias || !cardapioAtual.categorias.length) {
      const rc = await api("GET", "/api/cardapio"); if (rc && rc.ok) cardapioAtual = await rc.json();
    }
    const catId = {}, catNome = {};
    ((cardapioAtual && cardapioAtual.categorias) || []).forEach((c) => (c.itens || []).forEach((it) => {
      if (it.id != null) catId[it.id] = c.nome;
      if (it.nome) catNome[it.nome] = c.nome;
    }));
    const prodMap = {}, grupoMap = {};
    doMes.forEach((p) => (p.itens || []).forEach((i) => {
      const extras = (i.opcionais || []).reduce((x, o) => x + (o.preco || 0) * (o.qtd || 1), 0)
        + (i.variacoes || []).reduce((x, v) => x + (v.preco || 0) * (v.qtd || 1), 0);
      const qtd = i.qtd || 1;
      const nome = i.nome || "—";
      if (!prodMap[nome]) prodMap[nome] = { nome, qtd: 0, valor: 0 };
      prodMap[nome].qtd += qtd;
      prodMap[nome].valor += ((i.preco || 0) + extras) * qtd;
      const cat = catId[i.id] || catNome[i.nome] || "Outros";
      grupoMap[cat] = (grupoMap[cat] || 0) + qtd;
    }));
    // 10 mais vendidos (por faturamento)
    const top10 = Object.values(prodMap).sort((a, b) => b.valor - a.valor).slice(0, 10);
    const elTop = $("dashTop10");
    if (elTop) elTop.innerHTML = top10.length
      ? top10.map((t) => `<li><span class="dash-top-nome">${escapar(t.nome)}</span><span class="dash-top-val">R$ ${moedaBR(t.valor)}</span></li>`).join("")
      : '<li class="dash-vazio">Sem vendas no mês.</li>';
    // Ranking de grupos (por quantidade)
    const ranking = Object.entries(grupoMap).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 6);
    const maxG = Math.max(1, ...ranking.map((r) => r.qtd));
    const elRank = $("dashRankGrupos");
    if (elRank) elRank.innerHTML = ranking.length
      ? ranking.map((r) => `<div class="dash-rank-linha"><span class="dash-rank-nome">${escapar(r.nome)}</span><span class="dash-rank-barra"><span style="width:${Math.round((r.qtd / maxG) * 100)}%"></span></span><span class="dash-rank-qtd">${r.qtd}</span></div>`).join("")
      : '<p class="dash-vazio">Sem vendas no mês.</p>';
    // Visão geral (mês): qualidade e origem das vendas (o faturamento já está no topo).
    const ticket = doMes.length ? fatDe(doMes) / doMes.length : 0;
    // Taxa de cancelamento: precisa dos cancelados → usa `pedidos` (doMes exclui cancelados).
    const doMesTodos = pedidos.filter((p) => new Date(p.criadoEm) >= inicioMes);
    const nCancel = doMesTodos.filter((p) => p.status === "cancelado").length;
    const taxaCanc = doMesTodos.length ? Math.round((nCancel / doMesTodos.length) * 100) : 0;
    // Canais por faturamento (top 3, %).
    const canalFat = {};
    doMes.forEach((p) => { const c = canalPedido(p); canalFat[c] = (canalFat[c] || 0) + (p.total || 0); });
    const fatTotal = Object.values(canalFat).reduce((s, v) => s + v, 0) || 1;
    const canaisStr = Object.entries(canalFat).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([c, v]) => c + " " + Math.round((v / fatTotal) * 100) + "%").join(" · ") || "—";
    // Pagamento mais usado (entre pedidos com forma informada — web/PDV).
    const pagCount = {};
    doMes.forEach((p) => { const f = (p.pagamento || "").trim(); if (f) pagCount[f] = (pagCount[f] || 0) + 1; });
    const pagTot = Object.values(pagCount).reduce((s, v) => s + v, 0);
    const pagTop = Object.entries(pagCount).sort((a, b) => b[1] - a[1])[0];
    const pagStr = pagTop ? pagTop[0] + " (" + Math.round((pagTop[1] / pagTot) * 100) + "%)" : "—";
    const elVisao = $("dashVisaoGeral");
    if (elVisao) elVisao.innerHTML = [
      ["Ticket médio", "R$ " + moedaBR(ticket), false],
      ["Taxa de cancelamento", taxaCanc + "%", false],
      ["Canais", canaisStr, true],
      ["Pagamento mais usado", pagStr, true],
    ].map(([l, v, mini]) => `<div class="dash-visao-linha"><span>${l}</span><strong${mini ? ' class="dash-visao-mini"' : ""}>${escapar(v)}</strong></div>`).join("");

  } catch (e) {
    console.error("Dashboard error:", e);
  }
}

// Mini gráfico de barras (SVG puro, sem lib). serie = array de valores.
function renderBarras(id, serie) {
  const el = $(id);
  if (!el) return;
  const dados = Array.isArray(serie) ? serie : [];
  const max = Math.max(1, ...dados);
  const n = dados.length || 1;
  const slot = 100 / n;
  const bw = slot * 0.68;
  const off = (slot - bw) / 2;
  const bars = dados.map((v, idx) => {
    const h = max > 0 ? (Number(v) || 0) / max * 96 : 0;
    const x = idx * slot + off;
    const y = 100 - Math.max(h, 0.6);
    return `<rect class="dash-bar" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${Math.max(h, 0.6).toFixed(2)}" rx="0.6"></rect>`;
  }).join("");
  el.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
}

// ============================================================
// PEDIDOS
// ============================================================
let pedidosCache = [];
const filtros = { periodo: "hoje", tipo: "todos", canal: "todos", busca: "", dataIni: "", dataFim: "", pagamento: "todos" };

// Paginação da lista
const PEDIDOS_POR_PAGINA = 10;
let paginaPedidos = 1;
let listaPedidosAtual = []; // lista filtrada atual (para paginar sem refazer o cálculo)

// Só busca os pedidos do tenant; o recorte (período/tipo/busca) e as métricas
// são calculados no front em renderPedidos() a partir deste conjunto.
async function carregarPedidos() {
  try {
    const r = await api("GET", "/api/pedidos");
    if (!r) return;
    if (!r.ok) throw new Error("HTTP " + r.status);
    pedidosCache = await r.json();
    renderPedidos();
  } catch (e) {
    toast("Não foi possível carregar os pedidos. Verifique a conexão e tente de novo.", "erro");
  }
}

// Exporta os pedidos atualmente filtrados (período + tipo + busca) em CSV (Excel BR: ; + BOM).
function exportarPedidosCSV() {
  const lista = listaPedidosAtual || [];
  if (!lista.length) { toast("Nenhum pedido para exportar.", "erro"); return; }
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const resumoItens = (p) => (p.itens || [])
    .map((i) => `${i.qtd || 1}x ${i.nome}${i.observacao ? ` (${i.observacao})` : ""}`)
    .join(" | ");
  const cab = ["Numero", "Data", "Cliente", "Telefone", "Tipo", "Endereco", "Pagamento", "Itens", "Total", "Avisado"];
  const linhas = lista.map((p) => [
    p.numero,
    new Date(p.criadoEm).toLocaleString("pt-BR"),
    p.cliente || "",
    telefoneFmt(p),
    p.tipoEntrega || "",
    p.endereco || "",
    p.pagamento || "",
    resumoItens(p),
    "R$ " + moedaBR(p.total || 0),
    p.avisadoEm ? "Sim" : "Nao",
  ].map(esc).join(";"));
  const csv = "﻿" + [cab.map(esc).join(";"), ...linhas].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`${lista.length} pedido(s) exportado(s).`, "sucesso");
}

// Intervalo do período selecionado + nº de dias (para a média diária).
function periodoRange() {
  const agora = new Date();
  const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  // Fim do dia (e não "agora") como limite superior: evita que um pedido recém-criado
  // — cujo horário vem do relógio do servidor — caia "no futuro" por desencontro de
  // relógio e suma do "Hoje" até o próximo refresh.
  const fimDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  if (filtros.periodo === "hoje") {
    return { ini: inicioDoDia(agora), fim: fimDoDia(agora), dias: 1 };
  }
  if (filtros.periodo === "7dias") {
    const ini = inicioDoDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 6));
    return { ini, fim: fimDoDia(agora), dias: 7 };
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

// Tipo de atendimento do pedido: Entrega, Retirada ou Local (consumo no local —
// cobre mesa e balcão do PDV, ambos com tipoEntrega "Balcão").
function tipoPedido(p) {
  if (p.tipoEntrega === "Entrega") return "Entrega";
  if (p.tipoEntrega === "Retirada") return "Retirada";
  return "Local";
}
const ICO_TIPO = {
  Entrega: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>',
  Retirada: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  Local: '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>',
};
const CLS_TIPO = { Entrega: "tag-entrega", Retirada: "tag-retirada", Local: "tag-local" };
function tagTipo(p) {
  const t = tipoPedido(p);
  return `<span class="tag ${CLS_TIPO[t]}">${ICO_TIPO[t]} ${t}</span>`;
}

// Selo de pagamento: mostra status do pedido (cancelado para todos; recebido/a receber para Completo).
function seloPagamento(p) {
  if (p.status === "cancelado") return '<span class="selo-pag selo-cancelado">Cancelado</span>';
  if (planoAtual !== "completo") return "";
  return p.recebidoEm
    ? '<span class="selo-pag selo-pago">Recebido</span>'
    : '<span class="selo-pag selo-areceber">A receber</span>';
}

// Canal de origem do pedido (inferido, sem campo dedicado no banco):
//   Mesa    -> tem mesa_id (salão);
//   Balcão  -> tipoEntrega "Balcão" (só o PDV produz esse tipo);
//   WhatsApp-> o resto (cardápio web via link).
// Borda conhecida: uma venda de PDV feita como Entrega/Retirada cai como "WhatsApp"
// (o PDV é majoritariamente balcão). Conserto 100% robusto = coluna `origem` no
// banco — anotado no ROADMAP/PROGRESSO, sem migration por ora.
function canalPedido(p) {
  // Fonte de verdade: a coluna `origem` (web/pdv/mesa). Uma venda de PDV-Entrega
  // tem origem 'pdv' (canal Balcão) e tipo Entrega — sem a borda antiga.
  if (p.origem === "mesa") return "Mesa";
  if (p.origem === "pdv") return "Balcão";
  if (p.origem === "web") return "WhatsApp";
  // Fallback p/ registro antigo sem origem: infere por mesa/tipo.
  if (p.mesaId != null) return "Mesa";
  if (p.tipoEntrega === "Balcão") return "Balcão";
  return "WhatsApp";
}

const ICO_CANAL = {
  WhatsApp: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.67c2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23-1.52 0-3.01-.41-4.3-1.18l-.31-.18-3.12.82.83-3.04-.2-.32a8.16 8.16 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23zm4.52 9.79c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42-.14 0-.31-.02-.47-.02-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>',
  "Balcão": '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
  Mesa: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10h18"/><path d="M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M6 10v10"/><path d="M18 10v10"/></svg>',
};
function canalTag(p) {
  const c = canalPedido(p);
  const cls = c === "Mesa" ? "canal-mesa" : c === "Balcão" ? "canal-balcao" : "canal-whats";
  return `<span class="canal-tag ${cls}">${ICO_CANAL[c]} ${c}</span>`;
}

// Ações rápidas na linha (desktop, hover) — só Plano Completo. Reimprimir (não
// cancelado) e Receber pagamento (não recebido e não cancelado). Resolve o pedido
// pelo id no cache no handler, então a célula só precisa do data-pid.
const ICO_PRINTER = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
const ICO_MONEY = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
function linhaAcoesHtml(p) {
  if (planoAtual !== "completo") return "";
  if (p.status === "cancelado") return `<td class="ped-acoes-cel"></td>`;
  let btns = `<button class="ped-acao-btn" data-acao="reimprimir" data-pid="${p.id}" title="Reimprimir comanda" aria-label="Reimprimir comanda">${ICO_PRINTER}</button>`;
  // Mesa NÃO recebe aqui — é pago na aba Mesas (Fechar Conta/Receber Parcial),
  // que escolhe a forma, aplica taxa de serviço e faz split.
  if (!p.recebidoEm && p.origem !== "mesa") {
    btns += `<button class="ped-acao-btn" data-acao="receber" data-pid="${p.id}" title="Receber pagamento" aria-label="Receber pagamento">${ICO_MONEY}</button>`;
  }
  return `<td class="ped-acoes-cel"><div class="ped-acoes">${btns}</div></td>`;
}

// Modal "Receber pagamento" (Pedidos): SPLIT de formas somando o total do pedido.
// Pré-seleciona a forma informada e já preenche o valor com o total (1 forma = 1
// clique). Ao receber, chama aoReceber(). Só para pedidos NÃO-mesa (mesa recebe na
// aba Mesas). Mesmo modelo do PDV: dinheiro pode exceder (troco), demais limitam ao restante.
let pedReceberFormaSel = null;
let pedReceberPagamentos = [];
let pedReceberAlvo = 0;
let pedReceberPedido = null;
let pedReceberCallback = null;
function pedReceberPagoTotal() { return Math.round(pedReceberPagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0) * 100) / 100; }
function abrirPedReceber(p, aoReceber) {
  if (!p) return;
  pedReceberPedido = p;
  pedReceberCallback = aoReceber;
  pedReceberAlvo = Math.round((Number(p.total) || 0) * 100) / 100;
  pedReceberPagamentos = [];
  const formas = (typeof mesaFormasPagamento === "function" && mesaFormasPagamento()) || ["Dinheiro", "Pix", "Cartão Crédito", "Cartão Débito", "Outros"];
  // Pré-seleciona a forma informada, se estiver na lista; senão, a primeira.
  pedReceberFormaSel = formas.indexOf(p.pagamento) >= 0 ? p.pagamento : formas[0];
  const X = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  const tiles = formas.map((f) =>
    '<button type="button" class="pdv-forma' + (f === pedReceberFormaSel ? " ativo" : "") + '" data-pforma="' + pdvEsc(f) + '">' + pdvIconeForma(f) + "<span>" + pdvEsc(f) + "</span></button>"
  ).join("");
  $("pedReceberCaixa").innerHTML =
    '<button type="button" class="pdv-modal-x" id="pedReceberFechar" aria-label="Fechar">' + X + "</button>" +
    '<h3 class="pdv-modal-titulo">Receber pagamento</h3>' +
    '<div class="pdv-modal-corpo">' +
      '<div class="mesa-pagar-resumo"><div class="mesa-pagar-linha total"><span>Pedido #' + pdvEsc(String(p.numero)) + "</span><span>" + moedaBR(p.total) + "</span></div></div>" +
      '<span class="pdv-ops-tit">Forma de pagamento</span>' +
      '<div class="pdv-formas">' + tiles + "</div>" +
      '<div class="pdv-pg-add-row"><div class="campo-prefixo pdv-pg-campo"><span class="campo-prefixo-moeda">R$</span><input id="pedReceberValor" type="text" inputmode="numeric" placeholder="0,00" /></div><button type="button" class="pdv-pg-addbtn" id="pedReceberAdd">Adicionar</button></div>' +
      '<div class="pdv-pg-lista" id="pedReceberLista"></div>' +
      '<div class="mesa-pagar-resumo" style="margin-top:10px">' +
        '<div class="mesa-pagar-linha"><span>Pago</span><span id="pedReceberPago">R$ 0,00</span></div>' +
        '<div class="mesa-pagar-linha falta"><span>Falta</span><span id="pedReceberFalta">' + moedaBR(p.total) + "</span></div>" +
        '<div class="mesa-pagar-linha"><span>Troco</span><span id="pedReceberTroco">R$ 0,00</span></div>' +
      "</div>" +
      '<p class="sub" style="margin:10px 0 0">Confirme como o cliente pagou. Exige caixa aberto.</p>' +
    "</div>" +
    '<div class="pdv-modal-rodape">' +
      '<button type="button" class="secundario" id="pedReceberCancelar">Cancelar</button>' +
      '<button type="button" class="primario" id="pedReceberConfirmar" disabled>Receber</button>' +
    "</div>";
  $("pedReceberOverlay").hidden = false;
  $("pedReceberFechar").addEventListener("click", fecharPedReceber);
  $("pedReceberCancelar").addEventListener("click", fecharPedReceber);
  $("pedReceberBg").addEventListener("click", fecharPedReceber);
  $("pedReceberCaixa").querySelectorAll("[data-pforma]").forEach((b) => b.addEventListener("click", () => {
    pedReceberFormaSel = b.dataset.pforma;
    $("pedReceberCaixa").querySelectorAll("[data-pforma]").forEach((x) => x.classList.toggle("ativo", x === b));
    const inp = $("pedReceberValor"); if (inp) inp.focus();
  }));
  const valInp = $("pedReceberValor");
  if (window.Dinheiro) { Dinheiro.mascarar(valInp); Dinheiro.setValor(valInp, pedReceberAlvo); }
  if (typeof pdvSelecionarAoFocar === "function") pdvSelecionarAoFocar(valInp);
  $("pedReceberAdd").addEventListener("click", pedReceberAdd);
  valInp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); pedReceberAdd(); } });
  $("pedReceberConfirmar").addEventListener("click", pedReceberConfirmar);
  renderPedReceberLista();
}
function pedReceberAdd() {
  let v = window.Dinheiro ? Dinheiro.valor($("pedReceberValor")) : 0;
  if (!(v > 0)) { toast("Informe o valor.", "erro"); return; }
  if (!pedReceberFormaSel) { toast("Escolha a forma de pagamento.", "erro"); return; }
  const restante = Math.round((pedReceberAlvo - pedReceberPagoTotal()) * 100) / 100;
  // Só dinheiro pode exceder (gera troco); demais formas limitam ao restante.
  if (!pdvEhDinheiro(pedReceberFormaSel)) {
    if (restante <= 0) { toast("Pagamento já fechado.", "erro"); return; }
    v = Math.min(v, restante);
  }
  pedReceberPagamentos.push({ forma: pedReceberFormaSel, valor: v });
  renderPedReceberLista();
  const novoRest = Math.max(0, Math.round((pedReceberAlvo - pedReceberPagoTotal()) * 100) / 100);
  if (window.Dinheiro) Dinheiro.setValor($("pedReceberValor"), novoRest);
}
function renderPedReceberLista() {
  const box = $("pedReceberLista");
  if (box) {
    box.innerHTML = pedReceberPagamentos.map((p, i) =>
      '<div class="pdv-pg-item">' + pdvIconeForma(p.forma) + "<span>" + pdvEsc(p.forma) + "</span><strong>" + pdvMoney(p.valor) + '</strong><button type="button" data-rmppg="' + i + '" aria-label="Remover">&times;</button></div>'
    ).join("");
    box.querySelectorAll("[data-rmppg]").forEach((b) => b.addEventListener("click", () => { pedReceberPagamentos.splice(Number(b.dataset.rmppg), 1); renderPedReceberLista(); }));
  }
  pedReceberRecalc();
}
function pedReceberRecalc() {
  const pago = pedReceberPagoTotal();
  const falta = Math.max(0, Math.round((pedReceberAlvo - pago) * 100) / 100);
  const troco = Math.max(0, Math.round((pago - pedReceberAlvo) * 100) / 100);
  if ($("pedReceberPago")) $("pedReceberPago").textContent = pdvMoney(pago);
  if ($("pedReceberFalta")) $("pedReceberFalta").textContent = pdvMoney(falta);
  if ($("pedReceberTroco")) $("pedReceberTroco").textContent = pdvMoney(troco);
  if ($("pedReceberConfirmar")) $("pedReceberConfirmar").disabled = !(pedReceberPagamentos.length && falta <= 0.001);
}
async function pedReceberConfirmar() {
  const p = pedReceberPedido;
  if (!p || !pedReceberPagamentos.length) { toast("Adicione ao menos um pagamento.", "erro"); return; }
  // Registrados (somam o total): não-dinheiro como lançado; o dinheiro só a parte da
  // venda — o troco não é receita do caixa (mesmo modelo do PDV).
  const naoDin = pedReceberPagamentos.filter((pg) => !pdvEhDinheiro(pg.forma));
  const somaNaoDin = Math.round(naoDin.reduce((s, pg) => s + pg.valor, 0) * 100) / 100;
  const dinNaVenda = Math.max(0, Math.round((pedReceberAlvo - somaNaoDin) * 100) / 100);
  const registrados = naoDin.map((pg) => ({ forma: pg.forma, valor: pg.valor }));
  if (dinNaVenda > 0) {
    const formaDin = (pedReceberPagamentos.find((pg) => pdvEhDinheiro(pg.forma)) || {}).forma || "Dinheiro";
    registrados.push({ forma: formaDin, valor: dinNaVenda });
  }
  const btn = $("pedReceberConfirmar"); btn.disabled = true;
  const r = await api("POST", "/api/caixa/receber/" + p.id, { pagamentos: registrados });
  if (r && r.ok) {
    fecharPedReceber();
    toast("✓ Recebido!");
    if (typeof pedReceberCallback === "function") pedReceberCallback();
    if (typeof carregarCaixa === "function") carregarCaixa().catch(() => {});
  } else {
    btn.disabled = false;
    const d = r ? await r.json().catch(() => ({})) : {};
    toast(d.erro || "Abra o caixa primeiro.", "erro");
  }
}
function fecharPedReceber() { $("pedReceberOverlay").hidden = true; }

// Prévia compacta dos itens do pedido p/ escanear sem abrir o modal:
// "2x Buffet Kg · 1x Coca 2L". Mostra os 3 primeiros e "+N" se houver mais.
function previaItens(itens) {
  if (!Array.isArray(itens) || !itens.length) return "";
  const partes = itens.map((i) => (i.qtd || 1) + "x " + (i.nome || "item"));
  const MAX = 3;
  let txt = partes.slice(0, MAX).join(" · ");
  if (partes.length > MAX) txt += " +" + (partes.length - MAX);
  return txt;
}

// Resumo do recorte atual (já filtrado por período/tipo/pagamento/busca). Faturamento e
// ticket consideram só pedidos NÃO cancelados (consistente com o Dashboard); "pedidos" e
// "cancelados" são disjuntos e somam o total da lista.
function resumoPedidos(lista) {
  let pedidos = 0, faturamento = 0, cancelados = 0;
  for (const p of lista) {
    if (p.status === "cancelado") { cancelados++; continue; }
    pedidos++;
    faturamento += p.total || 0;
  }
  const ticket = pedidos ? faturamento / pedidos : 0;
  return { pedidos, faturamento, ticket, cancelados };
}

function resumoPedidosHtml(lista) {
  const r = resumoPedidos(lista);
  const cel = (label, valor, extra) =>
    `<div class="ped-resumo-cel${extra ? " " + extra : ""}"><span class="ped-resumo-label">${label}</span><span class="ped-resumo-valor">${valor}</span></div>`;
  return `<div class="pedidos-resumo">
    ${cel("Pedidos", String(r.pedidos))}
    ${cel("Faturamento", "R$ " + moedaBR(r.faturamento))}
    ${cel("Ticket médio", "R$ " + moedaBR(r.ticket))}
    ${cel("Cancelados", String(r.cancelados), r.cancelados > 0 ? "alerta" : "")}
  </div>`;
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

function renderPedidos(animar = false) {
  const range = periodoRange();

  // Conjunto base = período + tipo + canal (a busca não entra aqui).
  const base = pedidosCache.filter(
    (p) => noPeriodo(p, range)
      && (filtros.tipo === "todos" || tipoPedido(p) === filtros.tipo)
      && (filtros.canal === "todos" || canalPedido(p) === filtros.canal)
  );

  // Lista exibida = base + busca (nome / telefone / nº do pedido).
  const termo = filtros.busca.trim().toLowerCase();
  const digitos = termo.replace(/\D/g, "");
  let lista = !termo ? base : base.filter((p) => {
    if ((p.cliente || "").toLowerCase().includes(termo)) return true;
    if (digitos) {
      if ((p.telefone || "").replace(/\D/g, "").includes(digitos)) return true;
      if (String(p.numero).includes(digitos)) return true;
    }
    return false;
  });
  // Filtro de pagamento (só Plano Completo) — não afeta as métricas acima.
  if (planoAtual === "completo" && filtros.pagamento !== "todos") {
    lista = lista.filter((p) =>
      filtros.pagamento === "recebidos" ? !!p.recebidoEm
        : filtros.pagamento === "cancelados" ? p.status === "cancelado"
        : /* areceber */ !p.recebidoEm && p.status !== "cancelado"
    );
  }

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

  // Resumo do recorte atual (não cancelados p/ faturamento/ticket) acima da lista.
  const resumo = resumoPedidosHtml(lista);

  // Desktop: tabela escaneável. Coluna "Ações" só no Completo (ações são desse plano).
  const acoesTh = planoAtual === "completo" ? '<th class="ped-acoes-th">Ações</th>' : "";
  let tabela = `<table class="pedidos-tabela"><thead><tr>
    <th>Nº Pedido</th><th>Data/hora</th><th>Cliente</th><th>Telefone</th><th>Canal</th><th>Tipo</th><th class="col-total">Total</th>${acoesTh}
    </tr></thead><tbody>`;
  pagina.forEach((p) => {
    const novo = pedidosNovosDestaque.has(p.numero) ? ' <span class="ped-novo">NOVO</span>' : "";
    const canc = p.status === "cancelado" ? " cancelado" : "";
    tabela += `<tr class="pedido-linha${novo ? " pedido-linha-novo" : ""}${canc}" data-id="${p.id}">
      <td class="ped-num">#${p.numero}${novo}</td>
      <td>${escapar(dataHoraFmt(p.criadoEm))}</td>
      <td><div class="ped-cliente-linha">${escapar(p.cliente)} ${seloPagamento(p)}</div>${previaItens(p.itens) ? `<div class="ped-itens-previa">${escapar(previaItens(p.itens))}</div>` : ""}</td>
      <td>${escapar(telefoneFmt(p))}</td>
      <td>${canalTag(p)}</td>
      <td>${tagTipo(p)}</td>
      <td class="ped-total">R$ ${moedaBR(p.total)}</td>${linhaAcoesHtml(p)}
    </tr>`;
  });
  tabela += "</tbody></table>";

  // Mobile: cards condensados
  let cards = `<div class="pedidos-cards">`;
  pagina.forEach((p) => {
    const hora = new Date(p.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const novoC = pedidosNovosDestaque.has(p.numero) ? ' <span class="ped-novo">NOVO</span>' : "";
    const cancC = p.status === "cancelado" ? " cancelado" : "";
    cards += `<div class="pedido-card${novoC ? " pedido-card-novo" : ""}${cancC}" data-id="${p.id}">
      <div class="pedido-card-topo">
        <span class="pedido-card-num">#${p.numero}${novoC} • ${hora}</span>
        <span class="pedido-card-tags">${canalTag(p)} ${tagTipo(p)}</span>
      </div>
      <div class="pedido-card-cliente">${escapar(p.cliente)} ${seloPagamento(p)}</div>
      ${previaItens(p.itens) ? `<div class="ped-itens-previa">${escapar(previaItens(p.itens))}</div>` : ""}
      <div class="pedido-card-rodape">
        <span class="sub">${escapar(telefoneFmt(p))}</span>
        <span class="pedido-card-total">R$ ${moedaBR(p.total)}</span>
      </div>
    </div>`;
  });
  cards += "</div>";

  cont.innerHTML = resumo + tabela + cards + paginacaoHtml(lista.length, totalPaginas, ini, pagina.length);

  // Linha (desktop) ou card (mobile) → abre o detalhe existente.
  cont.querySelectorAll("[data-id]").forEach((el) =>
    el.addEventListener("click", () => {
      const p = pedidosCache.find((x) => String(x.id) === el.dataset.id);
      if (!p) return;
      if (pedidosNovosDestaque.delete(p.numero)) renderPedidos(); // visto → remove o "NOVO" na hora
      abrirModalPedido(p);
    })
  );

  // Ações rápidas no hover (desktop, Plano Completo) — não abrem o modal (stopPropagation).
  cont.querySelectorAll(".ped-acao-btn").forEach((b) =>
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      const p = pedidosCache.find((x) => String(x.id) === b.dataset.pid);
      if (!p) return;
      if (b.dataset.acao === "reimprimir") { reimprimirPedido(p.id); return; }
      // Receber: abre o modal p/ confirmar/escolher a forma (mesa nem chega aqui — sem badge).
      abrirPedReceber(p, () => {
        const ci = pedidosCache.findIndex((x) => x.id === p.id);
        if (ci !== -1) pedidosCache[ci].recebidoEm = new Date().toISOString();
        renderPedidos();
      });
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
$("filtroCanal").addEventListener("change", (e) => { filtros.canal = e.target.value; paginaPedidos = 1; renderPedidos(true); });
$("filtroPagamento").addEventListener("change", (e) => { filtros.pagamento = e.target.value; paginaPedidos = 1; renderPedidos(true); });
$("buscaPedido").addEventListener("input", (e) => { filtros.busca = e.target.value; paginaPedidos = 1; renderPedidos(); });

// Ícones neutros (Lucide) para o detalhe
const ICO_USER = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const ICO_LOCAL = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const ICO_PAG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;

function abrirModalPedido(p) {
  pedidoModalAtual = p;
  const btnImp = $("btnImprimirPedido");
  // Pedido cancelado vira só leitura — não faz sentido reimprimir comanda de um cancelado.
  if (btnImp) { btnImp.hidden = (p.status === "cancelado"); marcarImprBloqueado(btnImp, planoAtual !== "completo"); }
  $("pedido-numero").textContent = `Pedido #${p.numero}`;
  $("pedido-quando").textContent = new Date(p.criadoEm).toLocaleString("pt-BR");

  const taxa = p.taxaEntrega || 0;
  // Soma dos extras de um item: cada opcional E cada variação conta a sua quantidade
  // (a variação carrega o preço real; o item-pai fica com preço 0 — ex.: Refrigerante).
  const extrasDe = (i) => (i.opcionais || []).reduce((s, o) => s + (o.preco || 0) * (o.qtd || 1), 0)
    + (i.variacoes || []).reduce((s, v) => s + (v.preco || 0) * (v.qtd || 1), 0);
  const subtotal = p.itens.reduce((acc, i) => acc + (i.preco + extrasDe(i)) * i.qtd, 0);

  const podeModificar = !p.recebidoEm && p.status !== "cancelado";
  const ICO_LIXEIRA = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';

  // Itens como cards de leitura — com botão de cancelar item se pedido modificável
  const itensHtml = p.itens.map((i, idx) => {
    const sub = (i.preco + extrasDe(i)) * i.qtd;
    // Variação = o produto de fato (o pai é só agrupamento) → aparece como detalhe sob o nome.
    const varHtml = (i.variacoes && i.variacoes.length)
      ? `<div class="ped-item-opc">${i.variacoes.map((v) => (v.qtd > 1 ? v.qtd + "x " : "") + escapar(v.nome)).join("<br>")}</div>`
      : "";
    const opcHtml = (i.opcionais && i.opcionais.length)
      ? `<div class="ped-item-opc">${i.opcionais.map((o) => "+ " + (o.qtd > 1 ? o.qtd + "x " : "") + escapar(o.nome)).join("<br>")}</div>`
      : "";
    const delBtn = podeModificar
      ? `<button class="ped-item-del" data-item-idx="${idx}" title="Cancelar item" aria-label="Cancelar item">${ICO_LIXEIRA}</button>`
      : "";
    return `<div class="ped-item">
      <span class="ped-item-qtd">${escapar(String(i.qtd))}x</span>
      <div class="ped-item-info">
        <div class="ped-item-nome">${escapar(i.nome)}</div>
        ${varHtml}
        ${opcHtml}
      </div>
      <span class="ped-item-preco">R$ ${moedaBR(sub)}</span>
      ${delBtn}
    </div>`;
  }).join("");

  // Observação geral do pedido (informada no checkout do cardápio web).
  let obsPedidoHtml = "";
  if (p.observacao && p.observacao.trim()) {
    obsPedidoHtml = `<div class="ped-obs"><span class="ped-obs-titulo">Observação do pedido</span><p>${escapar(p.observacao)}</p></div>`;
  }

  // Observação agregada dos itens (só aparece se houver alguma; prefixo só com >1 item)
  const comObs = p.itens.filter((i) => i.observacao && i.observacao.trim());
  let obsHtml = "";
  if (comObs.length) {
    const linhas = comObs.map((i) =>
      comObs.length > 1
        ? `<p><strong>${escapar(i.nome)}:</strong> ${escapar(i.observacao)}</p>`
        : `<p>${escapar(i.observacao)}</p>`
    ).join("");
    obsHtml = `<div class="ped-obs"><span class="ped-obs-titulo">Observação dos itens</span>${linhas}</div>`;
  }

  const tipoTag = tagTipo(p);

  // Entrega: endereço em texto (sem mapa). Local (mesa/balcão): consumo no local.
  // Retirada: local do restaurante (config) ou balcão.
  let entregaTexto;
  if (p.tipoEntrega === "Entrega") {
    entregaTexto = (p.endereco && p.endereco !== "—")
      ? escapar(p.endereco)
      : `<span class="ped-info-vazio">Endereço não informado</span>`;
  } else if (tipoPedido(p) === "Local") {
    entregaTexto = "Consumo no local";
  } else {
    const endRest = (configAtual && configAtual.restaurante && configAtual.restaurante.endereco) || "";
    entregaTexto = endRest
      ? `Retirada no local<br><span class="sub">${escapar(endRest)}</span>`
      : "Retirada no balcão";
  }

  const canceladoBanner = p.status === "cancelado"
    ? `<div class="ped-cancelado-banner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>Este pedido foi cancelado</div>`
    : "";

  $("pedido-detalhe-corpo").innerHTML = `
    ${canceladoBanner}
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
        ${obsPedidoHtml}
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

  // Wiring dos botões de cancelar item individual
  if (podeModificar) {
    $("pedido-detalhe-corpo").querySelectorAll(".ped-item-del").forEach(function (btn) {
      btn.addEventListener("click", async function (e) {
        e.stopPropagation();
        var idx = Number(btn.dataset.itemIdx);
        var nome = (pedidoModalAtual.itens[idx] || {}).nome || "item";
        var ok = await confirmar(
          "Cancelar item?",
          "Remover \"" + nome + "\" do pedido. Esta ação não pode ser desfeita.",
          "Cancelar item"
        );
        if (!ok) return;
        var r = await api("POST", "/api/pedidos/" + pedidoModalAtual.id + "/cancelar-item", { itemIdx: idx });
        if (!r || !r.ok) {
          var d = await (r && r.json().catch(function () { return {}; })) || {};
          toast(d.erro || "Erro ao cancelar o item.", "erro");
          return;
        }
        var novoPedido = await r.json();
        var ci = pedidosCache.findIndex(function (x) { return x.id === novoPedido.id; });
        if (ci !== -1) pedidosCache[ci] = novoPedido;
        pedidoModalAtual = novoPedido;
        abrirModalPedido(novoPedido);
        renderPedidos();
      });
    });
  }

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
  if (!podeAvisar(p)) {
    cont.innerHTML = ""; // sem canal: não oferece avisar
  } else if (p.avisadoEm) {
    const quando = new Date(p.avisadoEm).toLocaleString("pt-BR");
    cont.innerHTML = `
      <span class="pedido-avisado">✓ Cliente avisado em ${quando}</span>
      <button class="secundario mini" id="btn-avisar">Avisar novamente</button>`;
  } else {
    cont.innerHTML = `<button id="btn-avisar">${escapar(textoAvisar(p))}</button>`;
  }
  const btn = $("btn-avisar");
  if (btn) btn.addEventListener("click", () => avisarCliente(p));

  // Recebimento no caixa (Plano Completo). É AQUI (no pedido) que se recebe o
  // pagamento; o estorno fica na aba Caixa.
  if (planoAtual === "completo" && p.status !== "cancelado") {
    if (p.recebidoEm) {
      const sel = document.createElement("span");
      sel.className = "pedido-avisado";
      sel.textContent = "Pagamento recebido";
      cont.appendChild(sel);
    } else if (p.origem === "mesa") {
      // Mesa é paga na aba Mesas (Fechar Conta), não aqui.
      const nota = document.createElement("span");
      nota.className = "pedido-nota-mesa";
      nota.textContent = "Recebimento pela aba Mesas";
      cont.appendChild(nota);
    } else {
      const extra = document.createElement("button");
      extra.className = "secundario";
      extra.textContent = "Receber pagamento (R$ " + fmtBRn(p.total) + ")";
      extra.addEventListener("click", () => {
        abrirPedReceber(p, () => { p.recebidoEm = new Date().toISOString(); montarAcoes(p); });
      });
      cont.appendChild(extra);
    }
  }

  // Botão de cancelar pedido — disponível se ainda não cancelado. Para pedido PAGO,
  // o cancelamento deduz no caixa (com registro) — confirmação reforçada.
  if (p.status !== "cancelado") {
    const pago = !!p.recebidoEm;
    const btnCancelar = document.createElement("button");
    btnCancelar.className = "btn-cancelar-pedido mini";
    btnCancelar.textContent = "Cancelar pedido";
    btnCancelar.addEventListener("click", async () => {
      const ok = await confirmar(
        "Cancelar pedido #" + p.numero + "?",
        pago
          ? "Este pedido já foi PAGO. Ao cancelar, o valor será deduzido do caixa (com registro) e o pedido fica marcado como cancelado. Exige caixa aberto. Esta ação não pode ser desfeita."
          : "O pedido será marcado como cancelado. Esta ação não pode ser desfeita.",
        "Cancelar pedido"
      );
      if (!ok) return;
      const r = await api("POST", "/api/pedidos/" + p.id + "/cancelar");
      if (!r || !r.ok) {
        const d = r ? await r.json().catch(() => ({})) : {};
        toast(d.erro || "Erro ao cancelar o pedido.", "erro");
        return;
      }
      p.status = "cancelado";
      const ci = pedidosCache.findIndex((x) => x.id === p.id);
      if (ci !== -1) pedidosCache[ci].status = "cancelado";
      toast("Pedido #" + p.numero + " cancelado.");
      fecharModalPedido();
      renderPedidos();
      // Pago: o caixa mudou (dedução) — atualiza a tela do caixa se estiver carregada.
      if (pago && typeof carregarCaixa === "function") carregarCaixa().catch(() => {});
    });
    cont.appendChild(btnCancelar);
  }
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
if ($("btnImprimirPedido")) {
  $("btnImprimirPedido").addEventListener("click", () => {
    if (planoAtual !== "completo") { abrirUpsell("impressao"); return; }
    if (pedidoModalAtual) reimprimirPedido(pedidoModalAtual.id);
  });
}

// ============================================================
// UPSELL DE IMPRESSÃO (Plano Completo)
// No Essencial o botão "Imprimir comanda" aparece bloqueado (cadeado); ao clicar,
// abre o modal de upgrade em vez de imprimir.
// ============================================================
const SVG_CADEADO_MINI = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';

function marcarImprBloqueado(btn, bloqueado) {
  if (!btn) return;
  btn.classList.toggle("bloqueado-impr", bloqueado);
  const existente = btn.querySelector(".impr-lock");
  if (bloqueado && !existente) {
    const s = document.createElement("span");
    s.className = "impr-lock";
    s.innerHTML = SVG_CADEADO_MINI;
    btn.appendChild(s);
  } else if (!bloqueado && existente) {
    existente.remove();
  }
}

// Presets do upsell, um por feature do Plano Completo. Para uma nova feature,
// basta adicionar um preset aqui e chamar abrirUpsell("nome") no controle bloqueado.
const SVG_CHECK_UPSELL = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
function _svgUpsell(inner) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
}
const UPSELL_FEATURES = {
  mesas: {
    icone: _svgUpsell('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>'),
    titulo: "Controle as mesas do salão",
    sub: 'O <strong>controle de mesas e comandas</strong> faz parte do <strong>Plano Completo</strong>. Gerencie o salão inteiro pelo painel, do abrir ao fechar.',
    beneficios: [
      'Abra a mesa, lance rodadas e feche com <strong>pagamento dividido</strong>',
      '<strong>Transferir ou juntar</strong> comandas entre mesas',
      'Conta com <strong>valor por pessoa</strong> e taxa de serviço',
    ],
  },
  impressao: {
    icone: _svgUpsell('<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>'),
    titulo: "Imprima seus pedidos automaticamente",
    sub: 'A impressão de comandas faz parte do <strong>Plano Completo</strong>. Imprima a via da cozinha e o cupom do cliente direto na impressora térmica — sem digitar nada.',
    beneficios: [
      'Via da <strong>cozinha</strong> + <strong>cupom do cliente</strong> em um clique',
      'Impressora térmica 80mm — <strong>USB ou serial (COM)</strong>',
      'Corte do papel <strong>automático</strong>',
    ],
  },
  pdv: {
    icone: _svgUpsell('<rect x="3" y="3" width="18" height="13" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><path d="M7 20h10"/><path d="M9 16v4"/><path d="M15 16v4"/>'),
    titulo: "Venda no balcão com o PDV",
    sub: 'O <strong>PDV (vendas no local)</strong> faz parte do <strong>Plano Completo</strong>. Monte o pedido na hora, cobre e a venda já entra no caixa com baixa de estoque.',
    beneficios: [
      'Monte a venda pelo <strong>cardápio</strong> (opcionais, observação e itens por kg)',
      'Cobre com <strong>troco, desconto e pagamento dividido</strong>',
      'A venda entra no <strong>caixa</strong> e dá <strong>baixa no estoque</strong> automático',
    ],
  },
  caixa: {
    icone: _svgUpsell('<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/>'),
    titulo: "Controle o caixa do seu dia",
    sub: 'O <strong>caixa do dia</strong> faz parte do <strong>Plano Completo</strong>. Abra, receba por pedido e feche com conferência do dinheiro.',
    beneficios: [
      'Abertura e fechamento com <strong>conferência de cédulas</strong>',
      '<strong>Sangria, suprimento</strong> e recebimento por pedido',
      '<strong>Relatório</strong> do caixa e histórico do dia',
    ],
  },
  freteRaio: {
    icone: _svgUpsell('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
    titulo: "Cobre frete por distância",
    sub: 'O <strong>frete por raio</strong> faz parte do <strong>Plano Completo</strong>. O valor é calculado pela distância real do cliente até o seu restaurante.',
    beneficios: [
      'Frete pela <strong>distância (km)</strong> até o cliente',
      'Faixas de preço por raio, calculadas pelo <strong>CEP</strong>',
      'Fora da área vira <strong>retirada</strong> automaticamente',
    ],
  },
};

// Abre o card de upgrade preenchido com o conteúdo da feature pedida.
function abrirUpsell(key) {
  const f = UPSELL_FEATURES[key] || UPSELL_FEATURES.impressao;
  const ico = $("upsell-ico"), tit = $("upsell-titulo"), sub = $("upsell-sub"), lista = $("upsell-lista");
  if (ico) ico.innerHTML = f.icone;
  if (tit) tit.textContent = f.titulo;
  if (sub) sub.innerHTML = f.sub;
  if (lista) lista.innerHTML = f.beneficios.map((b) => `<li>${SVG_CHECK_UPSELL}<span>${b}</span></li>`).join("");
  const o = $("upsell-overlay");
  if (o) o.style.display = "flex";
}
function fecharUpsell() {
  const o = $("upsell-overlay");
  if (o) o.style.display = "none";
}

if ($("upsell-fechar")) $("upsell-fechar").addEventListener("click", fecharUpsell);
if ($("upsell-agora-nao")) $("upsell-agora-nao").addEventListener("click", fecharUpsell);
if ($("upsell-overlay")) $("upsell-overlay").addEventListener("click", (e) => {
  if (e.target === $("upsell-overlay")) fecharUpsell();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("upsell-overlay") && $("upsell-overlay").style.display === "flex") fecharUpsell();
});
if ($("upsell-cta")) $("upsell-cta").addEventListener("click", () => {
  fecharUpsell();
  fecharModalPedido();
  fecharNovoPedido();
  const b = document.querySelector("nav button[data-aba='assinatura']");
  if (b) b.click();
});

// ============================================================
// PDV — vendas no local (Plano Completo)
// Usa o cardápio já carregado (cardapioAtual). A venda é gravada/recebida no
// servidor (POST /api/pdv/vender) que recalcula tudo; o front só faz a prévia.
// ============================================================
let pdvCart = [];        // [{ uid, id, nome, preco, unidade, qtd, opcionais:[{nome,preco,qtd}], observacao }]
let pdvFormasPg = ["Dinheiro"]; // formas de pagamento (config.pagamentos)
let pdvCatAtiva = null;  // null = Todos
let pdvBuscaTermo = "";
let pdvUidSeq = 1;
let pdvDesconto = null;  // { tipo:'valor'|'pct', valor } | null — aplicado no carrinho

// Desconto sobre o subtotal. Retorna { desconto (R$ abatido), total (líquido) }.
function pdvDescontoCalc(subtotal) {
  const sub = Math.max(0, Number(subtotal) || 0);
  let abate = 0;
  if (pdvDesconto && Number(pdvDesconto.valor) > 0) {
    abate = pdvDesconto.tipo === "pct"
      ? sub * (Math.min(100, Number(pdvDesconto.valor)) / 100)
      : Number(pdvDesconto.valor);
  }
  abate = Math.min(sub, Math.max(0, Math.round(abate * 100) / 100));
  return { desconto: abate, total: Math.round((sub - abate) * 100) / 100 };
}
function pdvTotalLiq() { return pdvDescontoCalc(pdvTotal()).total; }
// Frete da venda (0 fora de Entrega ou sem endereço). Total a cobrar = líquido + frete.
function pdvFreteValor() { return (pdvTipoEntrega === "Entrega" && pdvEntrega) ? (Number(pdvEntrega.taxaEntrega) || 0) : 0; }
function pdvTotalCobrar() { return Math.round((pdvTotalLiq() + pdvFreteValor()) * 100) / 100; }

function pdvMoney(v) { return Dinheiro.comPrefixo(Number(v) || 0); }
// Seleciona todo o conteúdo ao focar (deferido p/ não perder a seleção no clique
// do mouse) — operador digita o valor recebido substituindo, sem apagar.
function pdvSelecionarAoFocar(el) {
  if (!el) return;
  el.addEventListener("focus", () => setTimeout(() => { try { el.select(); } catch (_) {} }, 0));
}
function pdvEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function pdvParseOpcionais(texto) {
  if (!texto || !String(texto).trim()) return [];
  const lista = [];
  String(texto).split("\n").forEach((l) => {
    l = l.trim().replace(/^[*\-•]\s*/, "");
    if (!l) return;
    const partes = l.split("|");
    const nome = partes[0].trim();
    let preco = 0;
    if (partes.length >= 2) preco = parseFloat(partes[1].replace(",", ".").replace(/[^\d.]/g, "")) || 0;
    if (nome) lista.push({ nome, preco });
  });
  return lista;
}
function pdvPrecoUnit(l) {
  const add = (l.opcionais || []).reduce((s, o) => s + (Number(o.preco) || 0) * (o.qtd || 1), 0);
  const addV = (l.variacoes || []).reduce((s, v) => s + (Number(v.preco) || 0) * (v.qtd || 1), 0);
  return (Number(l.preco) || 0) + add + addV;
}
function pdvPrecoLinha(l) { return pdvPrecoUnit(l) * (Number(l.qtd) || 0); }
function pdvTotal() { return pdvCart.reduce((s, l) => s + pdvPrecoLinha(l), 0); }

async function carregarPdv() {
  $("pdvLock").hidden = true; $("pdvSemCaixa").hidden = true; $("pdvVencido").hidden = true; $("pdvConteudo").hidden = true; $("pdvFab").hidden = true;
  const r = await api("GET", "/api/caixa"); // gate (403) + status do caixa, numa chamada
  if (!r) return; // 401 já redirecionou
  if (r.status === 403) { $("pdvLock").hidden = false; return; }
  if (!r.ok) { $("pdvSemCaixa").hidden = false; return; }
  const data = await r.json();
  pdvFormasPg = (Array.isArray(data.formasPagamento) && data.formasPagamento.length) ? data.formasPagamento : ["Dinheiro"];
  if (!data.caixa) { $("pdvSemCaixa").hidden = false; return; } // exige caixa aberto
  if (data.caixa.vencido) { // caixa de outro dia: bloqueia venda até fechar
    const dia = new Date(data.caixa.abertoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    $("pdvVencidoSub").textContent = "Há um caixa aberto de " + dia + ". Feche-o no Caixa e abra um novo para vender hoje.";
    $("pdvVencido").hidden = false; return;
  }
  // Garante o cardápio carregado (a aba PDV pode ser a primeira a abrir).
  if (!cardapioAtual || !cardapioAtual.categorias || !cardapioAtual.categorias.length) {
    const rc = await api("GET", "/api/cardapio");
    if (rc && rc.ok) cardapioAtual = await rc.json();
  }
  $("pdvConteudo").hidden = false;
  renderPdvCategorias();
  renderPdvProdutos();
  renderPdvCarrinho();
}

function pdvCategorias() { return (cardapioAtual && cardapioAtual.categorias) || []; }

var IC_TAG = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
var IC_GRID = '<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
var IC_IMG = '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

function renderPdvCategorias() {
  const nav = $("pdvCats");
  const cats = pdvCategorias().filter((c) => c && c.nome);
  nav.innerHTML = "";
  const mk = (rotulo, val, ico) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pdv-cat" + ((pdvCatAtiva === val) ? " ativo" : "");
    b.innerHTML = ico + "<span>" + pdvEsc(rotulo) + "</span>";
    b.addEventListener("click", () => { pdvCatAtiva = val; renderPdvCategorias(); renderPdvProdutos(); });
    nav.appendChild(b);
  };
  mk("Todos", null, IC_GRID);
  cats.forEach((c) => mk(c.nome, c.nome, IC_TAG));
}

function renderPdvProdutos() {
  const grid = $("pdvGrid");
  grid.innerHTML = "";
  let n = 0;
  pdvCategorias().forEach((cat) => {
    if (pdvCatAtiva !== null && cat.nome !== pdvCatAtiva) return;
    (cat.itens || []).forEach((item) => {
      if (!item || item.disponivel === false || item.arquivado === true) return;
      if (pdvBuscaTermo && !Busca.itemCasaBusca(item.nome, pdvBuscaTermo)) return;
      const st = window.Estoque ? window.Estoque.statusEstoque(item) : { esgotado: false };
      const ehKg = item.unidade === "kg";
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "pdv-tile" + (st.esgotado ? " esgotado" : "");
      tile.dataset.id = item.id;
      const img = item.imagem
        ? '<img class="pdv-tile-img" src="' + pdvEsc(item.imagem) + '" alt="" loading="lazy" />'
        : '<div class="pdv-tile-img vazia">' + IC_IMG + "</div>";
      tile.innerHTML =
        img +
        '<div class="pdv-tile-corpo">' +
          '<span class="pdv-tile-nome">' + pdvEsc(item.nome) + "</span>" +
          '<span class="pdv-tile-preco">' + pdvMoney(item.preco) + (ehKg ? "<small>/kg</small>" : "") + "</span>" +
        "</div>" +
        (st.esgotado ? '<span class="pdv-tile-selo">Esgotado</span>' : "");
      if (!st.esgotado) tile.addEventListener("click", () => pdvTileClick(item));
      grid.appendChild(tile);
      n++;
    });
  });
  $("pdvVazio").hidden = n > 0;
  pdvAtualizarBadges();
}

// Badge de quantidade no card: total de unidades (un) ou nº de pesagens (kg) que o
// item já tem no carrinho. 0 = sem badge.
function pdvBadgeDoItem(id) {
  const linhas = pdvCart.filter((l) => l.id === id);
  if (!linhas.length) return 0;
  if (linhas.some((l) => l.unidade === "kg")) return linhas.length;
  return linhas.reduce((s, l) => s + (l.qtd || 0), 0);
}
// Atualiza os selos sem reconstruir a grade (preserva o scroll). Chamado pela grade
// e a cada mudança do carrinho (renderPdvCarrinho).
function pdvAtualizarBadges() {
  const grid = $("pdvGrid");
  if (!grid) return;
  grid.querySelectorAll(".pdv-tile").forEach((tile) => {
    const n = pdvBadgeDoItem(tile.dataset.id);
    let badge = tile.querySelector(".pdv-tile-badge");
    if (n > 0) {
      if (!badge) { badge = document.createElement("span"); badge.className = "pdv-tile-badge"; tile.appendChild(badge); }
      badge.textContent = n;
    } else if (badge) {
      badge.remove();
    }
  });
}

function pdvTileClick(item) {
  const ops = pdvParseOpcionais(item.opcionais);
  const grps = (window.Grupos ? window.Grupos.normalizarGrupos(item.composicao) : []);
  const vars = (window.Variacoes ? window.Variacoes.normalizarVariacoes(item.variacoes) : []);
  const ehKg = item.unidade === "kg";
  if (ops.length || grps.length || vars.length || ehKg) { abrirPdvItemModal(item, null); return; }
  // Item simples: soma na linha existente (sem opcionais/obs/composição) ou cria nova.
  const ex = pdvCart.find((l) => l.id === item.id && !l.opcionais.length && !l.observacao && !(l.composicao && l.composicao.length));
  if (ex) ex.qtd += 1;
  else pdvCart.push({ uid: pdvUidSeq++, id: item.id, nome: item.nome, preco: Number(item.preco) || 0, unidade: "un", qtd: 1, composicao: [], opcionais: [], observacao: "" });
  // Sem toast por item: o feedback é o próprio carrinho + o badge de quantidade no
  // card. Toast fica reservado para ações mais relevantes.
  renderPdvCarrinho();
}

// ---- Modal de item (opcionais / peso / observação) ----
let pdvItemCtx = null; // { item, ops, uid|null }

function abrirPdvItemModal(item, uid) {
  const ops = pdvParseOpcionais(item.opcionais);
  const grps = (window.Grupos ? window.Grupos.normalizarGrupos(item.composicao) : []);
  const vars = (window.Variacoes ? window.Variacoes.normalizarVariacoes(item.variacoes) : []).map((v) => ({
    id: v.id, nome: v.nome, preco: v.preco,
    esgotado: window.Estoque ? window.Estoque.statusEstoque(v).esgotado : false,
  }));
  const ehKg = item.unidade === "kg";
  const linha = uid != null ? pdvCart.find((l) => l.uid === uid) : null;
  pdvItemCtx = { item, ops, grps, vars, uid: uid != null ? uid : null, ehKg };
  const opsQtd = ops.map((o) => {
    const found = linha && (linha.opcionais || []).find((x) => x.nome === o.nome);
    return found ? found.qtd : 0;
  });
  const varsQtd = vars.map((v) => {
    const found = linha && (linha.variacoes || []).find((x) => x.id === v.id);
    return found ? found.qtd : 0;
  });
  const escIni = {};
  (linha && Array.isArray(linha.composicao) ? linha.composicao : []).forEach((c) => { escIni[c.grupo] = c.itens || []; });
  const qtdIni = linha ? linha.qtd : (ehKg ? "" : 1);
  const obsIni = linha ? linha.observacao : "";

  let html =
    '<button class="pdv-modal-x" type="button" data-pdv-close="item" aria-label="Fechar"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
    '<h3 class="pdv-modal-titulo">' + pdvEsc(item.nome) + "</h3>";
  if (ehKg) {
    html += '<label class="pdv-campo"><span>Peso (kg)</span><input id="pdvMpeso" type="text" inputmode="decimal" placeholder="0,000" value="' + pdvEsc(qtdIni === "" ? "" : String(qtdIni).replace(".", ",")) + '" /></label>';
  } else {
    html += '<div class="pdv-campo"><span>Quantidade</span><div class="pdv-stepper pdv-stepper-qtd"><button type="button" data-qstep="-1" aria-label="Diminuir">−</button><input id="pdvMqtd" class="pdv-qtd-input" type="text" inputmode="numeric" value="' + qtdIni + '" aria-label="Quantidade" /><button type="button" data-qstep="1" aria-label="Aumentar">+</button></div></div>';
  }
  grps.forEach((g) => {
    const unico = g.max === 1;
    const regra = g.obrigatorio ? (unico ? "Escolha 1" : "Escolha ao menos " + Math.max(1, g.min)) : (g.max > 1 ? "Até " + g.max : "Opcional");
    html += '<div class="pdv-grp" data-grupo="' + pdvEsc(g.nome) + '"><div class="pdv-grp-cab"><span class="pdv-grp-nome">' + pdvEsc(g.nome) + '</span><span class="pdv-grp-regra' + (g.obrigatorio ? " obrig" : "") + '">' + pdvEsc(regra) + '</span></div>';
    g.itens.forEach((nome) => {
      const marcado = (escIni[g.nome] || []).indexOf(nome) !== -1 ? " checked" : "";
      const tipo = unico ? "radio" : "checkbox";
      html += '<label class="pdv-grp-opt"><input type="' + tipo + '" name="pgrp_' + pdvEsc(g.nome) + '" value="' + pdvEsc(nome) + '" data-grupo="' + pdvEsc(g.nome) + '" data-max="' + g.max + '"' + marcado + ' /> <span>' + pdvEsc(nome) + '</span></label>';
    });
    html += '</div>';
  });
  if (ops.length) {
    html += '<div class="pdv-ops"><span class="pdv-ops-tit">Adicionais</span>';
    ops.forEach((o, i) => {
      html += '<div class="pdv-op"><span class="pdv-op-nome">' + pdvEsc(o.nome) + '</span><span class="pdv-op-preco">+ ' + pdvMoney(o.preco) + '</span>' +
        '<div class="pdv-stepper" data-stepper="op" data-opi="' + i + '"><button type="button" data-step="-1">−</button><span class="pdv-op-q">' + opsQtd[i] + '</span><button type="button" data-step="1">+</button></div></div>';
    });
    html += "</div>";
  }
  if (vars.length) {
    html += '<div class="pdv-ops"><span class="pdv-ops-tit">Opções</span>';
    vars.forEach((v, i) => {
      if (v.esgotado) {
        html += '<div class="pdv-op pdv-op-esg"><span class="pdv-op-nome">' + pdvEsc(v.nome) + ' <small>(esgotado)</small></span><span class="pdv-op-preco">' + pdvMoney(v.preco) + '</span></div>';
      } else {
        html += '<div class="pdv-op"><span class="pdv-op-nome">' + pdvEsc(v.nome) + '</span><span class="pdv-op-preco">' + pdvMoney(v.preco) + '</span>' +
          '<div class="pdv-stepper" data-stepper="var" data-vari="' + i + '"><button type="button" data-step="-1">−</button><span class="pdv-var-q">' + varsQtd[i] + '</span><button type="button" data-step="1">+</button></div></div>';
      }
    });
    html += "</div>";
  }
  html += '<label class="pdv-campo"><span>Observação (opcional)</span><textarea id="pdvMobs" rows="2" placeholder="Ex.: sem cebola, ponto da carne…">' + pdvEsc(obsIni) + "</textarea></label>";
  html += '<button type="button" class="primario pdv-modal-add" id="pdvMadd">' + (uid != null ? "Salvar" : "Adicionar") + ' · <span id="pdvMtot">R$ 0,00</span></button>';

  $("pdvItemCaixa").innerHTML = html;
  $("pdvItemOverlay").hidden = false;
  focarModalPdv("pdvItemCaixa");

  // wiring
  $("pdvItemCaixa").querySelectorAll("[data-stepper]").forEach((box) => {
    box.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => {
      const span = box.querySelector("span");
      const min = box.dataset.stepper === "qtd" ? 1 : 0;
      let v = parseInt(span.textContent, 10) || 0;
      v = Math.max(min, v + Number(b.dataset.step));
      span.textContent = v;
      pdvItemRecalc();
    }));
  });
  // Quantidade (un): input digitável + botões +/− (mínimo 1). O kg usa o próprio campo de peso.
  const qtdInput = $("pdvMqtd");
  if (qtdInput) {
    $("pdvItemCaixa").querySelectorAll("[data-qstep]").forEach((b) => b.addEventListener("click", () => {
      const v = Math.max(1, (parseInt(qtdInput.value, 10) || 0) + Number(b.dataset.qstep));
      qtdInput.value = v;
      pdvItemRecalc();
    }));
    qtdInput.addEventListener("input", () => {
      const d = qtdInput.value.replace(/\D/g, "");
      if (qtdInput.value !== d) qtdInput.value = d;
      pdvItemRecalc();
    });
    qtdInput.addEventListener("blur", () => {
      if (!(parseInt(qtdInput.value, 10) > 0)) qtdInput.value = "1";
      pdvItemRecalc();
    });
  }
  $("pdvItemCaixa").querySelectorAll(".pdv-grp input").forEach((inp) => inp.addEventListener("change", () => {
    if (inp.type === "checkbox") {
      const max = parseInt(inp.dataset.max, 10) || 0;
      const escG = (window.CSS && CSS.escape) ? CSS.escape(inp.dataset.grupo) : inp.dataset.grupo.replace(/"/g, '\\"');
      const marc = $("pdvItemCaixa").querySelectorAll('.pdv-grp input[data-grupo="' + escG + '"]:checked');
      if (max > 1 && marc.length > max) inp.checked = false;
    }
    pdvItemRecalc();
  }));
  const peso = $("pdvMpeso"); if (peso) peso.addEventListener("input", pdvItemRecalc);
  $("pdvMadd").addEventListener("click", pdvConfirmarItem);
  const xb = $("pdvItemCaixa").querySelector('[data-pdv-close="item"]');
  if (xb) xb.addEventListener("click", fecharPdvItemModal);
  pdvItemRecalc();
}
function fecharPdvItemModal() { $("pdvItemOverlay").hidden = true; pdvItemCtx = null; }

function _pdvLerModalItem() {
  const { item, ops, vars, ehKg } = pdvItemCtx;
  let qtd;
  if (ehKg) {
    qtd = parseFloat(String(($("pdvMpeso").value || "")).replace(",", ".")) || 0;
  } else {
    qtd = parseInt($("pdvMqtd").value, 10) || 1;
  }
  const opcionais = [];
  $("pdvItemCaixa").querySelectorAll('[data-stepper="op"]').forEach((box) => {
    const i = Number(box.dataset.opi);
    const q = parseInt(box.querySelector("span").textContent, 10) || 0;
    if (q > 0) opcionais.push({ nome: ops[i].nome, preco: ops[i].preco, qtd: q });
  });
  const composicao = [];
  ($("pdvItemCaixa").querySelectorAll(".pdv-grp")).forEach((box) => {
    const grupo = box.getAttribute("data-grupo");
    const itens = Array.prototype.slice.call(box.querySelectorAll("input:checked")).map((c) => c.value);
    if (itens.length) composicao.push({ grupo, itens });
  });
  const variacoes = [];
  $("pdvItemCaixa").querySelectorAll('[data-stepper="var"]').forEach((box) => {
    const i = Number(box.dataset.vari);
    const q = parseInt(box.querySelector("span").textContent, 10) || 0;
    if (q > 0 && vars[i]) variacoes.push({ id: vars[i].id, nome: vars[i].nome, preco: vars[i].preco, qtd: q });
  });
  const observacao = ($("pdvMobs").value || "").trim().slice(0, 200);
  return { item, qtd, composicao, opcionais, variacoes, observacao, ehKg };
}
function pdvItemRecalc() {
  const { item, qtd, opcionais, variacoes } = _pdvLerModalItem();
  const add = opcionais.reduce((s, o) => s + o.preco * o.qtd, 0);
  const addV = (variacoes || []).reduce((s, v) => s + v.preco * v.qtd, 0);
  const tot = ((Number(item.preco) || 0) + add + addV) * (Number(qtd) || 0);
  const el = $("pdvMtot"); if (el) el.textContent = pdvMoney(tot);
}
function pdvConfirmarItem() {
  const { item, qtd, composicao, opcionais, variacoes, observacao, ehKg } = _pdvLerModalItem();
  if (ehKg && !(qtd > 0)) { toast("Informe o peso.", "erro"); return; }
  const aval = window.Grupos ? window.Grupos.avaliarComposicao(item, composicao) : { valido: true };
  if (!aval.valido) { toast(aval.pendencias[0] || "Complete a composição.", "erro"); return; }
  // item COM variações exige ≥1 escolha (senão o total seria só o preço base)
  if ((pdvItemCtx.vars || []).length && !(variacoes || []).length) { toast("Escolha ao menos 1 opção.", "erro"); return; }
  const linha = { uid: pdvItemCtx.uid != null ? pdvItemCtx.uid : pdvUidSeq++, id: item.id, nome: item.nome, preco: Number(item.preco) || 0, unidade: ehKg ? "kg" : "un", qtd, composicao: aval.selecoes, opcionais, variacoes, observacao };
  const idx = pdvItemCtx.uid != null ? pdvCart.findIndex((l) => l.uid === pdvItemCtx.uid) : -1;
  if (idx >= 0) pdvCart[idx] = linha; else pdvCart.push(linha);
  fecharPdvItemModal();
  renderPdvCarrinho();
}

// ---- Carrinho ----
function renderPdvCarrinho() {
  const cont = $("pdvCartItens");
  cont.innerHTML = "";
  if (!pdvCart.length) {
    cont.innerHTML = '<p class="pdv-cart-vazio">Toque nos produtos para montar a venda.</p>';
  } else {
    pdvCart.forEach((l) => {
      const div = document.createElement("div");
      div.className = "pdv-linha";
      const opsTxt = (l.opcionais || []).map((o) => (o.qtd > 1 ? o.qtd + "x " : "") + o.nome).join(", ");
      const varsTxt = (l.variacoes || []).map((v) => (v.qtd > 1 ? v.qtd + "x " : "") + v.nome).join(", ");
      const compTxt = (l.composicao || []).map((c) => c.itens.join(", ")).filter(Boolean).join(" · ");
      const ehKg = l.unidade === "kg";
      const unit = pdvMoney(pdvPrecoUnit(l)) + (ehKg ? "/kg" : "");
      const ctrl = ehKg
        ? '<span class="pdv-linha-kg" data-edit="' + l.uid + '">' + window.Estoque.formatarQtd(l.qtd, "kg") + " kg</span>"
        : '<div class="pdv-stepper sm"><button type="button" data-dec="' + l.uid + '">−</button><span>' + l.qtd + '</span><button type="button" data-inc="' + l.uid + '">+</button></div>';
      div.innerHTML =
        '<div class="pdv-linha-top" data-edit="' + l.uid + '">' +
          '<span class="pdv-linha-nome">' + pdvEsc(l.nome) + "</span>" +
          '<span class="pdv-linha-preco">' + pdvMoney(pdvPrecoLinha(l)) + "</span>" +
        "</div>" +
        '<span class="pdv-linha-unit">Preço unit: ' + unit + "</span>" +
        (varsTxt ? '<span class="pdv-linha-ops">' + pdvEsc(varsTxt) + "</span>" : "") +
        (compTxt ? '<span class="pdv-linha-ops">' + pdvEsc(compTxt) + "</span>" : "") +
        (opsTxt ? '<span class="pdv-linha-ops">' + pdvEsc(opsTxt) + "</span>" : "") +
        (l.observacao ? '<span class="pdv-linha-obs">' + pdvEsc(l.observacao) + "</span>" : "") +
        '<div class="pdv-linha-ctrl">' +
          ctrl +
          '<button class="pdv-linha-rm" type="button" data-rm="' + l.uid + '" aria-label="Remover"><svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        "</div>";
      cont.appendChild(div);
    });
    cont.querySelectorAll("[data-inc]").forEach((b) => b.addEventListener("click", () => { const l = pdvCart.find((x) => x.uid == b.dataset.inc); if (l) { l.qtd++; renderPdvCarrinho(); } }));
    cont.querySelectorAll("[data-dec]").forEach((b) => b.addEventListener("click", () => { const l = pdvCart.find((x) => x.uid == b.dataset.dec); if (l) { l.qtd = Math.max(1, l.qtd - 1); renderPdvCarrinho(); } }));
    cont.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => { pdvCart = pdvCart.filter((x) => x.uid != b.dataset.rm); renderPdvCarrinho(); }));
    cont.querySelectorAll("[data-edit]").forEach((el) => el.addEventListener("click", () => {
      const l = pdvCart.find((x) => x.uid == el.dataset.edit);
      if (!l) return;
      const item = pdvAcharItem(l.id) || { id: l.id, nome: l.nome, preco: l.preco, unidade: l.unidade, opcionais: "" };
      abrirPdvItemModal(item, l.uid);
    }));
  }
  // Rodapé: reflete o desconto aplicado no Finalizar venda (Subtotal/Desconto só
  // aparecem quando há desconto; senão mostra só o Total).
  const sub = pdvTotal();
  const { desconto, total } = pdvDescontoCalc(sub);
  const temDesc = !!pdvDesconto && desconto > 0;
  $("pdvSubtotal").textContent = pdvMoney(sub);
  $("pdvDescValor").textContent = "− " + pdvMoney(desconto);
  $("pdvSubLinha").hidden = !temDesc;
  $("pdvDescLinha").hidden = !temDesc;
  $("pdvTotal").textContent = pdvMoney(total);
  $("pdvCobrar").disabled = !pdvCart.length;
  const fab = $("pdvFab");
  if (pdvCart.length) {
    fab.hidden = false;
    $("pdvFabCount").textContent = pdvCart.reduce((s, l) => s + (l.unidade === "kg" ? 1 : l.qtd), 0);
    $("pdvFabTotal").textContent = pdvMoney(total);
  } else { fab.hidden = true; fab.classList.remove("oculto"); $("pdvCarrinho").classList.remove("aberto"); pdvDesconto = null; }
  pdvAtualizarBadges(); // reflete a quantidade nos cards da grade
}

function pdvAcharItem(id) {
  for (const c of pdvCategorias()) {
    for (const it of (c.itens || [])) if (it && it.id === id) return it;
  }
  return null;
}

// ---- Pagamento (forma em tiles + split + troco + desconto) ----
let pdvPagamentos = []; // [{ forma, valor }] adicionados (tendência)
let pdvFormaSel = null;
let pdvDescTipoSel = "valor"; // tipo do desconto na tela de pagamento ('valor'|'pct')
let pdvTipoEntrega = "Balcão"; // 'Balcão' | 'Entrega' | 'Retirada'
let pdvEntrega = null; // { endereco, enderecoCampos, telefone, taxaEntrega } | null

function pdvEhDinheiro(f) { return /dinheiro|esp[ée]cie/i.test(f || ""); }
function pdvIconeForma(f) {
  const s = (f || "").toLowerCase();
  const w = (inner) => '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
  if (pdvEhDinheiro(s)) return w('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>');
  if (/pix/.test(s)) return w('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>');
  if (/cart|cr[eé]dito|d[eé]bito/.test(s)) return w('<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>');
  if (/aliment|vale|vr\b|va\b|ticket|sodexo|alelo/.test(s)) return w('<path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2"/><path d="M5 11v11"/><path d="M19 2v20"/><path d="M19 8c-1.7 0-3-1.8-3-4s1.3-2 3-2"/>');
  return w('<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><circle cx="16" cy="14" r="1.5"/>');
}

// A11y: foca o primeiro controle do modal ao abrir (navegação por teclado/leitor).
function focarModalPdv(caixaId) {
  const caixa = $(caixaId);
  if (!caixa) return;
  const alvo = caixa.querySelector("input:not([type=hidden]), select, textarea, button");
  if (alvo) { try { alvo.focus(); } catch (_) {} }
}

function abrirPdvPagar() {
  if (!pdvCart.length) return;
  pdvPagamentos = [];
  pdvFormaSel = pdvFormasPg[0] || "Dinheiro";
  pdvDescTipoSel = (pdvDesconto && pdvDesconto.tipo) || "valor";
  pdvTipoEntrega = "Balcão";
  pdvEntrega = null;
  renderPdvPagar();
  $("pdvPagarOverlay").hidden = false;
  focarModalPdv("pdvPagarCaixa");
}
function fecharPdvPagar() { $("pdvPagarOverlay").hidden = true; }
function pdvPagoTotal() { return Math.round(pdvPagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0) * 100) / 100; }

function renderPdvPagar() {
  const total = pdvTotalCobrar();
  // Só Balcão recebe na hora (paga no caixa). Entrega/Retirada vão para Pedidos como
  // "a receber" — sem bloco de pagamento; o recebimento é feito depois.
  const ehBalcao = pdvTipoEntrega === "Balcão";
  const tiles = pdvFormasPg.map((f) =>
    '<button type="button" class="pdv-forma' + (f === pdvFormaSel ? " ativo" : "") + '" data-forma="' + pdvEsc(f) + '">' + pdvIconeForma(f) + "<span>" + pdvEsc(f) + "</span></button>"
  ).join("");
  const itensHtml = pdvCart.map((l) => {
    const q = l.unidade === "kg" ? window.Estoque.formatarQtd(l.qtd, "kg") + " kg" : l.qtd + "x";
    const det = (l.variacoes || []).map((v) => (v.qtd > 1 ? v.qtd + "x " : "") + v.nome).join(", ");
    return '<div class="pdv-resumo-item"><span>' + q + " " + pdvEsc(l.nome) + (det ? ' <small>(' + pdvEsc(det) + ")</small>" : "") + "</span><span>" + pdvMoney(pdvPrecoLinha(l)) + "</span></div>";
  }).join("");
  const html =
    '<button class="pdv-modal-x" type="button" data-pdv-close="pagar" aria-label="Fechar"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
    '<div class="pdv-pg-grid">' +
      '<div class="pdv-pg-main">' +
        '<h3 class="pdv-modal-titulo">Finalizar venda</h3>' +
        '<div class="pdv-tve-bloco">' +
          '<span class="pdv-ops-tit">Tipo de venda</span>' +
          '<div class="pdv-tve">' +
            ["Balcão", "Entrega", "Retirada"].map((t) =>
              '<button type="button" class="' + (pdvTipoEntrega === t ? "ativo" : "") + '" data-tve="' + t + '">' + t + "</button>"
            ).join("") +
          "</div>" +
          (pdvTipoEntrega === "Entrega"
            ? '<div class="pdv-entrega-resumo" id="pdvEntregaResumo"></div>'
            : pdvTipoEntrega === "Retirada"
            ? '<label class="pdv-campo pdv-tve-tel"><span>Telefone (opcional)</span><input id="pdvRetiradaTel" type="text" inputmode="numeric" placeholder="(00) 00000-0000" value="' + pdvEsc((pdvEntrega && pdvEntrega.telefone) || "") + '" /></label>'
            : "") +
        "</div>" +
        (ehBalcao
          ? '<span class="pdv-ops-tit">Forma de pagamento</span>' +
            '<div class="pdv-formas">' + tiles + "</div>" +
            '<div class="pdv-pg-add-row"><div class="campo-prefixo pdv-pg-campo"><span class="campo-prefixo-moeda">R$</span><input id="pdvPgValor" type="text" inputmode="numeric" placeholder="0,00" /></div><button type="button" class="pdv-pg-addbtn" id="pdvPgAdd">Adicionar</button><button type="button" class="pdv-desc-acao' + (pdvDesconto ? " ativo" : "") + '" id="pdvDescBtn">Desconto</button></div>' +
            '<div class="pdv-pg-lista" id="pdvPgLista"></div>'
          : '<div class="pdv-areceber-nota"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><span>Sem cobrança agora: o pedido vai para a aba <strong>Pedidos</strong> como <strong>a receber</strong>. O recebimento é feito depois.</span></div>') +
      "</div>" +
      '<aside class="pdv-pg-resumo-box">' +
        '<span class="pdv-ops-tit">Resumo do pedido</span>' +
        '<div class="pdv-resumo-itens">' + itensHtml + "</div>" +
        '<div class="pdv-resumo-linha" id="pdvResSubLinha" hidden><span>Subtotal</span><span id="pdvResSub"></span></div>' +
        '<div class="pdv-resumo-linha pdv-resumo-desc" id="pdvResDescLinha" hidden><span>Desconto</span><span id="pdvResDesc"></span></div>' +
        '<div class="pdv-resumo-linha pdv-resumo-frete" id="pdvResFreteLinha" hidden><span>Frete</span><span class="pdv-frete-val"><span id="pdvResFrete"></span><button type="button" class="pdv-frete-zerar" id="pdvFreteZerar" title="Não cobrar frete (cortesia)" aria-label="Não cobrar frete"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button></span></div>' +
        '<div class="pdv-resumo-tot"><span>Total</span><strong id="pdvPgTotal">' + pdvMoney(total) + "</strong></div>" +
        (ehBalcao
          ? '<div class="pdv-resumo-linha"><span>Pago</span><span id="pdvPgPago">R$ 0,00</span></div>' +
            '<div class="pdv-resumo-linha"><span>Falta</span><span id="pdvPgFalta" class="falta">' + pdvMoney(total) + "</span></div>" +
            '<div class="pdv-resumo-linha"><span>Troco</span><span id="pdvPgTroco" class="troco">R$ 0,00</span></div>' +
            '<label class="pdv-campo pdv-cpf"><span>CPF na nota (opcional)</span><input id="pdvCpf" type="text" inputmode="numeric" placeholder="000.000.000-00" /></label>'
          : "") +
      "</aside>" +
    "</div>" +
    '<div class="pdv-pg-acoes">' +
      '<button type="button" class="secundario" id="pdvVoltar">Voltar</button>' +
      '<button type="button" class="pdv-pg-confirmar" id="pdvFinalizar" disabled>' + (ehBalcao ? "Confirmar pagamento" : "Enviar para Pedidos") + "</button>" +
    "</div>";
  $("pdvPagarCaixa").innerHTML = html;

  // Tipo de venda: Balcão / Entrega / Retirada (re-renderiza p/ mostrar o bloco certo).
  $("pdvPagarCaixa").querySelectorAll("[data-tve]").forEach((b) => b.addEventListener("click", () => {
    if (pdvTipoEntrega === b.dataset.tve) return;
    pdvTipoEntrega = b.dataset.tve;
    renderPdvPagar();
  }));
  if (pdvTipoEntrega === "Entrega") {
    pdvRenderEntregaResumo();
    const eb = $("pdvEntregaBtn"); if (eb) eb.addEventListener("click", abrirPdvEntrega);
  }
  if (pdvTipoEntrega === "Retirada") {
    const rt = $("pdvRetiradaTel");
    if (rt) rt.addEventListener("input", () => { pdvEntrega = pdvEntrega || {}; pdvEntrega.telefone = rt.value; });
  }
  const fz = $("pdvFreteZerar");
  if (fz) fz.addEventListener("click", () => {
    if (pdvEntrega) pdvEntrega.taxaEntrega = 0;
    pdvSyncResumo(); pdvPagarRecalc();
    Dinheiro.setValor($("pdvPgValor"), Math.max(0, Math.round((pdvTotalCobrar() - pdvPagoTotal()) * 100) / 100));
    toast("Frete zerado (cortesia).");
  });

  $("pdvPagarCaixa").querySelectorAll("[data-forma]").forEach((b) => b.addEventListener("click", () => {
    pdvFormaSel = b.dataset.forma;
    $("pdvPagarCaixa").querySelectorAll("[data-forma]").forEach((x) => x.classList.toggle("ativo", x === b));
    const inp = $("pdvPgValor"); if (inp) inp.focus();
  }));
  // Desconto: botão ao lado do recebimento → abre o modal de desconto.
  if ($("pdvDescBtn")) $("pdvDescBtn").addEventListener("click", abrirPdvDescModal);

  if (ehBalcao) {
    const valInp = $("pdvPgValor");
    Dinheiro.mascarar(valInp);
    Dinheiro.setValor(valInp, Math.max(0, Math.round((total - pdvPagoTotal()) * 100) / 100));
    $("pdvPgAdd").addEventListener("click", pdvAddPagamento);
    valInp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); pdvAddPagamento(); } });
    pdvSelecionarAoFocar(valInp);
  }
  $("pdvVoltar").addEventListener("click", fecharPdvPagar);
  $("pdvFinalizar").addEventListener("click", finalizarVendaPdv);
  const xb = $("pdvPagarCaixa").querySelector('[data-pdv-close="pagar"]'); if (xb) xb.addEventListener("click", fecharPdvPagar);
  pdvSyncResumo();
  if (ehBalcao) renderPdvPgLista(); else pdvPagarRecalc(); // recalc liga/desliga o botão Enviar
}

// Atualiza as linhas Subtotal/Desconto/Frete do RESUMO. Subtotal aparece quando há
// desconto OU frete (p/ o cliente ver a composição do total).
function pdvSyncResumo() {
  const sub = pdvTotal();
  const { desconto } = pdvDescontoCalc(sub);
  const frete = pdvFreteValor();
  const temDesc = pdvDesconto && desconto > 0;
  const temFrete = frete > 0;
  const sl = $("pdvResSubLinha"), dl = $("pdvResDescLinha"), fl = $("pdvResFreteLinha");
  if (sl) { sl.hidden = !(temDesc || temFrete); $("pdvResSub").textContent = pdvMoney(sub); }
  if (dl) { dl.hidden = !temDesc; if (temDesc) $("pdvResDesc").textContent = "− " + pdvMoney(desconto); }
  if (fl) { fl.hidden = !temFrete; if (temFrete) $("pdvResFrete").textContent = "+ " + pdvMoney(frete); }
}

// Resumo do endereço de entrega no bloco "Tipo de venda" (botão adicionar/editar).
function pdvRenderEntregaResumo() {
  const box = $("pdvEntregaResumo");
  if (!box) return;
  if (pdvEntrega && pdvEntrega.endereco) {
    const contato = [pdvEntrega.nome, pdvEntrega.telefone].filter(Boolean).join(" · ");
    box.innerHTML =
      (contato ? '<div class="pdv-entrega-contato">' + pdvEsc(contato) + "</div>" : "") +
      '<div class="pdv-entrega-end"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>' + pdvEsc(pdvEntrega.endereco) + "</span></div>" +
      '<button type="button" class="pdv-entrega-btn" id="pdvEntregaBtn">Editar endereço</button>';
  } else {
    box.innerHTML =
      '<p class="pdv-entrega-vazio">Informe o endereço de entrega para calcular o frete.</p>' +
      '<button type="button" class="pdv-entrega-btn" id="pdvEntregaBtn">Adicionar endereço</button>';
  }
}

// ---- Desconto (modal aberto pelo botão ao lado do recebimento) ----
function abrirPdvDescModal() {
  pdvDescTipoSel = (pdvDesconto && pdvDesconto.tipo) || "valor";
  renderPdvDescModal();
  $("pdvDescOverlay").hidden = false;
  focarModalPdv("pdvDescCaixa");
}
function fecharPdvDescModal() { $("pdvDescOverlay").hidden = true; }

function renderPdvDescModal() {
  const pref = pdvDescTipoSel === "pct" ? "%" : "R$";
  const html =
    '<button class="pdv-modal-x" type="button" data-pdv-close="desc" aria-label="Fechar"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
    '<h3 class="pdv-modal-titulo">Desconto na venda</h3>' +
    '<div class="pdv-desc-linha">' +
      '<div class="pdv-desc-tipo">' +
        '<button type="button" class="' + (pdvDescTipoSel === "valor" ? "ativo" : "") + '" data-dt="valor">R$</button>' +
        '<button type="button" class="' + (pdvDescTipoSel === "pct" ? "ativo" : "") + '" data-dt="pct">%</button>' +
      "</div>" +
      '<div class="campo-prefixo pdv-desc-campo"><span class="campo-prefixo-moeda" id="pdvDescPrefixo">' + pref + '</span><input id="pdvDescInput" type="text" inputmode="numeric" placeholder="0,00" /></div>' +
    "</div>" +
    '<div class="pdv-pg-acoes">' +
      (pdvDesconto ? '<button type="button" class="secundario" id="pdvDescRemover">Remover</button>' : "") +
      '<button type="button" class="pdv-pg-confirmar" id="pdvDescAplicar">Aplicar</button>' +
    "</div>";
  $("pdvDescCaixa").innerHTML = html;
  const inp = $("pdvDescInput");
  if (pdvDescTipoSel === "valor") {
    Dinheiro.mascarar(inp);
    if (pdvDesconto && pdvDesconto.tipo === "valor") Dinheiro.setValor(inp, pdvDesconto.valor);
  } else if (pdvDesconto && pdvDesconto.tipo === "pct") {
    inp.value = String(pdvDesconto.valor).replace(".", ",");
  }
  pdvSelecionarAoFocar(inp);
  $("pdvDescCaixa").querySelectorAll("[data-dt]").forEach((b) => b.addEventListener("click", () => {
    if (pdvDescTipoSel === b.dataset.dt) return;
    pdvDescTipoSel = b.dataset.dt;
    renderPdvDescModal(); // re-renderiza: troca o nó do input e zera a máscara antiga (sem vazar listener)
    $("pdvDescInput").focus();
  }));
  $("pdvDescAplicar").addEventListener("click", pdvAplicarDesconto);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); pdvAplicarDesconto(); } });
  if ($("pdvDescRemover")) $("pdvDescRemover").addEventListener("click", () => { pdvDesconto = null; pdvAposDesconto(); fecharPdvDescModal(); toast("Desconto removido."); });
  const xb = $("pdvDescCaixa").querySelector('[data-pdv-close="desc"]'); if (xb) xb.addEventListener("click", fecharPdvDescModal);
}

function pdvAplicarDesconto() {
  const inp = $("pdvDescInput");
  const valor = pdvDescTipoSel === "valor"
    ? Dinheiro.valor(inp)
    : (parseFloat(String(inp.value || "").replace(",", ".")) || 0);
  pdvDesconto = valor > 0 ? { tipo: pdvDescTipoSel, valor } : null;
  pdvAposDesconto();
  fecharPdvDescModal();
  toast(pdvDesconto ? "Desconto aplicado." : "Desconto removido.");
}

// Refresca tudo após mudar o desconto (RESUMO, total a cobrar, campo de
// recebimento, estado do botão Desconto e rodapé do carrinho).
function pdvAposDesconto() {
  pdvSyncResumo();
  pdvPagarRecalc();
  const rest = Math.max(0, Math.round((pdvTotalCobrar() - pdvPagoTotal()) * 100) / 100);
  if ($("pdvPgValor")) Dinheiro.setValor($("pdvPgValor"), rest);
  const db = $("pdvDescBtn"); if (db) db.classList.toggle("ativo", !!pdvDesconto);
  renderPdvCarrinho();
}

// ---- Entrega (overlay com endereço + cálculo de frete) ----
function abrirPdvEntrega() {
  const ec = (pdvEntrega && pdvEntrega.enderecoCampos) || {};
  const v = (x) => pdvEsc(ec[x] || "");
  const html =
    '<button class="pdv-modal-x" type="button" data-pdv-close="entrega" aria-label="Fechar"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
    '<h3 class="pdv-modal-titulo">Endereço de entrega</h3>' +
    '<div class="pdv-ent-grid">' +
      '<label class="pdv-campo pdv-ent-nome"><span>Nome do cliente</span><input id="pdvEntNome" type="text" placeholder="Nome" value="' + pdvEsc((pdvEntrega && pdvEntrega.nome) || ($("pdvCliente") ? $("pdvCliente").value : "")) + '" /></label>' +
      '<label class="pdv-campo pdv-ent-tel"><span>Telefone</span><input id="pdvEntTelefone" type="text" inputmode="numeric" placeholder="(00) 00000-0000" value="' + pdvEsc((pdvEntrega && pdvEntrega.telefone) || "") + '" /></label>' +
      '<label class="pdv-campo pdv-ent-cep"><span>CEP</span><input id="pdvEntCep" type="text" inputmode="numeric" placeholder="00000-000" value="' + v("cep") + '" /></label>' +
      '<label class="pdv-campo pdv-ent-logr"><span>Rua</span><input id="pdvEntLogradouro" type="text" placeholder="Logradouro" value="' + v("logradouro") + '" /></label>' +
      '<label class="pdv-campo pdv-ent-num"><span>Número</span><input id="pdvEntNumero" type="text" inputmode="numeric" placeholder="Nº" value="' + v("numero") + '" /></label>' +
      '<label class="pdv-campo pdv-ent-bairro"><span>Bairro</span><input id="pdvEntBairro" type="text" placeholder="Bairro" value="' + v("bairro") + '" /></label>' +
      '<label class="pdv-campo pdv-ent-compl"><span>Complemento</span><input id="pdvEntComplemento" type="text" placeholder="Apto, bloco… (opcional)" value="' + v("complemento") + '" /></label>' +
      '<label class="pdv-campo pdv-ent-cidade"><span>Cidade</span><input id="pdvEntCidade" type="text" placeholder="Cidade" value="' + v("cidade") + '" /></label>' +
      '<label class="pdv-campo pdv-ent-uf"><span>UF</span><input id="pdvEntUf" type="text" maxlength="2" placeholder="UF" value="' + v("uf") + '" /></label>' +
    "</div>" +
    '<div class="pdv-pg-acoes">' +
      '<button type="button" class="secundario" data-pdv-close="entrega">Cancelar</button>' +
      '<button type="button" class="pdv-pg-confirmar" id="pdvEntConfirmar">Confirmar endereço</button>' +
    "</div>";
  $("pdvEntregaCaixa").innerHTML = html;
  if (window.EnderecoCep) {
    window.EnderecoCep.ligarBuscaCep({ cep: "pdvEntCep", logradouro: "pdvEntLogradouro", numero: "pdvEntNumero", bairro: "pdvEntBairro", cidade: "pdvEntCidade", uf: "pdvEntUf" });
  }
  $("pdvEntConfirmar").addEventListener("click", pdvConfirmarEntrega);
  $("pdvEntregaCaixa").querySelectorAll('[data-pdv-close="entrega"]').forEach((b) => b.addEventListener("click", fecharPdvEntrega));
  $("pdvEntregaOverlay").hidden = false;
  focarModalPdv("pdvEntregaCaixa");
}
function fecharPdvEntrega() { $("pdvEntregaOverlay").hidden = true; }

async function pdvConfirmarEntrega() {
  const g = (id) => ($(id) ? $(id).value.trim() : "");
  const campos = {
    cep: g("pdvEntCep").replace(/\D/g, "").slice(0, 8),
    logradouro: g("pdvEntLogradouro"), numero: g("pdvEntNumero"),
    complemento: g("pdvEntComplemento"), bairro: g("pdvEntBairro"),
    cidade: g("pdvEntCidade"), uf: g("pdvEntUf").toUpperCase().slice(0, 2),
  };
  const nome = g("pdvEntNome");
  const telefone = g("pdvEntTelefone");
  if (!campos.logradouro || !campos.numero) { toast("Informe a rua e o número.", "erro"); return; }
  const btn = $("pdvEntConfirmar"); btn.disabled = true; btn.textContent = "Calculando…";
  const r = await api("POST", "/api/pdv/frete", { cep: campos.cep, numero: campos.numero });
  btn.disabled = false; btn.textContent = "Confirmar endereço";
  if (!r) return;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { toast(d.erro || "Falha ao calcular o frete.", "erro"); return; }
  if (d.incompleto) { toast("Para o frete por raio, informe CEP e número.", "erro"); return; }
  // Fora da área: não prossegue com frete grátis em silêncio — o operador decide
  // (Retirada/Balcão ou corrigir o endereço). Mantém o overlay aberto.
  if (d.foraDaArea) { toast("Endereço fora da área de entrega. Use Retirada/Balcão ou ajuste o endereço.", "erro"); return; }
  let taxa = Number(d.valor_frete) || 0;
  const endereco = window.EnderecoCep ? window.EnderecoCep.comporEndereco(campos) : (campos.logradouro + ", " + campos.numero);
  pdvEntrega = { endereco, enderecoCampos: campos, nome, telefone, taxaEntrega: taxa };
  // Espelha o nome no campo Cliente da venda (consistência no cabeçalho/pedido).
  if (nome && $("pdvCliente")) $("pdvCliente").value = nome;
  fecharPdvEntrega();
  renderPdvPagar();
}

function pdvAddPagamento() {
  let v = Dinheiro.valor($("pdvPgValor"));
  if (!(v > 0)) { toast("Informe o valor.", "erro"); return; }
  if (!pdvFormaSel) { toast("Escolha a forma de pagamento.", "erro"); return; }
  const total = pdvTotalCobrar();
  const restante = Math.round((total - pdvPagoTotal()) * 100) / 100;
  // Só DINHEIRO pode exceder (gera troco); as demais formas limitam ao restante.
  if (!pdvEhDinheiro(pdvFormaSel)) {
    if (restante <= 0) { toast("Pagamento já fechado.", "erro"); return; }
    v = Math.min(v, restante);
  }
  pdvPagamentos.push({ forma: pdvFormaSel, valor: v });
  renderPdvPgLista();
  const novoRest = Math.max(0, Math.round((total - pdvPagoTotal()) * 100) / 100);
  Dinheiro.setValor($("pdvPgValor"), novoRest);
}

function renderPdvPgLista() {
  const box = $("pdvPgLista");
  box.innerHTML = pdvPagamentos.map((p, i) =>
    '<div class="pdv-pg-item">' + pdvIconeForma(p.forma) + "<span>" + pdvEsc(p.forma) + "</span><strong>" + pdvMoney(p.valor) + '</strong><button type="button" data-rmpg="' + i + '" aria-label="Remover">×</button></div>'
  ).join("");
  box.querySelectorAll("[data-rmpg]").forEach((b) => b.addEventListener("click", () => { pdvPagamentos.splice(Number(b.dataset.rmpg), 1); renderPdvPgLista(); }));
  pdvPagarRecalc();
}

function pdvPagarRecalc() {
  const total = pdvTotalCobrar();
  const pago = pdvPagoTotal();
  const falta = Math.max(0, Math.round((total - pago) * 100) / 100);
  const troco = Math.max(0, Math.round((pago - total) * 100) / 100);
  if ($("pdvPgTotal")) $("pdvPgTotal").textContent = pdvMoney(total);
  if ($("pdvPgPago")) $("pdvPgPago").textContent = pdvMoney(pago);
  if ($("pdvPgFalta")) $("pdvPgFalta").textContent = pdvMoney(falta);
  if ($("pdvPgTroco")) $("pdvPgTroco").textContent = pdvMoney(troco);
  // Entrega exige endereço definido antes de fechar a venda.
  const entregaOk = pdvTipoEntrega !== "Entrega" || !!(pdvEntrega && pdvEntrega.endereco);
  // Balcão: precisa quitar (falta 0 + ao menos 1 pagamento). Entrega/Retirada: sem
  // pagamento — basta o endereço (Entrega) / sempre ok (Retirada).
  const pode = pdvTipoEntrega === "Balcão"
    ? (falta <= 0.001 && pdvPagamentos.length && entregaOk)
    : entregaOk;
  if ($("pdvFinalizar")) $("pdvFinalizar").disabled = !pode;
}

async function finalizarVendaPdv() {
  const ehBalcao = pdvTipoEntrega === "Balcão";
  const total = pdvTotalCobrar();
  // Só Balcão registra pagamento agora. Entrega/Retirada vão "a receber" (sem pagamento).
  let registrados = [];
  let observacao = "";
  if (ehBalcao) {
    // Pagamentos REGISTRADOS (somam o total): não-dinheiro como lançado; o dinheiro
    // registra só a parte da venda — o troco não é receita do caixa.
    const naoDin = pdvPagamentos.filter((p) => !pdvEhDinheiro(p.forma));
    const somaNaoDin = Math.round(naoDin.reduce((s, p) => s + p.valor, 0) * 100) / 100;
    const dinNaVenda = Math.max(0, Math.round((total - somaNaoDin) * 100) / 100);
    registrados = naoDin.map((p) => ({ forma: p.forma, valor: p.valor }));
    if (dinNaVenda > 0) {
      const formaDin = (pdvPagamentos.find((p) => pdvEhDinheiro(p.forma)) || {}).forma || "Dinheiro";
      registrados.push({ forma: formaDin, valor: dinNaVenda });
    }
    const cpf = (($("pdvCpf") || {}).value || "").replace(/\D/g, "");
    observacao = cpf ? ("CPF na nota: " + cpf) : "";
  }
  // Telefone: Entrega vem do overlay; Retirada do campo do bloco.
  const telefone = pdvTipoEntrega === "Retirada" && $("pdvRetiradaTel")
    ? $("pdvRetiradaTel").value
    : (pdvEntrega && pdvEntrega.telefone) || "";
  const body = {
    cliente: ($("pdvCliente").value || "").trim(),
    itens: pdvCart.map((l) => ({ id: l.id, qtd: l.qtd, composicao: (l.composicao || []), opcionais: (l.opcionais || []).map((o) => ({ nome: o.nome, qtd: o.qtd })), variacoes: (l.variacoes || []).map((v) => ({ id: v.id, qtd: v.qtd })), observacao: l.observacao })),
    desconto: pdvDesconto,
    pagamentos: registrados,
    observacao,
    tipoEntrega: pdvTipoEntrega,
    endereco: pdvTipoEntrega === "Entrega" && pdvEntrega ? pdvEntrega.endereco : "",
    enderecoCampos: pdvTipoEntrega === "Entrega" && pdvEntrega ? pdvEntrega.enderecoCampos : null,
    telefone,
    taxaEntrega: pdvFreteValor(),
  };
  const btn = $("pdvFinalizar");
  const rotulo = ehBalcao ? "Confirmar pagamento" : "Enviar para Pedidos";
  btn.disabled = true; btn.textContent = ehBalcao ? "Registrando…" : "Enviando…";
  const r = await api("POST", "/api/pdv/vender", body);
  btn.textContent = rotulo;
  if (!r) return;
  if (!r.ok) { const d = await r.json().catch(() => ({})); toast(d.erro || "Falha ao registrar a venda.", "erro"); btn.disabled = false; return; }
  // Sem supressão client-side: o servidor já escopa o alerta de "novo pedido" só ao
  // cardápio web (origem='web'), então venda de PDV (qualquer tipo) nunca abre o modal.
  toast(ehBalcao ? "✓ Venda registrada — disponível em Pedidos." : "✓ Pedido enviado — a receber em Pedidos.");
  // Impressão (cupom/cozinha conforme o tipo) é enfileirada no servidor e sai pelo agente.
  pdvCart = []; pdvDesconto = null; pdvPagamentos = []; pdvTipoEntrega = "Balcão"; pdvEntrega = null; $("pdvCliente").value = "";
  fecharPdvPagar();
  $("pdvCarrinho").classList.remove("aberto");
  const rc = await api("GET", "/api/cardapio"); if (rc && rc.ok) cardapioAtual = await rc.json();
  renderPdvProdutos();
  renderPdvCarrinho();
}

// ---- Wiring do PDV ----
if ($("btnVerPlanosPdv")) $("btnVerPlanosPdv").addEventListener("click", () => abrirUpsell("pdv"));
if ($("btnPdvIrCaixa")) $("btnPdvIrCaixa").addEventListener("click", () => { const b = document.querySelector("nav button[data-aba='caixa']"); if (b) b.click(); });
if ($("btnPdvVencidoCaixa")) $("btnPdvVencidoCaixa").addEventListener("click", () => { const b = document.querySelector("nav button[data-aba='caixa']"); if (b) b.click(); });
if ($("pdvBusca")) $("pdvBusca").addEventListener("input", (e) => { pdvBuscaTermo = e.target.value || ""; renderPdvProdutos(); });
if ($("pdvCobrar")) $("pdvCobrar").addEventListener("click", function () { if (mesaModoId) mesaLancarDoPdv(); else abrirPdvPagar(); });
if ($("pdvCancelar")) $("pdvCancelar").addEventListener("click", async () => {
  if (pdvCart.length) {
    const ok = await confirmar("Cancelar venda?", "Isso esvazia o carrinho atual. Esta ação não pode ser desfeita.", "Cancelar venda");
    if (!ok) return;
  }
  pdvCart = []; pdvDesconto = null; renderPdvCarrinho();
});
if ($("pdvFab")) $("pdvFab").addEventListener("click", () => { $("pdvCarrinho").classList.add("aberto"); $("pdvFab").classList.add("oculto"); });
if ($("pdvCartFechar")) $("pdvCartFechar").addEventListener("click", () => { $("pdvCarrinho").classList.remove("aberto"); $("pdvFab").classList.remove("oculto"); });
document.querySelectorAll("[data-pdv-close]").forEach((el) => el.addEventListener("click", (e) => {
  if (e.target !== el) return;
  if (el.dataset.pdvClose === "item") fecharPdvItemModal();
  if (el.dataset.pdvClose === "pagar") fecharPdvPagar();
  if (el.dataset.pdvClose === "entrega") fecharPdvEntrega();
  if (el.dataset.pdvClose === "desc") fecharPdvDescModal();
}));
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("pdvItemOverlay").hidden) fecharPdvItemModal();
  else if (!$("pdvEntregaOverlay").hidden) fecharPdvEntrega();
  else if (!$("pdvDescOverlay").hidden) fecharPdvDescModal();
  else if (!$("pdvPagarOverlay").hidden) fecharPdvPagar();
});

$("btnAtualizarPedidos").addEventListener("click", carregarPedidos);
$("btnExportarPedidos").addEventListener("click", exportarPedidosCSV);

// Auto-refresh de pedidos enquanto a aba estiver ativa
setInterval(() => {
  if ($("aba-pedidos").classList.contains("ativa")) carregarPedidos();
}, 15000);

// ============================================================
// Utilidades + carga inicial
// ============================================================
function escapar(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
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

// Rótulo amigável da etapa do bot (o fluxo só tem MENU/ATENDENTE).
function simRotuloEtapa(estado) {
  if (estado === "ATENDENTE") return "Atendente";
  if (estado === "MENU" || estado === "INICIO") return "Menu";
  return estado || "—";
}

function simAtualizarEstado(estado) {
  const etapa = $("simCtxEtapa");
  if (etapa) etapa.textContent = simRotuloEtapa(estado);
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
    simAtualizarEstado(data.estado);
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
  simAdicionarSeparador("Conversa reiniciada");
  simAtualizarEstado("INICIO");
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

// ============================================================
// LINK + QR DO CARDÁPIO DIGITAL (aba Cardápio)
// ============================================================
let _linkCardapio = ""; // URL pública do cardápio; preenchida por carregarLinkCardapio()
let _qrCardapio = "";   // data URL (PNG) do QR Code

async function carregarLinkCardapio() {
  const elUrl = $("cardapioLinkUrl");
  try {
    const r = await api("GET", "/api/cardapio/link");
    if (!r || !r.ok) throw new Error("falha");
    const d = await r.json();
    _linkCardapio = d.url || "";
    _qrCardapio = d.qr || "";
    if (elUrl) elUrl.textContent = _linkCardapio || "—";
  } catch (e) {
    if (elUrl) elUrl.textContent = "Não foi possível carregar o link.";
  }
}

// Copiar link (Clipboard API com fallback p/ contexto não seguro).
$("btnCopiarLink").addEventListener("click", async () => {
  if (!_linkCardapio) return;
  try {
    await navigator.clipboard.writeText(_linkCardapio);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = _linkCardapio;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) { /* ignora */ }
    document.body.removeChild(ta);
  }
  const txt = $("btnCopiarLinkTxt");
  if (txt) {
    txt.textContent = "Copiado!";
    setTimeout(() => { txt.textContent = "Copiar link"; }, 1600);
  }
  toast("Link copiado!");
});

// Modal do QR Code.
function abrirQr() {
  if (!_qrCardapio) { toast("QR ainda carregando, tente de novo.", "erro"); return; }
  $("qr-img").src = _qrCardapio;
  $("qr-url").textContent = _linkCardapio;
  const slug = (_linkCardapio.split("/c/")[1] || "cardapio").replace(/[^\w-]/g, "");
  const baixar = $("qr-baixar");
  baixar.href = _qrCardapio;
  baixar.download = "cardapio-" + slug + ".png";
  $("qr-overlay").style.display = "flex";
}
function fecharQr() { $("qr-overlay").style.display = "none"; }

$("btnVerQr").addEventListener("click", abrirQr);
$("qr-fechar").addEventListener("click", fecharQr);
$("qr-fechar-rodape").addEventListener("click", fecharQr);
$("qr-overlay").addEventListener("click", (e) => { if (e.target === $("qr-overlay")) fecharQr(); });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("qr-overlay").style.display === "flex") fecharQr();
});

// Versão mais recente do agente publicada no GitHub (via proxy do servidor) — exibe
// ao lado do botão de download em Configurações → Impressora.
async function carregarVersaoAgente() {
  const el = $("agente-versao");
  if (!el) return;
  try {
    const r = await fetch("/api/agente/versao-publicada");
    const d = r.ok ? await r.json() : null;
    el.textContent = d && d.versao ? "Versão mais recente: " + d.versao : "";
  } catch (_) { el.textContent = ""; }
}

async function inicial() {
  setTimeout(checarPedidoNovo, 3000);   // base do poll de notificação (logo após o boot)
  carregarVersaoAgente();               // versão do agente publicada (aba Configurações → Impressora)
  setInterval(checarPedidoNovo, 6000);  // poll a cada 6s — pedido novo aparece em ~6s (era 15s)

  // Restaura a última aba visitada: a troca VISUAL já ocorreu no boot (evita piscar o
  // Dashboard); aqui, com a sessão pronta, disparamos o carregador da aba certa primeiro.
  let ultimaAba = null;
  try { ultimaAba = localStorage.getItem("ultimaAba"); } catch (_) {}
  if (ultimaAba && ultimaAba !== "dashboard") {
    const btnUltimaAba = document.querySelector("nav button[data-aba='" + ultimaAba + "']");
    if (btnUltimaAba) btnUltimaAba.click();
  }

  carregarDashboard(); // carrega dados do dashboard em background (sempre)
  carregarPedidos();   // pré-carrega pedidos em background
  atualizarStatus();   // mantém status/badge atualizados
  const rc = await api("GET", "/api/cardapio");
  if (rc) { cardapioAtual = await rc.json(); renderCardapio(); }
  carregarLinkCardapio();   // link público + QR (aba Cardápio)
  await carregarConfig();
  await carregarConta();        // e-mail de acesso (aba Empresa)
  await carregarAssinatura();   // aplica o gate de billing

  // Volta do Stripe Checkout: avisa e, se o webhook ainda não chegou, re-tenta
  // algumas vezes até a assinatura virar ativa (evita gate piscando após pagar).
  const params = new URLSearchParams(location.search);
  const ret = params.get("assinatura");
  if (ret === "ok") {
    for (let i = 0; i < 5 && assinaturaAtual && !assinaturaAtual.acessoLiberado; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      await carregarAssinatura();
    }
    toast("Assinatura iniciada! Aproveite seu teste grátis.");
    history.replaceState(null, "", location.pathname);
  } else if (ret === "cancelado") {
    toast("Pagamento não concluído. Você pode tentar de novo quando quiser.", "erro");
    history.replaceState(null, "", location.pathname);
  }
}
// ============================================================
// MESAS / COMANDAS
// ============================================================
var mesaState = {
  lista: [],
  selecionadaId: null,
  detalhe: null,
  mostrarInfo: false,
  tamanho: 110,
  cart: [],
  modo: "itens",
  cfgPendentes: [],
  alertaParadaMin: 30, // minutos sem novo pedido p/ marcar "mesa parada" (0 = off)
};
var mesasPdvCatAtual = "";
var mesasInitDone = false;
var mesaPagarModo = "fechar";
var mesaModoId = null;
var mesaModoNome = "";

async function carregarMesas() {
  mesasInitListeners();
  $("mesasLock").hidden = true;
  $("mesasSemCaixa").hidden = true;
  $("mesasVencido").hidden = true;
  $("mesasConteudo").hidden = true;

  try {
    // Gate: Plano Completo via GET /api/caixa (retorna 403 se não Completo)
    const rCaixa = await api("GET", "/api/caixa");
    if (!rCaixa || rCaixa.status === 403) { $("mesasLock").hidden = false; return; }
    const caixaData = rCaixa.ok ? await rCaixa.json() : {};
    if (!caixaData.caixa) { $("mesasSemCaixa").hidden = false; return; }
    if (caixaData.caixa.vencido) { $("mesasVencido").hidden = false; return; }

    const rMesas = await api("GET", "/api/mesas");
    if (!rMesas || rMesas.status === 403) { $("mesasLock").hidden = false; return; }
    if (!rMesas.ok) { toast("Erro ao carregar mesas.", "erro"); $("mesasSemCaixa").hidden = false; return; }
    const mesasData = await rMesas.json();
    mesaState.lista = mesasData.mesas || [];
    if (mesasData.alertaParadaMin != null) mesaState.alertaParadaMin = mesasData.alertaParadaMin;
    $("mesasConteudo").hidden = false;
    renderMesasGrade();
  } catch (e) {
    toast("Erro ao conectar. Tente recarregar a página.", "erro");
    $("mesasSemCaixa").hidden = false;
  }
}

function renderMesasGrade() {
  const grade = $("mesasGrade");
  if (!grade) return;
  grade.style.setProperty("--mesa-sz", mesaState.tamanho + "px");
  const labelMap = { livre: "ABRIR", ocupada: "OCUPADA", pediu_conta: "CONTA", fechando: "FECHANDO" };
  grade.innerHTML = "";
  if (!mesaState.lista.length) {
    grade.innerHTML = '<p class="sub" style="text-align:center;padding:32px 0;grid-column:1/-1">Nenhuma mesa cadastrada. Clique em <strong>Configurar</strong> para adicionar.</p>';
    return;
  }
  mesaState.lista.forEach(function (m) {
    var btn = document.createElement("button");
    btn.type = "button";
    var parada = mesaParadaMin(m);
    btn.className = "mesa-card" + (m.status !== "livre" ? " s-" + m.status : "") + (parada != null ? " parada" : "") + (m.id === mesaState.selecionadaId ? " ativa" : "");
    btn.dataset.id = m.id;
    var infoHtml = "";
    if (mesaState.mostrarInfo && m.status !== "livre") {
      var tot = pdvMoney(m.totalConsumido || 0);
      var dur = m.abertaEm ? mesaDuracao(m.abertaEm) : "";
      infoHtml = '<span class="mesa-card-info">' + tot + (dur ? "<br>" + dur : "") + "</span>";
    }
    var alertaHtml = parada != null
      ? '<span class="mesa-card-alerta" title="Parada há ' + parada + ' min sem novo pedido"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>'
      : "";
    btn.innerHTML =
      alertaHtml +
      '<span class="mesa-card-status">' + (labelMap[m.status] || m.status.toUpperCase()) + "</span>" +
      '<span class="mesa-card-num">' + pdvEsc(m.nome) + "</span>" +
      infoHtml;
    btn.addEventListener("click", function () { mesaSelecionarCard(m.id); });
    grade.appendChild(btn);
  });
  renderMesasResumo();
}

// Minutos que a mesa está "parada" (ocupada, sem novo pedido além do limiar).
// Retorna null quando não está parada / alerta desligado (limiar 0). Só vale para
// mesa ocupada — pediu_conta/fechando já estão em outro fluxo.
function mesaParadaMin(m) {
  var lim = Number(mesaState.alertaParadaMin) || 0;
  if (lim <= 0 || !m || m.status !== "ocupada" || !m.ultimoPedidoEm) return null;
  var mins = Math.floor((Date.now() - new Date(m.ultimoPedidoEm).getTime()) / 60000);
  return mins >= lim ? mins : null;
}

// Barra de resumo/legenda acima da grade: contagem por status + total em aberto.
// Os pontos coloridos são a própria legenda das cores dos cards (fonte única).
function renderMesasResumo() {
  var box = $("mesasResumo");
  if (!box) return;
  var lista = mesaState.lista || [];
  if (!lista.length) { box.hidden = true; return; }
  var livres = 0, ocupadas = 0, conta = 0, paradas = 0, aberto = 0;
  lista.forEach(function (m) {
    if (m.status === "livre") livres++;
    else {
      aberto += Number(m.totalConsumido) || 0;
      if (m.status === "ocupada") ocupadas++;
      else conta++; // pediu_conta / fechando
      if (mesaParadaMin(m) != null) paradas++;
    }
  });
  var item = function (cls, n, rot) {
    return '<span class="mesa-resumo-item"><span class="mesa-resumo-dot ' + cls + '"></span><strong>' + n + "</strong> " + rot + "</span>";
  };
  box.innerHTML =
    item("d-livre", livres, livres === 1 ? "Livre" : "Livres") +
    item("d-ocupada", ocupadas, "Ocupada" + (ocupadas === 1 ? "" : "s")) +
    item("d-pediu_conta", conta, "Pediu conta") +
    (paradas > 0 ? item("d-parada", paradas, paradas === 1 ? "Parada" : "Paradas") : "") +
    '<span class="mesa-resumo-total">Em aberto: <strong>' + pdvMoney(aberto) + "</strong></span>";
  box.hidden = false;
}

function mesaDuracao(iso) {
  var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return mins + "min";
  var h = Math.floor(mins / 60), m2 = mins % 60;
  return h + "h" + (m2 ? String(m2).padStart(2, "0") : "");
}

function mesaFmtHora(iso) {
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  } catch (_) { return ""; }
}

async function mesaSelecionarCard(id) {
  mesaState.selecionadaId = id;
  renderMesasGrade();
  var r = await api("GET", "/api/mesas/" + id);
  if (!r.ok) { toast("Erro ao carregar mesa.", "erro"); return; }
  mesaState.detalhe = await r.json();
  mesaState.modo = "itens";
  mesaState.cart = [];
  abrirMesaPainel();
}

function abrirMesaPainel() {
  var d = mesaState.detalhe;
  if (!d) return;
  $("mesaPainelNome").textContent = "Mesa " + d.nome;
  $("mesaPainelSub").textContent = (d.status !== "livre" && d.abertaEm) ? "Aberta às " + mesaFmtHora(d.abertaEm) : "Livre";
  var badge = $("mesaPainelBadge");
  badge.className = "mesa-status-badge s-" + d.status;
  var badgeLabel = { livre: "LIVRE", ocupada: "OCUPADA", pediu_conta: "PEDIU CONTA", fechando: "FECHANDO" };
  badge.textContent = badgeLabel[d.status] || d.status.toUpperCase();
  $("mesasPainelOverlay").classList.add("visivel");
  $("mesasPainel").classList.add("aberto");
  mesaMudarAba(mesaState.modo || "itens");
  renderMesaAcoes();
  renderMesaTotais();
}

function fecharMesaPainel() {
  mesaState.selecionadaId = null;
  $("mesasPainel").classList.remove("aberto");
  $("mesasPainelOverlay").classList.remove("visivel");
  renderMesasGrade();
}

function mesaMudarAba(aba) {
  mesaState.modo = aba;
  document.querySelectorAll(".mesa-aba-btn").forEach(function (b) {
    b.classList.toggle("ativo", b.dataset.mesaAba === aba);
  });
  $("mesaAbaItens").hidden = aba !== "itens";
  $("mesaAbaLancar").hidden = true;
  if (aba === "itens") renderMesaItens();
  if (aba === "lancar") ativarMesaModoPdv();
}

function renderMesaItens() {
  var d = mesaState.detalhe;
  var lista = $("mesaItensLista");
  var peds = (d && d.pedidos || []).filter(function (p) { return p.status !== "cancelado"; });
  var todos = [];
  peds.forEach(function (p) {
    (p.itens || []).forEach(function (item, idx) {
      todos.push({ item: item, pedidoId: p.id, idx: idx });
    });
  });
  if (!todos.length) {
    lista.innerHTML = '<p class="sub" style="text-align:center;padding:32px 0">Nenhum item lançado ainda.</p>';
    return;
  }
  var canDel = d && d.status !== "fechando";
  var html = "";
  todos.forEach(function (entry) {
    var item = entry.item;
    // Preço da linha soma opcionais E variações (a variação carrega o preço; o pai fica com 0).
    var preco = pdvMoney(pdvPrecoLinha(item));
    var det = (item.variacoes || []).map(function (v) { return (v.qtd > 1 ? v.qtd + "x " : "") + (v.nome || ""); }).join(", ");
    var delBtn = canDel
      ? '<button class="mesa-item-del" data-pedido-id="' + entry.pedidoId + '" data-item-idx="' + entry.idx + '" data-nome-item="' + pdvEsc(item.nome || "") + '" title="Cancelar item" aria-label="Cancelar item">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
        '</button>'
      : '';
    html +=
      '<div class="mesa-rodada-item">' +
      '<span class="mesa-rodada-item-esq"><span class="mesa-rodada-item-qtd">' + (item.qtd || 1) + "x </span>" +
      '<span class="mesa-rodada-item-nome">' + pdvEsc(item.nome || "") + (det ? ' <small class="mesa-rodada-item-det">(' + pdvEsc(det) + ")</small>" : "") + "</span></span>" +
      '<span class="mesa-rodada-item-preco">' + preco + "</span>" +
      delBtn +
      "</div>";
  });
  lista.innerHTML = html;
  lista.querySelectorAll(".mesa-item-del").forEach(function (btn) {
    btn.addEventListener("click", function () {
      mesaCancelarItem(Number(btn.dataset.pedidoId), Number(btn.dataset.itemIdx), btn.dataset.nomeItem);
    });
  });
}

async function mesaCancelarItem(pedidoId, itemIdx, nomeItem) {
  var conf = await confirmar(
    "Cancelar item?",
    "Remover \"" + (nomeItem || "item") + "\" da conta da mesa. Esta ação não pode ser desfeita.",
    "Cancelar item"
  );
  if (!conf) return;
  var d = mesaState.detalhe;
  if (!d) return;
  var r = await api("POST", "/api/mesas/" + d.id + "/cancelar-item", { pedidoId: pedidoId, itemIdx: itemIdx });
  if (!r || !r.ok) {
    var e = await (r && r.json().catch(function () { return {}; })) || {};
    toast(e.erro || "Erro ao cancelar o item.", "erro");
    return;
  }
  mesaState.detalhe = await r.json();
  renderMesaItens();
  renderMesaTotais();
}

function renderMesaTotais() {
  var d = mesaState.detalhe;
  var el = $("mesaTotais");
  if (!d || d.status === "livre") { el.innerHTML = ""; return; }
  var resumo = d.resumo || {};
  var recebido = d.recebido || 0;
  var falta = d.falta || 0;
  var pes = Number(d.pessoas) || 1;
  var editIco = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
  var html = "";
  html += '<div class="mesa-tot-linha mesa-tot-pessoas"><span>Pessoas</span><span>' + pes + ' <button type="button" class="mesa-pessoas-edit" id="mesaPessoasEdit" aria-label="Editar nº de pessoas">' + editIco + "</button></span></div>";
  html += '<div class="mesa-tot-linha"><span>Subtotal</span><span>' + pdvMoney(resumo.subtotal || 0) + "</span></div>";
  if ((resumo.taxaServico || 0) > 0) {
    html += '<div class="mesa-tot-linha"><span>Taxa serviço (' + (d.taxaServico || 0) + '%)</span><span>' + pdvMoney(resumo.taxaServico) + "</span></div>";
  }
  html += '<div class="mesa-tot-linha total"><span>TOTAL</span><span>' + pdvMoney(resumo.total || 0) + "</span></div>";
  if (pes > 1) {
    var porPessoa = Math.round(((resumo.total || 0) / pes) * 100) / 100;
    html += '<div class="mesa-tot-linha mesa-tot-porpessoa"><span>Por pessoa (' + pes + ')</span><span>' + pdvMoney(porPessoa) + "</span></div>";
  }
  if (recebido > 0) {
    html += '<div class="mesa-tot-linha recebido"><span>Recebido</span><span>' + pdvMoney(recebido) + "</span></div>";
    html += '<div class="mesa-tot-linha falta"><span>Falta</span><span>' + pdvMoney(falta) + "</span></div>";
  }
  el.innerHTML = html;
  var edit = $("mesaPessoasEdit");
  if (edit) edit.addEventListener("click", function () { abrirModalPessoas("editar"); });
}

function renderMesaAcoes() {
  var d = mesaState.detalhe;
  if (!d) return;
  var row = $("mesaAcoesRow");
  var imprimir = $("btnMesaImprimirConta");
  var parcial = $("btnMesaReceberParcial");
  var fechar = $("btnMesaFecharConta");
  row.innerHTML = "";
  if (d.status === "livre") {
    var btnAbrir = document.createElement("button");
    btnAbrir.type = "button";
    btnAbrir.className = "primario";
    btnAbrir.textContent = "Abrir Mesa";
    btnAbrir.addEventListener("click", mesaAbrir);
    row.appendChild(btnAbrir);
    imprimir.hidden = true; parcial.hidden = true; fechar.hidden = true;
  } else {
    imprimir.hidden = false; parcial.hidden = false; fechar.hidden = false;
    if (d.status === "ocupada") {
      var btnSol = document.createElement("button");
      btnSol.type = "button"; btnSol.className = "secundario";
      btnSol.textContent = "Solicitar Conta";
      btnSol.addEventListener("click", mesaSolicitarConta);
      var btnTransf = document.createElement("button");
      btnTransf.type = "button"; btnTransf.className = "secundario";
      btnTransf.textContent = "Transferir";
      btnTransf.addEventListener("click", abrirMesaTransferir);
      var btnCan = document.createElement("button");
      btnCan.type = "button"; btnCan.className = "secundario";
      btnCan.style.color = "var(--error)"; btnCan.style.borderColor = "var(--error)";
      btnCan.textContent = "Cancelar";
      btnCan.addEventListener("click", mesaCancelar);
      row.appendChild(btnSol); row.appendChild(btnTransf); row.appendChild(btnCan);
    } else if (d.status === "pediu_conta" || d.status === "fechando") {
      var btnRe = document.createElement("button");
      btnRe.type = "button"; btnRe.className = "secundario";
      btnRe.textContent = "Reabrir";
      btnRe.addEventListener("click", mesaReabrir);
      row.appendChild(btnRe);
    }
  }
}

function mesaAbrir() {
  var d = mesaState.detalhe;
  if (!d) return;
  abrirModalPessoas("abrir"); // pergunta o nº de pessoas antes de abrir (opcional)
}

async function mesaConfirmarAbrir(pessoas) {
  var d = mesaState.detalhe;
  if (!d) return;
  var r = await api("POST", "/api/mesas/" + d.id + "/abrir", { pessoas: pessoas });
  if (!r.ok) { var e = await r.json().catch(function () { return {}; }); toast(e.erro || "Erro ao abrir mesa.", "erro"); return; }
  var m = await r.json();
  mesaState.detalhe = Object.assign({}, mesaState.detalhe, m, { pedidos: [], resumo: { subtotal: 0, taxaServico: 0, total: 0 }, recebido: 0, falta: 0 });
  await mesaAtualizarLista();
  abrirMesaPainel();
}

/* ---- Nº de pessoas (modal ao abrir / editar) ---- */
var mesaPessoasVal = 1;
var mesaPessoasModo = "abrir";

function abrirModalPessoas(modo) {
  var d = mesaState.detalhe;
  if (!d) return;
  mesaPessoasModo = modo;
  mesaPessoasVal = modo === "editar" ? (Number(d.pessoas) || 1) : 1;
  var X = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var titulo = modo === "editar" ? "Nº de pessoas — Mesa " + pdvEsc(d.nome) : "Abrir Mesa " + pdvEsc(d.nome);
  var rodape = modo === "editar"
    ? '<button type="button" class="secundario" id="mesaPessoasCancelar">Cancelar</button><button type="button" class="primario" id="mesaPessoasConfirmar">Salvar</button>'
    : '<button type="button" class="secundario" id="mesaPessoasPular">Abrir sem informar</button><button type="button" class="primario" id="mesaPessoasConfirmar">Abrir mesa</button>';
  $("mesasPessoasCaixa").innerHTML =
    '<button type="button" class="pdv-modal-x" id="mesaPessoasFechar" aria-label="Fechar">' + X + "</button>" +
    '<h3 class="pdv-modal-titulo">' + titulo + "</h3>" +
    '<div class="pdv-modal-corpo">' +
      '<p class="sub" style="margin:0 0 16px">Quantas pessoas nesta mesa? Usado para o <strong>valor por pessoa</strong> na conta.</p>' +
      '<div class="mesa-pessoas-stepper">' +
        '<button type="button" id="mesaPessoasMenos" aria-label="Menos uma pessoa">−</button>' +
        '<span id="mesaPessoasNum">' + mesaPessoasVal + "</span>" +
        '<button type="button" id="mesaPessoasMais" aria-label="Mais uma pessoa">+</button>' +
      "</div>" +
    "</div>" +
    '<div class="pdv-modal-rodape">' + rodape + "</div>";
  $("mesasPessoasOverlay").hidden = false;
  var setNum = function (v) {
    mesaPessoasVal = Math.max(1, Math.min(99, v));
    $("mesaPessoasNum").textContent = mesaPessoasVal;
  };
  $("mesaPessoasMenos").addEventListener("click", function () { setNum(mesaPessoasVal - 1); });
  $("mesaPessoasMais").addEventListener("click", function () { setNum(mesaPessoasVal + 1); });
  $("mesaPessoasFechar").addEventListener("click", fecharModalPessoas);
  $("mesasPessoasBg").addEventListener("click", fecharModalPessoas);
  if ($("mesaPessoasCancelar")) $("mesaPessoasCancelar").addEventListener("click", fecharModalPessoas);
  if ($("mesaPessoasPular")) $("mesaPessoasPular").addEventListener("click", function () { fecharModalPessoas(); mesaConfirmarAbrir(1); });
  $("mesaPessoasConfirmar").addEventListener("click", mesaPessoasConfirmar);
}
function fecharModalPessoas() { $("mesasPessoasOverlay").hidden = true; }

async function mesaPessoasConfirmar() {
  var d = mesaState.detalhe;
  if (!d) return;
  if (mesaPessoasModo === "editar") {
    var r = await api("POST", "/api/mesas/" + d.id + "/pessoas", { pessoas: mesaPessoasVal });
    if (!r || !r.ok) { var e = (r && await r.json().catch(function () { return {}; })) || {}; toast(e.erro || "Erro ao salvar.", "erro"); return; }
    var m = await r.json();
    mesaState.detalhe = Object.assign({}, mesaState.detalhe, { pessoas: m.pessoas });
    fecharModalPessoas();
    renderMesaTotais();
    toast("Nº de pessoas atualizado.");
  } else {
    fecharModalPessoas();
    mesaConfirmarAbrir(mesaPessoasVal);
  }
}

async function mesaSolicitarConta() {
  var d = mesaState.detalhe;
  if (!d) return;
  var r = await api("POST", "/api/mesas/" + d.id + "/solicitar-conta");
  if (!r.ok) { var e = await r.json().catch(function () { return {}; }); toast(e.erro || "Erro.", "erro"); return; }
  await mesaRecarregarDetalhe(d.id);
}

async function mesaReabrir() {
  var d = mesaState.detalhe;
  if (!d) return;
  var r = await api("POST", "/api/mesas/" + d.id + "/reabrir");
  if (!r.ok) { var e = await r.json().catch(function () { return {}; }); toast(e.erro || "Erro ao reabrir.", "erro"); return; }
  await mesaRecarregarDetalhe(d.id);
  toast("Mesa reaberta.");
}

async function mesaCancelar() {
  var d = mesaState.detalhe;
  if (!d) return;
  var total = (d.resumo && d.resumo.total) || 0;
  var motivo = "";
  if (total > 0) {
    // Reforço anti-fraude: mesa COM consumo exige MOTIVO (fica na auditoria) e mostra o valor.
    var r0 = await modalCaixa({
      titulo: "Cancelar mesa " + d.nome + "?",
      info: "Esta mesa tem " + pdvMoney(total) + " em consumo. Cancelar marca os pedidos como cancelados e libera a mesa SEM receber. Informe o motivo (fica registrado).",
      campos: [{ id: "mesaCancelMotivo", label: "Motivo do cancelamento", tipo: "texto", placeholder: "Ex.: cliente desistiu, mesa aberta por engano" }],
      txtConfirmar: "Cancelar mesa",
    });
    if (!r0) return;
    motivo = (r0.mesaCancelMotivo || "").trim();
    if (!motivo) { toast("Informe o motivo para cancelar uma mesa com consumo.", "erro"); return; }
  } else {
    var conf = await confirmar("Cancelar mesa " + d.nome + "?", "A mesa será liberada.", "Cancelar mesa", "Voltar");
    if (!conf) return;
  }
  var r = await api("POST", "/api/mesas/" + d.id + "/cancelar", { motivo: motivo });
  if (!r.ok) { var e = await r.json().catch(function () { return {}; }); toast(e.erro || "Erro ao cancelar.", "erro"); return; }
  toast("Mesa " + d.nome + " cancelada.");
  fecharMesaPainel();
  await mesaAtualizarLista();
}

async function mesaRecarregarDetalhe(id) {
  var r = await api("GET", "/api/mesas/" + id);
  if (!r.ok) return;
  mesaState.detalhe = await r.json();
  abrirMesaPainel();
  await mesaAtualizarLista();
}

/* ---- Transferir / Juntar comanda ---- */
function abrirMesaTransferir() {
  var d = mesaState.detalhe;
  if (!d) return;
  // Destinos: demais mesas livres ou ocupadas (destino ocupado = juntar comandas).
  var destinos = (mesaState.lista || []).filter(function (m) {
    return m.id !== d.id && (m.status === "livre" || m.status === "ocupada");
  });
  if (!destinos.length) { toast("Nenhuma mesa disponível para transferir.", "erro"); return; }
  var X = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var opcoes = destinos.map(function (m) {
    var rotulo = m.status === "ocupada"
      ? pdvEsc(m.nome) + " (ocupada · " + pdvMoney(m.totalConsumido || 0) + ")"
      : pdvEsc(m.nome) + " (livre)";
    return '<option value="' + m.id + '">Mesa ' + rotulo + "</option>";
  }).join("");
  $("mesasTransferirCaixa").innerHTML =
    '<button type="button" class="pdv-modal-x" id="mesaTransfFechar" aria-label="Fechar">' + X + "</button>" +
    '<h3 class="pdv-modal-titulo">Transferir Mesa ' + pdvEsc(d.nome) + "</h3>" +
    '<div class="pdv-modal-corpo">' +
      '<p class="sub" style="margin:0 0 14px">Move toda a comanda (' + pdvMoney((d.resumo && d.resumo.total) || 0) + ') para outra mesa.</p>' +
      '<label class="pdv-campo"><span>Mesa de destino</span><select id="mesaTransfDestino">' + opcoes + "</select></label>" +
      '<div class="mesa-transf-aviso" id="mesaTransfAviso" hidden></div>' +
    "</div>" +
    '<div class="pdv-modal-rodape">' +
      '<button type="button" class="secundario" id="mesaTransfCancelar">Cancelar</button>' +
      '<button type="button" class="primario" id="mesaTransfConfirmar">Transferir</button>' +
    "</div>";
  $("mesasTransferirOverlay").hidden = false;
  $("mesaTransfFechar").addEventListener("click", fecharMesaTransferir);
  $("mesaTransfCancelar").addEventListener("click", fecharMesaTransferir);
  $("mesasTransferirBg").addEventListener("click", fecharMesaTransferir);
  $("mesaTransfDestino").addEventListener("change", mesaTransfAtualizarAviso);
  $("mesaTransfConfirmar").addEventListener("click", mesaConfirmarTransferir);
  mesaTransfAtualizarAviso();
}
function fecharMesaTransferir() { $("mesasTransferirOverlay").hidden = true; }

// Reflete a intenção conforme o destino: destino OCUPADO = juntar contas (aviso +
// botão "Juntar contas"); destino LIVRE = transferência simples.
function mesaTransfAtualizarAviso() {
  var destinoId = Number(($("mesaTransfDestino") || {}).value);
  var destino = (mesaState.lista || []).find(function (m) { return m.id === destinoId; });
  var juntar = destino && destino.status !== "livre";
  var aviso = $("mesaTransfAviso");
  var btn = $("mesaTransfConfirmar");
  if (juntar) {
    aviso.innerHTML = '<strong>Juntar as contas.</strong> A Mesa ' + pdvEsc(destino.nome) + ' já está ocupada — as duas viram <strong>uma conta só</strong> (um serviço, um pagamento). Para pagar separado, mantenha as mesas abertas (cancele aqui).';
    aviso.hidden = false;
    if (btn) btn.textContent = "Juntar contas";
  } else {
    aviso.hidden = true;
    if (btn) btn.textContent = "Transferir";
  }
}

async function mesaConfirmarTransferir() {
  var d = mesaState.detalhe;
  if (!d) return;
  var destinoId = Number(($("mesaTransfDestino") || {}).value);
  if (!destinoId) { toast("Escolha a mesa de destino.", "erro"); return; }
  var destino = (mesaState.lista || []).find(function (m) { return m.id === destinoId; });
  var juntar = destino && destino.status !== "livre";
  var btn = $("mesaTransfConfirmar"); btn.disabled = true;
  var r = await api("POST", "/api/mesas/" + d.id + "/transferir/" + destinoId, {});
  if (!r || !r.ok) { btn.disabled = false; var e = (r && await r.json().catch(function () { return {}; })) || {}; toast(e.erro || "Falha ao transferir.", "erro"); return; }
  fecharMesaTransferir();
  fecharMesaPainel();
  toast(juntar
    ? "Comanda da Mesa " + d.nome + " juntada à Mesa " + (destino ? destino.nome : "") + "."
    : "Mesa " + d.nome + " transferida para " + (destino ? destino.nome : "") + ".");
  await mesaAtualizarLista();
}

async function mesaAtualizarLista() {
  var r = await api("GET", "/api/mesas");
  if (!r.ok) return;
  var data = await r.json();
  mesaState.lista = data.mesas || [];
  if (data.alertaParadaMin != null) mesaState.alertaParadaMin = data.alertaParadaMin;
  renderMesasGrade();
}

/* ---- Modo PDV para mesa ---- */
function ativarMesaModoPdv() {
  var d = mesaState.detalhe;
  if (!d || d.status === "livre") { toast("Abra a mesa antes de lançar.", "aviso"); mesaMudarAba("itens"); return; }
  if (d.status === "pediu_conta" || d.status === "fechando") { toast("Mesa em fechamento. Reabra para lançar.", "aviso"); mesaMudarAba("itens"); return; }
  mesaModoId = d.id;
  mesaModoNome = d.nome;
  // Banner no topo do PDV
  if (!$("pdvMesaBanner")) {
    var abaPdv = $("aba-pdv");
    var banner = document.createElement("div");
    banner.id = "pdvMesaBanner";
    banner.className = "pdv-mesa-banner";
    banner.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>' +
      '<span>Lançando para <strong>Mesa ' + pdvEsc(mesaModoNome) + '</strong></span>' +
      '<button type="button" class="secundario mini" id="pdvMesaCancelar">Cancelar</button>';
    if (abaPdv) abaPdv.insertBefore(banner, abaPdv.firstChild);
    var cancelBtn = $("pdvMesaCancelar");
    if (cancelBtn) cancelBtn.addEventListener("click", desativarMesaModoPdv);
  }
  var cobrar = $("pdvCobrar");
  if (cobrar) cobrar.textContent = "Enviar para Mesa";
  pdvCart = []; pdvDesconto = null; renderPdvCarrinho();
  fecharMesaPainel();
  var pdvBtn = document.querySelector("nav button[data-aba='pdv']");
  if (pdvBtn) pdvBtn.click();
}

function desativarMesaModoPdv(voltarParaMesa) {
  var idMesa = mesaModoId;
  mesaModoId = null;
  mesaModoNome = "";
  pdvCart = []; pdvDesconto = null;
  var banner = $("pdvMesaBanner");
  if (banner) banner.remove();
  var cobrar = $("pdvCobrar");
  if (cobrar) cobrar.textContent = "Cobrar";
  renderPdvCarrinho();
  if (voltarParaMesa !== false && idMesa) {
    var mesaNavBtn = document.querySelector("nav button[data-aba='mesas']");
    if (mesaNavBtn) mesaNavBtn.click();
    setTimeout(function () { mesaSelecionarCard(idMesa); }, 200);
  }
}

async function mesaLancarDoPdv() {
  if (!pdvCart.length) { toast("Carrinho vazio.", "aviso"); return; }
  var btn = $("pdvCobrar");
  if (btn) btn.disabled = true;
  try {
    var itens = pdvCart.map(function (l) {
      return {
        id: l.id, qtd: l.qtd,
        composicao: l.composicao || [],
        opcionais: (l.opcionais || []).map(function (o) { return { nome: o.nome, qtd: o.qtd }; }),
        variacoes: (l.variacoes || []).map(function (v) { return { id: v.id, qtd: v.qtd }; }),
        observacao: l.observacao || ""
      };
    });
    var r = await api("POST", "/api/mesas/" + mesaModoId + "/pedido", { itens: itens });
    if (!r.ok) {
      var e = await r.json().catch(function () { return {}; });
      toast(e.erro || "Erro ao lançar na mesa.", "erro");
      return;
    }
    toast("Itens lançados na mesa!");
    // A comanda da cozinha da rodada é enfileirada no servidor e impressa pelo agente.
    var idMesa = mesaModoId;
    desativarMesaModoPdv(false);
    var mesaNavBtn = document.querySelector("nav button[data-aba='mesas']");
    if (mesaNavBtn) mesaNavBtn.click();
    setTimeout(function () { mesaSelecionarCard(idMesa); }, 200);
  } catch (err) {
    toast("Erro ao lançar na mesa.", "erro");
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---- Aba Lançar (legado — mantido para não quebrar referências) ---- */
function mesaCarregarGrade() {
  var cats = $("mesaCats");
  var grade = $("mesaGrid");
  if (!cats || !grade) return;
  cats.innerHTML = "";
  grade.innerHTML = "";
  mesasPdvCatAtual = mesasPdvCatAtual || "";
  mesaRenderGrade(mesasPdvCatAtual);
  $("mesaBusca").value = "";
}

function mesaRenderGrade(cat) {
  mesasPdvCatAtual = cat || "";
  var grade = $("mesaGrid");
  var cats = $("mesaCats");
  var busca = (($("mesaBusca") || {}).value || "").trim().toLowerCase();
  var cardapio = cardapioAtual || { categorias: [] };
  // render cat pills
  cats.innerHTML = "";
  var catNomes = cardapio.categorias.map(function (c) { return c.nome; }).filter(function (n, i, a) { return a.indexOf(n) === i; });
  catNomes.forEach(function (cn) {
    var b = document.createElement("button");
    b.type = "button"; b.role = "tab";
    b.className = "pdv-cat" + (cn === mesasPdvCatAtual ? " ativo" : "");
    b.textContent = cn;
    b.addEventListener("click", function () { mesasPdvCatAtual = cn; mesaRenderGrade(cn); });
    cats.appendChild(b);
  });
  // render items
  grade.innerHTML = "";
  var itens = cardapio.categorias.reduce(function (acc, c) {
    (c.itens || []).forEach(function (i) { acc.push(Object.assign({}, i, { _cat: c.nome })); });
    return acc;
  }, []);
  if (busca) {
    itens = itens.filter(function (i) { return (i.nome || "").toLowerCase().indexOf(busca) !== -1; });
  } else if (mesasPdvCatAtual) {
    itens = itens.filter(function (i) { return i._cat === mesasPdvCatAtual; });
  }
  itens.forEach(function (item) {
    if (!item.disponivel) return;
    var tile = document.createElement("button");
    tile.type = "button";
    tile.className = "pdv-tile";
    tile.innerHTML = '<div class="pdv-tile-corpo"><span class="pdv-tile-nome">' + pdvEsc(item.nome) + "</span>" +
      '<span class="pdv-tile-preco">' + pdvMoney(item.preco) + "</span></div>";
    tile.addEventListener("click", function () { mesaAdicionarItem(item); });
    grade.appendChild(tile);
  });
}

function mesaAdicionarItem(item) {
  var d = mesaState.detalhe;
  if (!d || d.status === "livre") { toast("Abra a mesa antes de lançar.", "erro"); return; }
  if (d.status === "pediu_conta" || d.status === "fechando") { toast("Mesa em fechamento. Reabra para lançar.", "erro"); return; }
  var idx = mesaState.cart.findIndex(function (c) { return c.id === item.id; });
  if (idx >= 0) {
    mesaState.cart[idx].qtd++;
  } else {
    mesaState.cart.push(Object.assign({}, item, { qtd: 1, opcionais: [], variacoes: [] }));
  }
  renderMesaCart();
}

function renderMesaCart() {
  var cart = mesaState.cart;
  var el = $("mesaCarrinho");
  var itensEl = $("mesaCartItens");
  if (!el) return;
  el.hidden = cart.length === 0;
  if (!cart.length) return;
  itensEl.innerHTML = cart.map(function (c, i) {
    return '<div class="mesa-cart-linha">' +
      '<span class="mesa-cart-linha-nome">' + c.qtd + "x " + pdvEsc(c.nome) + "</span>" +
      '<span class="mesa-cart-linha-preco">' + pdvMoney(c.preco * c.qtd) + "</span>" +
      '<button type="button" class="mesa-cart-rm" data-idx="' + i + '" aria-label="Remover">&times;</button>' +
      "</div>";
  }).join("");
  itensEl.querySelectorAll(".mesa-cart-rm").forEach(function (b) {
    b.addEventListener("click", function () {
      mesaState.cart.splice(Number(b.dataset.idx), 1);
      renderMesaCart();
    });
  });
}

async function mesaLancarRodada() {
  var d = mesaState.detalhe;
  if (!d || !mesaState.cart.length) return;
  var obs = (($("mesaObs") || {}).value || "").trim();
  var btn = $("mesaLancarRodada");
  btn.disabled = true; btn.textContent = "Lançando…";
  var r = await api("POST", "/api/mesas/" + d.id + "/pedido", {
    itens: mesaState.cart.map(function (c) {
      return { id: c.id, nome: c.nome, preco: c.preco, qtd: c.qtd, opcionais: c.opcionais || [], variacoes: c.variacoes || [] };
    }),
    observacao: obs,
  });
  btn.disabled = false; btn.textContent = "Lançar Rodada";
  if (!r.ok) { var e = await r.json().catch(function () { return {}; }); toast(e.erro || "Erro ao lançar rodada.", "erro"); return; }
  toast("Rodada lançada!");
  mesaState.cart = [];
  if ($("mesaObs")) $("mesaObs").value = "";
  renderMesaCart();
  await mesaRecarregarDetalhe(d.id);
  mesaMudarAba("itens");
}

/* ---- Configurar Mesas ---- */
function abrirConfigurarMesas() {
  mesaState.cfgPendentes = [];
  if ($("mesasTaxaCfg")) $("mesasTaxaCfg").value = "";
  if ($("mesasAlertaCfg")) $("mesasAlertaCfg").value = mesaState.alertaParadaMin != null ? mesaState.alertaParadaMin : "";
  if ($("mesasAddInput")) $("mesasAddInput").value = "";
  renderMesasConfigLista();
  $("mesasConfigOverlay").hidden = false;
}

function fecharConfigurarMesas() {
  $("mesasConfigOverlay").hidden = true;
}

function mesasAdicionarNomes() {
  var raw = (($("mesasAddInput") || {}).value || "").trim();
  if (!raw) return;
  var n = Number(raw);
  var nomes = [];
  if (!isNaN(n) && n > 0 && n <= 50) {
    for (var i = 1; i <= n; i++) nomes.push(String(i).padStart(2, "0"));
  } else {
    nomes = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }
  mesaState.cfgPendentes = mesaState.cfgPendentes.concat(nomes);
  if ($("mesasAddInput")) $("mesasAddInput").value = "";
  renderMesasConfigLista();
}

function renderMesasConfigLista() {
  var el = $("mesasConfigLista");
  if (!el) return;
  var existentes = mesaState.lista.map(function (m) {
    return '<span class="mesa-tag">' + pdvEsc(m.nome) +
      (m.status === "livre"
        ? '<button type="button" class="mesa-tag-rm" data-id="' + m.id + '" aria-label="Remover mesa ' + pdvEsc(m.nome) + '">&times;</button>'
        : "") +
      "</span>";
  }).join("");
  var pendentes = mesaState.cfgPendentes.map(function (n, i) {
    return '<span class="mesa-tag" style="opacity:.7">' + pdvEsc(n) +
      '<button type="button" class="mesa-tag-rm" data-idx="' + i + '" aria-label="Remover">&times;</button>' +
      "</span>";
  }).join("");
  el.innerHTML = existentes + pendentes;
  el.querySelectorAll(".mesa-tag-rm[data-id]").forEach(function (b) {
    b.addEventListener("click", async function () {
      var id = Number(b.dataset.id);
      var ok = await api("DELETE", "/api/mesas/" + id);
      if (!ok.ok) { var e2 = await ok.json().catch(function () { return {}; }); toast(e2.erro || "Não foi possível remover (mesa ocupada?).", "erro"); return; }
      mesaState.lista = mesaState.lista.filter(function (m) { return m.id !== id; });
      renderMesasConfigLista();
      renderMesasGrade();
    });
  });
  el.querySelectorAll(".mesa-tag-rm[data-idx]").forEach(function (b) {
    b.addEventListener("click", function () {
      mesaState.cfgPendentes.splice(Number(b.dataset.idx), 1);
      renderMesasConfigLista();
    });
  });
}

async function salvarConfigurarMesas() {
  var taxa = (($("mesasTaxaCfg") || {}).value || "").trim();
  var alerta = (($("mesasAlertaCfg") || {}).value || "").trim();
  var body = {};
  if (mesaState.cfgPendentes.length) body.nomes = mesaState.cfgPendentes.slice();
  if (taxa !== "") body.taxaServico = Number(taxa);
  if (alerta !== "") body.alertaParadaMin = Number(alerta);
  if (!body.nomes && body.taxaServico == null && body.alertaParadaMin == null) { fecharConfigurarMesas(); return; }
  var r = await api("POST", "/api/mesas/config", body);
  if (!r.ok) { var e = await r.json().catch(function () { return {}; }); toast(e.erro || "Erro ao salvar.", "erro"); return; }
  mesaState.cfgPendentes = [];
  toast("Configurações salvas!");
  await mesaAtualizarLista();
  fecharConfigurarMesas();
}

/* ---- Pagamento / Recebimento (split — reusa o do PDV: formas em tiles, várias
   formas numa tela só, troco) ---- */
var mesaPagamentos = [];   // [{forma, valor}] adicionados nesta tela
var mesaPgFormaSel = null; // forma selecionada
var mesaPagarAlvo = 0;     // alvo a cobrir (falta a receber), em reais

// Formas de pagamento: prioriza a config do tenant (configAtual.pagamentos), com
// fallback pro que o PDV carregou e, por fim, um padrão.
function mesaFormasPagamento() {
  if (configAtual && Array.isArray(configAtual.pagamentos) && configAtual.pagamentos.length) return configAtual.pagamentos;
  if (typeof pdvFormasPg !== "undefined" && pdvFormasPg && pdvFormasPg.length > 1) return pdvFormasPg;
  return ["Dinheiro", "Cartão Débito", "Cartão Crédito", "Pix", "Outros"];
}
function mesaPagoTotal() { return Math.round(mesaPagamentos.reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0) * 100) / 100; }

function abrirMesaPagar(modo) {
  var d = mesaState.detalhe;
  if (!d) return;
  mesaPagarModo = modo || "fechar";
  var resumo = d.resumo || {};
  var recebido = d.recebido || 0;
  var falta = d.falta != null ? d.falta : Math.max(0, (resumo.total || 0) - recebido);
  mesaPagarAlvo = Math.round(falta * 100) / 100;
  mesaPagamentos = [];
  var formas = mesaFormasPagamento();
  mesaPgFormaSel = formas[0] || "Dinheiro";
  var titulo = mesaPagarModo === "parcial" ? "Receber Parcial" : "Fechar Conta";
  var btnLabel = mesaPagarModo === "parcial" ? "Registrar" : "Fechar conta";
  var X = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  var tiles = formas.map(function (f) {
    return '<button type="button" class="pdv-forma' + (f === mesaPgFormaSel ? " ativo" : "") + '" data-mforma="' + pdvEsc(f) + '">' + pdvIconeForma(f) + "<span>" + pdvEsc(f) + "</span></button>";
  }).join("");
  $("mesasPagarCaixa").innerHTML =
    '<button type="button" class="pdv-modal-x" id="mesasPagarFechar" aria-label="Fechar">' + X + "</button>" +
    '<h3 class="pdv-modal-titulo">' + titulo + "</h3>" +
    '<div class="pdv-modal-corpo">' +
      '<div class="mesa-pagar-resumo">' +
        '<div class="mesa-pagar-linha"><span>Subtotal</span><span>' + pdvMoney(resumo.subtotal || 0) + "</span></div>" +
        ((resumo.taxaServico || 0) > 0 ? '<div class="mesa-pagar-linha"><span>Taxa serviço (' + (d.taxaServico || 0) + '%)</span><span>' + pdvMoney(resumo.taxaServico) + "</span></div>" : "") +
        '<div class="mesa-pagar-linha total"><span>Total</span><span>' + pdvMoney(resumo.total || 0) + "</span></div>" +
        ((d.pessoas || 1) > 1 ? '<div class="mesa-pagar-linha"><span>Por pessoa (' + d.pessoas + ')</span><span>' + pdvMoney(Math.round(((resumo.total || 0) / d.pessoas) * 100) / 100) + "</span></div>" : "") +
        (recebido > 0 ? '<div class="mesa-pagar-linha recebido"><span>Já recebido</span><span>' + pdvMoney(recebido) + "</span></div>" : "") +
        '<div class="mesa-pagar-linha falta"><span>Falta</span><span>' + pdvMoney(falta) + "</span></div>" +
      "</div>" +
      '<span class="pdv-ops-tit">Forma de pagamento</span>' +
      '<div class="pdv-formas">' + tiles + "</div>" +
      '<div class="pdv-pg-add-row"><div class="campo-prefixo pdv-pg-campo"><span class="campo-prefixo-moeda">R$</span><input id="mesaPgValor" type="text" inputmode="numeric" placeholder="0,00" /></div><button type="button" class="pdv-pg-addbtn" id="mesaPgAdd">Adicionar</button></div>' +
      '<div class="pdv-pg-lista" id="mesaPgLista"></div>' +
      '<div class="mesa-pagar-resumo" style="margin-top:10px">' +
        '<div class="mesa-pagar-linha"><span>Pago</span><span id="mesaPgPago">R$ 0,00</span></div>' +
        '<div class="mesa-pagar-linha falta"><span>' + (mesaPagarModo === "parcial" ? "Restante" : "Falta") + '</span><span id="mesaPgRestante">' + pdvMoney(falta) + "</span></div>" +
        '<div class="mesa-pagar-linha"><span>Troco</span><span id="mesaPgTroco">R$ 0,00</span></div>' +
      "</div>" +
    "</div>" +
    '<div class="pdv-modal-rodape">' +
      '<button type="button" class="secundario" id="mesasPagarFechar2">Cancelar</button>' +
      '<button type="button" class="primario" id="btnMesaConfirmarPag" disabled>' + btnLabel + "</button>" +
    "</div>";
  $("mesasPagarOverlay").hidden = false;
  $("mesasPagarFechar").addEventListener("click", function () { $("mesasPagarOverlay").hidden = true; });
  $("mesasPagarFechar2").addEventListener("click", function () { $("mesasPagarOverlay").hidden = true; });
  $("mesasPagarCaixa").querySelectorAll("[data-mforma]").forEach(function (b) {
    b.addEventListener("click", function () {
      mesaPgFormaSel = b.dataset.mforma;
      $("mesasPagarCaixa").querySelectorAll("[data-mforma]").forEach(function (x) { x.classList.toggle("ativo", x === b); });
      var inp = $("mesaPgValor"); if (inp) inp.focus();
    });
  });
  var valInp = $("mesaPgValor");
  if (window.Dinheiro) { Dinheiro.mascarar(valInp); Dinheiro.setValor(valInp, mesaPagarAlvo); }
  $("mesaPgAdd").addEventListener("click", mesaPagAdd);
  valInp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); mesaPagAdd(); } });
  if (typeof pdvSelecionarAoFocar === "function") pdvSelecionarAoFocar(valInp);
  $("btnMesaConfirmarPag").addEventListener("click", mesaConfirmarPagamento);
  renderMesaPgLista();
}

function mesaPagAdd() {
  var v = window.Dinheiro ? Dinheiro.valor($("mesaPgValor")) : 0;
  if (!(v > 0)) { toast("Informe o valor.", "erro"); return; }
  if (!mesaPgFormaSel) { toast("Escolha a forma de pagamento.", "erro"); return; }
  var restante = Math.round((mesaPagarAlvo - mesaPagoTotal()) * 100) / 100;
  // Só dinheiro pode exceder (gera troco); demais formas limitam ao restante.
  if (!pdvEhDinheiro(mesaPgFormaSel)) {
    if (restante <= 0) { toast("Pagamento já fechado.", "erro"); return; }
    v = Math.min(v, restante);
  }
  mesaPagamentos.push({ forma: mesaPgFormaSel, valor: v });
  renderMesaPgLista();
  var novoRest = Math.max(0, Math.round((mesaPagarAlvo - mesaPagoTotal()) * 100) / 100);
  if (window.Dinheiro) Dinheiro.setValor($("mesaPgValor"), novoRest);
}

function renderMesaPgLista() {
  var box = $("mesaPgLista");
  if (box) {
    box.innerHTML = mesaPagamentos.map(function (p, i) {
      return '<div class="pdv-pg-item">' + pdvIconeForma(p.forma) + "<span>" + pdvEsc(p.forma) + "</span><strong>" + pdvMoney(p.valor) + '</strong><button type="button" data-rmmpg="' + i + '" aria-label="Remover">&times;</button></div>';
    }).join("");
    box.querySelectorAll("[data-rmmpg]").forEach(function (b) {
      b.addEventListener("click", function () { mesaPagamentos.splice(Number(b.dataset.rmmpg), 1); renderMesaPgLista(); });
    });
  }
  mesaPagRecalc();
}

function mesaPagRecalc() {
  var pago = mesaPagoTotal();
  var restante = Math.max(0, Math.round((mesaPagarAlvo - pago) * 100) / 100);
  var troco = Math.max(0, Math.round((pago - mesaPagarAlvo) * 100) / 100);
  if ($("mesaPgPago")) $("mesaPgPago").textContent = pdvMoney(pago);
  if ($("mesaPgRestante")) $("mesaPgRestante").textContent = pdvMoney(restante);
  if ($("mesaPgTroco")) $("mesaPgTroco").textContent = pdvMoney(troco);
  // Parcial: qualquer valor > 0 já registra. Fechar: precisa cobrir a falta.
  var pode = mesaPagarModo === "parcial" ? (pago > 0) : (pago > 0 && pago + 0.001 >= mesaPagarAlvo);
  if ($("btnMesaConfirmarPag")) $("btnMesaConfirmarPag").disabled = !pode;
}

async function mesaConfirmarPagamento() {
  var d = mesaState.detalhe;
  if (!d || !mesaPagamentos.length) { toast("Adicione ao menos um pagamento.", "erro"); return; }
  var pagoAgora = mesaPagoTotal();
  var btn = $("btnMesaConfirmarPag");
  btn.disabled = true;
  if (mesaPagarModo === "parcial") {
    var r = await api("POST", "/api/mesas/" + d.id + "/receber-parcial", { pagamentos: mesaPagamentos });
    if (!r || !r.ok) { btn.disabled = false; var e = (r && await r.json().catch(function () { return {}; })) || {}; toast(e.erro || "Erro.", "erro"); return; }
    mesaState.detalhe = await r.json();
    $("mesasPagarOverlay").hidden = true;
    toast("Recebido " + pdvMoney(pagoAgora) + ".");
    abrirMesaPainel();
    await mesaAtualizarLista();
  } else {
    var r2 = await api("POST", "/api/mesas/" + d.id + "/pagar", { pagamentos: mesaPagamentos });
    if (!r2 || !r2.ok) { btn.disabled = false; var e2 = (r2 && await r2.json().catch(function () { return {}; })) || {}; toast(e2.erro || "Erro ao fechar.", "erro"); return; }
    $("mesasPagarOverlay").hidden = true;
    toast("Mesa " + d.nome + " fechada!");
    fecharMesaPainel();
    await mesaAtualizarLista();
  }
}

async function mesaIniciarFechamento() {
  var d = mesaState.detalhe;
  if (!d) return;
  var r = await api("POST", "/api/mesas/" + d.id + "/fechar-conta");
  if (!r.ok) { var e = await r.json().catch(function () { return {}; }); toast(e.erro || "Erro.", "erro"); return; }
  mesaState.detalhe = await r.json();
  abrirMesaPainel();
  abrirMesaPagar("fechar");
}

async function mesaImprimirConta() {
  var d = mesaState.detalhe;
  if (!d || !d.id) return;
  // O servidor monta a pré-conta e enfileira para o agente imprimir.
  var r = await api("POST", "/api/mesas/" + d.id + "/imprimir-conta");
  if (r && r.ok) toast("Conta enviada para impressão.");
  else { var e = r ? await r.json().catch(function () { return {}; }) : {}; toast(e.erro || "Falha ao enviar a conta.", "erro"); }
}

/* ---- Init (wired once) ---- */
function mesasInitListeners() {
  if (mesasInitDone) return;
  mesasInitDone = true;
  $("mesasPainelFechar").addEventListener("click", fecharMesaPainel);
  $("mesasPainelOverlay").addEventListener("click", fecharMesaPainel);
  $("mesaAbaItensBtn").addEventListener("click", function () { mesaMudarAba("itens"); });
  $("mesaAbaLancarBtn").addEventListener("click", function () { mesaMudarAba("lancar"); });
  $("btnMesaImprimirConta").addEventListener("click", mesaImprimirConta);
  $("btnMesaReceberParcial").addEventListener("click", function () { abrirMesaPagar("parcial"); });
  $("btnMesaFecharConta").addEventListener("click", mesaIniciarFechamento);
  $("mesasMostrarInfo").addEventListener("change", function (e) {
    mesaState.mostrarInfo = e.target.checked;
    renderMesasGrade();
  });
  $("mesasTamanho").addEventListener("input", function (e) {
    mesaState.tamanho = Number(e.target.value);
    renderMesasGrade();
  });
  $("btnConfigurarMesas").addEventListener("click", abrirConfigurarMesas);
  $("mesasConfigBg").addEventListener("click", fecharConfigurarMesas);
  $("mesasConfigFechar").addEventListener("click", fecharConfigurarMesas);
  $("mesasConfigFechar2").addEventListener("click", fecharConfigurarMesas);
  $("btnMesasAdd").addEventListener("click", mesasAdicionarNomes);
  $("mesasAddInput").addEventListener("keydown", function (e) { if (e.key === "Enter") mesasAdicionarNomes(); });
  $("btnMesasSalvarCfg").addEventListener("click", salvarConfigurarMesas);
  $("mesasPagarBg").addEventListener("click", function () { $("mesasPagarOverlay").hidden = true; });
  $("btnMesasIrCaixa").addEventListener("click", function () { document.querySelector("[data-aba='caixa']").click(); });
  $("btnMesasVencidoCaixa").addEventListener("click", function () { document.querySelector("[data-aba='caixa']").click(); });
  $("btnVerPlanosMesas").addEventListener("click", function () { abrirUpsell("mesas"); });
}

// Antes do boot: mostra imediatamente a última aba visitada (só a troca VISUAL, sem
// carregador — a sessão ainda não existe). Evita piscar o Dashboard no refresh; os dados
// da aba são carregados em inicial(), assim que a sessão estiver pronta.
try {
  var _ultimaAbaBoot = localStorage.getItem("ultimaAba");
  if (_ultimaAbaBoot && _ultimaAbaBoot !== "dashboard") {
    var _btnBoot = document.querySelector("nav button[data-aba='" + _ultimaAbaBoot + "']");
    var _abaBoot = document.getElementById("aba-" + _ultimaAbaBoot);
    if (_btnBoot && _abaBoot) {
      document.querySelectorAll("nav button").forEach(function (x) { x.classList.remove("ativo"); });
      document.querySelectorAll(".aba").forEach(function (x) { x.classList.remove("ativa"); });
      _btnBoot.classList.add("ativo");
      _abaBoot.classList.add("ativa");
    }
  }
} catch (_) {}

// Boot: obtém a sessão pelo cookie (refresh) e só então carrega o painel.
iniciarSessao().then((ok) => { if (ok) inicial(); });
