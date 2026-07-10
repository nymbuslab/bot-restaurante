// ============================================================
// NORMALIZAR-PAGAMENTOS — migração one-shot das formas de pagamento.
//
// Antes `config.pagamentos` era texto livre (o dono digitava "Pix",
// "Cartão (na entrega)", "Outros"...). Agora é um conjunto FIXO
// (ver src/pagamentos.js). Este script mapeia as formas antigas de cada
// tenant para as canônicas e persiste. Rode UMA vez, junto do deploy:
//   npm run normalizar-pagamentos
//
// Idempotente: rodar de novo não muda nada (já normalizado). Direto no
// jsonb `config` da tabela `empresas` (não passa pelo cache do store —
// o servidor lê fresco no próximo boot/cache miss).
// ============================================================

require("dotenv").config();
const db = require("../src/db");
const { normalizarFormasPagamento } = require("../src/pagamentos");

(async () => {
  const { rows } = await db.query("SELECT id, slug, config FROM empresas ORDER BY criado_em");
  let mudados = 0;
  for (const emp of rows) {
    const atual = Array.isArray(emp.config && emp.config.pagamentos) ? emp.config.pagamentos : [];
    const novo = normalizarFormasPagamento(atual);
    if (JSON.stringify(atual) === JSON.stringify(novo)) {
      console.log(`=  ${emp.slug}: [${atual.join(", ")}] (sem mudança)`);
      continue;
    }
    await db.query(
      "UPDATE empresas SET config = jsonb_set(config, '{pagamentos}', $1::jsonb) WHERE id = $2",
      [JSON.stringify(novo), emp.id]
    );
    mudados++;
    console.log(`✓  ${emp.slug}: [${atual.join(", ")}] → [${novo.join(", ")}]`);
  }
  console.log(`\n${mudados} de ${rows.length} tenant(s) atualizado(s).`);
  await db.pool.end();
  process.exit(0);
})().catch((e) => { console.error("❌ Falha:", e.message); process.exit(1); });
