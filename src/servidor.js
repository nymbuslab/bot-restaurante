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
const caixa = require("./caixa");
const clientes = require("./clientes");
const auditoria = require("./auditoria");
const cep = require("./cep");
const frete = require("./frete");
const mail = require("./email");
const db = require("./db");
const multiBot = require("./multi-bot");
const { supabaseAdmin, supabaseAnon } = require("./supabase");
const stripeBilling = require("./stripe");
const { validarConfig, validarCardapio, tipoImagemPorAssinatura } = require("./validacao");
const { getSessao, resetSessao } = require("./sessoes");
const { processarMensagem, estaAberto } = require("./fluxo");
const cardapioWeb = require("./cardapio-web");
const estoque = require("../public/estoque"); // dual-mode Node/browser
const texto = require("../public/texto");     // dual-mode Node/browser (padroniza nomes)
const pdv = require("./pdv");
const mesas = require("./mesas");       // lógica pura (total/split/falta)
const mesasDb = require("./mesas-db");  // CRUD + recebimento parcial/fechamento
const impressaoFila = require("./impressao-fila"); // fila genérica consumida pelo agente
const Comanda = require("../public/comanda");      // dual-mode: monta as vias no servidor p/ enfileirar

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
const esqueciLimiter    = limitador(60, 5,  "Muitas solicitações de redefinição. Tente novamente mais tarde."); // esqueci a senha

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

// ---- Autenticação SUPER-ADMIN (conta master) ----
// O master é um usuário do Supabase Auth (como os restaurantes), reconhecido
// como super-admin por uma ALLOWLIST de e-mail: `master_email` (plataforma_config,
// editável) com bootstrap na env SUPERADMIN_EMAIL. Quem loga com esse e-mail vira
// super-admin; qualquer outro usuário Supabase (restaurante) NÃO entra no /api/admin/*.
// Sem token em memória — o JWT do Supabase é validado localmente (jose/JWKS).
const SUPERADMIN_EMAIL       = (process.env.SUPERADMIN_EMAIL || "").trim().toLowerCase();
const SUPERADMIN_CONFIGURADO = Boolean(SUPERADMIN_EMAIL);

// E-mail do master (allowlist): banco tem prioridade; env é o bootstrap.
async function masterEmail() {
  let email = SUPERADMIN_EMAIL;
  try { const m = await plataforma.obterMaster(); if (m && m.email) email = m.email.trim().toLowerCase(); }
  catch (_) { /* sem banco → usa env */ }
  return email;
}

// Informações da plataforma (Nymbus) expostas ao painel do cliente.
// Por ora vêm de env; no futuro, a aba "Nymbus" do painel master alimenta isto.
// Só dígitos (formato wa.me): ex. SUPORTE_WHATSAPP=5511999999999
const SUPORTE_WHATSAPP = (process.env.SUPORTE_WHATSAPP || "").replace(/\D/g, "");

if (!SUPERADMIN_CONFIGURADO) {
  console.warn("⚠️  Super-admin não configurado (defina SUPERADMIN_EMAIL = e-mail do master). Rotas /api/admin/* desativadas até configurar.");
}

// Valida o JWT do Supabase e exige que o e-mail seja o do master (allowlist).
async function exigeSuperAdmin(req, res, next) {
  try {
    const token = (req.headers["authorization"] || "").replace("Bearer ", "");
    const info = await empresas.emailDoToken(token);
    const alvo = await masterEmail();
    if (!info || !alvo || info.email !== alvo) return res.status(401).json({ erro: "Não autorizado" });
    req.adminEmail = info.email;
    req.adminUserId = info.id;
    next();
  } catch (e) {
    res.status(401).json({ erro: "Não autorizado" });
  }
}

// ---- Rotas públicas ----

app.post("/api/cadastro", cadastroLimiter, async (req, res) => {
  try {
    const { nome, email, senha, aceite } = req.body || {};
    if (!nome || !email || !senha) return res.status(400).json({ erro: "Preencha todos os campos." });
    if (senha.length < 6) return res.status(400).json({ erro: "Senha deve ter pelo menos 6 caracteres." });
    if (aceite !== true) return res.status(400).json({ erro: "É necessário aceitar os Termos de Uso e a Política de Privacidade." });
    const empresa = await empresas.cadastrar({ nome, email, senha });
    mail.boasVindas(email, empresa.nome).catch((e) => console.error("email boas-vindas:", e.message));
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

// ---- Agente de impressão desktop ----
// Diferente do painel (que guarda o refresh em cookie httpOnly), o agente é um app
// Electron e guarda o refresh no cofre do SO → devolvemos o refresh NO CORPO.
app.post("/api/agente/login", loginLimiter, async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    const r = await empresas.autenticar(email, senha);
    if (!r) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    res.json({ token: r.token, refresh: r.refreshToken, slug: r.slug, nome: r.nome });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao entrar. Tente de novo." });
  }
});

app.post("/api/agente/refresh", refreshLimiter, async (req, res) => {
  try {
    const r = await empresas.renovarSessao((req.body || {}).refresh);
    if (!r) return res.status(401).json({ erro: "Sessão expirada. Entre novamente." });
    res.json({ token: r.token, refresh: r.refreshToken, slug: r.slug, nome: r.nome });
  } catch (e) {
    res.status(401).json({ erro: "Sessão expirada. Entre novamente." });
  }
});

// Pedidos novos (cardápio web) que o agente ainda não imprimiu — alvo do polling.
app.get("/api/agente/pendentes", exigeAuth, async (req, res) => {
  try {
    res.json(await pedidos.pendentes(req.tenantDir));
  } catch (e) {
    res.status(500).json({ erro: "Falha ao consultar pendentes." });
  }
});

// O agente confirma que imprimiu (idempotente): não reimprime em reinício/2 agentes.
app.post("/api/agente/pedidos/:numero/impresso", exigeAuth, async (req, res) => {
  try {
    const marcado = await pedidos.marcarImpresso(req.tenantDir, req.params.numero);
    res.json({ ok: true, marcado });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao marcar como impresso." });
  }
});

// Fila GENÉRICA (PDV/Mesas/Caixa/reimpressão): cada item já traz o TEXTO das vias.
app.get("/api/agente/fila", exigeAuth, async (req, res) => {
  try {
    res.json(await impressaoFila.pendentes(req.tenantDir));
  } catch (e) {
    res.status(500).json({ erro: "Falha ao consultar a fila." });
  }
});

app.post("/api/agente/fila/:id/impresso", exigeAuth, async (req, res) => {
  try {
    const marcado = await impressaoFila.marcarImpresso(req.tenantDir, req.params.id);
    res.json({ ok: true, marcado });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao marcar a fila como impressa." });
  }
});

// Download do agente de impressão (Windows). Serve o instalador .exe mais recente
// de agente-impressora/dist sob um nome estável (resiliente à versão no arquivo).
app.get("/downloads/nymbus-impressora.exe", (req, res) => {
  try {
    const dir = path.join(__dirname, "..", "agente-impressora", "dist");
    const exe = require("fs").readdirSync(dir).find((f) => f.toLowerCase().endsWith(".exe"));
    if (!exe) return res.status(404).send("Instalador indisponível no momento.");
    res.download(path.join(dir, exe), "Nymbus Impressora Setup.exe");
  } catch (e) {
    res.status(404).send("Instalador indisponível no momento.");
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
// Troca de plano (upgrade/downgrade) de uma assinatura viva, com proration.
app.post("/api/assinatura/plano", exigeAuth, async (req, res) => {
  if (!stripeBilling.CONFIGURADO) return res.status(503).json({ erro: "Pagamento não configurado no servidor." });
  const plano = req.body && req.body.plano;
  if (plano !== "essencial" && plano !== "completo") return res.status(400).json({ erro: "Plano inválido." });
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    if (!emp.stripeSubscriptionId) return res.status(400).json({ erro: "Ative um plano antes de trocar." });
    if (empresas.planoDe(emp) === plano) return res.json({ ok: true, jaNoPlano: true });
    await stripeBilling.trocarPlano(emp.slug, emp.stripeSubscriptionId, plano);
    res.json({ ok: true });
  } catch (e) {
    console.error("trocar plano:", e.message);
    res.status(500).json({ erro: "Não foi possível trocar de plano. Tente novamente." });
  }
});

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
  const { setupIntentId, plano } = req.body || {};
  if (!setupIntentId) return res.status(400).json({ erro: "setupIntentId é obrigatório." });
  try {
    const emp = await empresas.buscarPorSlug(req.slug);
    if (!emp.stripeCustomerId) return res.status(400).json({ erro: "Inicie o checkout antes de confirmar." });
    await stripeBilling.ativarAssinaturaComSetup({
      slug: emp.slug,
      setupIntentId,
      stripeCustomerId: emp.stripeCustomerId,
      stripeSubscriptionId: emp.stripeSubscriptionId,
      plano: plano === "completo" ? "completo" : "essencial",
    });
    const planoNome = plano === "completo" ? "Plano Completo" : "Plano Essencial";
    mail.assinaturaConfirmada(emp.email, emp.nome, planoNome).catch((e) => console.error("email assinatura:", e.message));
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
        logo: r.logo || "",
        capa: r.capa || "",
      },
      // Frete: modo + taxa fixa; no raio NÃO expõe faixas/coords (privado) —
      // só o modo e a política de fora-da-área; o valor sai do POST .../frete.
      frete: (function () {
        const f = frete.freteDeConfig(config);
        return f.modo === "raio"
          ? { modo: "raio", foraDaArea: f.raio.foraDaArea, configurado: !!(f.raio.coordEmpresa && f.raio.faixas.length) }
          : { modo: "fixo", taxaFixa: f.taxaFixa };
      })(),
      taxaEntrega: frete.freteDeConfig(config).taxaFixa, // compat (checkout antigo)
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

// Página de redefinição de senha (link do e-mail: /redefinir-senha?token=...).
app.get("/redefinir-senha", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "redefinir-senha.html"));
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

// ---- "Esqueci a senha" (cliente e master — ambos usuários do Supabase Auth) ----
// Resposta SEMPRE genérica (anti-enumeração). Se o usuário existir, gera um token
// (guarda só o HASH, expira em 1h, uso único) e manda o link pelo Resend.
const RESET_TTL_MS = 60 * 60 * 1000; // 1h
const hashToken = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");

app.post("/api/esqueci-senha", esqueciLimiter, async (req, res) => {
  const email_ = String((req.body && req.body.email) || "").trim().toLowerCase();
  res.json({ ok: true }); // responde já, genérico (não revela se o e-mail existe)
  try {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email_)) return;
    const user = await empresas.acharAuthUserPorEmail(email_);
    if (!user) return; // usuário não existe → não manda nada (resposta já foi genérica)
    const token = crypto.randomBytes(32).toString("hex");
    const expira = new Date(Date.now() + RESET_TTL_MS).toISOString();
    await db.query(
      "INSERT INTO password_resets (token_hash, email, expira_em) VALUES ($1, $2, $3)",
      [hashToken(token), email_, expira]
    );
    // Base SEMPRE a partir de PUBLIC_URL (domínio confiável) — nunca do header Host,
    // que é forjável e permitiria "envenenar" o link de reset enviado por e-mail.
    const base = (process.env.PUBLIC_URL || "").replace(/\/+$/, "") || baseUrlDe(req);
    const link = `${base}/redefinir-senha?token=${token}`;
    await mail.resetSenha(email_, link).catch((e) => console.error("email reset:", e.message));
  } catch (e) {
    console.error("esqueci-senha:", e.message);
  }
});

app.post("/api/redefinir-senha", esqueciLimiter, async (req, res) => {
  const { token, novaSenha } = req.body || {};
  if (!token) return res.status(400).json({ erro: "Link inválido." });
  if (!novaSenha || String(novaSenha).length < 6) return res.status(400).json({ erro: "A nova senha deve ter ao menos 6 caracteres." });
  try {
    const r = await db.query(
      "SELECT email FROM password_resets WHERE token_hash = $1 AND usado = false AND expira_em > now()",
      [hashToken(token)]
    );
    if (!r.rows[0]) return res.status(400).json({ erro: "Link inválido ou expirado. Solicite um novo." });
    const user = await empresas.acharAuthUserPorEmail(r.rows[0].email);
    if (!user) return res.status(400).json({ erro: "Link inválido." });
    const upd = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: String(novaSenha) });
    if (upd.error) return res.status(400).json({ erro: "Não foi possível redefinir a senha." });
    await db.query("UPDATE password_resets SET usado = true WHERE token_hash = $1", [hashToken(token)]);
    res.json({ ok: true });
  } catch (e) {
    console.error("redefinir-senha:", e.message);
    res.status(500).json({ erro: "Falha ao redefinir a senha." });
  }
});

// Cálculo de frete por raio no checkout (Plano Completo). Público, rate-limited.
// CEP → ViaCEP (cep.js) → endereço; cliente dá o número → geocodifica (cache) →
// distância (Haversine) vs coords da empresa → faixa. Nunca expõe a chave/coords.
app.post("/api/c/:slug/frete", publicoLimiter, async (req, res) => {
  try {
    const emp = await empresas.buscarPorSlug(req.params.slug);
    if (!emp || !empresas.acessoLiberado(emp)) return res.status(404).json({ erro: "Indisponível." });
    const dir = empresas.tenantDir(emp.slug);
    await store.ensure(dir);
    const f = frete.freteDeConfig(store.getConfig(dir));
    if (f.modo !== "raio") return res.status(400).json({ erro: "Frete por raio não está ativo." });
    if (!f.raio.coordEmpresa || !f.raio.faixas.length) {
      return res.json({ entrega_disponivel: false, foraDaArea: f.raio.foraDaArea, mensagem: "Entrega indisponível no momento." });
    }
    const b = req.body || {};
    const cepDig = String(b.cep || "").replace(/\D/g, "");
    const numero = String(b.numero || "").trim().slice(0, 20);
    if (cepDig.length !== 8) return res.status(400).json({ erro: "CEP inválido." });
    if (!numero) return res.status(400).json({ erro: "Informe o número do endereço." });

    const end = await cep.buscarCep(cepDig);
    if (!end) return res.json({ entrega_disponivel: false, foraDaArea: f.raio.foraDaArea, mensagem: "CEP não encontrado." });
    const coordCliente = await frete.geocodificar(frete.montarEnderecoCompleto(Object.assign({}, end, { numero })));
    if (!coordCliente) return res.json({ entrega_disponivel: false, foraDaArea: f.raio.foraDaArea, mensagem: "Não foi possível localizar o endereço." });

    const r = frete.calcularFreteRaio(f.raio.coordEmpresa, coordCliente, f.raio.faixas);
    res.json({
      entrega_disponivel: r.entrega_disponivel,
      distancia_km: r.distancia_km,
      valor_frete: r.valor_frete,
      foraDaArea: f.raio.foraDaArea,
      endereco: { cep: cepDig, logradouro: end.logradouro, bairro: end.bairro, cidade: end.cidade, uf: end.uf, numero },
    });
  } catch (e) {
    console.error("POST /api/c/:slug/frete:", e.message);
    res.status(500).json({ erro: "Falha ao calcular o frete." });
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

// Frete do PDV (servidor = fonte de verdade): Fixo → taxa única; Raio → geocode
// do endereço (Haversine + faixa). Retorna { taxa, entrega_disponivel, distancia,
// foraDaArea, incompleto }. Usado pela rota /api/pdv/frete e por /api/pdv/vender.
async function calcularFretePdv(dir, tipoEntrega, enderecoCampos) {
  if (tipoEntrega !== "Entrega") return { taxa: 0, entrega_disponivel: true };
  const f = frete.freteDeConfig(store.getConfig(dir));
  if (f.modo !== "raio") return { taxa: Number(f.taxaFixa) || 0, entrega_disponivel: true };
  if (!f.raio.coordEmpresa || !f.raio.faixas.length) return { taxa: 0, entrega_disponivel: false, foraDaArea: true };
  const ec = sanitizarEnderecoCampos(enderecoCampos);
  if (ec.cep.length !== 8 || !ec.numero) return { taxa: 0, entrega_disponivel: false, incompleto: true };
  const endCep = await cep.buscarCep(ec.cep);
  const coordCli = endCep ? await frete.geocodificar(frete.montarEnderecoCompleto(Object.assign({}, endCep, { numero: ec.numero }))) : null;
  const rr = frete.calcularFreteRaio(f.raio.coordEmpresa, coordCli, f.raio.faixas);
  if (!rr.entrega_disponivel) return { taxa: 0, entrega_disponivel: false, foraDaArea: true, distancia: rr.distancia_km };
  return { taxa: Number(rr.valor_frete) || 0, entrega_disponivel: true, distancia: rr.distancia_km };
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

    // Item "só no local" não sai para entrega (defesa real — o front também barra).
    if (tipoEntrega === "Entrega") {
      const soLocal = cardapioWeb.itensSoLocal(store.getCardapio(dir), b.itens);
      if (soLocal.length) {
        return res.status(400).json({ erro: "Estes itens são vendidos só no local e não saem para entrega: " + soLocal.join(", ") + ". Troque para Retirada ou remova-os." });
      }
    }

    // Estoque ativo: rejeita esgotado / pedido maior que o disponível (fonte de verdade).
    const estCheck = estoque.validarEstoque(store.getCardapio(dir), b.itens);
    if (!estCheck.ok) return res.status(400).json({ erro: estCheck.erro });

    // Frete: o servidor é a fonte de verdade. Fixo = taxa única; Raio = recalcula
    // do endereço (geocode + Haversine + faixa) e barra se estiver fora da área.
    const f = frete.freteDeConfig(config);
    let taxaEntrega = 0;
    if (tipoEntrega === "Entrega") {
      if (f.modo === "raio") {
        if (!f.raio.coordEmpresa || !f.raio.faixas.length) return res.status(409).json({ erro: "Entrega indisponível no momento." });
        const ec = sanitizarEnderecoCampos(b.enderecoCampos);
        if (ec.cep.length !== 8 || !ec.numero) return res.status(400).json({ erro: "Endereço incompleto para entrega (CEP e número)." });
        const endCep = await cep.buscarCep(ec.cep);
        const coordCli = endCep ? await frete.geocodificar(frete.montarEnderecoCompleto(Object.assign({}, endCep, { numero: ec.numero }))) : null;
        const rr = frete.calcularFreteRaio(f.raio.coordEmpresa, coordCli, f.raio.faixas);
        if (!rr.entrega_disponivel) return res.status(409).json({ erro: "Endereço fora da área de entrega." });
        taxaEntrega = rr.valor_frete;
      } else {
        taxaEntrega = f.taxaFixa;
      }
    }
    const total = recalc.subtotal + taxaEntrega;

    // chatId do token (liga ao cliente do WhatsApp); ausente/expirado → confirma pelo telefone.
    const tk = cardapioWeb.verificarToken(CARDAPIO_LINK_SECRET, b.token, emp.slug);
    const chatId = tk ? tk.chatId : "";

    // Pedido + baixa de estoque numa ÚNICA transação (atômica): trava o tenant
    // (FOR UPDATE), revalida o estoque na versão fresca e decrementa; se faltar
    // estoque (corrida), faz ROLLBACK e o pedido não é salvo. O lock também
    // serializa o MAX(numero)+1 (sem número duplicado).
    let pedido, novoCardapio;
    const clientTx = await db.pool.connect();
    try {
      await clientTx.query("BEGIN");
      novoCardapio = await store.baixarEstoqueTx(clientTx, dir, b.itens);
      pedido = await pedidos.salvarPedido(dir, {
        cliente, telefone, chatId, tipoEntrega, endereco, pagamento,
        taxaEntrega, itens: recalc.itens, total, observacao,
      }, clientTx);
      await clientTx.query("COMMIT");
    } catch (e) {
      await clientTx.query("ROLLBACK").catch(() => {});
      if (e.code === "ESTOQUE") return res.status(409).json({ erro: e.message });
      throw e;
    } finally {
      clientTx.release();
    }
    store.sincronizarCardapio(dir, novoCardapio); // cache reflete o estoque baixado

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

app.post("/api/admin/login", adminLoginLimiter, async (req, res) => {
  if (!SUPERADMIN_CONFIGURADO) return res.status(503).json({ erro: "Super-admin não configurado no servidor." });
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ erro: "Preencha e-mail e senha." });
  const alvo = await masterEmail();
  // Só o e-mail do master pode tentar — e a senha é validada pelo Supabase Auth.
  if (String(email).trim().toLowerCase() !== alvo) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
  try {
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email: alvo, password: senha });
    if (error || !data || !data.session) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    if ((data.user.email || "").toLowerCase() !== alvo) return res.status(401).json({ erro: "Não autorizado" });
    res.json({ token: data.session.access_token, refresh: data.session.refresh_token });
  } catch (e) {
    console.error("admin login:", e.message);
    res.status(401).json({ erro: "E-mail ou senha incorretos." });
  }
});

// Renova a sessão do master (o JWT do Supabase dura ~1h) usando o refresh token.
app.post("/api/admin/refresh", async (req, res) => {
  const { refresh } = req.body || {};
  if (!refresh) return res.status(401).json({ erro: "Sessão expirada" });
  try {
    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refresh });
    if (error || !data || !data.session) return res.status(401).json({ erro: "Sessão expirada" });
    if ((data.user.email || "").toLowerCase() !== (await masterEmail())) return res.status(401).json({ erro: "Não autorizado" });
    res.json({ token: data.session.access_token, refresh: data.session.refresh_token });
  } catch (e) {
    res.status(401).json({ erro: "Sessão expirada" });
  }
});

// Logout do master é stateless (o cliente descarta o token). No-op no servidor.
app.post("/api/admin/logout", (_req, res) => res.json({ ok: true }));

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
    const emailMaster = await masterEmail();
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
      masterEmail: emailMaster || "",
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

// Altera as credenciais do master (e-mail e/ou senha) no Supabase Auth. Exige a
// SENHA ATUAL. Trocar o e-mail também atualiza a allowlist (master_email no banco).
app.patch("/api/admin/conta", exigeSuperAdmin, async (req, res) => {
  try {
    const { senhaAtual, email, novaSenha } = req.body || {};
    const alvo = await masterEmail();
    const chk = await supabaseAnon.auth.signInWithPassword({ email: alvo, password: senhaAtual || "" });
    if (chk.error || !chk.data || !chk.data.session) return res.status(400).json({ erro: "Senha atual incorreta." });

    const updates = {};
    let novoEmail = null;
    if (email && email.trim() && email.trim().toLowerCase() !== alvo) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return res.status(400).json({ erro: "E-mail inválido." });
      novoEmail = email.trim().toLowerCase();
      updates.email = novoEmail;
    }
    if (novaSenha) {
      if (String(novaSenha).length < 6) return res.status(400).json({ erro: "A nova senha deve ter ao menos 6 caracteres." });
      updates.password = novaSenha;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ erro: "Nada para alterar." });

    const upd = await supabaseAdmin.auth.admin.updateUserById(req.adminUserId, updates);
    if (upd.error) return res.status(400).json({ erro: "Não foi possível atualizar a conta." });
    if (novoEmail) await plataforma.salvarMaster({ email: novoEmail }); // allowlist segue o e-mail
    const oQue = (updates.password && novoEmail) ? "Sua senha e e-mail" : updates.password ? "Sua senha" : "Seu e-mail de acesso";
    mail.avisoSeguranca(novoEmail || alvo, oQue).catch((e) => console.error("email aviso master:", e.message));
    res.json({ ok: true, email: novoEmail || alvo });
  } catch (e) {
    console.error("admin conta:", e.message);
    res.status(400).json({ erro: "Falha ao atualizar a conta." });
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
      plano: empresas.planoDe(emp),
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

// Troca o plano do tenant (Essencial <-> Completo). Com assinatura viva no Stripe,
// troca o preço lá (proration); senão (cortesia/sem Stripe), só ajusta a coluna.
app.patch("/api/admin/tenants/:slug/plano", exigeSuperAdmin, async (req, res) => {
  const slug = req.params.slug;
  const plano = req.body && req.body.plano;
  if (plano !== "essencial" && plano !== "completo") return res.status(400).json({ erro: "Plano inválido." });
  const emp = await empresas.buscarPorSlug(slug);
  if (!emp) return res.status(404).json({ erro: "Tenant não encontrado." });
  if (empresas.planoDe(emp) === plano) return res.json({ ok: true, plano, jaNoPlano: true });
  try {
    const temStripeVivo = emp.stripeSubscriptionId && ["trialing", "active", "past_due"].includes(emp.assinaturaStatus);
    if (temStripeVivo && stripeBilling.CONFIGURADO) {
      await stripeBilling.trocarPlano(slug, emp.stripeSubscriptionId, plano); // proration + aplica plano
    } else {
      await empresas.atualizarAssinatura(slug, { plano }); // override (cortesia / sem Stripe)
    }
    res.json({ ok: true, plano });
  } catch (e) {
    console.error("admin trocar plano:", e.message);
    res.status(500).json({ erro: "Não foi possível trocar o plano." });
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
    const body = req.body;
    let avisoFrete = null;
    // Frete por raio: feature do Plano Completo (gate no servidor, não confia no front).
    if (body.frete && body.frete.modo === "raio") {
      const emp = await empresas.buscarPorSlug(req.slug);
      if (!empresas.temFreteRaio(emp)) {
        body.frete.modo = "fixo"; // sem Completo → não ativa o raio
      } else {
        // Geocodifica o endereço da empresa 1x (regeocodifica só se o endereço mudou).
        const raio = body.frete.raio || (body.frete.raio = {});
        const endEmpresa = frete.montarEnderecoCompleto(body.restaurante || {});
        if (endEmpresa === "Brasil") {
          avisoFrete = "Cadastre o endereço completo do restaurante (com número) para o frete por raio funcionar.";
        } else if (!raio.coordEmpresa || raio.enderecoBase !== endEmpresa) {
          const coord = await frete.geocodificar(endEmpresa);
          if (coord) { raio.coordEmpresa = coord; raio.enderecoBase = endEmpresa; }
          else avisoFrete = "Não foi possível localizar o endereço do restaurante no mapa. Confira o endereço cadastrado.";
        }
      }
    }
    await store.setConfig(req.tenantDir, body);
    res.json({ ok: true, avisoFrete });
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
    res.json({ email: emp.email, nome: emp.nome, plano: empresas.planoDe(emp) });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao ler a conta." });
  }
});

app.patch("/api/conta/senha", exigeAuth, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body || {};
    await empresas.trocarSenha(req.slug, senhaAtual, novaSenha);
    const emp = await empresas.buscarPorSlug(req.slug);
    if (emp) mail.avisoSeguranca(emp.email, "Sua senha").catch((e) => console.error("email aviso senha:", e.message));
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.patch("/api/conta/email", exigeAuth, async (req, res) => {
  try {
    const { senhaAtual, novoEmail } = req.body || {};
    const email = await empresas.trocarEmail(req.slug, senhaAtual, novoEmail);
    mail.avisoSeguranca(email, "Seu e-mail de acesso").catch((e) => console.error("email aviso email:", e.message));
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
    await auditoria.registrar("dados_exportados", req.slug, {}); // trilha LGPD
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
    const contato = emp ? { email: emp.email, nome: emp.nome } : null;
    await empresas.excluir(req.slug);
    await auditoria.registrar("conta_excluida", req.slug, {}); // trilha LGPD (slug em texto sobrevive à exclusão)
    if (contato) mail.contaExcluida(contato.email, contato.nome).catch((e) => console.error("email exclusao:", e.message));
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
    // Padroniza os nomes (categoria/item/opcional) no servidor — toda salvada passa
    // por aqui, então o cardápio fica consistente no banco (imune a cache/stale panel).
    await store.setCardapio(req.tenantDir, texto.padronizarNomesCardapio(req.body));
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

// Quantas vendas o item já teve (decide o modal de exclusão no painel).
app.get("/api/cardapio/item/:id/vendas", exigeAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ erro: "id inválido" });
    const vendas = await pedidos.contarVendasDoItem(req.tenantDir, id);
    res.json({ vendas });
  } catch (e) {
    console.error("GET item vendas:", e.message);
    res.status(500).json({ erro: "Falha ao checar vendas." });
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

app.post("/api/pedidos/:id/cancelar", exigeAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pedido = await pedidos.lerPorId(req.tenantDir, id);
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });
    if (pedido.recebidoEm) {
      // Pedido PAGO: cancela mantendo o rastro e deduz no caixa (exige caixa aberto).
      // Caixa é recurso do Plano Completo → gate de servidor.
      if (!(await exigeCaixa(req, res))) return;
      await caixa.cancelarRecebido(req.tenantDir, id);
    } else {
      await pedidos.cancelarPedido(req.tenantDir, id);
    }
    res.json({ ok: true, recebido: !!pedido.recebidoEm });
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao cancelar o pedido." });
  }
});

app.post("/api/pedidos/:id/cancelar-item", exigeAuth, async (req, res) => {
  try {
    const b = req.body || {};
    if (b.itemIdx == null) return res.status(400).json({ erro: "itemIdx é obrigatório." });
    await pedidos.cancelarItemPedido(req.tenantDir, Number(req.params.id), Number(b.itemIdx));
    const pedido = await pedidos.lerPorId(req.tenantDir, Number(req.params.id));
    res.json(pedido);
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao cancelar o item." });
  }
});

// Reimpressão manual: re-enfileira a comanda (cozinha + cupom) do pedido para o
// agente. Substitui o antigo "Imprimir comanda" do navegador.
app.post("/api/pedidos/:id/reimprimir", exigeAuth, async (req, res) => {
  try {
    const pedido = await pedidos.lerPorId(req.tenantDir, Number(req.params.id));
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado." });
    await store.ensure(req.tenantDir);
    const cfg = store.getConfig(req.tenantDir) || {};
    const link = baseUrlDe(req) + "/c/" + req.slug;
    const { cozinha, cupom } = Comanda.montarComanda(pedido, cfg, { linkCardapio: link });
    await impressaoFila.enfileirar(req.tenantDir, "reimpressao", [cozinha, cupom]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao reimprimir." });
  }
});

// ---- Caixa (Plano Completo) ----
// Gate: caixa é recurso de servidor → barra no backend (não só no front).
async function exigeCaixa(req, res) {
  const emp = await empresas.buscarPorSlug(req.slug);
  if (!empresas.temCaixa(emp)) { res.status(403).json({ erro: "Recurso do Plano Completo." }); return false; }
  return true;
}

app.get("/api/caixa", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try {
    const data = await caixa.resumo(req.tenantDir);
    await store.ensure(req.tenantDir);
    const cfg = store.getConfig(req.tenantDir) || {};
    data.formasPagamento = Array.isArray(cfg.pagamentos) ? cfg.pagamentos : [];
    data.restaurante = (cfg.restaurante && cfg.restaurante.nome) || "";
    res.json(data);
  } catch (e) { res.status(500).json({ erro: "Falha ao ler o caixa." }); }
});

app.post("/api/caixa/abrir", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.abrirCaixa(req.tenantDir, { fundoTroco: req.body.fundoTroco, operador: req.body.operador, obsAbertura: req.body.obsAbertura })); }
  catch (e) { res.status(400).json({ erro: e.message }); }
});

app.post("/api/caixa/receber/:pedidoId", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.receberPedido(req.tenantDir, Number(req.params.pedidoId), { forma: req.body.forma, valor: req.body.valor })); }
  catch (e) { res.status(400).json({ erro: e.message }); }
});

app.post("/api/caixa/estornar/:pedidoId", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.estornarRecebimento(req.tenantDir, Number(req.params.pedidoId))); }
  catch (e) { res.status(400).json({ erro: e.message }); }
});

app.post("/api/caixa/movimento", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.registrarMovimento(req.tenantDir, { tipo: req.body.tipo, valor: req.body.valor, descricao: req.body.descricao })); }
  catch (e) { res.status(400).json({ erro: e.message }); }
});

app.post("/api/caixa/fechar", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try {
    const resultado = await caixa.fecharCaixa(req.tenantDir, { contagem: req.body.contagem, eletronico: req.body.eletronico });
    // Enfileira o relatório de fechamento (texto montado no servidor) p/ o agente imprimir.
    try {
      if (resultado && resultado.relatorio) await impressaoFila.enfileirar(req.tenantDir, "caixa", [resultado.relatorio]);
    } catch (e) { console.error("enfileirar impressão caixa:", e.message); }
    res.json(resultado);
  } catch (e) { res.status(400).json({ erro: e.message }); }
});

// "historico" ANTES de ":id" (senão cairia no parâmetro).
app.get("/api/caixa/historico", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.listarCaixas(req.tenantDir)); }
  catch (e) { res.status(500).json({ erro: "Falha ao listar caixas." }); }
});

app.get("/api/caixa/:id", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try {
    const d = await caixa.detalheCaixa(req.tenantDir, Number(req.params.id));
    if (!d) return res.status(404).json({ erro: "Caixa não encontrado." });
    res.json(d);
  } catch (e) { res.status(500).json({ erro: "Falha ao ler o caixa." }); }
});

// ---- PDV — venda no local (Plano Completo) ----
// Gate de servidor (não só no front). Fluxo atômico (Abordagem A): recalcula a
// venda pelo cardápio (fonte de verdade), aplica desconto, valida o split, grava
// pedido "Balcão" recebido + movimentos no caixa (caixa.venderLocal) e dá baixa
// no estoque (best-effort, igual ao cardápio web). Devolve o pedido p/ impressão.
async function exigePdv(req, res) {
  const emp = await empresas.buscarPorSlug(req.slug);
  if (!empresas.temPdv(emp)) { res.status(403).json({ erro: "Recurso do Plano Completo." }); return false; }
  return true;
}

// Cálculo de frete no PDV (autenticada). Front usa para o modo raio (CEP+número);
// no fixo retorna a taxa direto. Não expõe a chave/coords da empresa.
app.post("/api/pdv/frete", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    await store.ensure(req.tenantDir);
    const b = req.body || {};
    const r = await calcularFretePdv(req.tenantDir, "Entrega", { cep: b.cep, numero: b.numero });
    res.json({
      entrega_disponivel: r.entrega_disponivel,
      valor_frete: r.taxa,
      distancia_km: r.distancia != null ? r.distancia : null,
      foraDaArea: !!r.foraDaArea,
      incompleto: !!r.incompleto,
    });
  } catch (e) {
    console.error("POST /api/pdv/frete:", e.message);
    res.status(500).json({ erro: "Falha ao calcular o frete." });
  }
});

// Filtra os itens (já recalculados) cujo item de cardápio está marcado p/ imprimir
// na cozinha (`it.cozinha === true`) — só esses entram na via da cozinha.
function itensDeCozinha(cardapio, itens) {
  const ids = new Set();
  ((cardapio && cardapio.categorias) || []).forEach((c) =>
    ((c && c.itens) || []).forEach((it) => { if (it && it.cozinha === true) ids.add(it.id); }));
  return (itens || []).filter((i) => ids.has(i.id));
}

app.post("/api/pdv/vender", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const b = req.body || {};
    if (!Array.isArray(b.itens) || !b.itens.length) return res.status(400).json({ erro: "A venda está vazia." });

    await store.ensure(req.tenantDir);
    const cardapio = store.getCardapio(req.tenantDir);

    // Estoque (fonte de verdade no servidor) antes de gravar.
    const estCheck = estoque.validarEstoque(cardapio, b.itens);
    if (!estCheck.ok) return res.status(409).json({ erro: estCheck.erro });

    // Tipo da venda + frete (servidor é a fonte de verdade do frete).
    const tipoEntrega = ["Entrega", "Retirada"].includes(b.tipoEntrega) ? b.tipoEntrega : "Balcão";
    let endereco = "", telefone = "", taxaEntrega = 0;
    if (tipoEntrega === "Entrega") {
      endereco = String(b.endereco || "").trim().slice(0, 300);
      if (endereco.length < 4) return res.status(400).json({ erro: "Informe o endereço de entrega." });
      const soLocal = cardapioWeb.itensSoLocal(cardapio, b.itens);
      if (soLocal.length) return res.status(400).json({ erro: "Estes itens são vendidos só no local e não saem para entrega: " + soLocal.join(", ") + "." });
      const fr = await calcularFretePdv(req.tenantDir, "Entrega", b.enderecoCampos);
      // Não aceita entrega que o frete não cobre (em vez de cobrar 0 em silêncio):
      // endereço incompleto ou fora da área de entrega → erro claro p/ o operador.
      if (fr.incompleto) return res.status(400).json({ erro: "Para o frete por raio, informe o CEP e o número do endereço." });
      if (fr.foraDaArea) return res.status(400).json({ erro: "Endereço fora da área de entrega. Use Retirada/Balcão ou ajuste o endereço." });
      taxaEntrega = pdv.freteEfetivo(b.taxaEntrega, fr.taxa); // aceita só 0 (cortesia) ou o calculado
    }
    if (tipoEntrega !== "Balcão") telefone = String(b.telefone || "").replace(/[^\d]/g, "").slice(0, 20);

    // Recalcula itens/subtotal pelo cardápio; nunca confia no preço do cliente.
    const { itens, subtotal } = pdv.recalcularVenda(cardapio, b.itens);
    const { desconto, total: totalSemFrete } = pdv.aplicarDesconto(subtotal, b.desconto);
    const total = pdv.totalComFrete(totalSemFrete, taxaEntrega);
    const obs = String(b.observacao || "").slice(0, 200);

    // Comportamento por tipo de venda:
    //  • Balcão  → cliente paga na hora: pedido RECEBIDO + movimento no caixa (exige
    //    caixa aberto). Baixa de estoque atômica dentro de caixa.venderLocal.
    //  • Entrega/Retirada → SEM pagamento agora: pedido nasce "a receber" e vai para a
    //    aba Pedidos (recebimento depois); baixa de estoque atômica, sem mexer no caixa.
    let pedido;
    if (tipoEntrega === "Balcão") {
      pdv.validarPagamentos(total, b.pagamentos);
      pedido = await caixa.venderLocal(req.tenantDir, {
        cliente: b.cliente, itens, total, desconto,
        pagamentos: b.pagamentos,
        pagamentoResumo: pdv.resumoPagamento(b.pagamentos),
        observacao: obs, tipoEntrega, endereco, telefone, taxaEntrega,
      });
    } else {
      const clientTx = await db.pool.connect();
      try {
        await clientTx.query("BEGIN");
        const novoCardapio = await store.baixarEstoqueTx(clientTx, req.tenantDir, b.itens);
        pedido = await pedidos.salvarPedido(req.tenantDir, {
          cliente: b.cliente || "", telefone, tipoEntrega, endereco,
          pagamento: "", taxaEntrega, itens, total, observacao: obs,
          desconto, origem: "pdv",
        }, clientTx);
        await clientTx.query("COMMIT");
        store.sincronizarCardapio(req.tenantDir, novoCardapio);
      } catch (e) {
        await clientTx.query("ROLLBACK").catch(() => {});
        if (e.code === "ESTOQUE") return res.status(409).json({ erro: e.message });
        throw e;
      } finally {
        clientTx.release();
      }
    }

    // Impressão automática pelo agente (best-effort: nunca derruba a venda já gravada).
    // A via da COZINHA só quando há itens marcados "Imprime na cozinha". O CUPOM da
    // venda sai para Balcão e Entrega (tem os dados); Retirada imprime SÓ a cozinha.
    try {
      const cfg = store.getConfig(req.tenantDir) || {};
      const cozItens = itensDeCozinha(cardapio, itens);
      const vias = [];
      if (cozItens.length) vias.push(Comanda.montarCozinha({ ...pedido, itens: cozItens }, cfg));
      if (tipoEntrega !== "Retirada") vias.push(Comanda.montarCupom(pedido, cfg));
      if (vias.length) await impressaoFila.enfileirar(req.tenantDir, "pdv", vias);
    } catch (e) { console.error("enfileirar impressão PDV:", e.message); }

    res.json({ ok: true, pedido });
  } catch (e) {
    // Erros de validação (recalcular/desconto/split/caixa) → 400 com a mensagem.
    res.status(400).json({ erro: e.message || "Falha ao registrar a venda." });
  }
});

// ============================ MESAS & COMANDAS ============================
// Gate = Plano Completo (mesmo do PDV, via exigePdv). Salão presencial: cada
// rodada vira um pedido com mesa_id (não recebido até o fechamento). Recebimento
// parcial e taxa de serviço apoiados em mesas.js (puro) + mesas-db.js.

function taxaServicoPadrao(dir) {
  const cfg = store.getConfig(dir) || {};
  const t = cfg.mesas && cfg.mesas.taxaServico;
  return t == null ? 10 : Math.max(0, Math.min(100, Number(t) || 0));
}

// Monta o detalhe completo de uma mesa: dados + pedidos + resumo (com taxa) +
// recebido (parciais) + falta. Reusado pelas rotas de detalhe/fechamento.
async function detalheMesa(dir, mesaId) {
  const mesa = await mesasDb.buscarPorId(dir, mesaId);
  if (!mesa) return null;
  const peds = await mesasDb.pedidosDaMesa(dir, mesaId);
  const resumo = mesas.calcularTotalMesa(peds, mesa.taxaServico);
  const recebido = await mesasDb.recebidoDaMesa(dir, mesaId);
  const falta = Math.max(0, Math.round((resumo.total - recebido) * 100) / 100);
  return { ...mesa, pedidos: peds, resumo, recebido, falta };
}

app.get("/api/mesas", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    res.json({ mesas: await mesasDb.listar(req.tenantDir), taxaServico: taxaServicoPadrao(req.tenantDir) });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao listar mesas." });
  }
});

app.get("/api/mesas/:id", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const d = await detalheMesa(req.tenantDir, Number(req.params.id));
    if (!d) return res.status(404).json({ erro: "Mesa não encontrada." });
    res.json(d);
  } catch (e) {
    res.status(500).json({ erro: "Falha ao carregar a mesa." });
  }
});

// Criar mesas em lote (body.nomes) e/ou salvar a taxa de serviço padrão.
app.post("/api/mesas/config", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const b = req.body || {};
    let criadas = [];
    if (Array.isArray(b.nomes) && b.nomes.length) criadas = await mesasDb.criarEmLote(req.tenantDir, b.nomes);
    if (b.taxaServico != null) {
      await store.ensure(req.tenantDir);
      const cfg = store.getConfig(req.tenantDir) || {};
      cfg.mesas = Object.assign({}, cfg.mesas, { taxaServico: Math.max(0, Math.min(100, Number(b.taxaServico) || 0)) });
      await store.setConfig(req.tenantDir, cfg);
    }
    res.json({ ok: true, mesas: criadas });
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao configurar mesas." });
  }
});

app.delete("/api/mesas/:id", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const ok = await mesasDb.remover(req.tenantDir, Number(req.params.id));
    if (!ok) return res.status(400).json({ erro: "Só é possível remover mesas livres." });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: "Falha ao remover a mesa." });
  }
});

app.post("/api/mesas/:id/abrir", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    await store.ensure(req.tenantDir);
    const mesa = await mesasDb.abrir(req.tenantDir, Number(req.params.id), taxaServicoPadrao(req.tenantDir));
    if (!mesa) return res.status(400).json({ erro: "Mesa não encontrada ou já está aberta." });
    res.json(mesa);
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao abrir a mesa." });
  }
});

// Lança uma rodada: recalcula no servidor, baixa estoque atômico e salva o pedido
// vinculado à mesa (não recebido). A impressão da cozinha é disparada pelo painel.
app.post("/api/mesas/:id/pedido", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const mesaId = Number(req.params.id);
    const b = req.body || {};
    if (!Array.isArray(b.itens) || !b.itens.length) return res.status(400).json({ erro: "Pedido vazio." });
    const mesa = await mesasDb.buscarPorId(req.tenantDir, mesaId);
    if (!mesa) return res.status(404).json({ erro: "Mesa não encontrada." });
    if (mesa.status === "livre") return res.status(400).json({ erro: "Abra a mesa antes de lançar pedidos." });
    if (mesa.status === "pediu_conta" || mesa.status === "fechando") {
      return res.status(400).json({ erro: "A mesa está em fechamento. Reabra a mesa para lançar novos itens." });
    }
    await store.ensure(req.tenantDir);
    const cardapio = store.getCardapio(req.tenantDir);
    const estCheck = estoque.validarEstoque(cardapio, b.itens);
    if (!estCheck.ok) return res.status(409).json({ erro: estCheck.erro });
    const { itens, subtotal } = pdv.recalcularVenda(cardapio, b.itens);

    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const novoCardapio = await store.baixarEstoqueTx(client, req.tenantDir, b.itens);
      await mesasDb.lancarItens(req.tenantDir, mesaId, {
        itens,
        total: subtotal,
        cliente: "Mesa " + mesa.nome,
        observacao: String(b.observacao || "").slice(0, 200),
      }, client);
      await client.query("COMMIT");
      store.sincronizarCardapio(req.tenantDir, novoCardapio);
      // Enfileira a via da cozinha da rodada (best-effort, fora da transação).
      try {
        const cozItens = itensDeCozinha(cardapio, itens);
        if (cozItens.length) {
          const cfg = store.getConfig(req.tenantDir) || {};
          const pedCoz = { numero: mesa.nome, criadoEm: new Date().toISOString(), tipoEntrega: "Balcão", itens: cozItens };
          await impressaoFila.enfileirar(req.tenantDir, "mesa-cozinha", [Comanda.montarCozinha(pedCoz, cfg)]);
        }
      } catch (e) { console.error("enfileirar impressão mesa:", e.message); }
      res.json({ ok: true });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao lançar o pedido na mesa." });
  }
});

// Cliente pediu a conta (bloqueia novos lançamentos; reabrível).
app.post("/api/mesas/:id/solicitar-conta", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const mesa = await mesasDb.atualizarStatus(req.tenantDir, Number(req.params.id), "pediu_conta", "ocupada");
    if (!mesa) return res.status(400).json({ erro: "Mesa não está ocupada." });
    res.json(mesa);
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao solicitar a conta." });
  }
});

// Operador inicia o fechamento (→ fechando, bloqueia lançamentos). Devolve o
// detalhe com resumo/recebido/falta para a tela de pagamento.
app.post("/api/mesas/:id/fechar-conta", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const mesaId = Number(req.params.id);
    const atual = await mesasDb.buscarPorId(req.tenantDir, mesaId);
    if (!atual || atual.status === "livre") return res.status(400).json({ erro: "Mesa não está aberta." });
    if (atual.status !== "fechando") await mesasDb.atualizarStatus(req.tenantDir, mesaId, "fechando");
    res.json(await detalheMesa(req.tenantDir, mesaId));
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao iniciar o fechamento." });
  }
});

// Envia a PRÉ-CONTA (espelho, não-fiscal) da mesa para a fila de impressão do agente.
app.post("/api/mesas/:id/imprimir-conta", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const d = await detalheMesa(req.tenantDir, Number(req.params.id));
    if (!d) return res.status(404).json({ erro: "Mesa não encontrada." });
    const cfg = store.getConfig(req.tenantDir) || {};
    const texto = Comanda.montarPreConta(
      { nome: d.nome },
      d.pedidos || [],
      {
        subtotal: (d.resumo && d.resumo.subtotal) || 0,
        taxaServico: (d.resumo && d.resumo.taxaServico) || 0,
        taxaPct: d.taxaServico || 0,
        total: (d.resumo && d.resumo.total) || 0,
        recebido: d.recebido || 0,
        falta: d.falta || 0,
        quando: new Date().toISOString(),
      },
      cfg
    );
    await impressaoFila.enfileirar(req.tenantDir, "mesa-conta", [texto]);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao enviar a conta para impressão." });
  }
});

app.post("/api/mesas/:id/reabrir", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const mesa = await mesasDb.reabrir(req.tenantDir, Number(req.params.id));
    if (!mesa) return res.status(400).json({ erro: "A mesa não está em fechamento." });
    res.json(mesa);
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao reabrir a mesa." });
  }
});

// Recebimento PARCIAL: lança um pagamento e devolve recebido/falta atualizados.
app.post("/api/mesas/:id/receber-parcial", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const mesaId = Number(req.params.id);
    const b = req.body || {};
    const mesa = await mesasDb.buscarPorId(req.tenantDir, mesaId);
    if (!mesa || mesa.status === "livre") return res.status(400).json({ erro: "Mesa não está aberta." });
    await mesasDb.receberParcial(req.tenantDir, mesaId, { forma: b.forma, valor: b.valor }, mesa.nome);
    res.json(await detalheMesa(req.tenantDir, mesaId));
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao receber o pagamento." });
  }
});

// Fechamento FINAL: valida que recebido + pagamentos cobrem o total e libera a mesa.
app.post("/api/mesas/:id/pagar", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const mesaId = Number(req.params.id);
    const b = req.body || {};
    const mesa = await mesasDb.buscarPorId(req.tenantDir, mesaId);
    if (!mesa || mesa.status === "livre") return res.status(400).json({ erro: "Mesa não está aberta." });
    const peds = await mesasDb.pedidosDaMesa(req.tenantDir, mesaId);
    if (!peds.filter((p) => p.status !== "cancelado").length) return res.status(400).json({ erro: "A mesa não possui pedidos." });
    const resumo = mesas.calcularTotalMesa(peds, mesa.taxaServico);
    const { total } = pdv.aplicarDesconto(resumo.total, b.desconto);
    const recebidoAntes = await mesasDb.recebidoDaMesa(req.tenantDir, mesaId);
    const pagamentos = Array.isArray(b.pagamentos) ? b.pagamentos : [];
    const somaAgora = pagamentos.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    if (recebidoAntes + somaAgora + 0.01 < total) {
      return res.status(400).json({ erro: "Pagamento insuficiente para fechar a conta." });
    }
    const fechada = await mesasDb.finalizarFechamento(req.tenantDir, mesaId, { pagamentos }, mesa.nome);
    res.json({ ok: true, mesa: fechada });
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao fechar a conta." });
  }
});

app.post("/api/mesas/:id/cancelar", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const mesa = await mesasDb.cancelar(req.tenantDir, Number(req.params.id));
    if (!mesa) return res.status(404).json({ erro: "Mesa não encontrada." });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao cancelar a mesa." });
  }
});

// Cancela um item individual de um pedido da mesa.
app.post("/api/mesas/:id/cancelar-item", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const mesaId = Number(req.params.id);
    const b = req.body || {};
    if (!b.pedidoId || b.itemIdx == null) return res.status(400).json({ erro: "pedidoId e itemIdx são obrigatórios." });
    const mesa = await mesasDb.buscarPorId(req.tenantDir, mesaId);
    if (!mesa || mesa.status === "livre") return res.status(400).json({ erro: "Mesa não está aberta." });
    if (mesa.status === "fechando") return res.status(400).json({ erro: "Conta já iniciada. Reabra a mesa para cancelar itens." });
    await mesasDb.cancelarItem(req.tenantDir, mesaId, Number(b.pedidoId), Number(b.itemIdx));
    res.json(await detalheMesa(req.tenantDir, mesaId));
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao cancelar o item." });
  }
});

// Transfere/junta: move pedidos (body.pedidoIds vazio = todos) p/ a mesa destino.
app.post("/api/mesas/:id/transferir/:destinoId", exigeAuth, async (req, res) => {
  if (!(await exigePdv(req, res))) return;
  try {
    const b = req.body || {};
    await mesasDb.transferir(req.tenantDir, Number(req.params.id), Number(req.params.destinoId), b.pedidoIds);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message || "Falha ao transferir." });
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
