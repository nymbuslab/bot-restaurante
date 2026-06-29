// ============================================================
// FILA DE IMPRESSÃO genérica (Postgres), isolada por empresa_id.
// O SERVIDOR enfileira o TEXTO pronto de cada via (PDV, Mesas, Caixa,
// reimpressão); o AGENTE desktop busca os pendentes, imprime e marca
// impresso (idempotente). Delivery NÃO usa esta fila — segue pelo
// polling de `pedidos` (o agente monta a comanda lá).
// ============================================================

const path = require("path");
const db = require("./db");

const slugDe = (dir) => path.basename(dir);
const idCache = {}; // slug -> empresa_id (uuid)

async function empresaId(dir) {
  const slug = slugDe(dir);
  if (idCache[slug]) return idCache[slug];
  const r = await db.query("SELECT id FROM empresas WHERE slug = $1", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  idCache[slug] = r.rows[0].id;
  return idCache[slug];
}

function mapRow(r) {
  return {
    id: r.id,
    tipo: r.tipo,
    vias: Array.isArray(r.vias) ? r.vias : [],
    criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
  };
}

// Enfileira um trabalho de impressão. `vias` é um array de strings (cada via =
// um documento). Vias vazias são descartadas; se nenhuma sobrar, não enfileira
// e retorna null. `client` opcional roda o INSERT na transação do chamador.
async function enfileirar(dir, tipo, vias, client) {
  const lista = (Array.isArray(vias) ? vias : []).filter((v) => v != null && String(v).trim() !== "");
  if (!lista.length) return null;
  const empId = await empresaId(dir);
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => db.query(sql, p);
  const r = await exec(
    "INSERT INTO impressao_fila (empresa_id, tipo, vias) VALUES ($1, $2, $3::jsonb) RETURNING id",
    [empId, String(tipo || "").slice(0, 40), JSON.stringify(lista)]
  );
  return r.rows[0].id;
}

// Trabalhos ainda não impressos (alvo do polling do agente), em ordem de chegada.
async function pendentes(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT id, tipo, vias, criado_em FROM impressao_fila
      WHERE empresa_id = $1 AND impresso_em IS NULL
      ORDER BY id ASC
      LIMIT 50`,
    [empId]
  );
  return r.rows.map(mapRow);
}

// Marca como impresso (idempotente): só atualiza se ainda estava nulo.
// Retorna true se marcou agora, false se já estava impresso/não existe.
async function marcarImpresso(dir, id) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `UPDATE impressao_fila SET impresso_em = now()
      WHERE empresa_id = $1 AND id = $2 AND impresso_em IS NULL
      RETURNING id`,
    [empId, parseInt(id, 10) || 0]
  );
  return r.rowCount > 0;
}

// Higiene: apaga trabalhos já impressos mais antigos que `dias` (a fila é volátil;
// o histórico de impressão fica em `pedidos.impresso_em`/`caixas`). GLOBAL, idempotente.
async function limparAntigos(dias = 7) {
  const r = await db.query(
    "DELETE FROM impressao_fila WHERE impresso_em IS NOT NULL AND impresso_em < now() - make_interval(days => $1)",
    [dias]
  );
  return r.rowCount;
}

// Limpa o empresa_id cacheado de um slug (ex.: ao excluir).
function esquecer(slug) {
  delete idCache[slug];
}

module.exports = { enfileirar, pendentes, marcarImpresso, limparAntigos, esquecer };
