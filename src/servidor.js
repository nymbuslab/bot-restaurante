// ============================================================
// SERVIDOR WEB — painel administrativo + API
// - Serve os arquivos do painel (pasta /public)
// - API REST para editar cardápio, configurações e ver pedidos
// - Login simples por senha (token em memória)
// ============================================================

const express = require("express");
const path = require("path");

const estado = require("./estado");
const store = require("./store");
const pedidos = require("./pedidos");
const bot = require("./bot");
const { getSessao, resetSessao } = require("./sessoes");
const { processarMensagem } = require("./fluxo");

const SIMULADOR_ID = "simulador-painel@c.us";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// Página inicial -> tela de login
app.get("/", (_req, res) => res.redirect("/login.html"));

// ---- Autenticação simples por token em memória ----
const tokensValidos = new Set();

function gerarToken() {
  return (
    Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)
  );
}

function exigeAuth(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const token = auth.replace("Bearer ", "");
  if (tokensValidos.has(token)) return next();
  return res.status(401).json({ erro: "Não autorizado" });
}

// ---- Rotas públicas ----

app.post("/api/login", (req, res) => {
  const { senha } = req.body || {};
  const config = store.getConfig();
  if (senha && senha === config.admin.senha) {
    const token = gerarToken();
    tokensValidos.add(token);
    return res.json({ token });
  }
  return res.status(401).json({ erro: "Senha incorreta" });
});

app.get("/api/status", (_req, res) => {
  res.json({ status: estado.botStatus, qr: estado.qrDataUrl });
});

// Conectar / desconectar o WhatsApp pelo painel
app.post("/api/bot/conectar", exigeAuth, (_req, res) => {
  bot.iniciar();
  res.json({ ok: true });
});

app.post("/api/bot/desconectar", exigeAuth, async (_req, res) => {
  await bot.desconectar();
  res.json({ ok: true });
});

app.post("/api/bot/resetar", exigeAuth, async (_req, res) => {
  try {
    await bot.resetarSessao();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ---- Rotas protegidas ----

app.get("/api/config", exigeAuth, (_req, res) => {
  const config = store.getConfig();
  const seguro = { ...config, admin: undefined }; // nunca expõe a senha
  res.json(seguro);
});

app.put("/api/config", exigeAuth, (req, res) => {
  try {
    const atual = store.getConfig();
    const novo = req.body || {};
    // Preserva a senha (não vem do front por padrão)
    novo.admin = novo.admin && novo.admin.senha ? novo.admin : atual.admin;
    store.setConfig(novo);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get("/api/cardapio", exigeAuth, (_req, res) => {
  res.json(store.getCardapio());
});

app.put("/api/cardapio", exigeAuth, (req, res) => {
  try {
    store.setCardapio(req.body || { categorias: [] });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get("/api/pedidos", exigeAuth, (_req, res) => {
  res.json(pedidos.lerTodos().reverse()); // mais recentes primeiro
});

// ---- Simulador (sem autenticação — sessão isolada) ----

app.get("/api/simulador/status", (_req, res) => {
  const s = getSessao(SIMULADOR_ID);
  res.json({ estado: s.estado, carrinho: s.carrinho });
});

app.post("/api/simulador/mensagem", (req, res) => {
  const { mensagem } = req.body || {};
  if (!mensagem && mensagem !== "0") return res.status(400).json({ erro: "mensagem ausente" });
  const sessao = getSessao(SIMULADOR_ID);
  const resultado = processarMensagem(SIMULADOR_ID, String(mensagem), sessao);
  res.json({
    respostas: resultado.respostas || [],
    estado: sessao.estado,
    carrinho: sessao.carrinho,
  });
});

app.post("/api/simulador/reset", (_req, res) => {
  resetSessao(SIMULADOR_ID);
  res.json({ ok: true });
});

function iniciar(porta) {
  app.listen(porta, () => {
    console.log("🌐 Painel disponível em http://localhost:" + porta);
  });
}

module.exports = { iniciar };
