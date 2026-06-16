// ============================================================
// PAINEL MASTER (super-admin) — front-end
//
// Totalmente separado do painel de restaurante (app.js):
//   - Token guardado em sessionStorage["tokenAdmin"] (chave própria,
//     nunca colide com o "token" do restaurante).
//   - sessionStorage é INTENCIONAL: a sessão master expira ao fechar
//     a aba/navegador → o super-admin redigita a senha a cada sessão.
//     Não "lembra" a sessão master indefinidamente (escolha de segurança).
// ============================================================

const TKEY = "tokenAdmin";
const $ = (id) => document.getElementById(id);

// ---- Helper de API (sempre com o token master) ----
async function apiAdmin(metodo, url, corpo) {
  const opc = {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + (sessionStorage.getItem(TKEY) || ""),
    },
  };
  if (corpo) opc.body = JSON.stringify(corpo);
  const r = await fetch(url, opc);
  if (r.status === 401) {
    // Sessão master expirou/inválida → volta ao login.
    sessionStorage.removeItem(TKEY);
    mostrarLogin();
    throw new Error("Sessão expirada");
  }
  return r;
}

// ============================================================
// TOAST
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

// ============================================================
// MODAL GENÉRICO DE CONFIRMAÇÃO (suspender / reativar / cortesia / cancelar)
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
// TROCA DE VIEWS
// ============================================================
function mostrarLogin() {
  $("view-dash").style.display = "none";
  $("view-login").style.display = "flex";
  const s = $("senha");
  if (s) s.value = "";
}

function mostrarDash() {
  $("view-login").style.display = "none";
  $("view-dash").style.display = "block";
  carregarTenants();
}

// Troca de aba na sidebar (Dashboard / Clientes / Configurações Master).
function trocarAba(aba) {
  document.querySelectorAll("#view-dash nav button[data-aba]").forEach((b) =>
    b.classList.toggle("ativo", b.dataset.aba === aba));
  document.querySelectorAll("#view-dash .aba").forEach((s) =>
    s.classList.toggle("ativa", s.id === "aba-" + aba));
  if (aba === "config" && !plataformaCarregada) carregarPlataforma();
}

// ============================================================
// LOGIN MASTER
// ============================================================
function toggleSenha(inputId, btnId) {
  const inp = $(inputId);
  const isHidden = inp.type === "password";
  inp.type = isHidden ? "text" : "password";
  $(btnId + "-icon").innerHTML = isHidden
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

async function entrar() {
  const btn  = $("btnEntrar");
  const erro = $("erro");
  erro.textContent = "";
  const email = $("email").value.trim();
  const senha = $("senha").value;
  if (!email || !senha) { erro.textContent = "Preencha e-mail e senha."; return; }

  btn.disabled = true;
  btn.textContent = "Entrando...";

  try {
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha }),
    });
    if (r.status === 503) {
      erro.textContent = "Painel master não configurado no servidor.";
      return;
    }
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      erro.textContent = d.erro || "E-mail ou senha incorretos.";
      return;
    }
    const { token } = await r.json();
    sessionStorage.setItem(TKEY, token);
    mostrarDash();
  } catch (e) {
    erro.textContent = "Erro ao conectar ao servidor.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
}

async function sair() {
  try { await apiAdmin("POST", "/api/admin/logout"); } catch (e) { /* ignora */ }
  sessionStorage.removeItem(TKEY);
  mostrarLogin();
}

// ============================================================
// LISTAGEM DE TENANTS
// ============================================================
function escapar(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatarData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtMoeda(valor, moeda = "BRL") {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda }).format(valor || 0);
  } catch (_) {
    return `R$ ${(valor || 0).toFixed(2).replace(".", ",")}`;
  }
}

let tenants = [];
let metricas = { totais: {}, porTenant: {} };
let filtroStatus = "todos";

// Dias restantes até uma data ISO (>= 0), ou null.
function diasAte(iso) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return d < 0 ? 0 : d;
}

// Badge de plano/assinatura por status → [rótulo, classe do .assin-badge].
const PLANO_MAP = {
  trialing: ["Teste", "trial"],
  active:   ["Pagante", "ok"],
  cortesia: ["Cortesia", "cortesia"],
  past_due: ["Em atraso", "alerta"],
  canceled: ["Cancelada", "alerta"],
  nenhuma:  ["Sem assinatura", "neutro"],
};

function planoBadge(status) {
  const [txt, cls] = PLANO_MAP[status] || PLANO_MAP.nenhuma;
  return `<span class="assin-badge ${cls}">${txt}</span>`;
}

// Célula "Plano" da tabela: badge + subtexto (dias de trial / próxima cobrança).
function planoCelula(t) {
  const st = t.assinaturaStatus || "nenhuma";
  let sub = "";
  if (st === "trialing") { const d = diasAte(t.trialAte); sub = d != null ? `${d}d restantes` : ""; }
  else if (st === "active" && t.proximaCobranca) { sub = `renova ${formatarData(t.proximaCobranca)}`; }
  else if (st === "cortesia") { sub = "acesso manual"; }
  return `${planoBadge(st)}${sub ? `<span class="am-plano-sub">${sub}</span>` : ""}`;
}

async function carregarTenants() {
  try {
    // Lista e métricas em paralelo (ambas sob exigeSuperAdmin).
    const [rt, rm] = await Promise.all([
      apiAdmin("GET", "/api/admin/tenants"),
      apiAdmin("GET", "/api/admin/metrics"),
    ]);
    tenants = await rt.json();
    metricas = await rm.json();
    renderMetricas();
    renderUltimos();
    renderTenants();
  } catch (e) {
    if (e.message !== "Sessão expirada") {
      $("am-lista").innerHTML = `<div class="estado-vazio"><p>Erro ao carregar restaurantes</p><p class="sub">${escapar(e.message)}</p></div>`;
    }
  }
}

// Ícones (SVG) das métricas hero.
const ICO = {
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  teste: '<path d="M9 2v6l-5 9a2 2 0 0 0 1.8 3h12.4a2 2 0 0 0 1.8-3l-5-9V2"/><path d="M7 2h10"/>',
  assin: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  alerta: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
};

function renderMetricas() {
  const t = metricas.totais || {};
  // 4 cards "hero" (ícone + rótulo + número), como o protótipo.
  const hero = (ico, label, valor, cls = "") => `
    <div class="am-hero-card ${cls}">
      <span class="am-hero-ico"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico}</svg></span>
      <span class="am-hero-label">${label}</span>
      <span class="am-hero-valor">${(valor ?? 0).toLocaleString("pt-BR")}</span>
    </div>`;
  $("am-metricas").innerHTML =
    hero(ICO.users, "Clientes ativos", t.ativos) +
    hero(ICO.teste, "Em teste", t.trial) +
    hero(ICO.assin, "Assinantes", t.pagantes) +
    hero(ICO.alerta, "Cancelados", t.cancelados, "alerta");

  // Faixa secundária: demais métricas reais úteis (sem perder informação).
  const sec = (label, valor, cls = "") => `
    <div class="metrica-card am-sec-card ${cls}">
      <span class="metrica-label">${label}</span>
      <span class="metrica-valor">${(valor ?? 0).toLocaleString("pt-BR")}</span>
    </div>`;
  const atrasoCls = (t.atraso ?? 0) > 0 ? "am-metrica-alerta" : "";
  $("am-metricas-sec").innerHTML =
    sec("Cortesia", t.cortesia) +
    sec("Em atraso", t.atraso, atrasoCls) +
    sec("Pedidos no mês", t.pedidosMes) +
    sec("Conectados", t.conectados);
}

// Iniciais para o avatar neutro (sem foto de rosto).
function iniciais(nome) {
  const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

// "Últimos Clientes Cadastrados": top 5 por data de cadastro (desc).
function renderUltimos() {
  const cont = $("am-ultimos");
  if (!cont) return;
  if (!tenants.length) {
    cont.innerHTML = `<div class="estado-vazio"><p>Nenhum cliente ainda</p><p class="sub">Os últimos cadastros aparecem aqui.</p></div>`;
    return;
  }
  const recentes = [...tenants]
    .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0))
    .slice(0, 5);
  const linhas = recentes.map((t) => {
    const st = t.assinaturaStatus || "nenhuma";
    return `
      <tr>
        <td data-label="Cliente">
          <div class="am-cliente">
            <span class="am-avatar">${escapar(iniciais(t.nome))}</span>
            <div class="am-cliente-txt">
              <span class="am-cliente-nome">${escapar(t.nome)}</span>
              <span class="am-cliente-email">${escapar(t.email)}</span>
            </div>
          </div>
        </td>
        <td data-label="Status" class="am-col-status">${planoBadge(st)}</td>
        <td data-label="Cadastro">${formatarData(t.criadoEm)}</td>
        <td data-label="Ações" class="am-acoes">
          <button class="am-olho" data-gerenciar="${escapar(t.slug)}" aria-label="Ver / gerenciar" title="Ver / gerenciar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </td>
      </tr>`;
  }).join("");
  cont.innerHTML = `
    <table class="am-tabela am-ultimos-tabela">
      <thead><tr><th>Cliente</th><th>Status</th><th>Data de Cadastro</th><th>Ações</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
  cont.querySelectorAll("button[data-gerenciar]").forEach((b) =>
    b.addEventListener("click", () => abrirGerenciar(b.dataset.gerenciar)));
}

function renderTenants() {
  const lista = $("am-lista");
  const ativos = tenants.filter((t) => t.ativo).length;
  $("am-contagem").textContent =
    tenants.length === 0
      ? "Nenhum restaurante cadastrado"
      : `${tenants.length} restaurante${tenants.length > 1 ? "s" : ""} · ${ativos} ativo${ativos !== 1 ? "s" : ""}`;

  if (tenants.length === 0) {
    lista.innerHTML = `
      <div class="estado-vazio">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18M3 9l1.5-5h15L21 9M4 9v11h16V9"/><path d="M9 13h6"/></svg>
        <p>Nenhum restaurante ainda</p>
        <p class="sub">Clique em "Novo restaurante" para cadastrar o primeiro.</p>
      </div>`;
    return;
  }

  const porTenant = metricas.porTenant || {};
  const visiveis = filtroStatus === "todos"
    ? tenants
    : tenants.filter((t) => (t.assinaturaStatus || "nenhuma") === filtroStatus);

  const linhas = visiveis.map((t) => {
    const ativo = !!t.ativo;
    const m = porTenant[t.slug] || {};
    const conectado = !!m.conectado;
    const statusPill = ativo
      ? `<span class="am-status ativo">Ativo</span>${conectado ? '<span class="bolinha on" title="Conectado ao WhatsApp"></span>' : ""}`
      : '<span class="am-status suspenso">Suspenso</span>';
    return `
      <tr>
        <td data-label="Nome">${escapar(t.nome)}</td>
        <td data-label="E-mail">${escapar(t.email)}</td>
        <td data-label="Plano" class="am-col-plano">${planoCelula(t)}</td>
        <td data-label="Status" class="am-col-status">${statusPill}</td>
        <td data-label="Pedidos no mês" class="am-col-pedidos">${m.pedidosMes ?? 0}</td>
        <td data-label="Criado em">${formatarData(t.criadoEm)}</td>
        <td data-label="Ações" class="am-acoes">
          <button class="mini" data-gerenciar="${escapar(t.slug)}">Gerenciar</button>
        </td>
      </tr>`;
  }).join("");

  const corpo = visiveis.length
    ? linhas
    : `<tr><td colspan="7" class="am-vazio-filtro">Nenhum restaurante com esse status.</td></tr>`;

  lista.innerHTML = `
    <table class="am-tabela">
      <thead>
        <tr>
          <th>Nome</th><th>E-mail</th><th>Plano</th><th>Status</th><th>Pedidos no mês</th><th>Criado em</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>${corpo}</tbody>
    </table>`;

  lista.querySelectorAll("button[data-gerenciar]").forEach((b) => {
    b.addEventListener("click", () => abrirGerenciar(b.dataset.gerenciar));
  });
}

// ============================================================
// MODAL DE GESTÃO DE UM RESTAURANTE (assinatura + ações + faturas)
// ============================================================
let tenantAtual = null; // slug do restaurante aberto no modal

function abrirOverlay(id) {
  const ov = $(id);
  ov.style.display = "flex";
  ov.classList.remove("saindo");
}
function fecharOverlay(id) {
  const ov = $(id);
  ov.classList.add("saindo");
  ov.addEventListener("animationend", () => {
    ov.style.display = "none";
    ov.classList.remove("saindo");
  }, { once: true });
}

async function abrirGerenciar(slug) {
  tenantAtual = slug;
  $("am-t-nome").textContent = "Carregando…";
  $("am-t-slug").textContent = slug;
  $("am-t-email").textContent = "";
  $("am-tenant-corpo").innerHTML = `<div class="estado-vazio"><p class="sub">Carregando…</p></div>`;
  abrirOverlay("tenant-overlay");
  await recarregarGerenciar();
}

async function recarregarGerenciar() {
  const slug = tenantAtual;
  if (!slug) return;
  try {
    const r = await apiAdmin("GET", `/api/admin/tenants/${encodeURIComponent(slug)}/assinatura`);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      $("am-tenant-corpo").innerHTML = `<div class="estado-vazio"><p>${escapar(d.erro || "Erro ao carregar.")}</p></div>`;
      return;
    }
    renderTenantModal(await r.json());
  } catch (e) {
    if (e.message !== "Sessão expirada") {
      $("am-tenant-corpo").innerHTML = `<div class="estado-vazio"><p>Erro ao carregar os dados.</p></div>`;
    }
  }
}

// Badge de status de uma fatura do Stripe.
function faturaBadge(status) {
  const map = {
    paid:          ["Pago", "ok"],
    open:          ["Em aberto", "trial"],
    void:          ["Cancelada", "neutro"],
    uncollectible: ["Não pago", "alerta"],
    draft:         ["Rascunho", "neutro"],
  };
  const [txt, cls] = map[status] || [status || "—", "neutro"];
  return `<span class="assin-badge ${cls}">${txt}</span>`;
}

function renderFaturas(d) {
  if (!d.stripeConfigurado) {
    return `<p class="sub am-t-vazio">Stripe não está configurado no servidor.</p>`;
  }
  if (!d.temCustomerStripe) {
    return `<p class="sub am-t-vazio">Este restaurante ainda não tem cadastro de pagamento no Stripe.</p>`;
  }
  if (!d.faturas || !d.faturas.length) {
    return `<p class="sub am-t-vazio">Nenhuma fatura emitida ainda.</p>`;
  }
  const linhas = d.faturas.map((f) => {
    const link = f.url
      ? `<a href="${escapar(f.url)}" target="_blank" rel="noopener" class="am-fatura-link">Ver fatura</a>`
      : (f.pdf ? `<a href="${escapar(f.pdf)}" target="_blank" rel="noopener" class="am-fatura-link">PDF</a>` : "—");
    return `
      <tr>
        <td data-label="Data">${formatarData(f.data)}</td>
        <td data-label="Valor">${fmtMoeda(f.valor, f.moeda)}</td>
        <td data-label="Situação">${faturaBadge(f.status)}</td>
        <td data-label="" class="am-fatura-acao">${link}</td>
      </tr>`;
  }).join("");
  return `
    <table class="am-tabela am-faturas-tabela">
      <thead><tr><th>Data</th><th>Valor</th><th>Situação</th><th></th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
}

function renderTenantModal(d) {
  $("am-t-nome").textContent = d.nome || "—";
  $("am-t-slug").textContent = d.slug || "";
  $("am-t-email").textContent = d.email || "";

  const st = d.assinaturaStatus || "nenhuma";

  // Linha de detalhe da assinatura (trial / próxima cobrança).
  let detalheAssin = "";
  if (st === "trialing") {
    const dias = diasAte(d.trialAte);
    detalheAssin = `Teste grátis${dias != null ? ` · ${dias} dia${dias !== 1 ? "s" : ""} restante${dias !== 1 ? "s" : ""}` : ""} (até ${formatarData(d.trialAte)})`;
  } else if (st === "active") {
    detalheAssin = d.proximaCobranca ? `Próxima cobrança em ${formatarData(d.proximaCobranca)}` : "Assinatura ativa";
  } else if (st === "cortesia") {
    detalheAssin = "Acesso liberado manualmente (sem cobrança).";
  } else if (st === "past_due") {
    detalheAssin = "Pagamento pendente — acesso bloqueado.";
  } else if (st === "canceled") {
    detalheAssin = "Assinatura cancelada — sem acesso.";
  } else {
    detalheAssin = "Nunca iniciou uma assinatura.";
  }

  const situacaoPill = d.ativo
    ? `<span class="am-status ativo">Ativo</span>`
    : `<span class="am-status suspenso">Suspenso</span>`;
  const conexaoTxt = d.conectado
    ? `<span class="am-t-conectado"><span class="bolinha on"></span> Conectado</span>`
    : `<span class="am-t-conectado"><span class="bolinha off"></span> Desconectado</span>`;

  // Resumo (label/valor).
  const resumo = `
    <div class="am-t-resumo">
      <div class="am-t-linha">
        <span class="am-t-rotulo">Assinatura</span>
        <span class="am-t-valor">${planoBadge(st)}</span>
      </div>
      <div class="am-t-linha">
        <span class="am-t-rotulo">Detalhe</span>
        <span class="am-t-valor am-t-detalhe">${escapar(detalheAssin)}</span>
      </div>
      <div class="am-t-linha">
        <span class="am-t-rotulo">Situação</span>
        <span class="am-t-valor">${situacaoPill}</span>
      </div>
      <div class="am-t-linha">
        <span class="am-t-rotulo">WhatsApp</span>
        <span class="am-t-valor">${conexaoTxt}</span>
      </div>
      <div class="am-t-linha">
        <span class="am-t-rotulo">Criado em</span>
        <span class="am-t-valor">${formatarData(d.criadoEm)}</span>
      </div>
    </div>`;

  // Ações disponíveis.
  const botoes = [];
  if (st === "cortesia") {
    botoes.push(`<button class="secundario mini" data-acao="revogar">Revogar cortesia</button>`);
  } else {
    botoes.push(`<button class="secundario mini" data-acao="cortesia">Liberar acesso (cortesia)</button>`);
  }
  if (d.temAssinaturaStripe && ["trialing", "active", "past_due"].includes(st)) {
    botoes.push(`<button class="secundario mini" data-acao="cancelar">Cancelar assinatura</button>`);
  }
  if (d.ativo) {
    botoes.push(`<button class="secundario mini" data-acao="suspender">Suspender</button>`);
  } else {
    botoes.push(`<button class="secundario mini" data-acao="reativar">Reativar</button>`);
  }
  botoes.push(`<button class="perigo mini" data-acao="excluir">Excluir</button>`);

  const acoes = `
    <div class="am-t-secao">
      <h4 class="am-t-secao-titulo">Ações</h4>
      <div class="am-t-acoes">${botoes.join("")}</div>
    </div>`;

  const faturas = `
    <div class="am-t-secao">
      <h4 class="am-t-secao-titulo">Histórico de pagamentos</h4>
      ${renderFaturas(d)}
    </div>`;

  $("am-tenant-corpo").innerHTML = resumo + acoes + faturas;

  $("am-tenant-corpo").querySelectorAll("button[data-acao]").forEach((b) => {
    b.addEventListener("click", () => acaoGerenciar(b.dataset.acao));
  });
}

// Despacha as ações do modal de gestão.
async function acaoGerenciar(acao) {
  const slug = tenantAtual;
  if (!slug) return;
  if (acao === "cortesia")  return liberarCortesia(slug);
  if (acao === "revogar")   return revogarCortesia(slug);
  if (acao === "cancelar")  return cancelarAssinatura(slug);
  if (acao === "suspender") return suspender(slug);
  if (acao === "reativar")  return reativar(slug);
  if (acao === "excluir")   return abrirExcluir(slug);
}

// Após uma ação: recarrega o modal e a lista (em segundo plano).
async function aposAcaoTenant() {
  await recarregarGerenciar();
  carregarTenants();
}

async function liberarCortesia(slug) {
  try {
    await apiAdmin("PATCH", `/api/admin/tenants/${encodeURIComponent(slug)}/assinatura/cortesia`);
    toast("Acesso de cortesia liberado.");
    await aposAcaoTenant();
  } catch (e) {
    if (e.message !== "Sessão expirada") toast("Erro ao liberar acesso.", "erro");
  }
}

async function revogarCortesia(slug) {
  const ok = await confirmar(
    "Revogar cortesia",
    `O restaurante "${slug}" perderá o acesso e o bot será desconectado. Ele precisará assinar para voltar a usar. Deseja revogar?`,
    "Revogar"
  );
  if (!ok) return;
  try {
    await apiAdmin("PATCH", `/api/admin/tenants/${encodeURIComponent(slug)}/assinatura/revogar`);
    toast("Cortesia revogada.");
    await aposAcaoTenant();
  } catch (e) {
    if (e.message !== "Sessão expirada") toast("Erro ao revogar.", "erro");
  }
}

async function cancelarAssinatura(slug) {
  const ok = await confirmar(
    "Cancelar assinatura",
    `Isto cancela a assinatura de "${slug}" no Stripe imediatamente. O acesso é bloqueado e o bot desconectado. Deseja cancelar?`,
    "Cancelar assinatura"
  );
  if (!ok) return;
  try {
    const r = await apiAdmin("PATCH", `/api/admin/tenants/${encodeURIComponent(slug)}/assinatura/cancelar`);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast(d.erro || "Erro ao cancelar.", "erro");
      return;
    }
    toast("Assinatura cancelada no Stripe.");
    await aposAcaoTenant();
  } catch (e) {
    if (e.message !== "Sessão expirada") toast("Erro ao cancelar.", "erro");
  }
}

function fecharGerenciar() {
  tenantAtual = null;
  fecharOverlay("tenant-overlay");
}

// ============================================================
// AÇÕES DE STATUS (ativo) — chamadas pelo modal de gestão
// ============================================================
async function suspender(slug) {
  const ok = await confirmar(
    "Suspender restaurante",
    `O restaurante "${slug}" perderá acesso ao painel e o bot será desconectado na hora. Se houver assinatura ativa, a cobrança será pausada no Stripe. Você pode reativar depois. Deseja suspender?`,
    "Suspender"
  );
  if (!ok) return;
  try {
    const r = await apiAdmin("PATCH", `/api/admin/tenants/${encodeURIComponent(slug)}/suspender`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.erro || "Erro ao suspender.", "erro"); return; }
    toast("Restaurante suspenso.");
    if (d.avisoStripe) toast(d.avisoStripe, "erro");
    await aposAcaoTenant();
  } catch (e) {
    if (e.message !== "Sessão expirada") toast("Erro ao suspender.", "erro");
  }
}

async function reativar(slug) {
  try {
    const r = await apiAdmin("PATCH", `/api/admin/tenants/${encodeURIComponent(slug)}/reativar`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast(d.erro || "Erro ao reativar.", "erro"); return; }
    toast("Restaurante reativado.");
    if (d.avisoStripe) toast(d.avisoStripe, "erro");
    await aposAcaoTenant();
  } catch (e) {
    if (e.message !== "Sessão expirada") toast("Erro ao reativar.", "erro");
  }
}

// ---- Exclusão forte (digitar o slug) ----
let delSlugAlvo = "";

function abrirExcluir(slug) {
  delSlugAlvo = slug;
  $("del-slug").textContent = slug;
  $("del-input").value = "";
  $("del-confirmar").disabled = true;
  abrirOverlay("del-overlay");
  setTimeout(() => $("del-input").focus(), 50);
}

function fecharExcluir() {
  fecharOverlay("del-overlay");
}

async function confirmarExcluir() {
  const slug = delSlugAlvo;
  if ($("del-input").value !== slug) return; // trava de UI
  $("del-confirmar").disabled = true;
  try {
    const r = await apiAdmin("DELETE", `/api/admin/tenants/${encodeURIComponent(slug)}`, { confirmacao: slug });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast(d.erro || "Erro ao excluir.", "erro");
      return;
    }
    fecharExcluir();
    fecharGerenciar(); // o restaurante deixou de existir → fecha o modal de gestão
    await carregarTenants(); // recarrega lista + métricas
    toast("Restaurante excluído.");
  } catch (e) {
    if (e.message !== "Sessão expirada") toast("Erro ao excluir.", "erro");
  }
}

// ---- Criação de restaurante ----
function abrirCriar() {
  $("c-nome").value = "";
  $("c-email").value = "";
  $("c-senha").value = "";
  $("c-erro").textContent = "";
  abrirOverlay("criar-overlay");
  setTimeout(() => $("c-nome").focus(), 50);
}

function fecharCriar() {
  fecharOverlay("criar-overlay");
}

async function confirmarCriar() {
  const erro = $("c-erro");
  erro.textContent = "";
  const nome  = $("c-nome").value.trim();
  const email = $("c-email").value.trim();
  const senha = $("c-senha").value;
  if (!nome || !email || !senha) { erro.textContent = "Preencha todos os campos."; return; }
  if (senha.length < 6) { erro.textContent = "Senha deve ter pelo menos 6 caracteres."; return; }

  const btn = $("criar-confirmar");
  btn.disabled = true;
  btn.textContent = "Criando...";
  try {
    const r = await apiAdmin("POST", "/api/admin/tenants", { nome, email, senha });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      erro.textContent = d.erro || "Erro ao criar restaurante.";
      return;
    }
    fecharCriar();
    toast("Restaurante criado.");
    carregarTenants();
  } catch (e) {
    if (e.message !== "Sessão expirada") erro.textContent = "Erro ao conectar ao servidor.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Criar restaurante";
  }
}

// ============================================================
// EXPORTAR CSV (clientes)
// ============================================================
function exportarCSV() {
  if (!tenants.length) { toast("Nenhum cliente para exportar.", "erro"); return; }
  const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const cab = ["Nome", "E-mail", "Plano", "Ativo", "Cadastro"];
  const linhas = tenants.map((t) => {
    const [plano] = PLANO_MAP[t.assinaturaStatus || "nenhuma"] || PLANO_MAP.nenhuma;
    return [t.nome, t.email, plano, t.ativo ? "Sim" : "Suspenso", formatarData(t.criadoEm)].map(esc).join(";");
  });
  const csv = "﻿" + [cab.map(esc).join(";"), ...linhas].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "clientes-nymbus.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ============================================================
// CONFIGURAÇÕES MASTER (aba Nymbus — dados da plataforma)
// ============================================================
let plataformaCarregada = false;

// Máscara de CNPJ (00.000.000/0000-00) — só visual, opcional.
function mascararCNPJ(v) {
  const d = String(v || "").replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

async function carregarPlataforma() {
  try {
    const r = await apiAdmin("GET", "/api/admin/plataforma");
    if (!r.ok) return;
    const d = await r.json();
    $("cfg-razao").value = d.razaoSocial || "";
    $("cfg-fantasia").value = d.nomeFantasia || "";
    $("cfg-cnpj").value = d.cnpj ? mascararCNPJ(d.cnpj) : "";
    $("cfg-endereco").value = d.endereco || "";
    $("cfg-telefone").value = d.telefone || "";
    $("cfg-facebook").value = d.facebook || "";
    $("cfg-instagram").value = d.instagram || "";
    const wa = $("cfg-suporte-wa");
    wa.value = d.suporteWhatsapp || "";
    wa.placeholder = d.envFallback ? `Herdado do servidor: ${d.envFallback}` : "Ex.: 5511999999999 (com DDI e DDD)";
    $("acc-email").value = d.masterEmail || "";
    plataformaCarregada = true;
  } catch (e) { /* sessão expirada já tratada */ }
}

async function salvarPlataforma() {
  const btn = $("btnSalvarPlataforma");
  const aviso = $("cfg-plat-aviso");
  aviso.textContent = ""; aviso.className = "aviso";
  btn.disabled = true; btn.textContent = "Salvando...";
  try {
    const r = await apiAdmin("PUT", "/api/admin/plataforma", {
      razaoSocial: $("cfg-razao").value,
      nomeFantasia: $("cfg-fantasia").value,
      cnpj: $("cfg-cnpj").value,
      endereco: $("cfg-endereco").value,
      telefone: $("cfg-telefone").value,
      facebook: $("cfg-facebook").value,
      instagram: $("cfg-instagram").value,
      suporteWhatsapp: $("cfg-suporte-wa").value,
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { toast("✓ Dados da plataforma salvos!"); }
    else { aviso.textContent = d.erro || "Não foi possível salvar."; aviso.className = "aviso erro"; }
  } catch (e) {
    if (e.message !== "Sessão expirada") { aviso.textContent = "Erro ao conectar."; aviso.className = "aviso erro"; }
  } finally {
    btn.disabled = false; btn.textContent = "Salvar dados da plataforma";
  }
}

async function salvarAcessoMaster() {
  const btn = $("btnSalvarAcesso");
  const aviso = $("acc-aviso");
  aviso.textContent = ""; aviso.className = "aviso";
  const email = $("acc-email").value.trim();
  const novaSenha = $("acc-nova").value;
  const senhaAtual = $("acc-atual").value;
  if (!senhaAtual) { aviso.textContent = "Informe a senha atual."; aviso.className = "aviso erro"; return; }
  if (!email && !novaSenha) { aviso.textContent = "Nada para alterar."; aviso.className = "aviso erro"; return; }
  btn.disabled = true; btn.textContent = "Salvando...";
  try {
    const r = await apiAdmin("PATCH", "/api/admin/conta", { email, novaSenha, senhaAtual });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      $("acc-nova").value = ""; $("acc-atual").value = "";
      if (d.email) $("acc-email").value = d.email;
      toast("✓ Acesso atualizado!");
    } else { aviso.textContent = d.erro || "Não foi possível alterar."; aviso.className = "aviso erro"; }
  } catch (e) {
    if (e.message !== "Sessão expirada") { aviso.textContent = "Erro ao conectar."; aviso.className = "aviso erro"; }
  } finally {
    btn.disabled = false; btn.textContent = "Salvar acesso";
  }
}

// ============================================================
// BIND DE EVENTOS
// ============================================================
$("btnEntrar").addEventListener("click", entrar);
$("formLogin").addEventListener("submit", entrar);
$("btnSair").addEventListener("click", sair);
$("btnSairTopo").addEventListener("click", sair);
$("btnNovo").addEventListener("click", abrirCriar);
$("am-filtro-status").addEventListener("change", (e) => { filtroStatus = e.target.value; renderTenants(); });
$("btnExportar").addEventListener("click", exportarCSV);
$("btnVerTodos").addEventListener("click", () => trocarAba("restaurantes"));
$("btnSalvarPlataforma").addEventListener("click", salvarPlataforma);
$("formAcessoMaster").addEventListener("submit", salvarAcessoMaster);
$("cfg-cnpj").addEventListener("input", (e) => { e.target.value = mascararCNPJ(e.target.value); });

// Navegação por abas (sidebar)
document.querySelectorAll("#view-dash nav button[data-aba]").forEach((b) => {
  b.addEventListener("click", () => trocarAba(b.dataset.aba));
});

// Modal de gestão por tenant
$("am-t-fechar").addEventListener("click", fecharGerenciar);
$("tenant-overlay").addEventListener("click", (e) => {
  if (e.target === $("tenant-overlay")) fecharGerenciar();
});

$("del-cancelar").addEventListener("click", fecharExcluir);
$("del-confirmar").addEventListener("click", confirmarExcluir);
$("del-input").addEventListener("input", () => {
  $("del-confirmar").disabled = $("del-input").value !== delSlugAlvo;
});

$("criar-cancelar").addEventListener("click", fecharCriar);
$("criar-confirmar").addEventListener("click", confirmarCriar);
$("formCriar").addEventListener("submit", confirmarCriar);

// ============================================================
// BOOT: tem token master? → dashboard. Senão → login.
// ============================================================
if (sessionStorage.getItem(TKEY)) {
  mostrarDash();
} else {
  mostrarLogin();
}
