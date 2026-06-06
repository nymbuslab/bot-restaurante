// ============================================================
// PEDIDOS — SQLite por tenant (data/tenants/{slug}/pedidos.db)
//
// Interface pública:
//   salvarPedido(tenantDir, pedido) → registro
//   lerTodos(tenantDir)             → array (ordem de criação)
// ============================================================

const path = require("path");
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
      criadoEm    TEXT    NOT NULL
    )
  `);
  conexoes.set(dbPath, db);
  return db;
}

function salvarPedido(tenantDir, pedido) {
  const db = getDb(tenantDir);
  const numero = (db.prepare("SELECT COALESCE(MAX(numero), 0) AS max FROM pedidos").get().max) + 1;
  const criadoEm = new Date().toISOString();

  db.prepare(`
    INSERT INTO pedidos
      (numero, status, cliente, telefone, tipoEntrega, endereco, pagamento, taxaEntrega, itens, total, criadoEm)
    VALUES
      (@numero, 'novo', @cliente, @telefone, @tipoEntrega, @endereco, @pagamento, @taxaEntrega, @itens, @total, @criadoEm)
  `).run({
    numero,
    cliente:     pedido.cliente     || "",
    telefone:    pedido.telefone    || "",
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

module.exports = { salvarPedido, lerTodos };
