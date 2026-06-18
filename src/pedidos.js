// ============================================================
// PEDIDOS — tabela única no Postgres (Supabase), isolada por
// empresa_id. itens em jsonb. `numero` é sequencial por empresa.
//
// As funções recebem `dir` (tenantDir) como antes; o basename é o
// slug, resolvido para empresa_id (cacheado). O retorno mantém o
// shape camelCase que o painel e o bot já esperam.
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

// snake_case (banco) -> camelCase (app). Datas em ISO; numéricos como Number.
function mapRow(r) {
  return {
    id: r.id,
    numero: r.numero,
    status: r.status,
    cliente: r.cliente,
    telefone: r.telefone,
    chatId: r.chat_id,
    tipoEntrega: r.tipo_entrega,
    endereco: r.endereco,
    pagamento: r.pagamento,
    taxaEntrega: r.taxa_entrega == null ? 0 : Number(r.taxa_entrega),
    itens: r.itens || [],
    total: r.total == null ? 0 : Number(r.total),
    observacao: r.observacao || "",
    criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
    avisadoEm: r.avisado_em ? new Date(r.avisado_em).toISOString() : null,
  };
}

async function salvarPedido(dir, pedido) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `INSERT INTO pedidos
       (empresa_id, numero, status, cliente, telefone, chat_id, tipo_entrega, endereco, pagamento, taxa_entrega, itens, total, observacao)
     VALUES
       ($1, (SELECT COALESCE(MAX(numero),0)+1 FROM pedidos WHERE empresa_id = $1), 'novo',
        $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
     RETURNING numero, criado_em`,
    [
      empId,
      pedido.cliente || "",
      pedido.telefone || "",
      pedido.chatId || "",
      pedido.tipoEntrega || "",
      pedido.endereco || "",
      pedido.pagamento || "",
      pedido.taxaEntrega || 0,
      JSON.stringify(pedido.itens || []),
      pedido.total || 0,
      pedido.observacao || "",
    ]
  );
  const row = r.rows[0];
  return {
    numero: row.numero,
    status: "novo",
    criadoEm: new Date(row.criado_em).toISOString(),
    ...pedido,
    itens: pedido.itens || [],
  };
}

async function lerTodos(dir) {
  const empId = await empresaId(dir);
  const r = await db.query("SELECT * FROM pedidos WHERE empresa_id = $1 ORDER BY id ASC", [empId]);
  return r.rows.map(mapRow);
}

// Pedido mais recente (só nº + cliente) — consulta leve p/ o painel saber se
// chegou pedido novo (polling de notificação). Retorna null se não há pedidos.
async function ultimo(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT numero, cliente FROM pedidos WHERE empresa_id = $1 ORDER BY id DESC LIMIT 1",
    [empId]
  );
  return r.rows[0] || null;
}

async function lerPorId(dir, id) {
  const empId = await empresaId(dir);
  const r = await db.query("SELECT * FROM pedidos WHERE empresa_id = $1 AND id = $2", [empId, id]);
  return r.rows[0] ? mapRow(r.rows[0]) : null;
}

async function avisarPedido(dir, id) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "UPDATE pedidos SET avisado_em = now() WHERE empresa_id = $1 AND id = $2 RETURNING avisado_em",
    [empId, id]
  );
  return r.rows[0] ? new Date(r.rows[0].avisado_em).toISOString() : null;
}

// Conta pedidos do tenant criados a partir de `inicioISO` (UTC).
async function contarNoMes(dir, inicioISO) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT COUNT(*)::int AS n FROM pedidos WHERE empresa_id = $1 AND criado_em >= $2",
    [empId, inicioISO]
  );
  return r.rows[0].n;
}

// Retenção (LGPD): anonimiza pedidos mais antigos que `meses`, apagando só os
// dados pessoais (nome, telefone, endereço, chat_id E a `observacao` de cada
// item — texto livre do cliente que pode conter PII) e preservando número,
// itens, total e datas (valor estatístico/financeiro para o lojista). Roda
// GLOBAL (todos os tenants) como job de manutenção. Idempotente: a cláusula
// WHERE ignora linhas já anonimizadas, então rodar de novo retorna 0.
async function anonimizarAntigos(meses = 12) {
  const r = await db.query(
    `UPDATE pedidos
        SET cliente = 'anonimizado', telefone = '', endereco = '', chat_id = '', observacao = '',
            itens = CASE
              WHEN jsonb_typeof(itens) = 'array' THEN COALESCE((
                SELECT jsonb_agg(
                  CASE WHEN COALESCE(elem->>'observacao','') <> ''
                       THEN jsonb_set(elem, '{observacao}', '""'::jsonb)
                       ELSE elem END
                )
                FROM jsonb_array_elements(itens) AS elem
              ), itens)
              ELSE itens
            END
      WHERE criado_em < now() - make_interval(months => $1)
        AND (cliente IS DISTINCT FROM 'anonimizado'
             OR COALESCE(telefone,'') <> ''
             OR COALESCE(endereco,'') <> ''
             OR COALESCE(chat_id,'')  <> ''
             OR COALESCE(observacao,'') <> ''
             OR (jsonb_typeof(itens) = 'array' AND EXISTS (
                   SELECT 1 FROM jsonb_array_elements(itens) AS e
                   WHERE COALESCE(e->>'observacao','') <> '')))`,
    [meses]
  );
  return r.rowCount;
}

// Antes (SQLite) liberava o handle do arquivo antes de apagar a pasta.
// No Postgres não há handle local — no-op mantido por compatibilidade.
function fecharConexao(_dir) {}

// Limpa o empresa_id cacheado de um slug (ex.: ao excluir).
function esquecer(slug) {
  delete idCache[slug];
}

module.exports = { salvarPedido, lerTodos, ultimo, lerPorId, avisarPedido, contarNoMes, anonimizarAntigos, fecharConexao, esquecer };
