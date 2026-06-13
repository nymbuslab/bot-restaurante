// ============================================================
// PLATAFORMA — configuração global da Nymbus (tabela singleton
// `plataforma_config`). Gerenciada pelo painel master; alimenta o
// lado do cliente (ex.: WhatsApp de suporte no "Falar com Suporte").
// ============================================================

const db = require("./db");

// Lê a (única) linha de config. Retorna {} se ainda não existir.
async function obter() {
  const r = await db.query(
    `SELECT suporte_whatsapp AS "suporteWhatsapp", atualizado_em AS "atualizadoEm"
       FROM plataforma_config WHERE id = true`
  );
  return r.rows[0] || {};
}

// Salva (upsert) os campos informados. `suporteWhatsapp` é normalizado p/ só dígitos.
async function salvar({ suporteWhatsapp }) {
  const wa = suporteWhatsapp == null ? null : String(suporteWhatsapp).replace(/\D/g, "") || null;
  await db.query(
    `INSERT INTO plataforma_config (id, suporte_whatsapp, atualizado_em)
       VALUES (true, $1, now())
     ON CONFLICT (id) DO UPDATE SET suporte_whatsapp = EXCLUDED.suporte_whatsapp, atualizado_em = now()`,
    [wa]
  );
  return wa;
}

module.exports = { obter, salvar };
