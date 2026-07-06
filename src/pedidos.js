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
    origem: r.origem || "web",
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
       (empresa_id, numero, status, cliente, telefone, chat_id, tipo_entrega, endereco, pagamento, taxa_entrega, itens, total, observacao, mesa_id, desconto, origem)
     VALUES
       ($1, (SELECT COALESCE(MAX(numero),0)+1 FROM pedidos WHERE empresa_id = $1), 'novo',
        $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14)
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
      pedido.desconto || 0,
      pedido.origem || "web",
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

// `filtro` (opcional) recorta por janela de data NO BANCO (fuso America/Sao_Paulo),
// evitando trazer o histórico inteiro ao cliente. Sem filtro = tudo (usado pela
// exportação LGPD). `periodo`: 'hoje' | '7dias'; ou `desde`/`ate` ('YYYY-MM-DD').
async function lerTodos(dir, filtro) {
  const empId = await empresaId(dir);
  const TZ = "'America/Sao_Paulo'";
  const cond = ["empresa_id = $1"];
  const params = [empId];
  filtro = filtro || {};
  if (filtro.periodo === "hoje") {
    cond.push(`criado_em >= ((now() AT TIME ZONE ${TZ})::date)::timestamp AT TIME ZONE ${TZ}`);
  } else if (filtro.periodo === "7dias") {
    cond.push(`criado_em >= (((now() AT TIME ZONE ${TZ})::date - 6))::timestamp AT TIME ZONE ${TZ}`);
  } else {
    if (filtro.desde) { params.push(filtro.desde); cond.push(`criado_em >= ($${params.length}::date)::timestamp AT TIME ZONE ${TZ}`); }
    if (filtro.ate)   { params.push(filtro.ate);   cond.push(`criado_em < ($${params.length}::date + 1)::timestamp AT TIME ZONE ${TZ}`); }
  }
  const r = await db.query(`SELECT * FROM pedidos WHERE ${cond.join(" AND ")} ORDER BY id ASC`, params);
  return r.rows.map(mapRow);
}

// Pedido mais recente do CARDÁPIO WEB (nº, cliente, itens e total) — p/ o polling de
// notificação do painel detectar pedido novo e montar o modal. Só `origem = 'web'`:
// vendas de PDV (Balcão/Entrega/Retirada) e Mesa NÃO disparam o alerta (são iniciadas
// pelo operador, não precisam avisar). Retorna null se não há pedido web.
async function ultimo(dir, full) {
  const empId = await empresaId(dir);
  // O poll de 6s só precisa do `numero` — sem `full`, NÃO puxa o jsonb `itens` (que
  // trafegava/serializava a cada poll à toa). O detalhe (cliente/itens/total, p/ o modal
  // de pedido novo) é buscado sob demanda só quando um pedido novo é detectado.
  const cols = full ? "numero, cliente, itens, total" : "numero";
  const r = await db.query(
    `SELECT ${cols} FROM pedidos WHERE empresa_id = $1 AND origem = 'web' ORDER BY id DESC LIMIT 1`,
    [empId]
  );
  const row = r.rows[0];
  if (!row) return null;
  if (!full) return { numero: row.numero };
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

// Pedidos do CARDÁPIO WEB ainda não impressos pelo agente desktop: `origem = 'web'`
// (PDV e Mesa têm o próprio caminho de impressão via fila genérica — não entram aqui,
// senão imprimiriam em duplicidade; PDV Entrega/Retirada nascem "a receber" e cairiam
// neste filtro se fosse só por recebido_em) E não impressos (impresso_em nulo) E ainda
// não recebidos. Ordena por numero (imprime na ordem que caíram).
async function pendentes(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT * FROM pedidos
      WHERE empresa_id = $1 AND impresso_em IS NULL AND recebido_em IS NULL AND origem = 'web'
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
    "SELECT id, itens, taxa_entrega, desconto FROM pedidos WHERE empresa_id = $1 AND id = $2 AND recebido_em IS NULL AND status <> 'cancelado'",
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
    // Recalcula o total a partir dos itens restantes, mantendo a taxa de entrega
    // (frete não pertence a nenhum item) e ABATENDO o desconto do pedido (PDV) —
    // sem isto o total ignorava o desconto e o cliente era cobrado a mais.
    const taxa = r.rows[0].taxa_entrega == null ? 0 : Number(r.rows[0].taxa_entrega);
    const desconto = r.rows[0].desconto == null ? 0 : Number(r.rows[0].desconto);
    const novoTotal = Math.round(Math.max(0, itens.reduce((s, i) => {
      const extras = (i.opcionais || []).reduce((x, o) => x + (o.preco || 0) * (o.qtd || 1), 0)
        + (i.variacoes || []).reduce((x, v) => x + (v.preco || 0) * (v.qtd || 1), 0);
      return s + ((i.preco || 0) + extras) * (i.qtd || 1);
    }, 0) + taxa - desconto) * 100) / 100;
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

// Quantos pedidos da empresa contêm o item (por id). Via `itens_venda` (projeção
// indexada por empresa_id/item_id) em vez de `itens @> jsonb` sem índice GIN (seq scan).
async function contarVendasDoItem(dir, itemId) {
  const empId = await empresaId(dir);
  const idNum = parseInt(itemId, 10);
  if (!Number.isFinite(idNum)) return 0; // id não-numérico não existe em itens_venda (bigint)
  const r = await db.query(
    "SELECT count(DISTINCT pedido_id)::int AS n FROM itens_venda WHERE empresa_id = $1 AND item_id = $2",
    [empId, idNum]
  );
  return r.rows[0] ? r.rows[0].n : 0;
}

// ---- Dashboard: agregados calculados no BANCO (não traz o histórico ao cliente) ----
// Tudo no fuso America/Sao_Paulo (agrupa por dia/mês local do dono). Faturamento =
// venda de PRODUTOS = `total - taxa_entrega` (o frete não é receita), excluindo
// cancelados. Top itens vêm de `itens_venda` (JOIN em pedidos p/ excluir cancelado).
// Devolve dados CRUS; o formato final (labels, categorias, %) é montado em
// `src/dashboard-calc.js` (puro/testado). Uma passada no banco em vez do histórico.
const TZ_BR = "America/Sao_Paulo";
const INICIO_MES_BR = "date_trunc('month',(now() AT TIME ZONE $2)) AT TIME ZONE $2";

async function dashboardRaw(dir) {
  const empId = await empresaId(dir);
  const P = [empId, TZ_BR];

  const [hojeR, diarioR, mensalR, mesR, canaisR, pagR, itensR] = await Promise.all([
    // Hoje no fuso BR (âncora determinística das janelas).
    db.query("SELECT to_char((now() AT TIME ZONE $1)::date,'YYYY-MM-DD') AS hoje", [TZ_BR]),
    // Série diária dos últimos 30 dias (inclui hoje) — faturamento e nº de vendas por dia BR.
    db.query(
      `SELECT to_char((criado_em AT TIME ZONE $2)::date,'YYYY-MM-DD') AS dia,
              COALESCE(SUM(total - COALESCE(taxa_entrega,0)),0)::float8 AS valor,
              COUNT(*)::int AS qtd
         FROM pedidos
        WHERE empresa_id = $1 AND status <> 'cancelado'
          AND criado_em >= (((now() AT TIME ZONE $2)::date - 29)::timestamp) AT TIME ZONE $2
        GROUP BY dia`, P),
    // Série mensal dos últimos 12 meses (inclui o mês atual).
    db.query(
      `SELECT to_char(date_trunc('month', criado_em AT TIME ZONE $2),'YYYY-MM') AS mes,
              COALESCE(SUM(total - COALESCE(taxa_entrega,0)),0)::float8 AS valor
         FROM pedidos
        WHERE empresa_id = $1 AND status <> 'cancelado'
          AND criado_em >= (date_trunc('month',(now() AT TIME ZONE $2)) - interval '11 months') AT TIME ZONE $2
        GROUP BY mes`, P),
    // Agregados do MÊS atual: faturamento, nº de vendas, cancelados, total.
    db.query(
      `SELECT COALESCE(SUM((total - COALESCE(taxa_entrega,0))) FILTER (WHERE status <> 'cancelado'),0)::float8 AS fat,
              (COUNT(*) FILTER (WHERE status <> 'cancelado'))::int AS ativos,
              (COUNT(*) FILTER (WHERE status = 'cancelado'))::int AS cancel,
              COUNT(*)::int AS total
         FROM pedidos
        WHERE empresa_id = $1 AND criado_em >= ${INICIO_MES_BR}`, P),
    // Faturamento por CANAL no mês (mesma regra do canalPedido do front).
    db.query(
      `SELECT CASE WHEN origem='mesa' THEN 'Mesa'
                   WHEN origem='pdv'  THEN 'Balcão'
                   WHEN origem='web'  THEN 'WhatsApp'
                   WHEN mesa_id IS NOT NULL THEN 'Mesa'
                   WHEN tipo_entrega='Balcão' THEN 'Balcão'
                   ELSE 'WhatsApp' END AS canal,
              COALESCE(SUM(total - COALESCE(taxa_entrega,0)),0)::float8 AS valor
         FROM pedidos
        WHERE empresa_id = $1 AND status <> 'cancelado' AND criado_em >= ${INICIO_MES_BR}
        GROUP BY canal`, P),
    // Formas de pagamento informadas no mês (contagem).
    db.query(
      `SELECT trim(pagamento) AS forma, COUNT(*)::int AS qtd
         FROM pedidos
        WHERE empresa_id = $1 AND status <> 'cancelado'
          AND pagamento IS NOT NULL AND trim(pagamento) <> ''
          AND criado_em >= ${INICIO_MES_BR}
        GROUP BY trim(pagamento)`, P),
    // Itens vendidos no mês (para Top 10 e ranking de grupos), excluindo cancelados.
    db.query(
      `SELECT iv.item_id, iv.descricao,
              COALESCE(SUM(iv.qtd),0)::float8 AS qtd,
              COALESCE(SUM(iv.subtotal),0)::float8 AS valor
         FROM itens_venda iv
         JOIN pedidos p ON p.id = iv.pedido_id
        WHERE iv.empresa_id = $1 AND p.status <> 'cancelado'
          AND iv.criado_em >= ${INICIO_MES_BR}
        GROUP BY iv.item_id, iv.descricao`, P),
  ]);

  return {
    hojeBR:     hojeR.rows[0].hoje,
    diario:     diarioR.rows,   // [{ dia:'YYYY-MM-DD', valor, qtd }]
    mensal:     mensalR.rows,   // [{ mes:'YYYY-MM', valor }]
    mes:        mesR.rows[0],   // { fat, ativos, cancel, total }
    canais:     canaisR.rows,   // [{ canal, valor }]
    pagamentos: pagR.rows,      // [{ forma, qtd }]
    itens:      itensR.rows,    // [{ item_id, descricao, qtd, valor }]
  };
}

module.exports = { salvarPedido, lerTodos, ultimo, lerPorId, avisarPedido, pendentes, marcarImpresso, contarNoMes, anonimizarAntigos, fecharConexao, esquecer, contarVendasDoItem, cancelarPedido, cancelarItemPedido, dashboardRaw };
