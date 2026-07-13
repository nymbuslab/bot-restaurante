// ============================================================
// CLIENTES + ENDEREÇOS — cadastro do cliente final por empresa.
//
// Alimentado pelo checkout do cardápio web (best-effort: nunca bloqueia o
// pedido — se falhar, o pedido já foi salvo). Habilita o bot reconhecer o
// cliente ("Bem-vindo de novo, Fulano") e o checkout pré-preencher dados.
//
// Isolado por empresa_id (basename do `dir` = slug), igual a pedidos.js.
// PII → coberto pelo fluxo LGPD (export/excluir/retenção).
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

// Upsert por (empresa, telefone). Atualiza nome/chat_id SÓ quando vierem
// preenchidos — não apaga o que já existe. Retorna o id do cliente.
async function upsertCliente(empId, { telefone, chatId, nome }) {
  const r = await db.query(
    `INSERT INTO clientes (empresa_id, telefone, chat_id, nome)
       VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, telefone) WHERE telefone <> '' DO UPDATE
       SET nome    = CASE WHEN EXCLUDED.nome    <> '' THEN EXCLUDED.nome    ELSE clientes.nome    END,
           chat_id = CASE WHEN EXCLUDED.chat_id <> '' THEN EXCLUDED.chat_id ELSE clientes.chat_id END,
           atualizado_em = now()
     RETURNING id`,
    [empId, telefone || "", chatId || "", nome || ""]
  );
  return r.rows[0].id;
}

// Salva o endereço do cliente sem duplicar (mesma rua + número + cep).
async function salvarEndereco(empId, clienteId, e) {
  if (!e || (!e.logradouro && !e.cep)) return null;
  const dup = await db.query(
    `SELECT id FROM enderecos
       WHERE cliente_id = $1 AND cep = $2 AND logradouro = $3 AND numero = $4
       LIMIT 1`,
    [clienteId, e.cep || "", e.logradouro || "", e.numero || ""]
  );
  if (dup.rows[0]) return dup.rows[0].id;
  const r = await db.query(
    `INSERT INTO enderecos
       (cliente_id, empresa_id, cep, logradouro, numero, complemento, bairro, cidade, uf)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [clienteId, empId, e.cep || "", e.logradouro || "", e.numero || "",
     e.complemento || "", e.bairro || "", e.cidade || "", e.uf || ""]
  );
  return r.rows[0].id;
}

// Registra cliente (+ endereço, se for entrega) a partir de um pedido salvo.
// Best-effort: o chamador roda sem await e captura o erro. Sem telefone não há
// chave de cliente → não persiste.
async function registrarDoPedido(dir, { telefone, chatId, nome, tipoEntrega, endereco }) {
  if (!telefone) return null;
  const empId = await empresaId(dir);
  const clienteId = await upsertCliente(empId, { telefone, chatId, nome });
  if (tipoEntrega === "Entrega" && endereco) {
    await salvarEndereco(empId, clienteId, endereco);
  }
  return clienteId;
}

// Reconhece o cliente por chat_id (chave forte, vinda do token) ou, em fallback,
// pelo telefone. Ignora nome vazio e "anonimizado" (LGPD) → retorna null nesses
// casos (saudação genérica). Best-effort: erro de banco também retorna null,
// para nunca quebrar o atendimento do bot.
async function buscarCliente(dir, { chatId, telefone } = {}) {
  const chat = (chatId || "").trim();
  const tel = (telefone || "").replace(/\D/g, "");
  if (!chat && !tel) return null;
  try {
    const empId = await empresaId(dir);
    const r = await db.query(
      `SELECT nome, telefone, chat_id FROM clientes
         WHERE empresa_id = $1
           AND nome <> '' AND nome <> 'anonimizado'
           AND ( ($2 <> '' AND chat_id = $2) OR ($3 <> '' AND telefone = $3) )
         ORDER BY atualizado_em DESC
         LIMIT 1`,
      [empId, chat, tel]
    );
    return r.rows[0] ? { nome: r.rows[0].nome, telefone: r.rows[0].telefone, chatId: r.rows[0].chat_id } : null;
  } catch (e) {
    console.error("buscarCliente:", e.message);
    return null;
  }
}

// LGPD — exporta os clientes do tenant (cada um com seus endereços), p/ o
// "exportar meus dados". Inclui só o que é útil ao dono (sem o chat_id interno).
async function exportar(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT c.nome, c.telefone, c.criado_em, c.atualizado_em,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                       'cep', e.cep, 'logradouro', e.logradouro, 'numero', e.numero,
                       'complemento', e.complemento, 'bairro', e.bairro,
                       'cidade', e.cidade, 'uf', e.uf, 'apelido', e.apelido
                     ) ORDER BY e.criado_em)
              FROM enderecos e WHERE e.cliente_id = c.id
            ), '[]'::jsonb) AS enderecos
       FROM clientes c
      WHERE c.empresa_id = $1
      ORDER BY c.criado_em`,
    [empId]
  );
  return r.rows.map((x) => ({
    nome: x.nome,
    telefone: x.telefone,
    criadoEm: x.criado_em ? new Date(x.criado_em).toISOString() : null,
    atualizadoEm: x.atualizado_em ? new Date(x.atualizado_em).toISOString() : null,
    enderecos: x.enderecos || [],
  }));
}

// Retenção (LGPD): remove clientes inativos há mais de `meses` (por
// atualizado_em). Cascata apaga os endereços. Diferente de pedidos (que
// anonimiza p/ manter estatística), aqui é PII pura sem valor estatístico →
// apaga de vez. Global (todos os tenants), idempotente.
async function removerInativos(meses = 12) {
  const r = await db.query(
    "DELETE FROM clientes WHERE atualizado_em < now() - make_interval(months => $1)",
    [meses]
  );
  return r.rowCount;
}

// Limpa o empresa_id cacheado de um slug (ex.: ao excluir um tenant).
function esquecer(slug) { delete idCache[slug]; }

module.exports = {
  registrarDoPedido, buscarCliente, exportar, removerInativos, esquecer,
};
