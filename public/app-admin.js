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
// MODAL GENÉRICO DE CONFIRMAÇÃO (suspender / reativar)
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

let tenants = [];
let metricas = { totais: {}, porTenant: {} };

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
    renderTenants();
  } catch (e) {
    if (e.message !== "Sessão expirada") {
      $("am-lista").innerHTML = `<div class="estado-vazio"><p>Erro ao carregar restaurantes</p><p class="sub">${escapar(e.message)}</p></div>`;
    }
  }
}

function renderMetricas() {
  const t = metricas.totais || {};
  const card = (label, valor, sub) => `
    <div class="metrica-card">
      <span class="metrica-label">${label}</span>
      <span class="metrica-valor">${valor}</span>
      ${sub ? `<span class="metrica-subtitulo">${sub}</span>` : ""}
    </div>`;
  $("am-metricas").innerHTML =
    card("Restaurantes", t.restaurantes ?? 0, "cadastrados") +
    card("Ativos / Suspensos", `${t.ativos ?? 0} · ${t.suspensos ?? 0}`, "ativos · suspensos") +
    card("Pedidos no mês", t.pedidosMes ?? 0, "somando todos") +
    card("Conectados agora", t.conectados ?? 0, "no WhatsApp");
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
  const linhas = tenants.map((t) => {
    const ativo = !!t.ativo;
    const m = porTenant[t.slug] || {};
    const conectado = !!m.conectado;
    const statusPill = ativo
      ? `<span class="am-status ativo">Ativo</span>${conectado ? '<span class="bolinha on" title="Conectado ao WhatsApp"></span>' : ""}`
      : '<span class="am-status suspenso">Suspenso</span>';
    const acaoStatus = ativo
      ? `<button class="mini secundario" data-acao="suspender" data-slug="${escapar(t.slug)}">Suspender</button>`
      : `<button class="mini secundario" data-acao="reativar" data-slug="${escapar(t.slug)}">Reativar</button>`;
    return `
      <tr>
        <td data-label="Nome">${escapar(t.nome)}</td>
        <td data-label="E-mail">${escapar(t.email)}</td>
        <td data-label="Slug"><code class="am-slug">${escapar(t.slug)}</code></td>
        <td data-label="Status" class="am-col-status">${statusPill}</td>
        <td data-label="Pedidos no mês" class="am-col-pedidos">${m.pedidosMes ?? 0}</td>
        <td data-label="Criado em">${formatarData(t.criadoEm)}</td>
        <td data-label="Ações" class="am-acoes">
          ${acaoStatus}
          <button class="mini perigo" data-acao="excluir" data-slug="${escapar(t.slug)}">Excluir</button>
        </td>
      </tr>`;
  }).join("");

  lista.innerHTML = `
    <table class="am-tabela">
      <thead>
        <tr>
          <th>Nome</th><th>E-mail</th><th>Slug</th><th>Status</th><th>Pedidos no mês</th><th>Criado em</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>${linhas}</tbody>
    </table>`;

  lista.querySelectorAll("button[data-acao]").forEach((b) => {
    b.addEventListener("click", () => acaoTenant(b.dataset.acao, b.dataset.slug));
  });
}

// ============================================================
// AÇÕES POR TENANT
// ============================================================
function acaoTenant(acao, slug) {
  if (acao === "suspender")  return suspender(slug);
  if (acao === "reativar")   return reativar(slug);
  if (acao === "excluir")    return abrirExcluir(slug);
}

async function suspender(slug) {
  const ok = await confirmar(
    "Suspender restaurante",
    `O restaurante "${slug}" perderá acesso ao painel e o bot será desconectado na hora. Você pode reativar depois. Deseja suspender?`,
    "Suspender"
  );
  if (!ok) return;
  try {
    await apiAdmin("PATCH", `/api/admin/tenants/${encodeURIComponent(slug)}/suspender`);
    await carregarTenants(); // recarrega lista + métricas (ativos/suspensos/conectados mudam)
    toast("Restaurante suspenso.");
  } catch (e) {
    if (e.message !== "Sessão expirada") toast("Erro ao suspender.", "erro");
  }
}

async function reativar(slug) {
  try {
    await apiAdmin("PATCH", `/api/admin/tenants/${encodeURIComponent(slug)}/reativar`);
    await carregarTenants(); // recarrega lista + métricas
    toast("Restaurante reativado.");
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
  const overlay = $("del-overlay");
  overlay.style.display = "flex";
  overlay.classList.remove("saindo");
  setTimeout(() => $("del-input").focus(), 50);
}

function fecharExcluir() {
  const overlay = $("del-overlay");
  overlay.classList.add("saindo");
  overlay.addEventListener("animationend", () => {
    overlay.style.display = "none";
    overlay.classList.remove("saindo");
  }, { once: true });
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
  const overlay = $("criar-overlay");
  overlay.style.display = "flex";
  overlay.classList.remove("saindo");
  setTimeout(() => $("c-nome").focus(), 50);
}

function fecharCriar() {
  const overlay = $("criar-overlay");
  overlay.classList.add("saindo");
  overlay.addEventListener("animationend", () => {
    overlay.style.display = "none";
    overlay.classList.remove("saindo");
  }, { once: true });
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
// ABAS (Restaurantes / Configurações)
// ============================================================
let configCarregada = false;

function trocarAba(aba) {
  document.querySelectorAll(".am-tab").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === aba));
  document.querySelectorAll(".am-aba").forEach((s) => {
    const ativa = s.id === "aba-" + aba;
    s.classList.toggle("ativa", ativa);
    s.style.display = ativa ? "block" : "none";
  });
  if (aba === "config" && !configCarregada) {
    configCarregada = true;
    carregarBackups();
    carregarRunbook();
  }
}

// ============================================================
// BACKUP
// ============================================================
async function gerarBackup() {
  const btn = $("btnGerarBackup");
  btn.disabled = true;
  btn.textContent = "Gerando…";
  try {
    const r = await apiAdmin("POST", "/api/admin/backup/gerar");
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast(d.erro || "Erro ao gerar backup.", "erro");
      return;
    }
    await carregarBackups();
    toast("Backup gerado.");
  } catch (e) {
    if (e.message !== "Sessão expirada") toast("Erro ao gerar backup.", "erro");
  } finally {
    btn.disabled = false;
    btn.textContent = "Gerar backup agora";
  }
}

async function carregarBackups() {
  const alvo = $("am-backups-lista");
  try {
    const r = await apiAdmin("GET", "/api/admin/backup/listar");
    const lista = await r.json();
    renderBackups(lista);
  } catch (e) {
    if (e.message !== "Sessão expirada") {
      alvo.innerHTML = `<div class="estado-vazio"><p>Erro ao listar backups</p><p class="sub">${escapar(e.message)}</p></div>`;
    }
  }
}

function renderBackups(lista) {
  const alvo = $("am-backups-lista");
  if (!lista.length) {
    alvo.innerHTML = `
      <div class="estado-vazio">
        <p>Nenhum backup ainda</p>
        <p class="sub">Clique em "Gerar backup agora" para criar o primeiro.</p>
      </div>`;
    return;
  }
  const linhas = lista.map((b) => `
    <tr>
      <td data-label="Arquivo"><code class="am-slug">${escapar(b.nome)}</code></td>
      <td data-label="Tamanho">${formatarBytes(b.tamanho)}</td>
      <td data-label="Data">${formatarDataHora(b.data)}</td>
      <td data-label="" class="am-acoes">
        <button class="mini" data-baixar="${escapar(b.nome)}">Baixar</button>
      </td>
    </tr>`).join("");
  alvo.innerHTML = `
    <table class="am-tabela am-backups-tabela">
      <thead><tr><th>Arquivo</th><th>Tamanho</th><th>Data</th><th></th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>`;
  alvo.querySelectorAll("button[data-baixar]").forEach((b) => {
    b.addEventListener("click", () => baixarBackup(b.dataset.baixar, b));
  });
}

async function baixarBackup(nome, btn) {
  btn.disabled = true;
  btn.textContent = "Baixando…";
  try {
    // fetch autenticado (mantém o header Authorization) → blob → âncora de download.
    const r = await apiAdmin("GET", `/api/admin/backup/baixar/${encodeURIComponent(nome)}`);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast(d.erro || "Erro ao baixar.", "erro");
      return;
    }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    if (e.message !== "Sessão expirada") toast("Erro ao baixar.", "erro");
  } finally {
    btn.disabled = false;
    btn.textContent = "Baixar";
  }
}

async function carregarRunbook() {
  const alvo = $("am-runbook");
  try {
    const r = await apiAdmin("GET", "/api/admin/backup/restauracao-doc");
    const { markdown } = await r.json();
    alvo.innerHTML = renderMarkdown(markdown || "");
  } catch (e) {
    if (e.message !== "Sessão expirada") {
      alvo.innerHTML = "<p>Não foi possível carregar o passo a passo. Consulte o DEPLOY.md do projeto.</p>";
    }
  }
}

// ---- Helpers de formatação ----
function formatarBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatarDataHora(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ---- Renderizador de markdown mínimo (escapa HTML → sem XSS) ----
function inlineMd(s) {
  return escapar(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
function renderMarkdown(md) {
  const out = [];
  // Normaliza CRLF/CR → LF (o DEPLOY.md pode vir com quebras do Windows).
  const linhas = String(md).replace(/\r\n?/g, "\n").split("\n");
  let lista = null, quote = null;
  const flushLista = () => { if (lista) { out.push("<ul>" + lista.map((li) => `<li>${inlineMd(li)}</li>`).join("") + "</ul>"); lista = null; } };
  const flushQuote = () => { if (quote) { out.push("<blockquote>" + quote.map(inlineMd).join("<br>") + "</blockquote>"); quote = null; } };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (/^```/.test(linha)) {                 // bloco de código
      flushLista(); flushQuote();
      const code = [];
      i++;
      while (i < linhas.length && !/^```/.test(linhas[i])) { code.push(linhas[i]); i++; }
      out.push(`<pre><code>${escapar(code.join("\n"))}</code></pre>`);
      continue;
    }
    const h = linha.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushLista(); flushQuote(); const lvl = Math.min(h[1].length + 1, 6); out.push(`<h${lvl}>${inlineMd(h[2])}</h${lvl}>`); continue; }
    if (/^>\s?/.test(linha)) { flushLista(); (quote || (quote = [])).push(linha.replace(/^>\s?/, "")); continue; }
    if (/^[-*]\s+/.test(linha)) { flushQuote(); (lista || (lista = [])).push(linha.replace(/^[-*]\s+/, "")); continue; }
    if (/^\d+\.\s+/.test(linha)) { flushQuote(); (lista || (lista = [])).push(linha.replace(/^\d+\.\s+/, "")); continue; }
    if (linha.trim() === "") { flushLista(); flushQuote(); continue; }
    flushLista(); flushQuote(); out.push(`<p>${inlineMd(linha)}</p>`);
  }
  flushLista(); flushQuote();
  return out.join("\n");
}

// ============================================================
// BIND DE EVENTOS
// ============================================================
$("btnEntrar").addEventListener("click", entrar);
$("formLogin").addEventListener("submit", entrar);
$("btnSair").addEventListener("click", sair);
$("btnNovo").addEventListener("click", abrirCriar);
$("btnGerarBackup").addEventListener("click", gerarBackup);
document.querySelectorAll(".am-tab").forEach((b) => b.addEventListener("click", () => trocarAba(b.dataset.aba)));

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
