// ============================================================
// EMPRESAS — banco mestre de tenants (data/empresas.db)
//
// Cada empresa tem uma pasta própria em data/tenants/{slug}/
// com config.json, cardapio.json e pedidos.db isolados.
// ============================================================

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH  = path.join(DATA_DIR, "empresas.db");
const TENANTS_DIR = path.join(DATA_DIR, "tenants");

if (!fs.existsSync(TENANTS_DIR)) fs.mkdirSync(TENANTS_DIR, { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS empresas (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    slug      TEXT    NOT NULL UNIQUE,
    nome      TEXT    NOT NULL,
    email     TEXT    NOT NULL UNIQUE,
    senha     TEXT    NOT NULL,
    ativo     INTEGER NOT NULL DEFAULT 1,
    criadoEm  TEXT    NOT NULL
  )
`);

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

function slugUnico(base) {
  let slug = base;
  let i = 2;
  while (db.prepare("SELECT id FROM empresas WHERE slug = ?").get(slug)) slug = `${base}-${i++}`;
  return slug;
}

function tenantDir(slug) {
  return path.join(TENANTS_DIR, slug);
}

// Config inicial LIMPA de um tenant novo. NÃO herda de nenhum template com
// dados reais: identidade (nome/telefone/endereço/horário) nasce em branco
// (só o nome vem do cadastro), cardápio nasce vazio. mensagens/pagamentos/
// atendimento são defaults GENÉRICOS (não identificam ninguém). Isolamento
// multi-tenant: um tenant novo nunca pode nascer com dados de outro.
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
    admin: { senha: "admin123" }, // vestigial (login usa a senha da tabela empresas)
  };
}

function inicializarDiretorio(slug, nomeRestaurante) {
  const dir = tenantDir(slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Tenant novo nasce LIMPO — sem herdar de templates com dados reais.
  const cfgDestino = path.join(dir, "config.json");
  if (!fs.existsSync(cfgDestino)) {
    fs.writeFileSync(cfgDestino, JSON.stringify(configInicial(nomeRestaurante), null, 2), "utf8");
  }

  const cardDestino = path.join(dir, "cardapio.json");
  if (!fs.existsSync(cardDestino)) {
    fs.writeFileSync(cardDestino, JSON.stringify({ categorias: [] }, null, 2), "utf8");
  }
}

// ---- Migração automática do setup single-tenant legado ----
// Se não há nenhum tenant e existe data/config.json, cria um tenant "padrão"
// com os dados existentes. Roda apenas uma vez.
function migrarLegado() {
  const total = db.prepare("SELECT COUNT(*) as n FROM empresas").get().n;
  if (total > 0) return;

  const cfgLegado = path.join(DATA_DIR, "config.json");
  if (!fs.existsSync(cfgLegado)) return;

  const cfg = JSON.parse(fs.readFileSync(cfgLegado, "utf8"));
  const nome = (cfg.restaurante && cfg.restaurante.nome) || "Restaurante";
  const email = "admin@local";
  const senha = "admin123";
  const slug = slugUnico(slugBase(nome));
  const senhaHash = hashSenha(senha);

  db.prepare("INSERT INTO empresas (slug, nome, email, senha, ativo, criadoEm) VALUES (?, ?, ?, ?, 1, ?)")
    .run(slug, nome, email, senhaHash, new Date().toISOString());

  const dir = tenantDir(slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Copia config.json e cardapio.json legados
  fs.copyFileSync(cfgLegado, path.join(dir, "config.json"));
  const cardLegado = path.join(DATA_DIR, "cardapio.json");
  if (fs.existsSync(cardLegado)) fs.copyFileSync(cardLegado, path.join(dir, "cardapio.json"));

  // Copia pedidos.db legado se existir
  const dbLegado = path.join(DATA_DIR, "pedidos.db");
  const dbDest = path.join(dir, "pedidos.db");
  if (fs.existsSync(dbLegado) && !fs.existsSync(dbDest)) fs.copyFileSync(dbLegado, dbDest);

  console.log(`\n✅ Migração: tenant "${slug}" criado automaticamente.`);
  console.log(`   E-mail: ${email}  |  Senha: ${senha}`);
  console.log(`   (Altere a senha no painel após o primeiro acesso.)\n`);
}

migrarLegado();

// ---- CRUD ----

function cadastrar({ nome, email, senha }) {
  if (!nome || !email || !senha) throw new Error("nome, email e senha são obrigatórios");
  if (db.prepare("SELECT id FROM empresas WHERE email = ?").get(email)) throw new Error("E-mail já cadastrado");
  const slug = slugUnico(slugBase(nome));
  db.prepare("INSERT INTO empresas (slug, nome, email, senha, ativo, criadoEm) VALUES (?, ?, ?, ?, 1, ?)")
    .run(slug, nome, email, hashSenha(senha), new Date().toISOString());
  inicializarDiretorio(slug, nome);
  return { slug, nome };
}

function autenticar(email, senha) {
  return db.prepare("SELECT * FROM empresas WHERE email = ? AND senha = ? AND ativo = 1")
    .get(email, hashSenha(senha)) || null;
}

function buscarPorSlug(slug) {
  return db.prepare("SELECT * FROM empresas WHERE slug = ?").get(slug) || null;
}

function listar() {
  return db.prepare("SELECT id, slug, nome, email, ativo, criadoEm FROM empresas ORDER BY id").all();
}

// Suspende (ativo=0) ou reativa (ativo=1) um tenant. Retorna true se a linha existia.
function setAtivo(slug, ativo) {
  const r = db.prepare("UPDATE empresas SET ativo = ? WHERE slug = ?").run(ativo ? 1 : 0, slug);
  return r.changes > 0;
}

// Exclusão DESTRUTIVA: apaga o registro em empresas.db e a pasta data/tenants/{slug}/.
// IMPORTANTE: o chamador deve antes desconectar o bot e fechar a conexão SQLite de
// pedidos (better-sqlite3 mantém o arquivo aberto — no Windows o rmSync falha senão).
function excluir(slug) {
  const r = db.prepare("DELETE FROM empresas WHERE slug = ?").run(slug);
  if (r.changes === 0) return false;
  const dir = tenantDir(slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

module.exports = { cadastrar, autenticar, buscarPorSlug, listar, tenantDir, setAtivo, excluir, hashSenha };
