// ============================================================
// CATALOGO-ALVOS-DB — único ponto que fala com `catalogo_alvos` (o registro-
// ponte relacional do catálogo, D-02/D-26). Dá a produto e variação uma
// identidade estável, sem duplicar nada do jsonb (nome, preço, saldo).
//
// `sincronizarTx` roda DENTRO da transação de `store.setCardapio` (mesmo
// `client`), então nunca diverge do jsonb persistido. É SÓ ADITIVA: nunca
// apaga ou desativa um alvo — exclusão/renomeação no cardápio não apaga
// histórico (sprint-04/fases.md, F-04.1). Isolado por empresa_id, resolvido
// do slug com cache (mesmo padrão de estoque-db.js/pedidos.js).
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

// Alvos desejados a partir do cardápio: produto SEM variações vira alvo
// 'produto'; produto COM variações vira um alvo 'variacao' por opção (o
// produto não controla saldo próprio nesse caso — mesma regra de
// store.baixarEstoqueTx / base/01-CATALOGO-E-IDENTIDADE.md).
function alvosDesejados(cardapio) {
  const alvos = [];
  for (const cat of (cardapio && cardapio.categorias) || []) {
    for (const item of (cat && cat.itens) || []) {
      if (!item || item.id == null) continue;
      const produtoId = String(item.id);
      if (Array.isArray(item.variacoes) && item.variacoes.length) {
        for (const v of item.variacoes) {
          if (!v || v.id == null) continue;
          alvos.push({ tipo: "variacao", produtoId, variacaoId: String(v.id) });
        }
      } else {
        alvos.push({ tipo: "produto", produtoId, variacaoId: null });
      }
    }
  }
  return alvos;
}

// Upsert somente aditivo: cria o alvo que ainda não existe; nunca apaga o que
// já existe (mesmo que o produto tenha sumido do jsonb nesta chamada). Roda
// na transação do chamador (client de store.setCardapio).
//
// Os dois tipos usam ÍNDICES PARCIAIS distintos (migration): ON CONFLICT
// exige que o arbitro bata exatamente com UM índice, então o alvo precisa
// escolher o índice certo por tipo — misturar (ex.: usar sempre o de produto)
// deixaria linha de variação fora do arbitro e um duplicado de variação
// estouraria erro de unicidade da OUTRA constraint, abortando a transação.
async function sincronizarTx(client, empId, cardapio) {
  const desejados = alvosDesejados(cardapio);
  for (const alvo of desejados) {
    if (alvo.tipo === "produto") {
      await client.query(
        `INSERT INTO catalogo_alvos (empresa_id, tipo, produto_id, variacao_id)
         VALUES ($1, 'produto', $2, NULL)
         ON CONFLICT (empresa_id, produto_id) WHERE tipo = 'produto' DO NOTHING`,
        [empId, alvo.produtoId]
      );
    } else {
      await client.query(
        `INSERT INTO catalogo_alvos (empresa_id, tipo, produto_id, variacao_id)
         VALUES ($1, 'variacao', $2, $3)
         ON CONFLICT (empresa_id, produto_id, variacao_id) WHERE tipo = 'variacao' DO NOTHING`,
        [empId, alvo.produtoId, alvo.variacaoId]
      );
    }
  }
}

function mapRow(r) {
  return {
    id: r.id,
    empresaId: r.empresa_id,
    tipo: r.tipo,
    produtoId: r.produto_id,
    variacaoId: r.variacao_id,
    criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
  };
}

// Lista os alvos do tenant, opcionalmente filtrando por produto.
async function listar(dir, { produtoId = null } = {}) {
  const empId = await empresaId(dir);
  const params = [empId];
  let sql = "SELECT * FROM catalogo_alvos WHERE empresa_id = $1";
  if (produtoId != null) {
    params.push(String(produtoId));
    sql += ` AND produto_id = $${params.length}`;
  }
  sql += " ORDER BY id ASC";
  const r = await db.query(sql, params);
  return r.rows.map(mapRow);
}

// Busca o id relacional de UM alvo específico (usado por quem vincula
// fornecedor/compra a produto ou variação). Devolve null se ainda não existe.
async function buscarId(dir, { tipo, produtoId, variacaoId = null }) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT id FROM catalogo_alvos
      WHERE empresa_id = $1 AND tipo = $2 AND produto_id = $3
        AND variacao_id IS NOT DISTINCT FROM $4`,
    [empId, tipo, String(produtoId), variacaoId == null ? null : String(variacaoId)]
  );
  return r.rows[0] ? r.rows[0].id : null;
}

// Limpa o empresa_id cacheado de um slug (ex.: ao excluir o tenant).
function esquecer(slug) {
  delete idCache[slug];
}

module.exports = { sincronizarTx, listar, buscarId, empresaId, esquecer };
