const db = require("./db");
const CAMPOS = new Set(["funcionarioId", "dispositivoId", "perfil", "ativo", "permissao", "rota", "metodo", "tentativas"]);
function detalheSeguro(detalhe = {}) {
  const seguro = {};
  for (const [chave, valor] of Object.entries(detalhe)) {
    if (CAMPOS.has(chave) && ["string", "number", "boolean"].includes(typeof valor)) seguro[chave] = typeof valor === "string" ? valor.slice(0, 180) : valor;
  }
  return seguro;
}
async function registrar(executor, { empresaId, ator = {}, evento, detalhe }) {
  if (!empresaId) throw new Error("Auditoria exige empresa.");
  await executor.query(`insert into auditoria_operacional (empresa_id, ator_tipo, ator_id, evento, detalhe)
    values ($1, $2, $3, $4, $5::jsonb)`, [empresaId, ator.tipo || "sistema", ator.id || null, evento, JSON.stringify(detalheSeguro(detalhe))]);
}
module.exports = { registrar, detalheSeguro };
