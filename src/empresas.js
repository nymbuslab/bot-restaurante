// ============================================================
// EMPRESAS — perfil dos tenants na tabela `empresas` (Postgres/Supabase).
// A SENHA não fica aqui: o login usa o Supabase Auth (bcrypt + JWT).
// Cada empresa tem um diretório em disco (data/tenants/{slug}/) só
// para sessão do WhatsApp (baileys) e imagens do cardápio.
// ============================================================

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const db = require("./db");
const store = require("./store");
const pedidos = require("./pedidos");
const { supabaseAdmin, supabaseAnon } = require("./supabase");

const DATA_DIR = path.join(__dirname, "..", "data");
const TENANTS_DIR = path.join(DATA_DIR, "tenants");
// App stateless: nada é gravado em disco (sessões → Postgres, imagens → Storage).
// `tenantDir(slug)` ainda existe só como CHAVE do tenant (seu basename é o slug).

// Hash SHA-256+salt — usado SOMENTE pela conta super-admin (env-based).
// O login de restaurante usa o Supabase Auth (bcrypt), não esta função.
const SALT = "nymbus-lab-bot-v2";
function hashSenha(senha) {
  return crypto.createHash("sha256").update(senha + SALT).digest("hex");
}

function slugBase(nome) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "empresa";
}

async function slugUnico(base) {
  let slug = base;
  let i = 2;
  while ((await db.query("SELECT 1 FROM empresas WHERE slug = $1", [slug])).rows[0]) slug = `${base}-${i++}`;
  return slug;
}

function tenantDir(slug) {
  return path.join(TENANTS_DIR, slug);
}

// Config inicial LIMPA de um tenant novo (sem dados de ninguém). Vai para a
// coluna jsonb `config`. Sem `admin.senha` (vestigial, removido) — o login
// agora é o Supabase Auth.
function configInicial(nomeRestaurante) {
  return {
    restaurante: { nome: nomeRestaurante || "Restaurante", telefone: "", endereco: "", horario: "" },
    atendimento: {
      aberto: true,
      tempoEstimado: "30 a 45 min",
      taxaEntrega: 0,
      perguntarBebida: true,
      perguntarObservacao: true,
    },
    mensagens: {
      boasVindas: "Olá! 👋 Bem-vindo(a) ao *{restaurante}*.\n\nComo posso ajudar? Digite o número da opção:",
      fechado: "No momento estamos *fechados* 😴. Nosso horário é: {horario}.\n\nVolte mais tarde para fazer seu pedido!",
      atendente: "Tudo bem! Um de nossos atendentes vai continuar por aqui em instantes. 🧑‍🍳\n\n(Digite *menu* para voltar ao atendimento automático.)",
      pedidoConfirmado: "🎉 *Pedido confirmado!* Número *#{numero}*.\n\nJá estamos preparando. Tempo estimado: *{tempo}*.\nObrigado pela preferência! 🍴",
      pedidoPronto: {
        entrega:  "Olá, {cliente}! Seu pedido #{numero} está pronto e já saiu para entrega. Logo chega aí!",
        retirada: "Olá, {cliente}! Seu pedido #{numero} está pronto para retirada. Pode vir buscar quando quiser!",
      },
    },
    pagamentos: ["Pix", "Cartão (na entrega)", "Dinheiro"],
  };
}

// ---- CRUD ----

async function cadastrar({ nome, email, senha }) {
  if (!nome || !email || !senha) throw new Error("nome, email e senha são obrigatórios");

  // 1) cria o usuário no Supabase Auth (bcrypt). email_confirm: true → já ativo.
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error) {
    if (/already|exist|registered/i.test(error.message)) throw new Error("E-mail já cadastrado");
    throw new Error(error.message);
  }
  const userId = data.user.id;

  // 2) cria a linha de perfil (com slug único, config/cardápio iniciais).
  const slug = await slugUnico(slugBase(nome));
  try {
    await db.query(
      `INSERT INTO empresas (user_id, slug, nome, email, ativo, config, cardapio)
       VALUES ($1, $2, $3, $4, true, $5::jsonb, $6::jsonb)`,
      [userId, slug, nome, email, JSON.stringify(configInicial(nome)), JSON.stringify({ categorias: [] })]
    );
  } catch (e) {
    // rollback do usuário Auth se a inserção falhar (não deixa órfão)
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    throw e;
  }

  return { slug, nome };
}

// Autentica via Supabase Auth. Retorna { slug, nome, token } ou null.
async function autenticar(email, senha) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password: senha });
  if (error || !data || !data.session) return null;
  const r = await db.query("SELECT slug, nome, ativo FROM empresas WHERE user_id = $1", [data.user.id]);
  const emp = r.rows[0];
  if (!emp || !emp.ativo) return null;
  return { slug: emp.slug, nome: emp.nome, token: data.session.access_token };
}

// Verificação LOCAL do JWT (sem ida à rede) via JWKS público do Supabase.
// Os tokens são ES256 (chave assimétrica); o JWKS é cacheado e rotaciona sozinho.
// `jose` é ESM-only → import() dinâmico, cacheado.
let _jose = null, _jwks = null;
async function getJWKS() {
  if (!_jose) _jose = await import("jose");
  if (!_jwks) {
    _jwks = _jose.createRemoteJWKSet(new URL(`${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`));
  }
  return { jose: _jose, jwks: _jwks };
}

// Resolve o tenant a partir de um JWT do Supabase (usado no middleware).
// Valida o JWT LOCALMENTE (sem rede). Em qualquer erro de verificação, faz
// fallback para getUser (rede) — cobre rotação de chave/HS256 legado.
// Retorna { slug, ativo } ou null se o token for inválido.
async function resolverPorToken(token) {
  if (!token) return null;
  let userId = null;
  try {
    const { jose, jwks } = await getJWKS();
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: `${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`,
      audience: "authenticated",
    });
    userId = payload.sub;
  } catch (_) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data || !data.user) return null;
    userId = data.user.id;
  }
  if (!userId) return null;
  const r = await db.query(
    "SELECT slug, ativo, assinatura_status AS \"assinaturaStatus\", trial_ate AS \"trialAte\" FROM empresas WHERE user_id = $1",
    [userId]
  );
  return r.rows[0] || null;
}

async function buscarPorSlug(slug) {
  const r = await db.query(
    `SELECT id, user_id, slug, nome, email, ativo, criado_em,
            assinatura_status        AS "assinaturaStatus",
            trial_ate                AS "trialAte",
            proxima_cobranca         AS "proximaCobranca",
            stripe_customer_id       AS "stripeCustomerId",
            stripe_subscription_id   AS "stripeSubscriptionId"
       FROM empresas WHERE slug = $1`,
    [slug]
  );
  return r.rows[0] || null;
}

// Resolve o tenant a partir do Stripe Customer ID (usado pelos webhooks).
async function buscarPorStripeCustomer(stripeCustomerId) {
  if (!stripeCustomerId) return null;
  const r = await db.query(
    `SELECT slug, nome, ativo, assinatura_status AS "assinaturaStatus",
            stripe_subscription_id AS "stripeSubscriptionId"
       FROM empresas WHERE stripe_customer_id = $1`,
    [stripeCustomerId]
  );
  return r.rows[0] || null;
}

async function listar() {
  const r = await db.query(
    `SELECT slug, nome, email, ativo, criado_em AS "criadoEm",
            assinatura_status AS "assinaturaStatus",
            trial_ate         AS "trialAte",
            proxima_cobranca  AS "proximaCobranca"
       FROM empresas ORDER BY criado_em`
  );
  return r.rows;
}

async function setAtivo(slug, ativo) {
  const r = await db.query("UPDATE empresas SET ativo = $1 WHERE slug = $2", [!!ativo, slug]);
  return r.rowCount > 0;
}

// Atualiza os campos de billing de um tenant (chamado pelos webhooks do Stripe).
// `dados` aceita um subconjunto de chaves camelCase; só as presentes são gravadas.
async function atualizarAssinatura(slug, dados = {}) {
  const COLS = {
    status:               "assinatura_status",
    trialAte:             "trial_ate",
    proximaCobranca:      "proxima_cobranca",
    stripeCustomerId:     "stripe_customer_id",
    stripeSubscriptionId: "stripe_subscription_id",
  };
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [chave, col] of Object.entries(COLS)) {
    if (chave in dados) { sets.push(`${col} = $${i++}`); vals.push(dados[chave]); }
  }
  if (!sets.length) return false;
  sets.push("assinatura_atualizada_em = now()");
  vals.push(slug);
  const r = await db.query(`UPDATE empresas SET ${sets.join(", ")} WHERE slug = $${i}`, vals);
  return r.rowCount > 0;
}

// ---- Regras de acesso ----
// Dois eixos independentes: `ativo` (suspensão manual do admin) e o estado de
// billing. `podeLogar` só depende de `ativo` (o inadimplente entra para pagar);
// `acessoLiberado` controla bot + features (exige assinatura em dia ou trial).
// `cortesia` = acesso liberado manualmente pelo super-admin (assinante sem Stripe).
const STATUS_LIBERADOS = ["trialing", "active", "cortesia"];

function podeLogar(emp) {
  return !!emp && !!emp.ativo;
}

function acessoLiberado(emp) {
  return !!emp && !!emp.ativo && STATUS_LIBERADOS.includes(emp.assinaturaStatus);
}

// Exclusão DESTRUTIVA: apaga a linha (cascateia pedidos), o usuário do Auth e
// a pasta do tenant em disco (sessões/imagens).
async function excluir(slug) {
  const r = await db.query("SELECT user_id FROM empresas WHERE slug = $1", [slug]);
  const row = r.rows[0];
  if (!row) return false;

  await db.query("DELETE FROM empresas WHERE slug = $1", [slug]); // cascade → pedidos
  await db.query("DELETE FROM wa_auth WHERE slug = $1", [slug]);  // sessão WhatsApp
  await supabaseAdmin.auth.admin.deleteUser(row.user_id).catch(() => {});

  store.esquecer(slug);
  pedidos.esquecer(slug);

  // Limpa imagens do tenant no Storage (best-effort).
  try {
    const { data: arquivos } = await supabaseAdmin.storage.from("cardapio").list(slug);
    if (arquivos && arquivos.length) {
      await supabaseAdmin.storage.from("cardapio").remove(arquivos.map((a) => `${slug}/${a.name}`));
    }
  } catch (_) { /* best-effort */ }

  // Pasta legada em disco, se existir (instalações pré-stateless).
  const dir = tenantDir(slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

module.exports = {
  cadastrar, autenticar, resolverPorToken, buscarPorSlug, buscarPorStripeCustomer, listar,
  tenantDir, setAtivo, excluir, hashSenha,
  atualizarAssinatura, podeLogar, acessoLiberado,
};
