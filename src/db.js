// ============================================================
// DB — pool de conexões Postgres (Supabase).
// Fonte única de acesso ao banco. Lê DATABASE_URL do .env.
// ============================================================

require("dotenv").config();
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não definida no .env — necessária para o Postgres (Supabase).");
}

// Para app sempre-ligado, o Session pooler (porta 5432) é o recomendado.
if (/:6543\//.test(process.env.DATABASE_URL)) {
  console.warn("ℹ️  DATABASE_URL usa o Transaction pooler (6543). Para um app sempre-ligado, prefira o Session pooler (5432).");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (err) => console.error("Erro inesperado no pool Postgres:", err.message));

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
