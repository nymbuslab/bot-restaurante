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
    recebidoEm: r.recebido_em ? new Date(r.recebido_em).toISOString() : null,
    impressoEm: r.impresso_em ? new Date(r.impresso_em).toISOString() : null,
    mesaId: r.mesa_id == null ? null : r.mesa_id,
  };
}

// `client` opcional: quando passado, o INSERT roda DENTRO da transação do chamador
// (usado pelo cardápio web p/ casar a gravação do pedido com a baixa atômica de
// estoque). Sem `client`, usa o pool (autocommit).
async function salvarPedido(dir, pedido, client) {
  const empId = await empresaId(dir);
  const exec = client ? (sql, p) => client.query(sql, p) : (sql, p) => db.query(sql, p);
  const r = await exec(
    `INSERT INTO pedidos
       (empresa_id, numero, status, cliente, telefone, chat_id, tipo_entrega, endereco, pagamento, taxa_entrega, itens, total, observacao, mesa_id)
     VALUES
       ($1, (SELECT COALESCE(MAX(numero),0)+1 FROM pedidos WHERE empresa_id = $1), 'novo',
        $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)
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
      pedido.mesaId || null,
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

// Pedido mais recente (nº, cliente, itens e total) — p/ o polling de notificação
// do painel detectar pedido novo e montar o modal. Retorna null se não há pedidos.
async function ultimo(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT numero, cliente, itens, total FROM pedidos WHERE empresa_id = $1 AND mesa_id IS NULL ORDER BY id DESC LIMIT 1",
    [empId]
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    numero: row.numero,
    cliente: row.cliente,
    itens: row.itens || [],
    total: row.total == null ? 0 : Number(row.total),
  };
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

// Pedidos do cardápio web ainda não impressos pelo agente desktop: não impressos
// (impresso_em nulo) E ainda não recebidos (recebido_em nulo → exclui PDV/balcão,
// que nasce recebido) E sem mesa (mesa_id nulo → pedido de salão imprime pelo painel
// no lançamento, não pelo agente). Ordena por numero (imprime na ordem que caíram).
async function pendentes(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT * FROM pedidos
      WHERE empresa_id = $1 AND impresso_em IS NULL AND recebido_em IS NULL AND mesa_id IS NULL
      ORDER BY numero ASC
      LIMIT 50`,
    [empId]
  );
  return r.rows.map(mapRow);
}

// Marca o pedido como impresso (idempotente): só atualiza se ainda estava nulo.
// Retorna true se marcou agora, false se já estava impresso/não existe.
async function marcarImpresso(dir, numero) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `UPDATE pedidos SET impresso_em = now()
      WHERE empresa_id = $1 AND numero = $2 AND impresso_em IS NULL
      RETURNING numero`,
    [empId, parseInt(numero, 10) || 0]
  );
  return r.rowCount > 0;
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

// Cancela um pedido inteiro (não recebido). Seta status='cancelado'.
async function cancelarPedido(dir, pedidoId) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "UPDATE pedidos SET status = 'cancelado' WHERE empresa_id = $1 AND id = $2 AND recebido_em IS NULL AND status <> 'cancelado' RETURNING id",
    [empId, pedidoId]
  );
  if (!r.rows[0]) throw new Error("Pedido não encontrado, já recebido ou já cancelado.");
}

// Remove um item de um pedido (não recebido), recalcula total.
// Se ficar sem itens, cancela o pedido inteiro.
async function cancelarItemPedido(dir, pedidoId, itemIdx) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT id, itens, taxa_entrega FROM pedidos WHERE empresa_id = $1 AND id = $2 AND recebido_em IS NULL AND status <> 'cancelado'",
    [empId, pedidoId]
  );
  if (!r.rows[0]) throw new Error("Pedido não encontrado, já recebido ou cancelado.");
  const itens = Array.isArray(r.rows[0].itens) ? [...r.rows[0].itens] : [];
  if (itemIdx < 0 || itemIdx >= itens.length) throw new Error("Item não encontrado.");
  itens.splice(itemIdx, 1);
  if (!itens.length) {
    await db.query(
      "UPDATE pedidos SET itens='[]'::jsonb, total=0, status='cancelado' WHERE id=$1",
      [pedidoId]
    );
  } else {
    // Recalcula o total a partir dos itens restantes E mantém a taxa de entrega
    // (frete não pertence a nenhum item; some do total se não for re-somado aqui).
    const taxa = r.rows[0].taxa_entrega == null ? 0 : Number(r.rows[0].taxa_entrega);
    const novoTotal = Math.round((itens.reduce((s, i) => {
      const extras = (i.opcionais || []).reduce((x, o) => x + (o.preco || 0) * (o.qtd || 1), 0);
      return s + ((i.preco || 0) + extras) * (i.qtd || 1);
    }, 0) + taxa) * 100) / 100;
    await db.query(
      "UPDATE pedidos SET itens=$1::jsonb, total=$2 WHERE id=$3",
      [JSON.stringify(itens), novoTotal, pedidoId]
    );
  }
}

// Antes (SQLite) liberava o handle do arquivo antes de apagar a pasta.
// No Postgres não há handle local — no-op mantido por compatibilidade.
function fecharConexao(_dir) {}

// Limpa o empresa_id cacheado de um slug (ex.: ao excluir).
function esquecer(slug) {
  delete idCache[slug];
}

// Quantos pedidos da empresa contêm o item (por id) no jsonb `itens`.
async function contarVendasDoItem(dir, itemId) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT count(*)::int AS n FROM pedidos WHERE empresa_id = $1 AND itens @> $2::jsonb",
    [empId, JSON.stringify([{ id: itemId }])]
  );
  return r.rows[0] ? r.rows[0].n : 0;
}

module.exports = { salvarPedido, lerTodos, ultimo, lerPorId, avisarPedido, pendentes, marcarImpresso, contarNoMes, anonimizarAntigos, fecharConexao, esquecer, contarVendasDoItem, cancelarPedido, cancelarItemPedido };
