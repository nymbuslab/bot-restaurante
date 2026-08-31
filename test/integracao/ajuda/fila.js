// Leitura de teste da fila SEM reservar trabalhos.
// A rota do agente faz claim atomico; aqui a prova precisa comparar a fila antes
// e depois de uma reimpressao sem consumir o trabalho original.
require("./ambiente");

const path = require("path");
const db = require("../../../src/db");

const slugDe = (dir) => path.basename(dir);

async function empresaId(dir) {
  const r = await db.query("SELECT id FROM empresas WHERE slug = $1", [slugDe(dir)]);
  if (!r.rows[0]) throw new Error("Tenant nao encontrado: " + slugDe(dir));
  return r.rows[0].id;
}

function mapRow(r) {
  return {
    id: r.id,
    tipo: r.tipo,
    vias: Array.isArray(r.vias) ? r.vias : [],
    criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
  };
}

async function listar(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT id, tipo, vias, criado_em
       FROM impressao_fila
      WHERE empresa_id = $1 AND impresso_em IS NULL
      ORDER BY id ASC`,
    [empId]
  );
  return r.rows.map(mapRow);
}

module.exports = { listar };
