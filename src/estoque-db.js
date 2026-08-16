// ============================================================
// ESTOQUE-DB — único ponto que fala com `estoque_movimentos` (a trilha de
// movimentação). O SALDO não mora aqui: ele continua no jsonb do cardápio. Esta
// tabela é histórico, gravado SEMPRE dentro da transação de quem alterou o saldo
// (store.baixarEstoqueTx / devolverEstoqueTx / ajustarEstoqueTx) — por isso
// `registrarTx` recebe o `client` do chamador em vez de abrir conexão própria.
// Isolado por empresa_id, resolvido do slug com cache (padrão de pedidos.js).
// ============================================================

const path = require("path");
const db = require("./db");

const TIPOS = ["venda", "devolucao", "entrada", "perda", "contagem", "ajuste"];
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

// Grava os movimentos na transação do chamador. Movimento de quantidade zero é
// descartado (nada mudou de saldo → não é evento). Devolve os IDs das linhas
// inseridas (não a contagem): quem amarra o pedido depois (store.amarrarPedidoTx)
// carimba por PRIMARY KEY, não por um filtro "órfão do tenant" que um movimento
// velho não-carimbado também casaria.
async function registrarTx(client, empId, movimentos, ctx = {}) {
  const tipo = String(ctx.tipo || "");
  if (!TIPOS.includes(tipo)) throw new Error("Tipo de movimento inválido: " + tipo);
  const linhas = (movimentos || []).filter((m) => m && Number(m.quantidade) !== 0);
  if (!linhas.length) return [];
  const valores = [];
  const params = [];
  linhas.forEach((m, i) => {
    const b = i * 12;
    valores.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12})`);
    params.push(
      empId, String(m.itemId),
      m.variacaoId == null ? null : String(m.variacaoId),
      tipo, Number(m.quantidade), Number(m.saldoDepois),
      String(m.descricao || "").slice(0, 120), m.unidade === "kg" ? "kg" : "un",
      ctx.pedidoId == null ? null : Number(ctx.pedidoId),
      ctx.numero == null ? null : Number(ctx.numero),
      ctx.obs == null ? null : String(ctx.obs).slice(0, 200),
      new Date()
    );
  });
  const r = await client.query(
    `INSERT INTO estoque_movimentos
       (empresa_id, item_id, variacao_id, tipo, quantidade, saldo_depois,
        descricao, unidade, pedido_id, numero, obs, criado_em)
     VALUES ${valores.join(",")}
     RETURNING id`,
    params
  );
  return r.rows.map((row) => row.id);
}

function mapRow(r) {
  return {
    id: r.id, itemId: r.item_id, variacaoId: r.variacao_id, tipo: r.tipo,
    quantidade: Number(r.quantidade), saldoDepois: Number(r.saldo_depois),
    descricao: r.descricao, unidade: r.unidade,
    pedidoId: r.pedido_id, numero: r.numero, obs: r.obs,
    criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
  };
}

// Extrato de UM saldo, mais recente primeiro. `antes` é cursor por data (ISO):
// devolve o que for anterior a ele (paginação sem OFFSET).
async function listar(dir, { itemId, variacaoId = null, limite = 30, antes = null } = {}) {
  const empId = await empresaId(dir);
  const lim = Math.min(Math.max(parseInt(limite, 10) || 30, 1), 100);
  const params = [empId, String(itemId), variacaoId == null ? null : String(variacaoId)];
  let sql = `SELECT * FROM estoque_movimentos
              WHERE empresa_id = $1 AND item_id = $2 AND variacao_id IS NOT DISTINCT FROM $3`;
  if (antes) { params.push(antes); sql += ` AND criado_em < $${params.length}`; }
  params.push(lim);
  sql += ` ORDER BY criado_em DESC, id DESC LIMIT $${params.length}`;
  const r = await db.query(sql, params);
  return r.rows.map(mapRow);
}

// Soma por tipo nos últimos `dias` (cabeçalho da gaveta). Sempre devolve as seis
// chaves, zeradas quando não houve movimento.
async function resumo(dir, { itemId, variacaoId = null, dias = 30 } = {}) {
  const empId = await empresaId(dir);
  const d = Math.min(Math.max(parseInt(dias, 10) || 30, 1), 365);
  const r = await db.query(
    `SELECT tipo, SUM(quantidade)::float8 AS total
       FROM estoque_movimentos
      WHERE empresa_id = $1 AND item_id = $2 AND variacao_id IS NOT DISTINCT FROM $3
        AND criado_em > now() - make_interval(days => $4)
      GROUP BY tipo`,
    [empId, String(itemId), variacaoId == null ? null : String(variacaoId), d]
  );
  const out = {};
  TIPOS.forEach((t) => { out[t] = 0; });
  r.rows.forEach((row) => { out[row.tipo] = Number(row.total) || 0; });
  return out;
}

// Retenção: apaga movimento mais antigo que `meses`. Seguro porque o SALDO não é
// a soma das linhas — apagar histórico velho não altera número nenhum. Global.
async function limparAntigos(meses = 12) {
  try {
    const r = await db.query(
      "DELETE FROM estoque_movimentos WHERE criado_em < now() - make_interval(months => $1)",
      [meses]
    );
    return r.rowCount;
  } catch (e) {
    console.error("estoque-db.limparAntigos:", e.message);
    return 0;
  }
}

// Limpa o empresa_id cacheado de um slug (ex.: ao excluir o tenant).
function esquecer(slug) {
  delete idCache[slug];
}

module.exports = { registrarTx, listar, resumo, limparAntigos, empresaId, esquecer, TIPOS };
