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
const estoqueDb = require("./estoque-db"); // grava a trilha de movimento na mesma transação

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
// não acontece); decrementa e regrava o JSONB. `ctx` opcional `{ pedidoId, numero }`
// identifica o movimento (a Task 6 amarra o pedidoId, que só existe depois do
// salvarPedido). Retorna `{ cardapio, movimentoIds }`: o cardápio novo (o chamador
// deve chamar `sincronizarCardapio(dir, cardapio)` APÓS o COMMIT) e os IDs das
// linhas de `estoque_movimentos` gravadas nesta chamada — o chamador repassa esses
// IDs para `amarrarPedidoTx` depois de salvar o pedido, para carimbar por PRIMARY
// KEY (não por um filtro "órfão do tenant", que também casaria com movimento velho
// esquecido sem carimbo — ver Ruling C / Task 6).
async function baixarEstoqueTx(client, dir, itensPayload, ctx = {}) {
  const slug = slugDe(dir);
  const r = await client.query("SELECT id, cardapio FROM empresas WHERE slug = $1 FOR UPDATE", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  const cardapio = r.rows[0].cardapio || { categorias: [] };
  const check = Estoque.validarEstoque(cardapio, itensPayload);
  if (!check.ok) { const e = new Error(check.erro); e.code = "ESTOQUE"; throw e; }
  const { cardapio: novo, movimentos } = Estoque.calcularBaixa(cardapio, itensPayload);
  await client.query("UPDATE empresas SET cardapio = $1 WHERE slug = $2", [JSON.stringify(novo), slug]);
  // Trilha na MESMA transação: se o INSERT falhar, a venda inteira faz ROLLBACK.
  const movimentoIds = await estoqueDb.registrarTx(client, r.rows[0].id, movimentos, {
    tipo: "venda", pedidoId: ctx.pedidoId, numero: ctx.numero,
  });
  return { cardapio: novo, movimentoIds };
}

// Devolve ao estoque (cancelamento de pedido). Espelho da baixa: mesma trava,
// mesma transação, movimento positivo. Item que NÃO está controlado AGORA é
// ignorado (devolver criaria quantidade do nada). `ctx` opcional
// `{ pedidoId, numero, obs }` — quem cancela já sabe o pedidoId, então não há
// carimbo posterior (ao contrário da venda, que só descobre o id depois de
// salvar). Devolve só o cardápio (não há id de movimento para repassar).
async function devolverEstoqueTx(client, dir, itensPayload, ctx = {}) {
  const slug = slugDe(dir);
  const r = await client.query("SELECT id, cardapio FROM empresas WHERE slug = $1 FOR UPDATE", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  const { cardapio: novo, movimentos } = Estoque.calcularDevolucao(r.rows[0].cardapio || { categorias: [] }, itensPayload);
  if (!movimentos.length) return novo; // nada controlado foi afetado: não grava
  await client.query("UPDATE empresas SET cardapio = $1 WHERE slug = $2", [JSON.stringify(novo), slug]);
  await estoqueDb.registrarTx(client, r.rows[0].id, movimentos, {
    tipo: "devolucao", pedidoId: ctx.pedidoId, numero: ctx.numero, obs: ctx.obs,
  });
  return novo;
}

// Movimento lançado na tela de Controle de estoque: entrada, perda ou contagem.
// `contagem` recebe `contado` (o que foi contado de verdade) e o delta sai
// daqui. Usa `Estoque.aplicarAjuste`, que mexe em UM alvo só (Ruling D — revisão
// da Task 7): a versão anterior reusava o payload de venda
// (`calcularBaixa`/`calcularDevolucao`), montando um `{ qtd: 0 }` sintético no
// item pra só a variação mudar; mas o motor de venda força quantidade mínima 1
// pra item "un" (pensado pro carrinho), então aquele `0` virava `1` e aplicava
// um movimento fantasma no saldo PRÓPRIO do item toda vez que ele também tinha
// estoque controlado além da variação — corrompendo o saldo e carimbando o
// movimento errado na trilha. Mesma trava (`FOR UPDATE`) e mesma transação do
// chamador.
//
// Contagem em item AINDA NÃO controlado sempre liga o controle, MESMO contando
// zero — é assim que o dono zera um produto que esgotou (não dá pra ligar o
// controle "a partir de nada" sem persistir). Quando o delta dá zero (não
// mudou nada de saldo real), a função ainda persiste o cardápio nesse caso,
// mas não grava movimento (quantidade zero não é evento). Já numa contagem
// sobre item JÁ controlado cujo `contado` bate com o saldo atual, nada muda:
// não persiste, não grava, `movimento: null`.
//
// `entrada`/`perda` exigem o alvo JÁ controlado: a tela só oferece essas duas
// ações pra produto com controle ligado, então chegar aqui sem controle é bug
// do chamador — o erro deixa isso explícito em vez de fingir que aplicou.
// `contagem` exige `contado` numérico: `Number(undefined)`/`Number("abc")` são
// NaN e não podem vazar pra aritmética do delta.
async function ajustarEstoqueTx(client, dir, { itemId, variacaoId = null, tipo, quantidade, contado, obs } = {}) {
  const slug = slugDe(dir);
  const r = await client.query("SELECT id, cardapio FROM empresas WHERE slug = $1 FOR UPDATE", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  const cardapio = r.rows[0].cardapio || { categorias: [] };
  const alvo = Estoque.acharSaldo(cardapio, itemId, variacaoId);
  if (!alvo) throw new Error("Produto não encontrado no cardápio.");

  let delta;
  if (tipo === "contagem") {
    const contadoNum = Number(contado);
    if (!Number.isFinite(contadoNum)) throw new Error("Informe uma contagem numérica válida.");
    delta = contadoNum - (alvo.controlado ? alvo.quantidade : 0);
  } else if (tipo === "entrada" || tipo === "perda") {
    if (!alvo.controlado) throw new Error("Ative o controle de estoque deste produto antes de lançar entrada ou perda.");
    delta = tipo === "entrada" ? Math.abs(Number(quantidade) || 0) : -Math.abs(Number(quantidade) || 0);
  } else {
    throw new Error("Tipo de movimento inválido: " + tipo);
  }

  // Contagem SEMPRE liga o controle, mesmo com delta zero (contado igual ao
  // que já tinha ilimitado, ou seja, zero) — é a diferença entre "nunca
  // controlei" e "controlei e o saldo bate".
  const ligaControle = tipo === "contagem" && !alvo.controlado;
  const { cardapio: novo, movimento } = Estoque.aplicarAjuste(cardapio, { itemId, variacaoId, delta, ligaControle });

  if (!movimento) {
    if (!ligaControle) return { cardapio, movimento: null }; // nada mudou: não persiste
    await client.query("UPDATE empresas SET cardapio = $1 WHERE slug = $2", [JSON.stringify(novo), slug]);
    return { cardapio: novo, movimento: null }; // liga o controle em zero, sem movimento
  }

  await client.query("UPDATE empresas SET cardapio = $1 WHERE slug = $2", [JSON.stringify(novo), slug]);
  await estoqueDb.registrarTx(client, r.rows[0].id, [movimento], { tipo, obs });
  return { cardapio: novo, movimento };
}

// Carimba pelo PRIMARY KEY de cada movimento gravado NESTA chamada de
// baixarEstoqueTx (não mais por "empresa_id + tipo + pedido_id IS NULL"). Esse
// filtro antigo dependia de um invariante que nada garantia — qualquer órfão
// esquecido (5º ponto de venda que não carimbasse, correção manual, janela de
// deploy) seria roubado pela PRÓXIMA venda não relacionada, sem erro nem log.
// Amarrando por ID a operação é precisa por construção: não sobra invariante
// nenhum pra manter.
async function amarrarPedidoTx(client, movimentoIds, pedidoId, numero) {
  if (!movimentoIds || !movimentoIds.length || !pedidoId) return;
  await client.query(
    `UPDATE estoque_movimentos SET pedido_id = $1, numero = $2 WHERE id = ANY($3::bigint[])`,
    [pedidoId, numero == null ? null : numero, movimentoIds]
  );
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

module.exports = { ensure, getConfig, getCardapio, setConfig, setCardapio, baixarEstoqueTx, devolverEstoqueTx, ajustarEstoqueTx, amarrarPedidoTx, sincronizarCardapio, itensDisponiveis, esquecer };
