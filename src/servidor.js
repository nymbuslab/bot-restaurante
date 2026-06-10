// ============================================================
// SERVIDOR WEB — painel administrativo + API multi-tenant
// ============================================================

const express = require("express");
const path    = require("path");
const fs      = require("fs");
const crypto  = require("crypto");
const multer  = require("multer");

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

// ---- Imagens de item ----

const DATA_DIR    = path.join(__dirname, "..", "data");
const MIME_TO_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const EXT_TO_MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const SLUG_RE     = /^[a-z0-9-]+$/;
const FILE_RE     = /^[a-z0-9-]+\.(jpg|png|webp)$/;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

// Upload autenticado de imagem de item (multipart, campo "imagem")
app.post("/api/imagem", exigeAuth, (req, res) => {
  upload.single("imagem")(req, res, (err) => {
    if (err && err.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ erro: "Arquivo muito grande. Máximo: 2 MB." });
    if (err) return res.status(400).json({ erro: "Erro no envio do arquivo." });
    if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo enviado." });

    // Extensão derivada do mimetype validado — nunca do nome do arquivo enviado
    const ext = MIME_TO_EXT[req.file.mimetype];
    if (!ext) return res.status(400).json({ erro: "Tipo inválido. Use JPEG, PNG ou WebP." });

    const filename   = `${crypto.randomBytes(16).toString("hex")}-${Date.now()}.${ext}`;
    const uploadsDir = path.join(req.tenantDir, "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });

    // TODO: ao trocar a foto de um item ou excluir o item, apagar o arquivo anterior
    //       para evitar acúmulo de arquivos órfãos no volume (data/tenants/{slug}/uploads/).
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    res.json({ url: `/imagens/${req.slug}/${filename}` });
  });
});

// Servir imagem de item — isolamento por tenant (slug + filename validados e confinados)
app.get("/imagens/:slug/:filename", (req, res) => {
  const slug     = path.basename(req.params.slug);
  const filename = path.basename(req.params.filename);

  // Regex estrita: slug ^[a-z0-9-]+$, filename ^[a-z0-9-]+\.(jpg|png|webp)$
  if (!SLUG_RE.test(slug) || !FILE_RE.test(filename)) return res.status(400).end();

  // Slug deve corresponder a um tenant cadastrado
  if (!empresas.buscarPorSlug(slug)) return res.status(404).end();

  const uploadsDir = path.resolve(DATA_DIR, "tenants", slug, "uploads");
  const filePath   = path.resolve(uploadsDir, filename);

  // Confinamento: path resolvido deve começar dentro de uploadsDir
  if (!filePath.startsWith(uploadsDir + path.sep)) return res.status(403).end();
  if (!fs.existsSync(filePath)) return res.status(404).end();

  const ext = filename.split(".").pop();
  res.set("Content-Type", EXT_TO_MIME[ext]);
  res.sendFile(filePath);
});

app.get("/api/pedidos", exigeAuth, (req, res) => {
  res.json(pedidos.lerTodos(req.tenantDir).reverse());
});

const MSG_PRONTO_PADRAO = {
  entrega:  "Olá, {cliente}! Seu pedido #{numero} está pronto e já saiu para entrega. Logo chega aí!",
  retirada: "Olá, {cliente}! Seu pedido #{numero} está pronto para retirada. Pode vir buscar quando quiser!",
};

app.post("/api/pedido/avisar", exigeAuth, async (req, res) => {
  try {
    const { pedidoId } = req.body || {};
    if (!pedidoId) return res.status(400).json({ erro: "pedidoId obrigatório." });

    const pedido = pedidos.lerPorId(req.tenantDir, pedidoId);
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });

    const config = store.getConfig(req.tenantDir);
    const templates = config.mensagens?.pedidoPronto || MSG_PRONTO_PADRAO;
    const tipoChave = (pedido.tipoEntrega || "").toLowerCase() === "entrega" ? "entrega" : "retirada";
    const template  = templates[tipoChave] || MSG_PRONTO_PADRAO[tipoChave];

    const texto = template
      .replace(/\{cliente\}/g, pedido.cliente || "")
      .replace(/\{numero\}/g,  String(pedido.numero));

    // Destino do aviso: o JID da conversa (canal real por onde o cliente falou —
    // pode ser @lid no modelo de privacidade novo). Para pedidos antigos sem chatId,
    // fallback legado: reconstruir um phone JID a partir do telefone gravado.
    let destino = pedido.chatId || "";
    const ehJidReal = destino.endsWith("@s.whatsapp.net") || destino.endsWith("@lid");
    if (!ehJidReal) {
      const digits = (pedido.telefone || "").replace(/\D/g, "");
      if (digits.length < 10) {
        return res.status(400).json({ erro: "Pedido sem canal/telefone — não é possível avisar o cliente." });
      }
      destino = (digits.length <= 11 ? "55" + digits : digits) + "@s.whatsapp.net";
    }

    await multiBot.enviarMensagem(req.slug, destino, texto);
    const avisadoEm = pedidos.avisarPedido(req.tenantDir, pedidoId);

    res.json({ ok: true, avisadoEm });
  } catch (e) {
    const status = e.message === "WhatsApp não conectado" ? 400 : 500;
    res.status(status).json({ erro: e.message });
  }
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
