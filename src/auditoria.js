// Trilha mínima de auditoria de ações sensíveis com dados pessoais (LGPD Art. 37):
// conta criada/excluída e dados exportados. Best-effort: NUNCA lança (não pode quebrar
// o fluxo principal). O `slug` é guardado como texto (sem FK), então o registro de uma
// exclusão sobrevive ao apagamento da conta. Não gravar PII no `detalhe`.
const db = require("./db");

async function registrar(evento, slug, detalhe) {
  try {
    await db.query(
      "INSERT INTO auditoria (evento, slug, detalhe) VALUES ($1, $2, $3::jsonb)",
      [String(evento || ""), slug ? String(slug) : null, JSON.stringify(detalhe || {})]
    );
  } catch (e) {
    console.error("auditoria:", e.message); // não propaga
  }
}

module.exports = { registrar };
