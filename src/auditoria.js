// Trilha mínima de auditoria de ações sensíveis com dados pessoais (LGPD Art. 37):
// conta criada/excluída e dados exportados. Best-effort: NUNCA lança (não pode quebrar
// o fluxo principal). O `slug` é guardado como texto (sem FK), então o registro de uma
// exclusão sobrevive ao apagamento da conta. Não gravar PII no `detalhe`.
const db = require("./db");

// Retenção (LGPD Art. 15): apaga registros de auditoria com mais de `meses`
// (24 por padrão). A trilha não tem PII, mas manter para sempre infla a tabela
// sem necessidade — o valor é temporal (investigação recente). Global, idempotente.
async function limparAntigos(meses = 24) {
  try {
    const r = await db.query(
      "DELETE FROM auditoria WHERE criado_em < now() - make_interval(months => $1)",
      [meses]
    );
    return r.rowCount;
  } catch (e) {
    console.error("auditoria.limparAntigos:", e.message);
    return 0;
  }
}

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

module.exports = { registrar, limparAntigos };
