// ============================================================
// CARDÁPIO WEB — helpers PUROS do canal de pedido por link.
// Sem I/O nem dependências além do `crypto` nativo → testável isolado
// (ver test/cardapio-web.test.js). Usado pela API pública GET /api/c/:slug
// e (depois) pela rota de pedido POST /api/c/:slug/pedido em servidor.js.
// ============================================================

const crypto = require("crypto");
const estoque = require("../public/estoque"); // dual-mode Node/browser

// Validade do link enviado pelo bot (liga o pedido feito na web ao chatId).
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// Projeção PÚBLICA dos grupos de opções do item: [{ nome, min, max, opcoes:[{nome,preco}] }].
// Normaliza tipos e descarta grupo sem nome ou sem opções. `max` default 1 (escolha única).
function projetarGrupos(grupos) {
  return (Array.isArray(grupos) ? grupos : []).map((g) => ({
    nome: String((g && g.nome) || "").trim(),
    min: Math.max(0, parseInt(g && g.min, 10) || 0),
    max: (g && g.max != null) ? Math.max(1, parseInt(g.max, 10) || 1) : 1,
    opcoes: (((g && g.opcoes) || []))
      .map((o) => ({ nome: String((o && o.nome) || "").trim(), preco: Number(o && o.preco) || 0 }))
      .filter((o) => o.nome),
  })).filter((g) => g.nome && g.opcoes.length);
}

// Valida e precifica as opções escolhidas contra os GRUPOS do item (FONTE DE VERDADE).
// `opcoesPayload`: [{ grupo, nome }] (cada escolha conta 1). Lança Error amigável se a
// opção não existir no grupo, ou se a regra min/máx do grupo for violada. Retorna
// [{ nome, preco, qtd: 1, grupo }] — formato da linha (igual ao antigo `opcionais`).
function resolverOpcoesGrupos(base, opcoesPayload) {
  const grupos = projetarGrupos(base && base.grupos);
  const idx = {}; // grupoNome -> { opNome: preco }
  grupos.forEach((g) => { idx[g.nome] = {}; g.opcoes.forEach((o) => { idx[g.nome][o.nome] = o.preco; }); });

  const contagem = {};
  const resolvidas = [];
  (opcoesPayload || []).forEach((o) => {
    const gNome = o && o.grupo;
    const opNome = o && o.nome;
    if (gNome == null || opNome == null) return;
    if (!idx[gNome] || !(opNome in idx[gNome])) {
      throw new Error('Opção inválida em "' + ((base && base.nome) || "item") + '".');
    }
    contagem[gNome] = (contagem[gNome] || 0) + 1;
    resolvidas.push({ nome: opNome, preco: idx[gNome][opNome], qtd: 1, grupo: gNome });
  });

  grupos.forEach((g) => {
    const n = contagem[g.nome] || 0;
    if (n < g.min) throw new Error('Em "' + g.nome + '" escolha ' + (g.min === g.max ? "" : "pelo menos ") + g.min + (g.min === 1 ? " opção." : " opções."));
    if (n > g.max) throw new Error('Em "' + g.nome + '" escolha no máximo ' + g.max + (g.max === 1 ? " opção." : " opções."));
  });
  return resolvidas;
}

// Projeção PÚBLICA (whitelist) do cardápio jsonb: só os campos que o cliente
// pode ver, e só itens disponíveis. NUNCA devolver o jsonb cru (evita vazar
// campos internos). Categorias sem itens disponíveis somem.
function projetarCardapio(cardapio) {
  const categorias = [];
  for (const cat of (cardapio && cardapio.categorias) || []) {
    const itens = [];
    for (const item of (cat && cat.itens) || []) {
      if (!item || item.disponivel === false || item.arquivado === true) continue;
      itens.push({
        id: item.id,
        nome: item.nome,
        preco: Number(item.preco) || 0,
        desc: item.desc || "",
        imagem: item.imagem || "",
        grupos: projetarGrupos(item.grupos),
        apenasLocal: item.apenasLocal === true,
        esgotado: estoque.statusEstoque(item).esgotado,
        unidade: item.unidade === "kg" ? "kg" : "un",
        destaque: item.destaque === true,
      });
    }
    if (itens.length) categorias.push({ nome: cat.nome, itens });
  }
  return { categorias };
}

// Recalcula os itens do pedido a partir do cardápio (FONTE DE VERDADE dos preços):
// nunca confiar em preço/nome/total vindos do cliente. Lança Error se um item não
// existir ou estiver indisponível. Retorna { itens (normalizados p/ salvar), subtotal }.
function recalcularItens(cardapio, itensPayload) {
  const mapa = {};
  ((cardapio && cardapio.categorias) || []).forEach(function (c) {
    ((c && c.itens) || []).forEach(function (it) {
      if (it && it.disponivel !== false && it.arquivado !== true && it.unidade !== "kg") mapa[it.id] = it;
    });
  });
  const itens = [];
  let subtotal = 0;
  (itensPayload || []).forEach(function (p) {
    const base = mapa[p && p.id];
    if (!base) throw new Error("Item indisponível no cardápio.");
    const qtd = Math.max(1, Math.min(50, parseInt(p.qtd, 10) || 1));
    const opcionais = resolverOpcoesGrupos(base, (p && p.opcionais) || []);
    const precoBase = Number(base.preco) || 0;
    const addUnit = opcionais.reduce(function (s, o) { return s + o.preco * o.qtd; }, 0);
    subtotal += (precoBase + addUnit) * qtd;
    itens.push({
      id: base.id, nome: base.nome, preco: precoBase, qtd: qtd,
      opcionais: opcionais, observacao: String((p && p.observacao) || "").slice(0, 200),
    });
  });
  return { itens: itens, subtotal: subtotal };
}

// Nomes (sem repetição) dos itens do payload que são "só no local" (apenasLocal).
// Usado pelo servidor para barrar pedido de Entrega com item só-local.
function itensSoLocal(cardapio, itensPayload) {
  const mapa = {};
  ((cardapio && cardapio.categorias) || []).forEach(function (c) {
    ((c && c.itens) || []).forEach(function (it) { if (it) mapa[it.id] = it; });
  });
  const nomes = [];
  (itensPayload || []).forEach(function (p) {
    const base = mapa[p && p.id];
    if (base && base.apenasLocal === true && nomes.indexOf(base.nome) === -1) {
      nomes.push(base.nome);
    }
  });
  return nomes;
}

// ---- Token de link (HMAC-SHA256, stateless) ----
// Liga o link `/c/:slug?p=<token>` ao chatId do cliente, pra confirmar o pedido
// no WhatsApp depois. Formato: base64url(JSON) + "." + assinatura. Sem token
// (ou inválido/expirado) a confirmação cai no telefone do checkout.
// `agoraMs` é injetável só para teste (default: Date.now()).
function assinarToken(secret, slug, chatId, agoraMs) {
  if (!secret || !chatId) return "";
  const exp = (agoraMs || Date.now()) + TOKEN_TTL_MS;
  const corpo = Buffer.from(JSON.stringify({ slug, chatId, exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(corpo).digest("base64url");
  return `${corpo}.${sig}`;
}

function verificarToken(secret, token, slug, agoraMs) {
  if (!secret || !token) return null;
  const [corpo, sig] = String(token).split(".");
  if (!corpo || !sig) return null;
  const esperado = crypto.createHmac("sha256", secret).update(corpo).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let dados;
  try { dados = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")); } catch (_) { return null; }
  if (dados.slug !== slug || !dados.chatId || !dados.exp) return null;
  if ((agoraMs || Date.now()) > dados.exp) return null;
  return { chatId: dados.chatId };
}

module.exports = { projetarGrupos, resolverOpcoesGrupos, projetarCardapio, recalcularItens, itensSoLocal, assinarToken, verificarToken, TOKEN_TTL_MS };
