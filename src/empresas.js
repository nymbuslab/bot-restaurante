// ============================================================
// EMPRESAS — perfil dos tenants na tabela `empresas` (Postgres/Supabase).
// A SENHA não fica aqui: o login usa o Supabase Auth (bcrypt + JWT).
// Cada empresa tem um diretório em disco (data/tenants/{slug}/) só
// para sessão do WhatsApp (baileys) e imagens do cardápio.
// ============================================================

const path = require("path");
const fs = require("fs");
const db = require("./db");
const store = require("./store");
const pedidos = require("./pedidos");
const auditoria = require("./auditoria");
const clientes = require("./clientes");
const { supabaseAdmin, supabaseAnon } = require("./supabase");

const DATA_DIR = path.join(__dirname, "..", "data");
const TENANTS_DIR = path.join(DATA_DIR, "tenants");
// App stateless: nada é gravado em disco (sessões → Postgres, imagens → Storage).
// `tenantDir(slug)` ainda existe só como CHAVE do tenant (seu basename é o slug).

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
    },
    mensagens: {
      boasVindas: "Olá! 👋 Bem-vindo(a) ao *{restaurante}*.",
      boasVindasRetorno: "Que bom te ver de novo, *{cliente}*! 👋",
      despedida: "Atendimento encerrado. Quando quiser pedir de novo, é só mandar *oi*! 👋",
      fechado: "No momento estamos *fechados* 😴.\nAbrimos {proximaAbertura}.\n\nManda um *oi* quando a gente abrir que eu te ajudo! 🙂",
      atendente: "Tudo bem! Um de nossos atendentes vai continuar por aqui em instantes. 🧑‍🍳\n\n(Digite *menu* para voltar ao atendimento automático.)",
      pedidoConfirmado: "🎉 *Pedido confirmado!* Número *#{numero}*.\n\nJá estamos preparando. Tempo estimado: *{tempo}*.\nObrigado pela preferência! 🍴",
      pedidoPronto: {
        entrega:  "Olá, {cliente}! Seu pedido #{numero} está pronto e já saiu para entrega. Logo chega aí!",
        retirada: "Olá, {cliente}! Seu pedido #{numero} está pronto para retirada. Pode vir buscar quando quiser!",
      },
    },
    pagamentos: ["Pix", "Cartão (na entrega)", "Dinheiro"],
    // Progresso do onboarding (wizard de 4 etapas). `concluido` libera o painel
    // direto; enquanto false, login/cadastro retomam o wizard na `etapa` salva.
    onboarding: { concluido: false, etapa: 2 },
  };
}

// ---- CRUD ----

// Versão dos Termos/Privacidade vigente — gravada junto do aceite no cadastro (prova de
// consentimento). Atualizar quando o conteúdo legal mudar de forma relevante.
const TERMOS_VERSAO = "2026-06-24";

async function cadastrar({ nome, email, senha }) {
  if (!nome || !email || !senha) throw new Error("nome, email e senha são obrigatórios");

  // 1) cria o usuário no Supabase Auth (bcrypt). email_confirm: true → já ativo.
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  let userId;
  let criamosAgora = true;
  if (error) {
    if (/already|exist|registered/i.test(error.message)) {
      // E-mail já existe no Auth. Se há linha em `empresas`, é conta completa.
      const existente = await db.query("SELECT 1 FROM empresas WHERE email = $1", [email]);
      if (existente.rows[0]) throw new Error("E-mail já cadastrado");
      // Conta ÓRFÃ (Auth sem linha em `empresas`): cadastro interrompido no meio.
      // Auto-reparo: loga com a senha para obter o user_id e recria a linha.
      // Se a senha não confere, não dá para reparar → trata como já cadastrado.
      const signin = await supabaseAnon.auth.signInWithPassword({ email, password: senha });
      if (signin.error || !signin.data || !signin.data.user) throw new Error("E-mail já cadastrado");
      userId = signin.data.user.id;
      criamosAgora = false;
    } else {
      throw new Error(error.message);
    }
  } else {
    userId = data.user.id;
  }

  // 2) cria a linha de perfil (com slug único, config/cardápio iniciais).
  const slug = await slugUnico(slugBase(nome));
  try {
    await db.query(
      `INSERT INTO empresas (user_id, slug, nome, email, ativo, config, cardapio, termos_aceitos_em, termos_versao)
       VALUES ($1, $2, $3, $4, true, $5::jsonb, $6::jsonb, now(), $7)`,
      [userId, slug, nome, email, JSON.stringify(configInicial(nome)), JSON.stringify({ categorias: [] }), TERMOS_VERSAO]
    );
  } catch (e) {
    // rollback do usuário Auth só se ACABAMOS de criá-lo (não em auto-reparo de órfã).
    if (criamosAgora) await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
    throw e;
  }

  await auditoria.registrar("conta_criada", slug, {}); // trilha LGPD (best-effort)
  return { slug, nome };
}

// Autentica via Supabase Auth. Retorna { slug, nome, token, refreshToken } ou null.
async function autenticar(email, senha) {
  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password: senha });
  if (error || !data || !data.session) return null;
  const r = await db.query(
    "SELECT slug, nome, ativo, config->'onboarding' AS onboarding FROM empresas WHERE user_id = $1",
    [data.user.id]
  );
  const emp = r.rows[0];
  if (!emp || !emp.ativo) return null;
  // Onboarding ausente = conta antiga (criada antes do wizard) → considerada concluída.
  const onb = emp.onboarding;
  const onboardingConcluido = onb ? onb.concluido === true : true;
  const onboardingEtapa = (onb && onb.etapa) || 2;
  return {
    slug: emp.slug, nome: emp.nome,
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    onboardingConcluido, onboardingEtapa,
  };
}

// Renova a sessão a partir do refresh_token (o access_token/JWT expira em ~1h).
// Mantém o painel logado sem novo login. Retorna { token, refreshToken, slug,
// nome } (o refresh_token rotaciona a cada uso) ou null se expirou/foi revogado
// ou a conta foi suspensa/excluída (checa `ativo`, igual ao login).
async function renovarSessao(refreshToken) {
  if (!refreshToken) return null;
  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data || !data.session) return null;
  const r = await db.query(
    "SELECT slug, nome, ativo, config->'onboarding' AS onboarding FROM empresas WHERE user_id = $1",
    [data.user.id]
  );
  const emp = r.rows[0];
  if (!emp || !emp.ativo) return null;
  const onb = emp.onboarding; // ausente = conta antiga → concluída (igual ao login)
  return {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    slug: emp.slug, nome: emp.nome,
    onboardingConcluido: onb ? onb.concluido === true : true,
  };
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

// Verifica o JWT do Supabase e devolve { id, email } (claim), ou null se inválido.
// Usado pelo gate do super-admin (allowlist por e-mail) — NÃO resolve tenant.
async function emailDoToken(token) {
  if (!token) return null;
  try {
    const { jose, jwks } = await getJWKS();
    const { payload } = await jose.jwtVerify(token, jwks, {
      issuer: `${process.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1`,
      audience: "authenticated",
    });
    return { id: payload.sub, email: String(payload.email || "").toLowerCase() };
  } catch (_) {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return { id: data.user.id, email: String(data.user.email || "").toLowerCase() };
  }
}

// Acha um usuário do Supabase Auth pelo e-mail (cliente ou master). Pagina a
// listagem do admin (ok p/ a escala atual; revisar com cache se crescer p/ milhares).
// Retorna { id, email } ou null.
async function acharAuthUserPorEmail(email) {
  const alvo = String(email || "").trim().toLowerCase();
  if (!alvo) return null;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const us = (data && data.users) || [];
    const u = us.find((x) => (x.email || "").toLowerCase() === alvo);
    if (u) return { id: u.id, email: (u.email || "").toLowerCase() };
    if (us.length < 1000) break;
  }
  return null;
}

async function buscarPorSlug(slug) {
  const r = await db.query(
    `SELECT id, user_id, slug, nome, email, ativo, criado_em, plano,
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
    `SELECT slug, nome, email, ativo, criado_em AS "criadoEm", plano,
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
    plano:                "plano",
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

// ---- Plano comercial (essencial | completo) ----
// `plano` é gravado pelo webhook do Stripe (ver src/stripe.js). Default essencial.
function planoDe(emp) {
  return (emp && emp.plano) || "essencial";
}

// Porteiro do frete por raio (feature do Plano Completo): exige acesso liberado
// E plano completo. Fonte ÚNICA da decisão dessa feature por plano.
function temFreteRaio(emp) {
  return acessoLiberado(emp) && planoDe(emp) === "completo";
}

// Porteiro do Caixa (feature do Plano Completo). Mesma regra do frete por raio.
function temCaixa(emp) {
  return acessoLiberado(emp) && planoDe(emp) === "completo";
}

// ---- Conta de acesso (e-mail/senha no Supabase Auth) ----
// Toda troca exige a SENHA ATUAL: validamos via signInWithPassword antes de
// aplicar a mudança (admin.updateUserById com a service_role). Assim ninguém
// troca credenciais só com o JWT em mãos.

// Confere a senha atual do tenant. Retorna { user_id, email } ou null.
async function _validarSenhaAtual(slug, senhaAtual) {
  const emp = await buscarPorSlug(slug);
  if (!emp) return null;
  const signin = await supabaseAnon.auth.signInWithPassword({ email: emp.email, password: senhaAtual });
  if (signin.error || !signin.data || !signin.data.user) return null;
  return { user_id: emp.user_id, email: emp.email };
}

// Confere a senha atual do tenant (sem alterar nada). Usado por ações
// sensíveis de autoatendimento, como a exclusão da própria conta.
async function conferirSenha(slug, senhaAtual) {
  const conta = await _validarSenhaAtual(slug, senhaAtual);
  return !!conta;
}

async function trocarSenha(slug, senhaAtual, novaSenha) {
  if (!novaSenha || novaSenha.length < 6) throw new Error("A nova senha deve ter ao menos 6 caracteres.");
  const conta = await _validarSenhaAtual(slug, senhaAtual);
  if (!conta) throw new Error("Senha atual incorreta.");
  const { error } = await supabaseAdmin.auth.admin.updateUserById(conta.user_id, { password: novaSenha });
  if (error) throw new Error("Não foi possível alterar a senha.");
  return true;
}

async function trocarEmail(slug, senhaAtual, novoEmail) {
  const email = String(novoEmail || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("E-mail inválido.");
  const conta = await _validarSenhaAtual(slug, senhaAtual);
  if (!conta) throw new Error("Senha atual incorreta.");
  if (email === conta.email) throw new Error("O novo e-mail é igual ao atual.");
  // email_confirm: true → já fica válido para login sem etapa de confirmação.
  const { error } = await supabaseAdmin.auth.admin.updateUserById(conta.user_id, { email, email_confirm: true });
  if (error) {
    // Mensagem amigável para o caso mais comum (e-mail já usado por outra conta).
    throw new Error(/already|exist/i.test(error.message) ? "Este e-mail já está em uso." : "Não foi possível alterar o e-mail.");
  }
  // Mantém a coluna `email` da empresa em sincronia com o Auth.
  await db.query("UPDATE empresas SET email = $1 WHERE slug = $2", [email, slug]);
  return email;
}

// Exclusão DESTRUTIVA: apaga a linha (cascateia pedidos), o usuário do Auth e
// a pasta do tenant em disco (sessões/imagens).
async function excluir(slug) {
  const r = await db.query("SELECT user_id FROM empresas WHERE slug = $1", [slug]);
  const row = r.rows[0];
  if (!row) return false;

  await db.query("DELETE FROM empresas WHERE slug = $1", [slug]); // cascade → pedidos
  await db.query("DELETE FROM wa_auth WHERE slug = $1", [slug]);  // sessão WhatsApp
  // Auth: best-effort, mas a falha é LOGADA (a linha já foi apagada — não há de
  // onde re-tentar; o registro permite reconciliação manual do usuário órfão).
  await supabaseAdmin.auth.admin.deleteUser(row.user_id).catch((e) =>
    console.error(`excluir: falha ao apagar usuario do Auth (slug=${slug}, user=${row.user_id}):`, e.message)
  );

  store.esquecer(slug);
  pedidos.esquecer(slug);
  clientes.esquecer(slug); // limpa o cache de empresa_id (clientes/enderecos já caem na cascata)

  // Limpa imagens do tenant no Storage (best-effort; falha logada p/ reconciliação).
  try {
    const { data: arquivos } = await supabaseAdmin.storage.from("cardapio").list(slug);
    if (arquivos && arquivos.length) {
      await supabaseAdmin.storage.from("cardapio").remove(arquivos.map((a) => `${slug}/${a.name}`));
    }
  } catch (e) {
    console.error(`excluir: falha ao limpar imagens do Storage (slug=${slug}):`, e.message);
  }

  // Pasta legada em disco, se existir (instalações pré-stateless).
  const dir = tenantDir(slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

module.exports = {
  cadastrar, autenticar, renovarSessao, resolverPorToken, emailDoToken, acharAuthUserPorEmail, buscarPorSlug, buscarPorStripeCustomer, listar,
  tenantDir, setAtivo, excluir, slugBase,
  atualizarAssinatura, podeLogar, acessoLiberado, planoDe, temFreteRaio, temCaixa,
  trocarSenha, trocarEmail, conferirSenha,
};
