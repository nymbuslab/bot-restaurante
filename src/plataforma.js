// ============================================================
// PLATAFORMA — configuração global da Nymbus (tabela singleton
// `plataforma_config`). Gerenciada pelo painel master; alimenta o
// lado do cliente (WhatsApp de suporte, dados da empresa no footer).
// Também guarda as credenciais do master (migradas da env).
// ============================================================

const db = require("./db");

// Campos de empresa/contato editáveis pelo master (camelCase ↔ snake_case).
const CAMPOS = {
  suporteWhatsapp: "suporte_whatsapp",
  razaoSocial:     "razao_social",
  nomeFantasia:    "nome_fantasia",
  cnpj:            "cnpj",
  endereco:        "endereco",
  telefone:        "telefone",
  facebook:        "facebook",
  instagram:       "instagram",
};

// Lê a (única) linha de config (campos de empresa). Retorna {} se vazia.
async function obter() {
  const cols = Object.entries(CAMPOS).map(([k, c]) => `${c} AS "${k}"`).join(", ");
  const r = await db.query(`SELECT ${cols}, atualizado_em AS "atualizadoEm" FROM plataforma_config WHERE id = true`);
  return r.rows[0] || {};
}

// Salva (upsert) os campos de empresa informados. `suporteWhatsapp`/`telefone`
// guardam só dígitos; o resto vai como veio (trim). Atualiza só o que for enviado.
async function salvar(dados = {}) {
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [chave, col] of Object.entries(CAMPOS)) {
    if (!(chave in dados)) continue;
    let v = dados[chave];
    if (v == null) v = null;
    else {
      v = String(v).trim();
      if (chave === "suporteWhatsapp" || chave === "telefone") v = v.replace(/\D/g, "");
      if (v === "") v = null;
    }
    sets.push(`${col} = $${i++}`);
    vals.push(v);
  }
  if (!sets.length) return await obter();
  // Garante a linha e aplica os campos (id=true singleton).
  await db.query(
    `INSERT INTO plataforma_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING`
  );
  vals.push(/* id */ true);
  await db.query(
    `UPDATE plataforma_config SET ${sets.join(", ")}, atualizado_em = now() WHERE id = $${i}`,
    vals
  );
  return await obter();
}

// ---- Credenciais do master (email + hash) ----
// Retorna { email, senhaHash } do banco, ou null/undefined nos campos se ainda
// não foram definidos (nesse caso o servidor cai na env como bootstrap).
async function obterMaster() {
  const r = await db.query(
    `SELECT master_email AS "email", master_senha_hash AS "senhaHash" FROM plataforma_config WHERE id = true`
  );
  return r.rows[0] || {};
}

async function salvarMaster({ email, senhaHash }) {
  const sets = [];
  const vals = [];
  let i = 1;
  if (email !== undefined)     { sets.push(`master_email = $${i++}`); vals.push(email); }
  if (senhaHash !== undefined) { sets.push(`master_senha_hash = $${i++}`); vals.push(senhaHash); }
  if (!sets.length) return;
  await db.query(`INSERT INTO plataforma_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING`);
  vals.push(true);
  await db.query(`UPDATE plataforma_config SET ${sets.join(", ")}, atualizado_em = now() WHERE id = $${i}`, vals);
}

module.exports = { obter, salvar, obterMaster, salvarMaster };
