const { safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");
const api = require("./api");

let sessao = { slug: "", nome: "" };

function arqRefresh() {
  const { app } = require("electron");
  return path.join(app.getPath("userData"), "refresh.bin");
}
function guardarRefresh(refresh) {
  try { fs.writeFileSync(arqRefresh(), safeStorage.encryptString(String(refresh || ""))); } catch (_) {}
}
function lerRefresh() {
  try { return safeStorage.decryptString(fs.readFileSync(arqRefresh())); } catch (_) { return ""; }
}
function limparRefresh() { try { fs.unlinkSync(arqRefresh()); } catch (_) {} }

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

function estaLogado() { return !!lerRefresh(); }
function dados() { return sessao; }
function sair() { limparRefresh(); api.setToken(""); sessao = { slug: "", nome: "" }; }

api.setRenovador(renovar);

module.exports = { login, renovar, estaLogado, dados, sair };
