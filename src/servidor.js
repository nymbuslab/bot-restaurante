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
const backup = require("../scripts/backup");
const { getSessao, resetSessao } = require("./sessoes");
const { processarMensagem } = require("./fluxo");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (_req, res) => res.redirect("/login.html"));

// ---- Autenticação de restaurante — Supabase Auth (JWT) ----
// O token é o access_token (JWT) do Supabase. O middleware valida o JWT e
// resolve o tenant; também checa `ativo` a cada request (suspensão imediata).
async function exigeAuth(req, res, next) {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "");
  let emp;
  try {
    emp = await empresas.resolverPorToken(token);
  } catch (e) {
    return res.status(500).json({ erro: "Falha ao validar a sessão." });
  }
  if (!emp || !emp.ativo) return res.status(401).json({ erro: "Não autorizado" });
  req.slug = emp.slug;
  req.tenantDir = empresas.tenantDir(emp.slug);
  next();
}

// ---- Autenticação SUPER-ADMIN (conta master, isolada dos restaurantes) ----
// Token próprio em memória, separado do JWT de restaurante.
const tokensAdmin = new Map(); // token → true

function gerarToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const SUPERADMIN_EMAIL      = process.env.SUPERADMIN_EMAIL || "";
const SUPERADMIN_SENHA_HASH = process.env.SUPERADMIN_SENHA_HASH || "";
const SUPERADMIN_CONFIGURADO = Boolean(SUPERADMIN_EMAIL && SUPERADMIN_SENHA_HASH);

if (!SUPERADMIN_CONFIGURADO) {
  console.warn("⚠️  Super-admin não configurado (defina SUPERADMIN_EMAIL e SUPERADMIN_SENHA_HASH). Rotas /api/admin/* desativadas até configurar.");
}

// Comparação de hash resistente a timing attack.
function hashConfere(hashInformado, hashEsperado) {
  const a = Buffer.from(hashInformado);
  const b = Buffer.from(hashEsperado);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function exigeSuperAdmin(req, res, next) {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "");
  if (!tokensAdmin.has(token)) return res.status(401).json({ erro: "Não autorizado" });
  next();
}

// ---- Rotas públicas ----

app.post("/api/cadastro", async (req, res) => {
  try {
    const { nome, email, senha } = req.body || {};
    if (!nome || !email || !senha) return res.status(400).json({ erro: "Preencha todos os campos." });
    if (senha.length < 6) return res.status(400).json({ erro: "Senha deve ter pelo menos 6 caracteres." });
    const empresa = await empresas.cadastrar({ nome, email, senha });
    res.json({ ok: true, slug: empresa.slug, nome: empresa.nome });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    const r = await empresas.autenticar(email, senha);
    if (!r) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    res.json({ token: r.token, slug: r.slug, nome: r.nome });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao entrar. Tente de novo." });
  }
});

// Logout: o JWT é descartado no cliente (sessionStorage). Sem estado no servidor.
app.post("/api/logout", (_req, res) => res.json({ ok: true }));

// ---- Super-admin: autenticação master ----

app.post("/api/admin/login", (req, res) => {
  if (!SUPERADMIN_CONFIGURADO) return res.status(503).json({ erro: "Super-admin não configurado no servidor." });
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ erro: "Preencha e-mail e senha." });

  const emailOk = email === SUPERADMIN_EMAIL;
  const senhaOk = hashConfere(empresas.hashSenha(senha), SUPERADMIN_SENHA_HASH);
  if (!emailOk || !senhaOk) return res.status(401).json({ erro: "E-mail ou senha incorretos." });

  const token = gerarToken();
  tokensAdmin.set(token, true);
  res.json({ token });
});

app.post("/api/admin/logout", (req, res) => {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "");
  tokensAdmin.delete(token);
  res.json({ ok: true });
});

// ---- Super-admin: gestão de tenants ----

app.get("/api/admin/tenants", exigeSuperAdmin, async (_req, res) => {
  res.json(await empresas.listar());
});

// Início do mês corrente no fuso BR (America/Sao_Paulo, UTC-3 fixo), em UTC ISO.
function inicioDoMesBR() {
  const hojeBR = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const [ano, mes] = hojeBR.split("-");
  return new Date(`${ano}-${mes}-01T00:00:00-03:00`).toISOString();
}

app.get("/api/admin/metrics", exigeSuperAdmin, async (_req, res) => {
  try {
    const inicioISO = inicioDoMesBR();
    const lista = await empresas.listar();

    let ativos = 0, suspensos = 0, conectados = 0, pedidosMes = 0;
    const porTenant = {};

    for (const t of lista) {
      if (t.ativo) ativos++; else suspensos++;
      const conectado = multiBot.getEstado(t.slug).status === "conectado";
      if (conectado) conectados++;
      const n = await pedidos.contarNoMes(empresas.tenantDir(t.slug), inicioISO);
      pedidosMes += n;
      porTenant[t.slug] = { pedidosMes: n, conectado };
    }

    res.json({
      totais: { restaurantes: lista.length, ativos, suspensos, conectados, pedidosMes },
      porTenant,
    });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao calcular métricas." });
  }
});

// ---- Super-admin: backup (consome scripts/backup.js) ----

app.post("/api/admin/backup/gerar", exigeSuperAdmin, async (_req, res) => {
  try {
    const r = await backup.gerarBackup();
    res.json({ arquivo: r.arquivo, tamanho: r.tamanho, criadoEm: r.criadoEm });
  } catch (e) {
    res.status(500).json({ erro: e.message || "Falha ao gerar o backup." });
  }
});

app.get("/api/admin/backup/listar", exigeSuperAdmin, (_req, res) => {
  res.json(backup.listarBackups());
});

app.get("/api/admin/backup/baixar/:arquivo", exigeSuperAdmin, (req, res) => {
  const nome = path.basename(req.params.arquivo);
  if (!backup.NOME_RE.test(nome)) return res.status(400).json({ erro: "Nome de backup inválido." });
  const baseDir  = path.resolve(backup.BACKUPS_DIR);
  const filePath = path.resolve(baseDir, nome);
  if (!filePath.startsWith(baseDir + path.sep)) return res.status(403).end();
  if (!fs.existsSync(filePath)) return res.status(404).json({ erro: "Backup não encontrado." });
  res.download(filePath, nome);
});

app.post("/api/admin/tenants", exigeSuperAdmin, async (req, res) => {
  try {
    const { nome, email, senha } = req.body || {};
    if (!nome || !email || !senha) return res.status(400).json({ erro: "Preencha todos os campos." });
    if (senha.length < 6) return res.status(400).json({ erro: "Senha deve ter pelo menos 6 caracteres." });
    const empresa = await empresas.cadastrar({ nome, email, senha });
    res.json({ ok: true, slug: empresa.slug, nome: empresa.nome });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.patch("/api/admin/tenants/:slug/suspender", exigeSuperAdmin, async (req, res) => {
  const slug = req.params.slug;
  if (!(await empresas.setAtivo(slug, 0))) return res.status(404).json({ erro: "Tenant não encontrado." });
  // Efeito real: login recusado (autenticar filtra ativo) + exigeAuth checa ativo
  // a cada request (sessão aberta cai no próximo request); e o bot é derrubado.
  await multiBot.desconectar(slug);
  res.json({ ok: true, ativo: false });
});

app.patch("/api/admin/tenants/:slug/reativar", exigeSuperAdmin, async (req, res) => {
  const slug = req.params.slug;
  if (!(await empresas.setAtivo(slug, 1))) return res.status(404).json({ erro: "Tenant não encontrado." });
  res.json({ ok: true, ativo: true });
});

app.delete("/api/admin/tenants/:slug", exigeSuperAdmin, async (req, res) => {
  const slug = req.params.slug;
  const { confirmacao } = req.body || {};

  if (confirmacao !== slug) {
    return res.status(400).json({ erro: "Confirmação não confere. Envie { confirmacao: \"<slug>\" } igual ao slug." });
  }

  const empresa = await empresas.buscarPorSlug(slug);
  if (!empresa) return res.status(404).json({ erro: "Tenant não encontrado." });

  // Ordem: parar o bot (libera a sessão em disco) → excluir (linha + cascade de
  // pedidos + usuário do Auth + pasta do tenant).
  await multiBot.desconectar(slug);
  await empresas.excluir(slug);

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

app.get("/api/config", exigeAuth, async (req, res) => {
  try {
    await store.ensure(req.tenantDir);
    res.json(store.getConfig(req.tenantDir));
  } catch (e) {
    res.status(500).json({ erro: "Falha ao ler a configuração." });
  }
});

app.put("/api/config", exigeAuth, async (req, res) => {
  try {
    await store.setConfig(req.tenantDir, req.body || {});
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get("/api/cardapio", exigeAuth, async (req, res) => {
  try {
    await store.ensure(req.tenantDir);
    res.json(store.getCardapio(req.tenantDir));
  } catch (e) {
    res.status(500).json({ erro: "Falha ao ler o cardápio." });
  }
});

app.put("/api/cardapio", exigeAuth, async (req, res) => {
  try {
    await store.setCardapio(req.tenantDir, req.body || { categorias: [] });
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

app.post("/api/imagem", exigeAuth, (req, res) => {
  upload.single("imagem")(req, res, (err) => {
    if (err && err.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ erro: "Arquivo muito grande. Máximo: 2 MB." });
    if (err) return res.status(400).json({ erro: "Erro no envio do arquivo." });
    if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo enviado." });

    const ext = MIME_TO_EXT[req.file.mimetype];
    if (!ext) return res.status(400).json({ erro: "Tipo inválido. Use JPEG, PNG ou WebP." });

    const filename   = `${crypto.randomBytes(16).toString("hex")}-${Date.now()}.${ext}`;
    const uploadsDir = path.join(req.tenantDir, "uploads");
    fs.mkdirSync(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, req.file.buffer);

    res.json({ url: `/imagens/${req.slug}/${filename}` });
  });
});

// Servir imagem de item — isolamento por tenant (slug + filename validados)
app.get("/imagens/:slug/:filename", async (req, res) => {
  const slug     = path.basename(req.params.slug);
  const filename = path.basename(req.params.filename);

  if (!SLUG_RE.test(slug) || !FILE_RE.test(filename)) return res.status(400).end();

  if (!(await empresas.buscarPorSlug(slug))) return res.status(404).end();

  const uploadsDir = path.resolve(DATA_DIR, "tenants", slug, "uploads");
  const filePath   = path.resolve(uploadsDir, filename);

  if (!filePath.startsWith(uploadsDir + path.sep)) return res.status(403).end();
  if (!fs.existsSync(filePath)) return res.status(404).end();

  const ext = filename.split(".").pop();
  res.set("Content-Type", EXT_TO_MIME[ext]);
  res.sendFile(filePath);
});

app.get("/api/pedidos", exigeAuth, async (req, res) => {
  try {
    res.json((await pedidos.lerTodos(req.tenantDir)).reverse());
  } catch (e) {
    res.status(500).json({ erro: "Falha ao ler os pedidos." });
  }
});

const MSG_PRONTO_PADRAO = {
  entrega:  "Olá, {cliente}! Seu pedido #{numero} está pronto e já saiu para entrega. Logo chega aí!",
  retirada: "Olá, {cliente}! Seu pedido #{numero} está pronto para retirada. Pode vir buscar quando quiser!",
};

app.post("/api/pedido/avisar", exigeAuth, async (req, res) => {
  try {
    const { pedidoId } = req.body || {};
    if (!pedidoId) return res.status(400).json({ erro: "pedidoId obrigatório." });

    const pedido = await pedidos.lerPorId(req.tenantDir, pedidoId);
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });

    await store.ensure(req.tenantDir);
    const config = store.getConfig(req.tenantDir);
    const templates = config.mensagens?.pedidoPronto || MSG_PRONTO_PADRAO;
    const tipoChave = (pedido.tipoEntrega || "").toLowerCase() === "entrega" ? "entrega" : "retirada";
    const template  = templates[tipoChave] || MSG_PRONTO_PADRAO[tipoChave];

    const texto = template
      .replace(/\{cliente\}/g, pedido.cliente || "")
      .replace(/\{numero\}/g,  String(pedido.numero));

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
    const avisadoEm = await pedidos.avisarPedido(req.tenantDir, pedidoId);

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

app.post("/api/simulador/mensagem", exigeAuth, async (req, res) => {
  try {
    const { mensagem } = req.body || {};
    if (!mensagem && mensagem !== "0") return res.status(400).json({ erro: "mensagem ausente" });
    const sid = `sim:${req.slug}`;
    const sessao = getSessao(sid);
    await store.ensure(req.tenantDir);
    const resultado = await processarMensagem(sid, String(mensagem), sessao, req.tenantDir);
    res.json({
      respostas: resultado.respostas || [],
      estado: sessao.estado,
      carrinho: sessao.carrinho,
    });
  } catch (e) {
    res.status(500).json({ erro: "Falha no simulador." });
  }
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
