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

// SSL sempre ligado (Supabase exige). Sem `sslmode` na URL, o pg conectaria SEM
// criptografia silenciosamente — então forçamos aqui. `rejectUnauthorized:false`
// espelha o `sslmode=require`: criptografa sem exigir o CA do pooler no bundle do Node.
const ssl = /sslmode=disable/i.test(process.env.DATABASE_URL)
  ? false
  : { require: true, rejectUnauthorized: false };

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl });

pool.on("error", (err) => console.error("Erro inesperado no pool Postgres:", err.message));

// ---- Trava de teste ---------------------------------------------------------
// O `.env` local aponta para o MESMO Supabase de produção, então um teste que
// esqueça de stubar sai gravando em dado real. Aconteceu: um teste de mesa
// chamava `db.pool.connect()` por dentro da função e abriu conexão de verdade;
// só não escreveu porque a transação abortou na primeira query.
//
// O runner do Node marca os processos de teste com NODE_TEST_CONTEXT, então dá
// para fechar o portão único aqui em vez de confiar que cada teste lembre. Quem
// precisar do banco de propósito (script de auditoria, verificação de migração)
// roda fora do runner ou liga PERMITIR_BANCO_EM_TESTE=1 conscientemente.
const EM_TESTE = !!process.env.NODE_TEST_CONTEXT && process.env.PERMITIR_BANCO_EM_TESTE !== "1";
const barrar = (o) => {
  throw new Error(
    "Teste tentou " + o + " no banco REAL. O .env local aponta para produção. " +
    "Stube `db.query` e/ou `db.pool.connect` no teste, ou rode com PERMITIR_BANCO_EM_TESTE=1 se for proposital."
  );
};

// Em teste o pool exposto é um dublê que só sabe recusar. Clonar o Pool de
// verdade trocando `connect` deixaria `query` resolvendo pelo protótipo e ainda
// abrindo conexão; aqui não há caminho nenhum para o banco.
const query = EM_TESTE ? () => barrar("consultar") : (text, params) => pool.query(text, params);
const poolExposto = EM_TESTE
  ? {
      connect: () => barrar("abrir conexão"),
      query: () => barrar("consultar"),
      end: async () => {},
    }
  : pool;

module.exports = { pool: poolExposto, query };
