// ============================================================
// STORE — config.json e cardapio.json viraram colunas jsonb na
// tabela `empresas` (Postgres/Supabase).
//
// Para o fluxo.js continuar SÍNCRONO, mantemos um cache em memória
// por tenant. Chame `await ensure(dir)` antes dos reads síncronos
// (getConfig/getCardapio); writes (setConfig/setCardapio) persistem
// no banco e atualizam o cache. Como é processo único, o cache fica
// coerente; para múltiplas instâncias, trocar por invalidação/pub-sub.
//
// `dir` segue sendo o tenantDir (data/tenants/{slug}) — o basename é
// o slug, usado como chave no banco. (O dir ainda existe em disco para
// sessões do WhatsApp e imagens.)
// ============================================================

const path = require("path");
const db = require("./db");
const Estoque = require("../public/estoque"); // puro (dual-mode): validar/aplicar baixa

const cache = {}; // slug -> { config, cardapio }
const slugDe = (dir) => path.basename(dir);

// Carrega config/cardápio do tenant no cache (idempotente).
async function ensure(dir) {
  const slug = slugDe(dir);
  if (cache[slug]) return;
  const r = await db.query("SELECT config, cardapio FROM empresas WHERE slug = $1", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  cache[slug] = {
    config: r.rows[0].config || {},
    cardapio: r.rows[0].cardapio || { categorias: [] },
  };
}

function getConfig(dir) {
  const slug = slugDe(dir);
  if (!cache[slug]) throw new Error(`Config não carregada para ${slug} (chame store.ensure antes).`);
  return cache[slug].config;
}

function getCardapio(dir) {
  const slug = slugDe(dir);
  if (!cache[slug]) throw new Error(`Cardápio não carregado para ${slug} (chame store.ensure antes).`);
  return cache[slug].cardapio;
}

async function setConfig(dir, dados) {
  const slug = slugDe(dir);
  await db.query("UPDATE empresas SET config = $1 WHERE slug = $2", [JSON.stringify(dados), slug]);
  if (!cache[slug]) cache[slug] = { config: dados, cardapio: { categorias: [] } };
  else cache[slug].config = dados;
  return dados;
}

async function setCardapio(dir, dados) {
  const slug = slugDe(dir);
  await db.query("UPDATE empresas SET cardapio = $1 WHERE slug = $2", [JSON.stringify(dados), slug]);
  if (!cache[slug]) cache[slug] = { config: {}, cardapio: dados };
  else cache[slug].cardapio = dados;
  return dados;
}

// Baixa de estoque ATÔMICA dentro da transação do chamador (mesmo `client`).
// Trava a linha do tenant (`FOR UPDATE`) → serializa baixas concorrentes (sem
// lost-update) e o `MAX(numero)+1` do pedido; revalida o estoque na versão FRESCA
// (lança Error com `.code="ESTOQUE"` se faltar → o chamador faz ROLLBACK e a venda
// não acontece); decrementa e regrava o JSONB. Retorna o novo cardápio — o chamador
// deve chamar `sincronizarCardapio(dir, novo)` APÓS o COMMIT para atualizar o cache.
async function baixarEstoqueTx(client, dir, itensPayload) {
  const slug = slugDe(dir);
  const r = await client.query("SELECT cardapio FROM empresas WHERE slug = $1 FOR UPDATE", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  const cardapio = r.rows[0].cardapio || { categorias: [] };
  const check = Estoque.validarEstoque(cardapio, itensPayload);
  if (!check.ok) { const e = new Error(check.erro); e.code = "ESTOQUE"; throw e; }
  const novo = Estoque.aplicarBaixa(cardapio, itensPayload);
  await client.query("UPDATE empresas SET cardapio = $1 WHERE slug = $2", [JSON.stringify(novo), slug]);
  return novo;
}

// Atualiza o cache em memória do cardápio (após o COMMIT da baixa atômica).
function sincronizarCardapio(dir, cardapio) {
  const slug = slugDe(dir);
  if (!cache[slug]) cache[slug] = { config: {}, cardapio };
  else cache[slug].cardapio = cardapio;
}

// Mapa { id → item } dos itens disponíveis (cache deve estar quente).
function itensDisponiveis(dir) {
  const mapa = {};
  for (const cat of getCardapio(dir).categorias) {
    for (const item of cat.itens) {
      if (item.disponivel) mapa[item.id] = { ...item, categoria: cat.nome };
    }
  }
  return mapa;
}

// Limpa o cache de um tenant (ex.: ao excluir).
function esquecer(slug) {
  delete cache[slug];
}

module.exports = { ensure, getConfig, getCardapio, setConfig, setCardapio, baixarEstoqueTx, sincronizarCardapio, itensDisponiveis, esquecer };
