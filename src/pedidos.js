// ============================================================
// PEDIDOS — SQLite por tenant (data/tenants/{slug}/pedidos.db)
//
// Interface pública:
//   salvarPedido(tenantDir, pedido) → registro
//   lerTodos(tenantDir)             → array (ordem de criação)
// ============================================================

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const conexoes = new Map(); // { dbPath → Database }

function getDb(tenantDir) {
  const dbPath = path.join(tenantDir, "pedidos.db");
  if (conexoes.has(dbPath)) return conexoes.get(dbPath);

  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      numero      INTEGER NOT NULL,
      status      TEXT    NOT NULL DEFAULT 'novo',
      cliente     TEXT,
      telefone    TEXT,
      tipoEntrega TEXT,
      endereco    TEXT,
      pagamento   TEXT,
      taxaEntrega REAL    DEFAULT 0,
      itens       TEXT    NOT NULL DEFAULT '[]',
      total       REAL    DEFAULT 0,
      criadoEm    TEXT    NOT NULL,
      avisadoEm   TEXT,
      chatId      TEXT
    )
  `);
  // Migração: adiciona colunas em bancos criados antes desta versão
  try { db.exec("ALTER TABLE pedidos ADD COLUMN avisadoEm TEXT"); } catch (_) { /* já existe */ }
  try { db.exec("ALTER TABLE pedidos ADD COLUMN chatId TEXT"); } catch (_) { /* já existe */ }
  conexoes.set(dbPath, db);
  return db;
}

function salvarPedido(tenantDir, pedido) {
  const db = getDb(tenantDir);
  const numero = (db.prepare("SELECT COALESCE(MAX(numero), 0) AS max FROM pedidos").get().max) + 1;
  const criadoEm = new Date().toISOString();

  db.prepare(`
    INSERT INTO pedidos
      (numero, status, cliente, telefone, chatId, tipoEntrega, endereco, pagamento, taxaEntrega, itens, total, criadoEm)
    VALUES
      (@numero, 'novo', @cliente, @telefone, @chatId, @tipoEntrega, @endereco, @pagamento, @taxaEntrega, @itens, @total, @criadoEm)
  `).run({
    numero,
    cliente:     pedido.cliente     || "",
    telefone:    pedido.telefone    || "",
    chatId:      pedido.chatId      || "",
    tipoEntrega: pedido.tipoEntrega || "",
    endereco:    pedido.endereco    || "",
    pagamento:   pedido.pagamento   || "",
    taxaEntrega: pedido.taxaEntrega || 0,
    itens:       JSON.stringify(pedido.itens || []),
    total:       pedido.total       || 0,
    criadoEm,
  });

  return { numero, status: "novo", criadoEm, ...pedido, itens: pedido.itens || [] };
}

function lerTodos(tenantDir) {
  return getDb(tenantDir)
    .prepare("SELECT * FROM pedidos ORDER BY id ASC")
    .all()
    .map((r) => ({ ...r, itens: JSON.parse(r.itens) }));
}

function lerPorId(tenantDir, id) {
  const r = getDb(tenantDir).prepare("SELECT * FROM pedidos WHERE id = ?").get(id);
  if (!r) return null;
  return { ...r, itens: JSON.parse(r.itens) };
}

function avisarPedido(tenantDir, id) {
  const agora = new Date().toISOString();
  getDb(tenantDir).prepare("UPDATE pedidos SET avisadoEm = ? WHERE id = ?").run(agora, id);
  return agora;
}

// Conta pedidos criados a partir de `inicioISO` (criadoEm >= inicioISO).
// `criadoEm` é ISO em UTC, então `inicioISO` também deve ser UTC (ver
// servidor.js, que calcula o início do mês no fuso BR e converte p/ UTC).
// Pula tenants cujo pedidos.db ainda não existe (retorna 0) — não cria o
// arquivo só para contar.
// NOTA DE PERFORMANCE: cálculo on-demand. Reusa o pool de conexões (uma
// abertura por tenant, cacheada). Para muitos tenants (centenas), avaliar
// cache com TTL curto na rota /api/admin/metrics.
function contarNoMes(tenantDir, inicioISO) {
  const dbPath = path.join(tenantDir, "pedidos.db");
  if (!conexoes.has(dbPath) && !fs.existsSync(dbPath)) return 0;
  const db = getDb(tenantDir);
  return db.prepare("SELECT COUNT(*) AS n FROM pedidos WHERE criadoEm >= ?").get(inicioISO).n;
}

// Fecha e remove do pool a conexão SQLite de um tenant. Necessário antes de
// apagar a pasta do tenant (better-sqlite3 mantém o arquivo aberto — no Windows
// o rmSync da pasta falha enquanto o handle estiver vivo).
function fecharConexao(tenantDir) {
  const dbPath = path.join(tenantDir, "pedidos.db");
  const db = conexoes.get(dbPath);
  if (db) {
    try { db.close(); } catch (_) { /* já fechado */ }
    conexoes.delete(dbPath);
  }
}

module.exports = { salvarPedido, lerTodos, lerPorId, avisarPedido, fecharConexao, contarNoMes };
