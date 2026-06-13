// ============================================================
// SERVIDOR WEB — painel administrativo + API multi-tenant
// ============================================================

const express = require("express");
const path    = require("path");
const crypto  = require("crypto");
const multer  = require("multer");

const empresas = require("./empresas");
const store = require("./store");
const pedidos = require("./pedidos");
const multiBot = require("./multi-bot");
const { supabaseAdmin } = require("./supabase");
const stripeBilling = require("./stripe");
const { getSessao, resetSessao } = require("./sessoes");
const { processarMensagem } = require("./fluxo");

const app = express();
// ---- Webhook do Stripe — raw body, ANTES do express.json ----
// A verificação da assinatura (constructEvent) exige o corpo BRUTO; por isso
// esta rota usa express.raw e é registrada antes do parser JSON global.
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripeBilling.CONFIGURADO) return res.status(503).end();
  let event;
  try {
    event = stripeBilling.verificarEvento(req.body, req.headers["stripe-signature"]);
  } catch (e) {
    return res.status(400).send(`Assinatura do webhook inválida: ${e.message}`);
  }
  try {
    await stripeBilling.tratarEvento(event);
    res.json({ received: true });
  } catch (e) {
    console.error("Erro ao tratar evento Stripe:", e.message);
    res.status(500).json({ erro: "Falha ao processar evento." }); // 500 → Stripe re-tenta
  }
});

app.use(express.json({ limit: "1mb" }));
// A raiz "/" é servida pelo express.static → public/index.html (landing pública).
app.use(express.static(path.join(__dirname, "..", "public")));

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

// Gate de assinatura: exige trial/assinatura em dia (além do exigeAuth).
// Protege a ação que de fato presta o serviço (ligar o bot). Responde 402
// (Payment Required) quando o acesso não está liberado.
async function exigeAssinatura(req, res, next) {
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    if (!empresas.acessoLiberado(emp)) {
      return res.status(402).json({ erro: "Assinatura inativa. Ative seu plano para usar o bot." });
    }
    next();
  } catch (e) {
    res.status(500).json({ erro: "Falha ao validar a assinatura." });
  }
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
    res.json({
      token: r.token, slug: r.slug, nome: r.nome,
      onboardingConcluido: r.onboardingConcluido, onboardingEtapa: r.onboardingEtapa,
    });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao entrar. Tente de novo." });
  }
});

// Logout: o JWT é descartado no cliente (sessionStorage). Sem estado no servidor.
app.post("/api/logout", (_req, res) => res.json({ ok: true }));

// ---- Assinatura (Stripe) — rotas do restaurante ----

function baseUrlDe(req) {
  return `${req.headers["x-forwarded-proto"] || req.protocol}://${req.get("host")}`;
}

// Inicia o trial de 7 dias: abre a Checkout Session (coleta cartão) e devolve a URL.
app.post("/api/assinatura/checkout", exigeAuth, async (req, res) => {
  if (!stripeBilling.CONFIGURADO) return res.status(503).json({ erro: "Pagamento não configurado no servidor." });
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    const url = await stripeBilling.criarCheckout({
      slug: emp.slug, nome: emp.nome, email: emp.email,
      stripeCustomerId: emp.stripeCustomerId, baseUrl: baseUrlDe(req),
    });
    res.json({ url });
  } catch (e) {
    console.error("checkout:", e.message);
    res.status(500).json({ erro: "Não foi possível iniciar o pagamento." });
  }
});

// Abre o Customer Portal (trocar cartão / cancelar / ver faturas).
app.post("/api/assinatura/portal", exigeAuth, async (req, res) => {
  if (!stripeBilling.CONFIGURADO) return res.status(503).json({ erro: "Pagamento não configurado no servidor." });
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    if (!emp.stripeCustomerId) return res.status(400).json({ erro: "Você ainda não iniciou uma assinatura." });
    const url = await stripeBilling.criarPortal({ stripeCustomerId: emp.stripeCustomerId, baseUrl: baseUrlDe(req) });
    res.json({ url });
  } catch (e) {
    console.error("portal:", e.message);
    res.status(500).json({ erro: "Não foi possível abrir o portal de assinatura." });
  }
});

// Checkout PRÓPRIO (Stripe Elements) — passo 1: cria o SetupIntent (coleta o cartão).
app.post("/api/assinatura/setup-intent", exigeAuth, async (req, res) => {
  if (!stripeBilling.CONFIGURADO) return res.status(503).json({ erro: "Pagamento não configurado no servidor." });
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    const r = await stripeBilling.criarSetupIntent({
      slug: emp.slug, nome: emp.nome, email: emp.email, stripeCustomerId: emp.stripeCustomerId,
    });
    res.json(r);
  } catch (e) {
    console.error("setup-intent:", e.message);
    res.status(500).json({ erro: "Não foi possível iniciar o checkout." });
  }
});

// Checkout PRÓPRIO — passo 2: confirma o cartão e cria a assinatura (trial 7d).
app.post("/api/assinatura/confirmar", exigeAuth, async (req, res) => {
  if (!stripeBilling.CONFIGURADO) return res.status(503).json({ erro: "Pagamento não configurado no servidor." });
  const { setupIntentId } = req.body || {};
  if (!setupIntentId) return res.status(400).json({ erro: "setupIntentId é obrigatório." });
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    if (!emp.stripeCustomerId) return res.status(400).json({ erro: "Inicie o checkout antes de confirmar." });
    await stripeBilling.ativarAssinaturaComSetup({
      slug: emp.slug,
      setupIntentId,
      stripeCustomerId: emp.stripeCustomerId,
      stripeSubscriptionId: emp.stripeSubscriptionId,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error("confirmar assinatura:", e.message);
    res.status(500).json({ erro: e.message || "Falha ao ativar a assinatura." });
  }
});

// Estado atual da assinatura do tenant (consumido pelo painel).
app.get("/api/assinatura", exigeAuth, async (req, res) => {
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    res.json({
      status: emp.assinaturaStatus,
      trialAte: emp.trialAte,
      proximaCobranca: emp.proximaCobranca,
      acessoLiberado: empresas.acessoLiberado(emp),
    });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao carregar a assinatura." });
  }
});

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
    const billing = { trial: 0, pagantes: 0, cortesia: 0, atraso: 0, cancelados: 0, semAssinatura: 0 };
    const porTenant = {};

    for (const t of lista) {
      if (t.ativo) ativos++; else suspensos++;
      const conectado = multiBot.getEstado(t.slug).status === "conectado";
      if (conectado) conectados++;
      const n = await pedidos.contarNoMes(empresas.tenantDir(t.slug), inicioISO);
      pedidosMes += n;
      porTenant[t.slug] = { pedidosMes: n, conectado };

      switch (t.assinaturaStatus) {
        case "trialing": billing.trial++; break;
        case "active":   billing.pagantes++; break;
        case "cortesia": billing.cortesia++; break;
        case "past_due": billing.atraso++; break;
        case "canceled": billing.cancelados++; break;
        default:         billing.semAssinatura++; break;
      }
    }

    res.json({
      totais: {
        restaurantes: lista.length, ativos, suspensos, conectados, pedidosMes,
        trial: billing.trial, pagantes: billing.pagantes, cortesia: billing.cortesia,
        atraso: billing.atraso, cancelados: billing.cancelados, semAssinatura: billing.semAssinatura,
      },
      porTenant,
    });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao calcular métricas." });
  }
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

// ---- Super-admin: assinatura por tenant ----

// Detalhe de billing + histórico de faturas (Stripe) de um tenant.
app.get("/api/admin/tenants/:slug/assinatura", exigeSuperAdmin, async (req, res) => {
  try {
    const emp = await empresas.buscarPorSlug(req.params.slug);
    if (!emp) return res.status(404).json({ erro: "Tenant não encontrado." });
    let faturas = [];
    if (stripeBilling.CONFIGURADO && emp.stripeCustomerId) {
      faturas = await stripeBilling.listarFaturas(emp.stripeCustomerId).catch(() => []);
    }
    const estado = multiBot.getEstado(emp.slug);
    res.json({
      slug: emp.slug, nome: emp.nome, email: emp.email, criadoEm: emp.criado_em,
      ativo: !!emp.ativo,
      assinaturaStatus: emp.assinaturaStatus,
      trialAte: emp.trialAte,
      proximaCobranca: emp.proximaCobranca,
      temAssinaturaStripe: !!emp.stripeSubscriptionId,
      temCustomerStripe: !!emp.stripeCustomerId,
      conectado: estado.status === "conectado",
      stripeConfigurado: stripeBilling.CONFIGURADO,
      faturas,
    });
  } catch (e) {
    console.error("admin assinatura:", e.message);
    res.status(500).json({ erro: "Falha ao carregar a assinatura." });
  }
});

// Libera acesso manual (cortesia) — assinante sem Stripe.
app.patch("/api/admin/tenants/:slug/assinatura/cortesia", exigeSuperAdmin, async (req, res) => {
  const slug = req.params.slug;
  if (!(await empresas.buscarPorSlug(slug))) return res.status(404).json({ erro: "Tenant não encontrado." });
  await empresas.atualizarAssinatura(slug, { status: "cortesia", trialAte: null, proximaCobranca: null });
  res.json({ ok: true, assinaturaStatus: "cortesia" });
});

// Revoga a cortesia (volta a "nenhuma" e derruba o bot).
app.patch("/api/admin/tenants/:slug/assinatura/revogar", exigeSuperAdmin, async (req, res) => {
  const slug = req.params.slug;
  if (!(await empresas.buscarPorSlug(slug))) return res.status(404).json({ erro: "Tenant não encontrado." });
  await empresas.atualizarAssinatura(slug, { status: "nenhuma" });
  await multiBot.desconectar(slug).catch(() => {});
  res.json({ ok: true, assinaturaStatus: "nenhuma" });
});

// Cancela a assinatura no Stripe (o webhook subscription.deleted confirma depois).
app.patch("/api/admin/tenants/:slug/assinatura/cancelar", exigeSuperAdmin, async (req, res) => {
  const slug = req.params.slug;
  const emp = await empresas.buscarPorSlug(slug);
  if (!emp) return res.status(404).json({ erro: "Tenant não encontrado." });
  if (!stripeBilling.CONFIGURADO) return res.status(503).json({ erro: "Pagamento não configurado no servidor." });
  if (!emp.stripeSubscriptionId) return res.status(400).json({ erro: "Este restaurante não tem assinatura no Stripe." });
  try {
    await stripeBilling.cancelarAssinatura(emp.stripeSubscriptionId);
    // Reflexo imediato (o webhook subscription.deleted confirma logo em seguida).
    await empresas.atualizarAssinatura(slug, { status: "canceled" });
    await multiBot.desconectar(slug).catch(() => {});
    res.json({ ok: true, assinaturaStatus: "canceled" });
  } catch (e) {
    console.error("cancelar assinatura:", e.message);
    res.status(500).json({ erro: "Falha ao cancelar no Stripe." });
  }
});

app.get("/api/status", exigeAuth, (req, res) => {
  res.json(multiBot.getEstado(req.slug));
});

// ---- Bot ----

app.post("/api/bot/conectar", exigeAuth, exigeAssinatura, (req, res) => {
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

// ---- Conta de acesso (e-mail/senha de login) ----
// E-mail/senha vivem no Supabase Auth, não no `config`. Rotas separadas.
app.get("/api/conta", exigeAuth, async (req, res) => {
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    if (!emp) return res.status(404).json({ erro: "Conta não encontrada." });
    res.json({ email: emp.email, nome: emp.nome });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao ler a conta." });
  }
});

app.patch("/api/conta/senha", exigeAuth, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body || {};
    await empresas.trocarSenha(req.slug, senhaAtual, novaSenha);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.patch("/api/conta/email", exigeAuth, async (req, res) => {
  try {
    const { senhaAtual, novoEmail } = req.body || {};
    const email = await empresas.trocarEmail(req.slug, senhaAtual, novoEmail);
    res.json({ ok: true, email });
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

// ---- Imagens de item (Supabase Storage, bucket público "cardapio") ----

const MIME_TO_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const BUCKET_IMAGENS = "cardapio";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
});

// Upload da imagem direto para o Storage; o item guarda a URL pública retornada.
// (Não há mais rota /imagens nem arquivos em disco — o Storage serve a URL.)
app.post("/api/imagem", exigeAuth, (req, res) => {
  upload.single("imagem")(req, res, async (err) => {
    if (err && err.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ erro: "Arquivo muito grande. Máximo: 2 MB." });
    if (err) return res.status(400).json({ erro: "Erro no envio do arquivo." });
    if (!req.file) return res.status(400).json({ erro: "Nenhum arquivo enviado." });

    const ext = MIME_TO_EXT[req.file.mimetype];
    if (!ext) return res.status(400).json({ erro: "Tipo inválido. Use JPEG, PNG ou WebP." });

    try {
      const filename = `${crypto.randomBytes(16).toString("hex")}-${Date.now()}.${ext}`;
      const caminho  = `${req.slug}/${filename}`; // isolamento por tenant na pasta do bucket
      const { error } = await supabaseAdmin.storage
        .from(BUCKET_IMAGENS)
        .upload(caminho, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (error) return res.status(500).json({ erro: "Falha ao enviar a imagem." });

      const { data } = supabaseAdmin.storage.from(BUCKET_IMAGENS).getPublicUrl(caminho);
      res.json({ url: data.publicUrl });
    } catch (e) {
      res.status(500).json({ erro: "Falha ao enviar a imagem." });
    }
  });
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
    // Simulador é console de testes: ignora o horário comercial (5º arg telefone = null).
    const resultado = await processarMensagem(sid, String(mensagem), sessao, req.tenantDir, null, { ignorarHorario: true });
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
