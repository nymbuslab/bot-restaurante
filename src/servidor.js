// ============================================================
// SERVIDOR WEB — painel administrativo + API multi-tenant
// ============================================================

const express = require("express");
const path    = require("path");
const crypto  = require("crypto");
const multer  = require("multer");
const helmet  = require("helmet");
const rateLimit = require("express-rate-limit");
const QRCode  = require("qrcode");

const empresas = require("./empresas");
const plataforma = require("./plataforma");
const store = require("./store");
const pedidos = require("./pedidos");
const clientes = require("./clientes");
const cep = require("./cep");
const multiBot = require("./multi-bot");
const { supabaseAdmin } = require("./supabase");
const stripeBilling = require("./stripe");
const { validarConfig, validarCardapio, tipoImagemPorAssinatura } = require("./validacao");
const { getSessao, resetSessao } = require("./sessoes");
const { processarMensagem, estaAberto } = require("./fluxo");
const cardapioWeb = require("./cardapio-web");

const app = express();

// Atrás do proxy do Fly.io (1 hop): confia no X-Forwarded-* para obter o IP real
// do cliente (req.ip). Sem isso, o rate limit por IP agruparia todos no IP do proxy.
app.set("trust proxy", 1);

// ---- Cabeçalhos de segurança (helmet) + CSP ----
// A CSP libera só o necessário: Stripe (Payment Element), Google Fonts, Supabase
// (Auth/Storage) e ViaCEP (CEP). script-src SEM 'unsafe-inline' — todo JS é externo.
let SUPABASE_ORIGIN = "";
try { SUPABASE_ORIGIN = new URL(process.env.SUPABASE_URL || "").origin; } catch (_) { /* sem origem */ }
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", SUPABASE_ORIGIN].filter(Boolean),
      connectSrc: ["'self'", "https://api.stripe.com", SUPABASE_ORIGIN].filter(Boolean),
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  // HSTS: o Fly já força HTTPS; reforça no navegador por 1 ano.
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  // COEP off: não bloquear recursos cross-origin legítimos (Stripe/Fonts/Supabase).
  crossOriginEmbedderPolicy: false,
}));

// ---- Health check (vivacidade) — usado pelo Fly para reciclar a máquina ----
// Público, sem auth, trabalho mínimo: prova que o processo responde (event loop
// vivo + servidor ouvindo). NÃO checa o Supabase de propósito — se o banco cair,
// reiniciar não resolve e só causaria restart em loop; o app deve seguir de pé
// esperando o banco voltar. Registrado cedo, fora de rate limit/auth.
app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
});

// ---- Rate limiting (anti brute force / abuso) ----
// trust proxy acima garante req.ip correto atrás do Fly. Mensagens genéricas.
function limitador(windowMin, max, msg) {
  return rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { erro: msg },
  });
}
const TENTE_DEPOIS = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
const loginLimiter      = limitador(15, 10, TENTE_DEPOIS); // login de restaurante
const adminLoginLimiter = limitador(15, 5,  TENTE_DEPOIS); // login master (mais rígido)
const cadastroLimiter   = limitador(60, 5,  "Muitos cadastros a partir deste IP. Tente novamente mais tarde.");
const assinaturaLimiter = limitador(15, 20, TENTE_DEPOIS); // setup-intent / checkout
const refreshLimiter    = limitador(15, 60, TENTE_DEPOIS); // renovação de sessão (~1x/h por usuário)
const publicoLimiter    = limitador(15, 60, "Muitas requisições. Aguarde um momento e tente novamente."); // cardápio web público

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
const tokensAdmin = new Map(); // token → expira_em (epoch ms)
const TOKEN_ADMIN_TTL_MS = 12 * 60 * 60 * 1000; // 12h de validade

function gerarToken() {
  return crypto.randomBytes(32).toString("hex"); // CSPRNG (256 bits)
}

const SUPERADMIN_EMAIL      = process.env.SUPERADMIN_EMAIL || "";
const SUPERADMIN_SENHA_HASH = process.env.SUPERADMIN_SENHA_HASH || "";
const SUPERADMIN_CONFIGURADO = Boolean(SUPERADMIN_EMAIL && SUPERADMIN_SENHA_HASH);

// Informações da plataforma (Nymbus) expostas ao painel do cliente.
// Por ora vêm de env; no futuro, a aba "Nymbus" do painel master alimenta isto.
// Só dígitos (formato wa.me): ex. SUPORTE_WHATSAPP=5511999999999
const SUPORTE_WHATSAPP = (process.env.SUPORTE_WHATSAPP || "").replace(/\D/g, "");

if (!SUPERADMIN_CONFIGURADO) {
  console.warn("⚠️  Super-admin não configurado (defina SUPERADMIN_EMAIL e SUPERADMIN_SENHA_HASH). Rotas /api/admin/* desativadas até configurar.");
}

function exigeSuperAdmin(req, res, next) {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "");
  const expira = tokensAdmin.get(token);
  if (!expira || expira < Date.now()) {
    if (expira) tokensAdmin.delete(token); // token expirado → descarta
    return res.status(401).json({ erro: "Não autorizado" });
  }
  next();
}

// ---- Rotas públicas ----

app.post("/api/cadastro", cadastroLimiter, async (req, res) => {
  try {
    const { nome, email, senha } = req.body || {};
    if (!nome || !email || !senha) return res.status(400).json({ erro: "Preencha todos os campos." });
    if (senha.length < 6) return res.status(400).json({ erro: "Senha deve ter pelo menos 6 caracteres." });
    const empresa = await empresas.cadastrar({ nome, email, senha });
    res.json({ ok: true, slug: empresa.slug, nome: empresa.nome });
  } catch (e) {
    // Mensagem genérica e uniforme: NÃO confirma se o e-mail já existe (anti-enumeração).
    // A dica "faça login" aparece em qualquer erro, então não vaza existência de conta.
    // O detalhe real (ex.: "E-mail já cadastrado") fica só no log do servidor.
    console.error("cadastro:", e.message);
    res.status(400).json({ erro: "Não foi possível concluir o cadastro. Verifique os dados ou, se já tiver conta, faça login." });
  }
});

// ---- Sessão via cookie httpOnly (refresh token) ----
// O refresh token (longevo) vive num cookie httpOnly+Secure+SameSite=Lax — o JS
// NÃO o lê (imune a XSS). O access token (JWT, ~1h) fica só na memória do front.
// `rt` = refresh token; `rtl` = flag "lembrar" (controla a validade do cookie).
const COOKIE_RT = "rt", COOKIE_RTL = "rtl", COOKIE_SESS = "sess";
const LEMBRAR_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function lerCookie(req, nome) {
  const raw = req.headers.cookie || "";
  for (const par of raw.split(";")) {
    const i = par.indexOf("=");
    if (i === -1) continue;
    if (par.slice(0, i).trim() === nome) return decodeURIComponent(par.slice(i + 1).trim());
  }
  return "";
}
function opcoesCookie(req, lembrar) {
  const o = { httpOnly: true, secure: !!req.secure, sameSite: "lax", path: "/api" };
  if (lembrar) o.maxAge = LEMBRAR_MS; // persistente; sem isso = cookie de sessão (some ao fechar)
  return o;
}
function setSessaoCookies(req, res, refreshToken, lembrar) {
  res.cookie(COOKIE_RT, refreshToken, opcoesCookie(req, lembrar));
  res.cookie(COOKIE_RTL, lembrar ? "1" : "0", opcoesCookie(req, lembrar));
  // Cookie de PRESENÇA (NÃO-httpOnly, path "/"): o front lê pra decidir se tenta
  // retomar a sessão em login.html/landing (evita chamar /api/refresh à toa).
  // Não guarda nada sensível — só "1"; o refresh token segue httpOnly intocado.
  const oSess = { secure: !!req.secure, sameSite: "lax", path: "/" };
  if (lembrar) oSess.maxAge = LEMBRAR_MS;
  res.cookie(COOKIE_SESS, "1", oSess);
}
function limparSessaoCookies(req, res) {
  const o = { httpOnly: true, secure: !!req.secure, sameSite: "lax", path: "/api" };
  res.clearCookie(COOKIE_RT, o);
  res.clearCookie(COOKIE_RTL, o);
  res.clearCookie(COOKIE_SESS, { secure: !!req.secure, sameSite: "lax", path: "/" });
}

app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { email, senha, lembrar } = req.body || {};
    const r = await empresas.autenticar(email, senha);
    if (!r) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    setSessaoCookies(req, res, r.refreshToken, !!lembrar); // refresh token só no cookie
    res.json({
      token: r.token, slug: r.slug, nome: r.nome,
      onboardingConcluido: r.onboardingConcluido, onboardingEtapa: r.onboardingEtapa,
    });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao entrar. Tente de novo." });
  }
});

// Renova a sessão: lê o refresh token do COOKIE, devolve um access token novo e
// ROTACIONA o cookie. Evita o logout automático e mantém o "lembrar de mim".
app.post("/api/refresh", refreshLimiter, async (req, res) => {
  try {
    const r = await empresas.renovarSessao(lerCookie(req, COOKIE_RT));
    if (!r) {
      limparSessaoCookies(req, res);
      return res.status(401).json({ erro: "Sessão expirada. Faça login novamente." });
    }
    const lembrar = lerCookie(req, COOKIE_RTL) === "1";
    setSessaoCookies(req, res, r.refreshToken, lembrar);
    res.json({ token: r.token, slug: r.slug, nome: r.nome, onboardingConcluido: r.onboardingConcluido });
  } catch (e) {
    res.status(401).json({ erro: "Sessão expirada. Faça login novamente." });
  }
});

// Logout: descarta o cookie de sessão (o access token só vivia na memória do front).
app.post("/api/logout", (req, res) => {
  limparSessaoCookies(req, res);
  res.json({ ok: true });
});

// ---- Assinatura (Stripe) — rotas do restaurante ----

function baseUrlDe(req) {
  return `${req.headers["x-forwarded-proto"] || req.protocol}://${req.get("host")}`;
}

// Inicia o trial de 7 dias: abre a Checkout Session (coleta cartão) e devolve a URL.
app.post("/api/assinatura/checkout", exigeAuth, assinaturaLimiter, async (req, res) => {
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
app.post("/api/assinatura/setup-intent", exigeAuth, assinaturaLimiter, async (req, res) => {
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
    res.status(500).json({ erro: "Falha ao ativar a assinatura. Tente novamente." });
  }
});

// Estado atual da assinatura do tenant (consumido pelo painel) + faturas reais.
app.get("/api/assinatura", exigeAuth, async (req, res) => {
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    let faturas = [];
    if (emp.stripeCustomerId && stripeBilling.CONFIGURADO) {
      faturas = await stripeBilling.listarFaturas(emp.stripeCustomerId).catch(() => []);
    }
    const plano = empresas.planoDe(emp);
    const info = stripeBilling.PLANO_INFO[plano] || stripeBilling.PLANO_INFO.essencial;
    res.json({
      status: emp.assinaturaStatus,
      trialAte: emp.trialAte,
      proximaCobranca: emp.proximaCobranca,
      acessoLiberado: empresas.acessoLiberado(emp),
      plano,
      planoNome: info.nome,
      valorMes: info.valorMes,
      faturas,
    });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao carregar a assinatura." });
  }
});

// Informações da plataforma (Nymbus) para o painel do cliente.
// Fonte: tabela plataforma_config (editável no painel master); cai pra env
// SUPORTE_WHATSAPP se ainda não houver valor salvo.
app.get("/api/plataforma", exigeAuth, async (req, res) => {
  try {
    const cfg = await plataforma.obter();
    res.json({ suporteWhatsapp: cfg.suporteWhatsapp || SUPORTE_WHATSAPP || null });
  } catch (e) {
    res.json({ suporteWhatsapp: SUPORTE_WHATSAPP || null });
  }
});

// Dados PÚBLICOS da empresa (footer da landing). Sem auth, sem nada sensível
// (nunca expõe e-mail/hash do master). Campos vazios saem como null.
app.get("/api/plataforma/publico", async (_req, res) => {
  try {
    const c = await plataforma.obter();
    res.json({
      razaoSocial: c.razaoSocial || null,
      nomeFantasia: c.nomeFantasia || null,
      cnpj: c.cnpj || null,
      endereco: c.endereco || null,
      telefone: c.telefone || null,
      facebook: c.facebook || null,
      instagram: c.instagram || null,
    });
  } catch (e) {
    res.json({});
  }
});

// ---- Cardápio web público (canal de pedido por link) ----
// Sem auth: o cliente abre /c/:slug e a página busca esta API. Devolve só
// dados públicos do tenant (projeção whitelist — nunca o jsonb cru). Gate:
// tenant ativo com acesso liberado; senão `{ disponivel:false }` (200, não 4xx).
app.get("/api/c/:slug", publicoLimiter, async (req, res) => {
  try {
    const emp = await empresas.buscarPorSlug(req.params.slug);
    if (!emp || !empresas.acessoLiberado(emp)) {
      return res.json({ disponivel: false, motivo: "indisponivel" });
    }
    const dir = empresas.tenantDir(emp.slug);
    await store.ensure(dir);
    const config = store.getConfig(dir);
    const r = config.restaurante || {};
    res.json({
      disponivel: true,
      aberto: estaAberto(dir),
      restaurante: {
        nome: r.nome || emp.nome,
        telefone: r.telefone || "",
        endereco: r.endereco || "",
        horario: r.horario || "",
      },
      taxaEntrega: Number(config.atendimento && config.atendimento.taxaEntrega) || 0,
      pagamentos: Array.isArray(config.pagamentos) ? config.pagamentos : [],
      cardapio: cardapioWeb.projetarCardapio(store.getCardapio(dir)),
    });
  } catch (e) {
    console.error("GET /api/c/:slug:", e.message);
    res.status(500).json({ erro: "Falha ao carregar o cardápio." });
  }
});

// Página do cardápio web (casca estática; o JS lê o slug da URL e busca a API acima).
app.get("/c/:slug", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "cardapio.html"));
});

// Busca de CEP com cache no banco (substitui a chamada direta do front ao ViaCEP).
// Público (usado no checkout, onboarding e painel) e rate-limited.
app.get("/api/cep/:cep", publicoLimiter, async (req, res) => {
  try {
    const end = await cep.buscarCep(req.params.cep);
    if (!end) return res.json({ erro: true });
    res.json(end);
  } catch (e) {
    console.error("GET /api/cep:", e.message);
    res.json({ erro: true }); // front cai no preenchimento manual
  }
});

// Mensagem de confirmação padrão (se o tenant não tiver `mensagens.pedidoConfirmado`).
const MSG_CONFIRMADO_PADRAO = "🎉 *Pedido confirmado!* Número *#{numero}*.\n\nJá estamos preparando. Tempo estimado: *{tempo}*.\nObrigado pela preferência! 🍴";
const CARDAPIO_LINK_SECRET = process.env.CARDAPIO_LINK_SECRET || "";

// Confirma ao cliente, pelo WhatsApp do tenant, o pedido feito na web. NÃO lança para
// o fluxo do pedido: se o bot estiver offline, o pedido já está salvo (não perde venda).
async function confirmarPedidoWeb(slug, dir, pedido) {
  const config = store.getConfig(dir);
  const template = (config.mensagens && config.mensagens.pedidoConfirmado) || MSG_CONFIRMADO_PADRAO;
  const tempo = (config.atendimento && config.atendimento.tempoEstimado) || "";
  const texto = template
    .replace(/\{numero\}/g, String(pedido.numero))
    .replace(/\{tempo\}/g, tempo)
    .replace(/\{cliente\}/g, pedido.cliente || "");
  let destino = pedido.chatId || "";
  const ehJid = destino.endsWith("@s.whatsapp.net") || destino.endsWith("@lid");
  if (!ehJid) {
    const digits = (pedido.telefone || "").replace(/\D/g, "");
    if (digits.length < 10) return; // sem canal/telefone — não há como confirmar
    destino = (digits.length <= 11 ? "55" + digits : digits) + "@s.whatsapp.net";
  }
  await multiBot.enviarMensagem(slug, destino, texto);
}

// Recebe o pedido montado no cardápio web. RECALCULA tudo no servidor (nunca confia em
// Sanitiza os campos estruturados de endereço vindos do checkout (p/ a tabela
// `enderecos`). Limites curtos; CEP só dígitos; UF maiúscula.
function sanitizarEnderecoCampos(c) {
  c = c || {};
  const s = (v, n) => String(v || "").trim().slice(0, n);
  return {
    cep: s(c.cep, 12).replace(/\D/g, "").slice(0, 8),
    logradouro: s(c.logradouro, 160),
    numero: s(c.numero, 20),
    complemento: s(c.complemento, 80),
    bairro: s(c.bairro, 80),
    cidade: s(c.cidade, 80),
    uf: s(c.uf, 2).toUpperCase(),
  };
}

// preço/total do cliente), salva e dispara a confirmação pelo bot. Sem auth, rate-limited.
app.post("/api/c/:slug/pedido", publicoLimiter, async (req, res) => {
  try {
    const emp = await empresas.buscarPorSlug(req.params.slug);
    if (!emp || !empresas.acessoLiberado(emp)) return res.status(404).json({ erro: "Cardápio indisponível." });
    const dir = empresas.tenantDir(emp.slug);
    await store.ensure(dir);
    if (!estaAberto(dir)) return res.status(409).json({ erro: "O restaurante está fechado no momento." });

    const b = req.body || {};
    const cliente = String(b.cliente || "").trim().slice(0, 120);
    const telefone = String(b.telefone || "").replace(/\D/g, "");
    const tipoEntrega = b.tipoEntrega === "Retirada" ? "Retirada" : "Entrega";
    const endereco = tipoEntrega === "Entrega" ? String(b.endereco || "").trim().slice(0, 300) : "";
    const pagamento = String(b.pagamento || "").trim().slice(0, 60);
    const observacao = String(b.observacao || "").trim().slice(0, 300);

    if (cliente.length < 2) return res.status(400).json({ erro: "Informe seu nome." });
    if (telefone.length < 10) return res.status(400).json({ erro: "Telefone inválido." });
    if (!Array.isArray(b.itens) || !b.itens.length) return res.status(400).json({ erro: "Carrinho vazio." });
    if (tipoEntrega === "Entrega" && endereco.length < 4) return res.status(400).json({ erro: "Informe o endereço de entrega." });

    const config = store.getConfig(dir);
    const pagamentos = Array.isArray(config.pagamentos) ? config.pagamentos : [];
    if (pagamentos.length && pagamentos.indexOf(pagamento) === -1) return res.status(400).json({ erro: "Forma de pagamento inválida." });

    let recalc;
    try {
      recalc = cardapioWeb.recalcularItens(store.getCardapio(dir), b.itens);
    } catch (e) {
      return res.status(409).json({ erro: e.message || "Item indisponível." });
    }
    if (!recalc.itens.length) return res.status(400).json({ erro: "Carrinho vazio." });

    const taxaEntrega = tipoEntrega === "Entrega" ? (Number(config.atendimento && config.atendimento.taxaEntrega) || 0) : 0;
    const total = recalc.subtotal + taxaEntrega;

    // chatId do token (liga ao cliente do WhatsApp); ausente/expirado → confirma pelo telefone.
    const tk = cardapioWeb.verificarToken(CARDAPIO_LINK_SECRET, b.token, emp.slug);
    const chatId = tk ? tk.chatId : "";

    const pedido = await pedidos.salvarPedido(dir, {
      cliente, telefone, chatId, tipoEntrega, endereco, pagamento,
      taxaEntrega, itens: recalc.itens, total, observacao,
    });

    confirmarPedidoWeb(emp.slug, dir, pedido).catch((e) => console.error("confirmar pedido web:", e.message));

    // Cadastro do cliente + endereço (best-effort: o pedido já foi salvo acima).
    const enderecoCampos = tipoEntrega === "Entrega" ? sanitizarEnderecoCampos(b.enderecoCampos) : null;
    clientes
      .registrarDoPedido(dir, { telefone, chatId, nome: cliente, tipoEntrega, endereco: enderecoCampos })
      .catch((e) => console.error("registrar cliente web:", e.message));

    res.json({ numero: pedido.numero });
  } catch (e) {
    console.error("POST /api/c/:slug/pedido:", e.message);
    res.status(500).json({ erro: "Não foi possível registrar o pedido." });
  }
});

// ---- Gestão de cartões no painel (Stripe) ----
app.get("/api/assinatura/cartoes", exigeAuth, async (req, res) => {
  if (!stripeBilling.CONFIGURADO) return res.status(503).json({ erro: "Pagamento não configurado no servidor." });
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    if (!emp.stripeCustomerId) return res.json({ cartoes: [] });
    const cartoes = await stripeBilling.listarCartoes(emp.stripeCustomerId);
    res.json({ cartoes });
  } catch (e) {
    console.error("listar cartoes:", e.message);
    res.status(500).json({ erro: "Não foi possível carregar os cartões." });
  }
});

// Passo 1 de adicionar cartão: SetupIntent para o Payment Element do painel.
app.post("/api/assinatura/cartoes/setup-intent", exigeAuth, async (req, res) => {
  if (!stripeBilling.CONFIGURADO) return res.status(503).json({ erro: "Pagamento não configurado no servidor." });
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    const customer = await stripeBilling.garantirCustomer({
      slug: emp.slug, nome: emp.nome, email: emp.email, stripeCustomerId: emp.stripeCustomerId,
    });
    const r = await stripeBilling.criarSetupIntentCartao(customer);
    res.json(r);
  } catch (e) {
    console.error("setup-intent cartao:", e.message);
    res.status(500).json({ erro: "Não foi possível iniciar a adição do cartão." });
  }
});

app.patch("/api/assinatura/cartoes/:id/padrao", exigeAuth, async (req, res) => {
  if (!stripeBilling.CONFIGURADO) return res.status(503).json({ erro: "Pagamento não configurado no servidor." });
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    if (!emp.stripeCustomerId) return res.status(400).json({ erro: "Você ainda não iniciou uma assinatura." });
    await stripeBilling.definirCartaoPadrao({
      stripeCustomerId: emp.stripeCustomerId,
      stripeSubscriptionId: emp.stripeSubscriptionId,
      paymentMethodId: req.params.id,
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.delete("/api/assinatura/cartoes/:id", exigeAuth, async (req, res) => {
  if (!stripeBilling.CONFIGURADO) return res.status(503).json({ erro: "Pagamento não configurado no servidor." });
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    if (!emp.stripeCustomerId) return res.status(400).json({ erro: "Você ainda não iniciou uma assinatura." });
    await stripeBilling.removerCartao({ stripeCustomerId: emp.stripeCustomerId, paymentMethodId: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// ---- Super-admin: autenticação master ----

// Credenciais efetivas do master: o banco (editável no painel) tem prioridade;
// a env (SUPERADMIN_*) é o BOOTSTRAP inicial (e o gate "feature habilitada").
async function credenciaisMaster() {
  let email = SUPERADMIN_EMAIL, hash = SUPERADMIN_SENHA_HASH;
  try {
    const m = await plataforma.obterMaster();
    if (m && m.email) email = m.email;
    if (m && m.senhaHash) hash = m.senhaHash;
  } catch (e) { /* sem banco → usa env */ }
  return { email, hash };
}

app.post("/api/admin/login", adminLoginLimiter, async (req, res) => {
  if (!SUPERADMIN_CONFIGURADO) return res.status(503).json({ erro: "Super-admin não configurado no servidor." });
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ erro: "Preencha e-mail e senha." });

  const cred = await credenciaisMaster();
  const emailOk = email === cred.email;
  const senhaOk = empresas.verificarSenhaMaster(senha, cred.hash);
  if (!emailOk || !senhaOk) return res.status(401).json({ erro: "E-mail ou senha incorretos." });

  const token = gerarToken();
  tokensAdmin.set(token, Date.now() + TOKEN_ADMIN_TTL_MS);
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

// ---- Configurações da plataforma (aba "Configurações Master") ----
// Dados da empresa Nymbus + contato/redes + e-mail do master (nunca o hash).
app.get("/api/admin/plataforma", exigeSuperAdmin, async (_req, res) => {
  try {
    const cfg = await plataforma.obter();
    const cred = await credenciaisMaster();
    res.json({
      razaoSocial: cfg.razaoSocial || "",
      nomeFantasia: cfg.nomeFantasia || "",
      cnpj: cfg.cnpj || "",
      endereco: cfg.endereco || "",
      telefone: cfg.telefone || "",
      facebook: cfg.facebook || "",
      instagram: cfg.instagram || "",
      suporteWhatsapp: cfg.suporteWhatsapp || "",
      envFallback: SUPORTE_WHATSAPP || "",
      masterEmail: cred.email || "",
      atualizadoEm: cfg.atualizadoEm || null,
    });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao carregar as configurações." });
  }
});

// Salva os dados da empresa/contato/redes (não mexe nas credenciais).
app.put("/api/admin/plataforma", exigeSuperAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const cfg = await plataforma.salvar({
      razaoSocial: b.razaoSocial, nomeFantasia: b.nomeFantasia, cnpj: b.cnpj,
      endereco: b.endereco, telefone: b.telefone,
      facebook: b.facebook, instagram: b.instagram, suporteWhatsapp: b.suporteWhatsapp,
    });
    res.json({ ok: true, ...cfg });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// Altera as credenciais do master (e-mail e/ou senha). Exige a SENHA ATUAL.
app.patch("/api/admin/conta", exigeSuperAdmin, async (req, res) => {
  try {
    const { senhaAtual, email, novaSenha } = req.body || {};
    const cred = await credenciaisMaster();
    if (!senhaAtual || !empresas.verificarSenhaMaster(senhaAtual, cred.hash)) {
      return res.status(400).json({ erro: "Senha atual incorreta." });
    }
    const dados = {};
    if (email && email.trim()) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return res.status(400).json({ erro: "E-mail inválido." });
      dados.email = email.trim();
    }
    if (novaSenha) {
      if (String(novaSenha).length < 6) return res.status(400).json({ erro: "A nova senha deve ter ao menos 6 caracteres." });
      dados.senhaHash = empresas.hashSenha(novaSenha);
    }
    if (!dados.email && !dados.senhaHash) return res.status(400).json({ erro: "Nada para alterar." });
    await plataforma.salvarMaster(dados);
    res.json({ ok: true, email: dados.email || cred.email });
  } catch (e) {
    res.status(400).json({ erro: e.message });
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
  const emp = await empresas.buscarPorSlug(slug);
  if (!emp) return res.status(404).json({ erro: "Tenant não encontrado." });
  // Efeito real: login recusado (autenticar filtra ativo) + exigeAuth checa ativo
  // a cada request (sessão aberta cai no próximo request); e o bot é derrubado.
  await empresas.setAtivo(slug, 0);
  await multiBot.desconectar(slug);
  // Pausa a cobrança no Stripe (reversível) para não cobrar enquanto suspenso.
  // O bloqueio de acesso já aconteceu; se o Stripe falhar, avisamos o admin.
  let avisoStripe = null;
  if (emp.stripeSubscriptionId) {
    try {
      await stripeBilling.pausarAssinatura(emp.stripeSubscriptionId);
    } catch (e) {
      console.error("pausar assinatura ao suspender:", e.message);
      avisoStripe = "Tenant suspenso, mas NÃO consegui pausar a cobrança no Stripe. Verifique no painel do Stripe ou contate o suporte para evitar cobrança indevida.";
    }
  }
  res.json({ ok: true, ativo: false, avisoStripe });
});

app.patch("/api/admin/tenants/:slug/reativar", exigeSuperAdmin, async (req, res) => {
  const slug = req.params.slug;
  const emp = await empresas.buscarPorSlug(slug);
  if (!emp) return res.status(404).json({ erro: "Tenant não encontrado." });
  await empresas.setAtivo(slug, 1);
  // Retoma a cobrança pausada na suspensão. Falhou? Reativa mesmo assim e avisa.
  let avisoStripe = null;
  if (emp.stripeSubscriptionId) {
    try {
      await stripeBilling.retomarAssinatura(emp.stripeSubscriptionId);
    } catch (e) {
      console.error("retomar assinatura ao reativar:", e.message);
      avisoStripe = "Tenant reativado, mas NÃO consegui retomar a cobrança no Stripe. Verifique no painel do Stripe ou contate o suporte.";
    }
  }
  res.json({ ok: true, ativo: true, avisoStripe });
});

app.delete("/api/admin/tenants/:slug", exigeSuperAdmin, async (req, res) => {
  const slug = req.params.slug;
  const { confirmacao } = req.body || {};

  if (confirmacao !== slug) {
    return res.status(400).json({ erro: "Confirmação não confere. Envie { confirmacao: \"<slug>\" } igual ao slug." });
  }

  const empresa = await empresas.buscarPorSlug(slug);
  if (!empresa) return res.status(404).json({ erro: "Tenant não encontrado." });

  // Se houver assinatura no Stripe, CANCELA antes de apagar — senão ficaria órfã
  // cobrando o cartão. Falhou? Aborta a exclusão (não deixa cobrança viva).
  if (empresa.stripeSubscriptionId) {
    try {
      await stripeBilling.cancelarAssinatura(empresa.stripeSubscriptionId);
    } catch (e) {
      console.error("cancelar assinatura na exclusão (master):", e.message);
      return res.status(502).json({
        erro: "Não foi possível cancelar a assinatura no Stripe, então o tenant NÃO foi excluído (evita cobrança órfã). Verifique no painel do Stripe e tente de novo; se persistir, contate o suporte.",
      });
    }
  }

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
    console.error("bot/resetar:", e.message);
    res.status(500).json({ erro: "Não foi possível resetar a sessão. Tente novamente." });
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
  const invalido = validarConfig(req.body);
  if (invalido) return res.status(400).json({ erro: invalido });
  try {
    await store.setConfig(req.tenantDir, req.body);
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

// LGPD — Exportar meus dados: devolve TODO o conteúdo do tenant (acesso +
// portabilidade). O cliente baixa como arquivo JSON.
app.get("/api/conta/exportar", exigeAuth, async (req, res) => {
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    if (!emp) return res.status(404).json({ erro: "Conta não encontrada." });
    await store.ensure(req.tenantDir);
    const dados = {
      exportadoEm: new Date().toISOString(),
      empresa: {
        nome: emp.nome,
        email: emp.email,
        slug: emp.slug,
        criadoEm: emp.criado_em,
      },
      assinatura: {
        status: emp.assinaturaStatus,
        trialAte: emp.trialAte,
        proximaCobranca: emp.proximaCobranca,
      },
      config: store.getConfig(req.tenantDir),
      cardapio: store.getCardapio(req.tenantDir),
      pedidos: await pedidos.lerTodos(req.tenantDir),
      clientes: await clientes.exportar(req.tenantDir),
    };
    res.json(dados);
  } catch (e) {
    res.status(500).json({ erro: "Falha ao exportar os dados." });
  }
});

// LGPD — Excluir minha conta (autoatendimento, DESTRUTIVO). Exige a senha
// atual + confirmação textual. Apaga tudo (empresa, pedidos em cascata,
// sessão do WhatsApp, usuário do Auth e imagens). Desconecta o bot antes.
app.delete("/api/conta", exigeAuth, async (req, res) => {
  try {
    const { senhaAtual, confirmacao } = req.body || {};
    if (confirmacao !== "EXCLUIR") {
      return res.status(400).json({ erro: 'Digite "EXCLUIR" para confirmar.' });
    }
    const ok = await empresas.conferirSenha(req.slug, senhaAtual);
    if (!ok) return res.status(400).json({ erro: "Senha atual incorreta." });

    // Se houver assinatura ativa no Stripe, CANCELA antes de apagar — senão a
    // assinatura ficaria órfã cobrando o cartão. Falhou? Aborta a exclusão.
    const emp = await empresas.buscarPorSlug(req.slug);
    if (emp && emp.stripeSubscriptionId) {
      try {
        await stripeBilling.cancelarAssinatura(emp.stripeSubscriptionId);
      } catch (e) {
        console.error("cancelar assinatura na exclusão (self):", e.message);
        return res.status(502).json({
          erro: "Não foi possível cancelar sua assinatura agora, então não excluímos a conta para evitar cobranças. Tente novamente em instantes; se persistir, fale com o suporte.",
        });
      }
    }

    await multiBot.desconectar(req.slug).catch(() => {});
    await empresas.excluir(req.slug);
    limparSessaoCookies(req, res); // conta apagada → derruba a sessão
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao excluir a conta." });
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
  const invalido = validarCardapio(req.body);
  if (invalido) return res.status(400).json({ erro: invalido });
  try {
    await store.setCardapio(req.tenantDir, req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

// Link público do cardápio web + QR Code (p/ o dono copiar/imprimir e divulgar).
// A URL usa o host da requisição (localhost no teste, domínio em produção) — fonte
// única da verdade. QR como data URL PNG (CSP libera imgSrc data:).
app.get("/api/cardapio/link", exigeAuth, async (req, res) => {
  try {
    const url = `${baseUrlDe(req)}/c/${req.slug}`;
    const qr = await QRCode.toDataURL(url, { margin: 2, width: 512 });
    res.json({ url, qr });
  } catch (e) {
    console.error("GET /api/cardapio/link:", e.message);
    res.status(500).json({ erro: "Falha ao gerar o link do cardápio." });
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

    if (!MIME_TO_EXT[req.file.mimetype]) return res.status(400).json({ erro: "Tipo inválido. Use JPEG, PNG ou WebP." });

    // Confere a assinatura REAL dos bytes e usa o tipo detectado como fonte de
    // verdade para extensão/contentType (o MIME do header é falsificável).
    const tipo = tipoImagemPorAssinatura(req.file.buffer);
    if (!tipo) return res.status(400).json({ erro: "O arquivo não é uma imagem JPEG, PNG ou WebP válida." });

    try {
      const filename = `${crypto.randomBytes(16).toString("hex")}-${Date.now()}.${tipo.ext}`;
      const caminho  = `${req.slug}/${filename}`; // isolamento por tenant na pasta do bucket
      const { error } = await supabaseAdmin.storage
        .from(BUCKET_IMAGENS)
        .upload(caminho, req.file.buffer, { contentType: tipo.mime, upsert: false });
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

// Último pedido (nº + cliente) — consulta leve p/ o polling de notificação do
// painel detectar pedido novo sem baixar a lista inteira.
app.get("/api/pedidos/ultimo", exigeAuth, async (req, res) => {
  try {
    const p = await pedidos.ultimo(req.tenantDir);
    res.json(p || { numero: 0 });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao consultar pedidos." });
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
    if (status === 500) console.error("pedido/avisar:", e.message);
    res.status(status).json({ erro: status === 400 ? e.message : "Não foi possível enviar o aviso ao cliente." });
  }
});

// ---- Simulador (Prévia do atendimento) ----

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
