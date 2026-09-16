// ============================================================
// FORNECEDORES-DB — cadastro de fornecedores, identificadores do catálogo
// (código interno/GTIN por alvo) e o vínculo fornecedor-alvo. T-04.02.
//
// Isolado por empresa_id, resolvido do slug com cache (mesmo padrão de
// estoque-db.js/catalogo-alvos-db.js). Toda FK para outra tabela do tenant é
// COMPOSTA (empresa_id, id) — cruzar alvo/fornecedor de outra empresa é
// rejeitado pela própria constraint, não por disciplina do código.
//
// Erros de validação/negócio chegam como Error com `.codigo` (mesmo padrão
// de equipe-db.js/permissoes.js), para o servidor mapear o status HTTP sem
// adivinhar pela mensagem.
// ============================================================

const path = require("path");
const db = require("./db");
const catalogoAlvosDb = require("./catalogo-alvos-db");

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

function erro(codigo, mensagem) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}

function soDigitos(v) {
  return v == null ? "" : String(v).replace(/\D+/g, "");
}

function mapFornecedor(r) {
  return {
    id: r.id,
    nome: r.nome,
    documento: r.documento,
    tipoDocumento: r.tipo_documento,
    telefone: r.telefone,
    email: r.email,
    observacao: r.observacao,
    arquivado: r.arquivado,
    criadoEm: r.criado_em ? new Date(r.criado_em).toISOString() : null,
    atualizadoEm: r.atualizado_em ? new Date(r.atualizado_em).toISOString() : null,
  };
}

// Traduz violação de índice único (Postgres 23505) para o `.codigo` de
// negócio certo, a partir do nome da constraint/índice que estourou.
function relancarConflito(e, mapa) {
  if (e && e.code === "23505") {
    for (const [pista, codigo] of Object.entries(mapa)) {
      if (String(e.constraint || "").includes(pista)) throw erro(codigo, e.detail || "Já existe um registro com este valor.");
    }
  }
  throw e;
}

// Cria fornecedor com o RASCUNHO exatamente como recebido: só `nome` é
// obrigatório. Isso é intencional (T-04.02, teste_funcional): o fluxo de
// criação inline (dentro de uma compra futura) não pode forçar telefone,
// e-mail ou documento na hora — o dono completa depois.
async function criar(dir, dados = {}, ator = {}) {
  const nome = String(dados.nome || "").trim();
  if (!nome) throw erro("NOME_OBRIGATORIO", "Informe o nome do fornecedor.");
  const empId = await empresaId(dir);
  const documento = dados.documento ? soDigitos(dados.documento) : null;
  const tipoDocumento = documento ? (documento.length > 11 ? "cnpj" : "cpf") : null;
  try {
    const r = await db.query(
      `INSERT INTO fornecedores (empresa_id, nome, documento, tipo_documento, telefone, email, observacao)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        empId, nome, documento, tipoDocumento,
        dados.telefone ? String(dados.telefone).trim() : null,
        dados.email ? String(dados.email).trim() : null,
        dados.observacao ? String(dados.observacao).trim() : null,
      ]
    );
    return mapFornecedor(r.rows[0]);
  } catch (e) {
    relancarConflito(e, { fornecedores_documento_ativo_uniq: "DOCUMENTO_DUPLICADO" });
  }
}

async function listar(dir, { incluirArquivados = false } = {}) {
  const empId = await empresaId(dir);
  const params = [empId];
  let sql = "SELECT * FROM fornecedores WHERE empresa_id = $1";
  if (!incluirArquivados) sql += " AND arquivado = false";
  sql += " ORDER BY nome ASC";
  const r = await db.query(sql, params);
  return r.rows.map(mapFornecedor);
}

async function buscar(dir, id) {
  const empId = await empresaId(dir);
  const r = await db.query("SELECT * FROM fornecedores WHERE empresa_id = $1 AND id = $2", [empId, Number(id)]);
  if (!r.rows[0]) throw erro("FORNECEDOR_NAO_ENCONTRADO", "Fornecedor não encontrado.");
  return mapFornecedor(r.rows[0]);
}

async function atualizar(dir, id, dados = {}) {
  const empId = await empresaId(dir);
  const atual = await buscar(dir, id);
  const nome = dados.nome !== undefined ? String(dados.nome || "").trim() : atual.nome;
  if (!nome) throw erro("NOME_OBRIGATORIO", "Informe o nome do fornecedor.");
  const documento = dados.documento !== undefined ? (dados.documento ? soDigitos(dados.documento) : null) : atual.documento;
  const tipoDocumento = documento ? (documento.length > 11 ? "cnpj" : "cpf") : null;
  try {
    const r = await db.query(
      `UPDATE fornecedores
          SET nome = $1, documento = $2, tipo_documento = $3,
              telefone = $4, email = $5, observacao = $6, atualizado_em = now()
        WHERE empresa_id = $7 AND id = $8
        RETURNING *`,
      [
        nome, documento, tipoDocumento,
        dados.telefone !== undefined ? (dados.telefone ? String(dados.telefone).trim() : null) : atual.telefone,
        dados.email !== undefined ? (dados.email ? String(dados.email).trim() : null) : atual.email,
        dados.observacao !== undefined ? (dados.observacao ? String(dados.observacao).trim() : null) : atual.observacao,
        empId, Number(id),
      ]
    );
    if (!r.rows[0]) throw erro("FORNECEDOR_NAO_ENCONTRADO", "Fornecedor não encontrado.");
    return mapFornecedor(r.rows[0]);
  } catch (e) {
    relancarConflito(e, { fornecedores_documento_ativo_uniq: "DOCUMENTO_DUPLICADO" });
  }
}

async function arquivar(dir, id, arquivado = true) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "UPDATE fornecedores SET arquivado = $1, atualizado_em = now() WHERE empresa_id = $2 AND id = $3 RETURNING *",
    [!!arquivado, empId, Number(id)]
  );
  if (!r.rows[0]) throw erro("FORNECEDOR_NAO_ENCONTRADO", "Fornecedor não encontrado.");
  return mapFornecedor(r.rows[0]);
}

// Resolve o alvo (produto/variação) a partir do tipo + IDs do jsonb. Lança
// ALVO_NAO_ENCONTRADO se o cardápio ainda não sincronizou esse item (T-04.01).
async function resolverAlvoId(dir, { tipo, produtoId, variacaoId = null }) {
  const alvoId = await catalogoAlvosDb.buscarId(dir, { tipo, produtoId, variacaoId });
  if (!alvoId) throw erro("ALVO_NAO_ENCONTRADO", "Produto ou variação ainda não sincronizado no catálogo.");
  return alvoId;
}

// Vincula (ou atualiza o código) um fornecedor a um alvo do catálogo. Upsert:
// vínculo repetido só atualiza o código do fornecedor para o item.
async function vincularAlvo(dir, { fornecedorId, tipo, produtoId, variacaoId = null, codigoFornecedor = null } = {}) {
  const empId = await empresaId(dir);
  await buscar(dir, fornecedorId); // garante que o fornecedor existe neste tenant
  const alvoId = await resolverAlvoId(dir, { tipo, produtoId, variacaoId });
  const r = await db.query(
    `INSERT INTO fornecedor_alvos (empresa_id, fornecedor_id, alvo_id, codigo_fornecedor)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (empresa_id, fornecedor_id, alvo_id)
     DO UPDATE SET codigo_fornecedor = EXCLUDED.codigo_fornecedor
     RETURNING *`,
    [empId, Number(fornecedorId), alvoId, codigoFornecedor ? String(codigoFornecedor).trim() : null]
  );
  return {
    id: r.rows[0].id,
    fornecedorId: r.rows[0].fornecedor_id,
    alvoId: r.rows[0].alvo_id,
    codigoFornecedor: r.rows[0].codigo_fornecedor,
  };
}

async function desvincularAlvo(dir, { fornecedorId, tipo, produtoId, variacaoId = null }) {
  const empId = await empresaId(dir);
  const alvoId = await resolverAlvoId(dir, { tipo, produtoId, variacaoId });
  const r = await db.query(
    "DELETE FROM fornecedor_alvos WHERE empresa_id = $1 AND fornecedor_id = $2 AND alvo_id = $3",
    [empId, Number(fornecedorId), alvoId]
  );
  return r.rowCount > 0;
}

// Fornecedores JÁ conhecidos para este alvo — a sugestão que evita redigitar
// o fornecedor numa próxima compra do mesmo produto (T-04.02, teste_funcional).
async function sugestoesParaAlvo(dir, { tipo, produtoId, variacaoId = null }) {
  const empId = await empresaId(dir);
  const alvoId = await catalogoAlvosDb.buscarId(dir, { tipo, produtoId, variacaoId });
  if (!alvoId) return [];
  const r = await db.query(
    `SELECT f.id, f.nome, fa.codigo_fornecedor
       FROM fornecedor_alvos fa
       JOIN fornecedores f ON f.empresa_id = fa.empresa_id AND f.id = fa.fornecedor_id
      WHERE fa.empresa_id = $1 AND fa.alvo_id = $2 AND f.arquivado = false
      ORDER BY f.nome ASC`,
    [empId, alvoId]
  );
  return r.rows.map((row) => ({ fornecedorId: row.id, nome: row.nome, codigoFornecedor: row.codigo_fornecedor }));
}

// ---- Identificadores do catálogo (código interno + GTIN por alvo) --------

async function definirIdentificadores(dir, { tipo, produtoId, variacaoId = null, codigoInterno = null, gtin = null } = {}) {
  const empId = await empresaId(dir);
  const alvoId = await resolverAlvoId(dir, { tipo, produtoId, variacaoId });
  try {
    const r = await db.query(
      `INSERT INTO catalogo_identificadores (empresa_id, alvo_id, codigo_interno, gtin)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (empresa_id, alvo_id)
       DO UPDATE SET codigo_interno = EXCLUDED.codigo_interno, gtin = EXCLUDED.gtin, atualizado_em = now()
       RETURNING *`,
      [
        empId, alvoId,
        codigoInterno ? String(codigoInterno).trim() : null,
        gtin ? String(gtin).trim() : null,
      ]
    );
    return {
      alvoId: r.rows[0].alvo_id,
      codigoInterno: r.rows[0].codigo_interno,
      gtin: r.rows[0].gtin,
    };
  } catch (e) {
    relancarConflito(e, {
      catalogo_identificadores_codigo_uniq: "CODIGO_DUPLICADO",
      catalogo_identificadores_gtin_uniq: "GTIN_DUPLICADO",
    });
  }
}

async function buscarIdentificadores(dir, { tipo, produtoId, variacaoId = null }) {
  const empId = await empresaId(dir);
  const alvoId = await catalogoAlvosDb.buscarId(dir, { tipo, produtoId, variacaoId });
  if (!alvoId) return null;
  const r = await db.query(
    "SELECT * FROM catalogo_identificadores WHERE empresa_id = $1 AND alvo_id = $2",
    [empId, alvoId]
  );
  if (!r.rows[0]) return null;
  return { alvoId, codigoInterno: r.rows[0].codigo_interno, gtin: r.rows[0].gtin };
}

// Limpa o empresa_id cacheado de um slug (ex.: ao excluir o tenant).
function esquecer(slug) {
  delete idCache[slug];
}

module.exports = {
  empresaId, criar, listar, buscar, atualizar, arquivar,
  vincularAlvo, desvincularAlvo, sugestoesParaAlvo,
  definirIdentificadores, buscarIdentificadores, esquecer,
};
