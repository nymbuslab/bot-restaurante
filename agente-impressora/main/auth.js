const { safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");
const api = require("./api");

let sessao = { slug: "", nome: "" };
let logadoCache = null; // null = ainda nao lido do disco; depois vira boolean (evita ler o disco a cada chamada)

function arqRefresh() {
  const { app } = require("electron");
  return path.join(app.getPath("userData"), "refresh.bin");
}
function guardarRefresh(refresh) {
  const v = String(refresh || "");
  logadoCache = !!v; // a sessão vale NESTA execução mesmo que não dê para persistir
  try {
    // Só grava se o SO tem cifra (Windows/DPAPI sempre tem). Sem cifra (ex.: Linux sem
    // keyring) NÃO gravamos em claro — a sessão fica só em memória (perde no restart), em
    // vez de estourar o encryptString e ser engolido silenciosamente pelo catch.
    if (safeStorage.isEncryptionAvailable()) fs.writeFileSync(arqRefresh(), safeStorage.encryptString(v));
  } catch (_) {}
}
function lerRefresh() {
  try { return safeStorage.decryptString(fs.readFileSync(arqRefresh())); } catch (_) { return ""; }
}
function limparRefresh() { try { fs.unlinkSync(arqRefresh()); } catch (_) {} logadoCache = false; }

async function login(apiBase, email, senha) {
  api.setBase(apiBase);
  const r = await api.post("/api/agente/login", { email, senha });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.erro || "Falha no login."); }
  const d = await r.json();
  api.setToken(d.token);
  guardarRefresh(d.refresh);
  sessao = { slug: d.slug || "", nome: d.nome || "" };
  return sessao;
}

async function renovar() {
  const refresh = lerRefresh();
  if (!refresh) return false;
  const r = await api.post("/api/agente/refresh", { refresh });
  if (!r.ok) { limparRefresh(); api.setToken(""); return false; }
  const d = await r.json();
  api.setToken(d.token);
  guardarRefresh(d.refresh);
  sessao = { slug: d.slug || sessao.slug, nome: d.nome || sessao.nome };
  return true;
}

function estaLogado() {
  if (logadoCache === null) logadoCache = !!lerRefresh(); // 1a vez: le do disco; depois usa o cache
  return logadoCache;
}
function dados() { return sessao; }
function sair() { limparRefresh(); api.setToken(""); sessao = { slug: "", nome: "" }; }

api.setRenovador(renovar);

module.exports = { login, renovar, estaLogado, dados, sair };
