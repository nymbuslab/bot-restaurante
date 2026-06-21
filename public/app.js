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
    if (h && painelNome) h.textContent = painelNome;
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
    btn.classList.add("ativo");
    $("aba-" + btn.dataset.aba).classList.add("ativa");
    if (btn.dataset.aba === "pedidos") { carregarPedidos(); marcarPedidosVistos(); }
    if (btn.dataset.aba === "conexao") atualizarStatus();
    if (btn.dataset.aba === "assinatura") carregarAssinatura();
    if (btn.dataset.aba === "caixa") carregarCaixa();
  });
});

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
  if (btnNpImp) btnNpImp.hidden = planoAtual !== "completo";
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
// Imprimir comanda a partir do modal de novo pedido: o objeto do poll é leve
// (só nº/cliente/itens/total), então resolve o pedido completo no cache antes.
if ($("np-imprimir")) {
  $("np-imprimir").addEventListener("click", async () => {
    await carregarPedidos();
    const p = pedidosCache.find((x) => x.numero === novoPedidoNumeroAtual);
    if (p && window.Impressao) window.Impressao.abrirPreview(p, configAtual);
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
  const msg = ehUpgrade
    ? `Mudar para o ${info.nome} (R$ ${info.valor}/mês)?\n\nA diferença é cobrada proporcionalmente pelo Stripe. Você passa a ter o frete por raio e a impressão de pedidos.`
    : `Mudar para o ${info.nome} (R$ ${info.valor}/mês)?\n\nO ajuste é proporcional. Você deixa de ter o frete por raio e a impressão de pedidos.`;
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
    // Cortesia é gerenciada pela equipe Nymbus — sem ações de pagamento aqui.
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
  if ($("aba-conexao").classList.contains("ativa")) atualizarStatus();
}, 4000);

// ============================================================
// CARDÁPIO
// ============================================================
// Exibição monetária pt-BR unificada (ver public/dinheiro.js) — "1.234,56".
function moedaBR(v) { return Dinheiro.formatar(v); }

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
    Dinheiro.setValor("editor-preco", it.preco);
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
  const preco = Dinheiro.valor("editor-preco");

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
        <input type="text" inputmode="numeric" class="opc-preco" placeholder="0,00" value="${op.preco ? Dinheiro.formatar(op.preco) : ""}" data-oi="${oi}" />
      </div>
      <button type="button" class="perigo mini opc-del" data-oi="${oi}" aria-label="Remover">×</button>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll(".opc-nome").forEach((el) =>
    el.addEventListener("input", (e) => { editorOpcionais[+e.target.dataset.oi].nome = e.target.value; })
  );

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
}

$("btnDescartarConfig").addEventListener("click", async () => {
  await carregarConfig();
  toast("Alterações descartadas.");
});

$("btnSalvarConfig").addEventListener("click", async (e) => {
  configAtual.restaurante.nome = $("cfgNome").value;
  configAtual.restaurante.telefone = $("cfgTelefone").value;
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

// ---- Sub-aba Impressora: Completo vê a config; Essencial vê o cadeado/upsell ----
function renderImpressoraGate() {
  const completo = planoAtual === "completo";
  const lock = $("impressoraLock");
  const cfg = $("impressoraConfig");
  if (lock) lock.hidden = completo;
  if (cfg) cfg.hidden = !completo;
}

if ($("btnVerPlanosImpressora")) {
  $("btnVerPlanosImpressora").addEventListener("click", () => {
    const btnAssin = document.querySelector('.sidebar [data-aba="assinatura"]');
    if (btnAssin) btnAssin.click();
  });
}

// ================= Caixa (Plano Completo) =================
function fmtBRn(n) { return (Number(n) || 0).toFixed(2).replace(".", ","); }

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
  const completo = planoAtual === "completo";
  $("caixaLock").hidden = completo;
  $("caixaConteudo").hidden = !completo;
  if (!completo) return;
  const r = await api("GET", "/api/caixa");
  if (!r || !r.ok) { $("caixaConteudo").innerHTML = "<p class='sub'>Falha ao carregar o caixa.</p>"; return; }
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
  const formas = Object.keys(r.recebidoPorForma);
  const linhasForma = formas.length
    ? formas.map((f) => `<div class="caixa-linha"><span>${escapar(f)}</span><span>R$ ${fmtBRn(r.recebidoPorForma[f])}</span></div>`).join("")
    : "<p class='sub'>Nenhum recebimento ainda.</p>";
  // Extrato do turno: recebimentos (estornáveis) + sangrias/suprimentos, com
  // valor, forma e data/hora — é o que o dono confere ao olhar o caixa.
  const dataHoraCurta = (iso) => iso
    ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "";
  const rotuloMov = (m) => {
    if (m.tipo === "recebimento") return "Pedido #" + (m.numero != null ? m.numero : "—") + (m.cliente ? " · " + escapar(m.cliente) : "");
    const base = m.tipo === "sangria" ? "Sangria" : "Suprimento";
    return base + (m.descricao ? " · " + escapar(m.descricao) : "");
  };
  const linhasMov = (data.movimentos || []).map((m) => {
    const ehSangria = m.tipo === "sangria";
    const valorTxt = (ehSangria ? "−R$ " : "R$ ") + fmtBRn(m.valor);
    const forma = m.tipo === "recebimento" ? escapar(m.forma || "") : "—";
    const acao = m.tipo === "recebimento"
      ? `<button class="secundario mini caixa-estornar" data-id="${m.pedidoId}">Estornar</button>` : "";
    return `<tr>
      <td>${rotuloMov(m)}</td>
      <td>${forma}</td>
      <td class="caixa-tab-valor${ehSangria ? " caixa-tab-neg" : ""}">${valorTxt}</td>
      <td class="caixa-tab-data">${dataHoraCurta(m.quando)}</td>
      <td class="caixa-tab-acao">${acao}</td>
    </tr>`;
  }).join("");
  const tabelaMov = (data.movimentos && data.movimentos.length)
    ? `<table class="caixa-tabela"><thead><tr><th>Movimento</th><th>Forma</th><th>Valor</th><th>Data/hora</th><th></th></tr></thead><tbody>${linhasMov}</tbody></table>`
    : "<p class='sub'>Nenhuma movimentação neste caixa ainda. Receba no detalhe do pedido (aba Pedidos).</p>";

  cont.innerHTML = `
    <div class="caixa-topo">
      <div><h3>Caixa aberto</h3><span class="sub">Fundo de troco: R$ ${fmtBRn(data.caixa.fundoTroco)}</span></div>
      <div class="caixa-acoes">
        <button class="secundario" id="btnSangria">Sangria</button>
        <button class="secundario" id="btnSuprimento">Suprimento</button>
        <button class="secundario" id="btnHistCaixa">Caixas anteriores</button>
        <button id="btnFecharCaixa">Fechar caixa</button>
      </div>
    </div>
    <div class="caixa-resumo">
      ${linhasForma}
      <div class="caixa-linha"><span>Suprimentos</span><span>R$ ${fmtBRn(r.suprimentos)}</span></div>
      <div class="caixa-linha"><span>Sangrias</span><span>− R$ ${fmtBRn(r.sangrias)}</span></div>
      <div class="caixa-linha caixa-total"><span>Esperado em dinheiro</span><span>R$ ${fmtBRn(r.esperadoEspecie)}</span></div>
    </div>
    <h4>Movimentação do caixa</h4><div class="caixa-resumo caixa-mov">${tabelaMov}</div>`;

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
  const pendentes = Number(data.pedidosAReceber) || 0; // pedidos do turno ainda a receber

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
      ${pendentes > 0 ? `
      <div class="fc-bloqueio">
        <div class="fc-bloqueio-txt">
          <strong>${pendentes} pedido${pendentes > 1 ? "s" : ""} com pagamento a receber.</strong>
          <span>Receba todos os pedidos do dia antes de fechar o caixa.</span>
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
        <button id="fcFechar"${pendentes > 0 ? " disabled" : ""}>Fechar caixa e imprimir →</button>
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
  $("fcAdd").addEventListener("click", () => {
    const forma = $("fcForma").value;
    const valor = window.Dinheiro ? Dinheiro.valor("fcValor") : 0;
    if (valor <= 0) { toast("Informe um valor maior que zero."); return; }
    lancamentos.push({ forma, valor });
    if (window.Dinheiro) Dinheiro.setValor("fcValor", 0); else $("fcValor").value = "0,00";
    renderLista(); recalcEletronico();
  });
  $("fcCancelar").addEventListener("click", () => carregarCaixa());
  $("fcFechar").addEventListener("click", () => {
    if (pendentes > 0) { toast("Receba todos os pedidos antes de fechar o caixa."); return; }
    fecharCaixaFinal(data, contagemAtual(), lancamentos);
  });
  if (pendentes > 0 && $("fcVerPedidos")) $("fcVerPedidos").addEventListener("click", irParaPedidosAReceber);

  renderLista(); recalcDinheiro(); recalcEletronico();
}

async function fecharCaixaFinal(data, contagem, lancamentos) {
  // O relatório é montado no SERVIDOR (fonte única e autoritativa); o front só
  // envia a conferência e recebe o texto pronto pra prévia/impressão.
  const r = await api("POST", "/api/caixa/fechar", { contagem, eletronico: lancamentos });
  if (!r || !r.ok) { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Falha ao fechar."); return; }
  const res = await r.json();
  const dif = res.diferenca;
  toast(dif === 0 ? "✓ Caixa fechado, bateu certinho!" : (dif > 0 ? "Caixa fechado. Sobra de R$ " + fmtBRn(dif) : "Caixa fechado. Falta de R$ " + fmtBRn(-dif)));
  if (res.relatorio && window.Impressao && window.Impressao.abrirRelatorio) {
    window.Impressao.abrirRelatorio("Relatório de fechamento", res.relatorio);
  }
  carregarCaixa();
}

async function verHistoricoCaixa() {
  const r = await api("GET", "/api/caixa/historico");
  if (!r || !r.ok) return;
  const lista = await r.json();
  const resultado = (c) => c.diferenca === 0 ? "ok" : (c.diferenca > 0 ? "sobra R$ " + fmtBRn(c.diferenca) : "falta R$ " + fmtBRn(-c.diferenca));
  const html = lista.length
    ? lista.map((c) => `<div class="caixa-hist-item" data-id="${c.id}"><span>${new Date(c.fechadoEm).toLocaleString("pt-BR")}</span><span>${resultado(c)}</span></div>`).join("")
    : "<p class='sub'>Nenhum caixa fechado ainda.</p>";
  const box = $("caixaConteudo");
  // Substitui (não empilha) a caixa de histórico a cada clique.
  let sec = box.querySelector("#caixaHistBox");
  if (!sec) { sec = document.createElement("div"); sec.id = "caixaHistBox"; sec.className = "caixa-resumo"; box.appendChild(sec); }
  sec.innerHTML = `<h4>Caixas anteriores</h4>${lista.length ? "<p class='sub'>Toque num fechamento para reabrir o relatório.</p>" : ""}${html}`;
  sec.querySelectorAll(".caixa-hist-item").forEach((el) => {
    const item = lista.find((c) => String(c.id) === el.dataset.id);
    el.addEventListener("click", () => {
      if (item && item.relatorio && window.Impressao && window.Impressao.abrirRelatorio) {
        window.Impressao.abrirRelatorio("Relatório — " + new Date(item.fechadoEm).toLocaleString("pt-BR"), item.relatorio);
      } else {
        toast("Relatório indisponível para este fechamento.");
      }
    });
  });
  sec.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

if ($("btnVerPlanosCaixa")) {
  $("btnVerPlanosCaixa").addEventListener("click", () => {
    const b = document.querySelector('.sidebar [data-aba="assinatura"]'); if (b) b.click();
  });
}

if ($("btnVerPlanos")) {
  $("btnVerPlanos").addEventListener("click", () => {
    const btnAssin = document.querySelector('.sidebar [data-aba="assinatura"]');
    if (btnAssin) btnAssin.click();
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

// ============================================================
// PEDIDOS
// ============================================================
let pedidosCache = [];
const filtros = { periodo: "hoje", tipo: "todos", busca: "", dataIni: "", dataFim: "", pagamento: "todos" };

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
    ? `<span class="tag tag-entrega"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg> Entrega</span>`
    : `<span class="tag tag-retirada"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> Retirada</span>`;
}

// Selo de pagamento (só Plano Completo): mostra se o pedido já foi recebido no caixa.
function seloPagamento(p) {
  if (planoAtual !== "completo") return "";
  return p.recebidoEm
    ? '<span class="selo-pag selo-pago">Recebido</span>'
    : '<span class="selo-pag selo-areceber">A receber</span>';
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
    lista = lista.filter((p) => filtros.pagamento === "recebidos" ? !!p.recebidoEm : !p.recebidoEm);
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

  // Desktop: tabela escaneável
  let tabela = `<table class="pedidos-tabela"><thead><tr>
    <th>Nº Pedido</th><th>Data/hora</th><th>Cliente</th><th>Telefone</th><th>Tipo</th><th class="col-total">Total</th>
    </tr></thead><tbody>`;
  pagina.forEach((p) => {
    const novo = pedidosNovosDestaque.has(p.numero) ? ' <span class="ped-novo">NOVO</span>' : "";
    tabela += `<tr class="pedido-linha${novo ? " pedido-linha-novo" : ""}" data-id="${p.id}">
      <td class="ped-num">#${p.numero}${novo}</td>
      <td>${escapar(dataHoraFmt(p.criadoEm))}</td>
      <td>${escapar(p.cliente)} ${seloPagamento(p)}</td>
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
    const novoC = pedidosNovosDestaque.has(p.numero) ? ' <span class="ped-novo">NOVO</span>' : "";
    cards += `<div class="pedido-card${novoC ? " pedido-card-novo" : ""}" data-id="${p.id}">
      <div class="pedido-card-topo">
        <span class="pedido-card-num">#${p.numero}${novoC} • ${hora}</span>
        ${tagTipo(p)}
      </div>
      <div class="pedido-card-cliente">${escapar(p.cliente)} ${seloPagamento(p)}</div>
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
      if (!p) return;
      if (pedidosNovosDestaque.delete(p.numero)) renderPedidos(); // visto → remove o "NOVO" na hora
      abrirModalPedido(p);
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
$("filtroPagamento").addEventListener("change", (e) => { filtros.pagamento = e.target.value; paginaPedidos = 1; renderPedidos(true); });
$("buscaPedido").addEventListener("input", (e) => { filtros.busca = e.target.value; paginaPedidos = 1; renderPedidos(); });

// Ícones neutros (Lucide) para o detalhe
const ICO_USER = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
const ICO_LOCAL = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const ICO_PAG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`;

function abrirModalPedido(p) {
  pedidoModalAtual = p;
  const btnImp = $("btnImprimirPedido");
  if (btnImp) btnImp.hidden = planoAtual !== "completo";
  $("pedido-numero").textContent = `Pedido #${p.numero}`;
  $("pedido-quando").textContent = new Date(p.criadoEm).toLocaleString("pt-BR");

  const taxa = p.taxaEntrega || 0;
  // Soma dos extras de um item: cada opcional conta a sua quantidade (ex.: 2x Ovo).
  const extrasDe = (i) => (i.opcionais || []).reduce((s, o) => s + (o.preco || 0) * (o.qtd || 1), 0);
  const subtotal = p.itens.reduce((acc, i) => acc + (i.preco + extrasDe(i)) * i.qtd, 0);

  // Itens como cards de leitura (qtd Nx, nome, opcionais como subitens, preço à direita)
  const itensHtml = p.itens.map((i) => {
    const sub = (i.preco + extrasDe(i)) * i.qtd;
    const opcHtml = (i.opcionais && i.opcionais.length)
      ? `<div class="ped-item-opc">${i.opcionais.map((o) => "+ " + (o.qtd > 1 ? o.qtd + "x " : "") + escapar(o.nome)).join("<br>")}</div>`
      : "";
    return `<div class="ped-item">
      <span class="ped-item-qtd">${escapar(String(i.qtd))}x</span>
      <div class="ped-item-info">
        <div class="ped-item-nome">${escapar(i.nome)}</div>
        ${opcHtml}
      </div>
      <span class="ped-item-preco">R$ ${moedaBR(sub)}</span>
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

  const tipoTag = p.tipoEntrega === "Entrega"
    ? `<span class="tag tag-entrega"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg> Entrega</span>`
    : `<span class="tag tag-retirada"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> Retirada</span>`;

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
  if (planoAtual === "completo") {
    if (p.recebidoEm) {
      const sel = document.createElement("span");
      sel.className = "pedido-avisado";
      sel.textContent = "Pagamento recebido";
      cont.appendChild(sel);
    } else {
      const extra = document.createElement("button");
      extra.className = "secundario";
      extra.textContent = "Receber pagamento (R$ " + fmtBRn(p.total) + ")";
      extra.addEventListener("click", async () => {
        const r = await api("POST", "/api/caixa/receber/" + p.id, { forma: p.pagamento || "Outros", valor: p.total });
        if (r && r.ok) { p.recebidoEm = new Date().toISOString(); toast("✓ Recebido no caixa!"); montarAcoes(p); carregarCaixa(); }
        else { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Abra o caixa primeiro."); }
      });
      cont.appendChild(extra);
    }
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
    if (pedidoModalAtual && window.Impressao) window.Impressao.abrirPreview(pedidoModalAtual, configAtual);
  });
}

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

async function inicial() {
  setTimeout(checarPedidoNovo, 3000);   // base do poll de notificação (logo após o boot)
  setInterval(checarPedidoNovo, 6000);  // poll a cada 6s — pedido novo aparece em ~6s (era 15s)
  carregarPedidos();   // Pedidos é a aba inicial (home)
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
// Boot: obtém a sessão pelo cookie (refresh) e só então carrega o painel.
iniciarSessao().then((ok) => { if (ok) inicial(); });
