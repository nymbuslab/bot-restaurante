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

function inicializarDiretorio(slug, nomeRestaurante) {
  const dir = tenantDir(slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const cfgDestino = path.join(dir, "config.json");
  if (!fs.existsSync(cfgDestino)) {
    // Usa o config.json global como template
    const cfgTemplate = path.join(DATA_DIR, "config.json");
    const cfg = fs.existsSync(cfgTemplate)
      ? JSON.parse(fs.readFileSync(cfgTemplate, "utf8"))
      : { restaurante: {}, atendimento: { aberto: true, tempoEstimado: "30 a 45 min", taxaEntrega: 0 }, mensagens: {}, pagamentos: [], admin: {} };
    cfg.restaurante = { ...cfg.restaurante, nome: nomeRestaurante };
    cfg.admin = { senha: "admin123" };
    fs.writeFileSync(cfgDestino, JSON.stringify(cfg, null, 2), "utf8");
  }

  const cardDestino = path.join(dir, "cardapio.json");
  if (!fs.existsSync(cardDestino)) {
    const cardTemplate = path.join(DATA_DIR, "cardapio.json");
    if (fs.existsSync(cardTemplate)) {
      fs.copyFileSync(cardTemplate, cardDestino);
    } else {
      fs.writeFileSync(cardDestino, JSON.stringify({ categorias: [] }, null, 2), "utf8");
    }
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

module.exports = { cadastrar, autenticar, buscarPorSlug, listar, tenantDir };
