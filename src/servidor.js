// ============================================================
// SERVIDOR WEB — painel administrativo + API multi-tenant
// ============================================================

const express = require("express");
const path = require("path");

const empresas = require("./empresas");
const store = require("./store");
const pedidos = require("./pedidos");
const multiBot = require("./multi-bot");
const { getSessao, resetSessao } = require("./sessoes");
const { processarMensagem } = require("./fluxo");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (_req, res) => res.redirect("/login.html"));

// ---- Autenticação ----
// token → { slug, tenantDir }
const tokens = new Map();

function gerarToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function exigeAuth(req, res, next) {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "");
  const info = tokens.get(token);
  if (!info) return res.status(401).json({ erro: "Não autorizado" });
  req.slug = info.slug;
  req.tenantDir = info.tenantDir;
  next();
}

// ---- Rotas públicas ----

app.post("/api/cadastro", (req, res) => {
  try {
    const { nome, email, senha } = req.body || {};
    if (!nome || !email || !senha) return res.status(400).json({ erro: "Preencha todos os campos." });
    if (senha.length < 6) return res.status(400).json({ erro: "Senha deve ter pelo menos 6 caracteres." });
    const empresa = empresas.cadastrar({ nome, email, senha });
    res.json({ ok: true, slug: empresa.slug, nome: empresa.nome });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.post("/api/login", (req, res) => {
  const { email, senha } = req.body || {};
  const empresa = empresas.autenticar(email, senha);
  if (!empresa) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
  const token = gerarToken();
  tokens.set(token, { slug: empresa.slug, tenantDir: empresas.tenantDir(empresa.slug) });
  res.json({ token, slug: empresa.slug, nome: empresa.nome });
});

app.post("/api/logout", (req, res) => {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "");
  tokens.delete(token);
  res.json({ ok: true });
});

app.get("/api/status", exigeAuth, (req, res) => {
  res.json(multiBot.getEstado(req.slug));
});

// ---- Bot ----

app.post("/api/bot/conectar", exigeAuth, (req, res) => {
  multiBot.iniciar(req.slug, req.tenantDir);
  res.json({ ok: true });
});

app.post("/api/bot/desconectar", exigeAuth, async (req, res) => {
  await multiBot.desconectar(req.slug);
  res.json({ ok: true });
});

app.post("/api/bot/resetar", exigeAuth, async (req, res) => {
  try {
    await multiBot.resetarSessao(req.slug, req.tenantDir);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ---- Config / Cardápio ----

app.get("/api/config", exigeAuth, (req, res) => {
  const config = store.getConfig(req.tenantDir);
  res.json({ ...config, admin: undefined });
});

app.put("/api/config", exigeAuth, (req, res) => {
  try {
    const atual = store.getConfig(req.tenantDir);
    const novo = req.body || {};
    novo.admin = (novo.admin && novo.admin.senha) ? novo.admin : atual.admin;
    store.setConfig(req.tenantDir, novo);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get("/api/cardapio", exigeAuth, (req, res) => {
  res.json(store.getCardapio(req.tenantDir));
});

app.put("/api/cardapio", exigeAuth, (req, res) => {
  try {
    store.setCardapio(req.tenantDir, req.body || { categorias: [] });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get("/api/pedidos", exigeAuth, (req, res) => {
  res.json(pedidos.lerTodos(req.tenantDir).reverse());
});

// ---- Simulador ----

app.get("/api/simulador/status", exigeAuth, (req, res) => {
  const sid = `sim:${req.slug}`;
  const s = getSessao(sid);
  res.json({ estado: s.estado, carrinho: s.carrinho });
});

app.post("/api/simulador/mensagem", exigeAuth, (req, res) => {
  const { mensagem } = req.body || {};
  if (!mensagem && mensagem !== "0") return res.status(400).json({ erro: "mensagem ausente" });
  const sid = `sim:${req.slug}`;
  const sessao = getSessao(sid);
  const resultado = processarMensagem(sid, String(mensagem), sessao, req.tenantDir);
  res.json({
    respostas: resultado.respostas || [],
    estado: sessao.estado,
    carrinho: sessao.carrinho,
  });
});

app.post("/api/simulador/reset", exigeAuth, (req, res) => {
  resetSessao(`sim:${req.slug}`);
  res.json({ ok: true });
});

function iniciar(porta) {
  app.listen(porta, () => {
    console.log("🌐 Painel disponível em http://localhost:" + porta);
  });
}

module.exports = { iniciar };
