// ============================================================
// ESTOQUE E CUSTOS — fixtures isoladas para os novos domínios.
//
// Este helper só carrega depois da trava de ambiente. Os slugs conhecidos são
// guardados para provar que a limpeza removeu exatamente as empresas criadas
// pelo teste, sem consultas amplas nem exclusões fora do helper de tenant.
// ============================================================

require("./ambiente");

const db = require("../../../src/db");
const tenant = require("./tenant");
const fs = require("node:fs");
const path = require("node:path");

const slugsCriados = new Set();

async function criarTenant(rotulo) {
  const criado = await tenant.criarEmpresa(rotulo, { plano: "completo" });
  slugsCriados.add(criado.slug);
  return criado;
}

async function criarParDeTenants(rotulo = "estoque-custos") {
  // Este harness ja validou .env.test; jamais executado pelo app real.
  const auditoria = path.join(__dirname, "../../../supabase/migrations/20260915100000_auditoria_operacional.sql");
  if (fs.existsSync(auditoria)) await db.query(fs.readFileSync(auditoria, "utf8"));
  const primeiro = await criarTenant(rotulo + "-a");
  const segundo = await criarTenant(rotulo + "-b");
  return { primeiro, segundo };
}

async function contarTenantsCriados() {
  const slugs = Array.from(slugsCriados);
  if (!slugs.length) return 0;

  const resultado = await db.query(
    "select count(*)::int as total from empresas where slug = any($1::text[])",
    [slugs]
  );
  return resultado.rows[0].total;
}

async function limparTudo() {
  await tenant.limparTudo();
}

module.exports = { criarParDeTenants, contarTenantsCriados, limparTudo };
