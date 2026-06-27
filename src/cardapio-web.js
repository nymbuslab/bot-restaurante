// ============================================================
// CARDÁPIO WEB — helpers PUROS do canal de pedido por link.
// Sem I/O nem dependências além do `crypto` nativo → testável isolado
// (ver test/cardapio-web.test.js). Usado pela API pública GET /api/c/:slug
// e (depois) pela rota de pedido POST /api/c/:slug/pedido em servidor.js.
// ============================================================

const crypto = require("crypto");
const estoque = require("../public/estoque"); // dual-mode Node/browser
const grupos = require("../public/grupos"); // normalização da composição (dual-mode)
const variacoes = require("../public/variacoes"); // variações (opções com preço+estoque)

// Validade do link enviado pelo bot (liga o pedido feito na web ao chatId).
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// Opcionais do item são guardados como texto ("Nome | preco" por linha).
// Converte para [{ nome, preco }] — mesma regra usada pelo bot (fluxo.js importa daqui).
function parseOpcionais(texto) {
  if (!texto || !texto.trim()) return [];
  const lista = [];
  for (let linha of texto.split("\n")) {
    linha = linha.trim().replace(/^[*\-•]\s*/, "");
    if (!linha) continue;
    const partes = linha.split("|");
    const nome = partes[0].trim();
    let preco = 0;
    if (partes.length >= 2) preco = parseFloat(partes[1].replace(",", ".").replace(/[^\d.]/g, "")) || 0;
    if (nome) lista.push({ nome, preco });
  }
  return lista;
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
      // variações: só os campos públicos por opção (id/nome/preco/esgotado — NÃO vaza a contagem)
      const vars = variacoes.normalizarVariacoes(item.variacoes).map(function (v) {
        return { id: v.id, nome: v.nome, preco: v.preco, esgotado: estoque.statusEstoque(v).esgotado };
      });
      itens.push({
        id: item.id,
        nome: item.nome,
        preco: Number(item.preco) || 0,
        desc: item.desc || "",
        imagem: item.imagem || "",
        composicao: grupos.normalizarGrupos(item.composicao),
        opcionais: parseOpcionais(item.opcionais),
        variacoes: vars,
        precoAPartir: variacoes.precoAPartir(item), // null se o item não tem variações
        apenasLocal: item.apenasLocal === true,
        // esgotado se o próprio item zerou OU (item de variações) todas as variações zeraram
        esgotado: estoque.statusEstoque(item).esgotado || variacoes.todasEsgotadas(item),
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
    const opsMap = {};
    parseOpcionais(base.opcionais).forEach(function (o) { opsMap[o.nome] = o.preco; });
    const opcionais = [];
    ((p && p.opcionais) || []).forEach(function (o) {
      const nome = o && o.nome;
      if (nome == null || !(nome in opsMap)) return; // ignora opcional desconhecido
      const oq = Math.max(1, Math.min(10, parseInt(o.qtd, 10) || 1));
      opcionais.push({ nome: nome, preco: opsMap[nome], qtd: oq });
    });
    const aval = grupos.avaliarComposicao(base, p && p.composicao);
    if (!aval.valido) throw new Error(aval.pendencias[0] || ("Composição inválida em " + base.nome + "."));
    const avalVar = variacoes.avaliarVariacoes(base, p && p.variacoes);
    if (!avalVar.valido) throw new Error(avalVar.pendencias[0] || ("Escolha uma opção em " + base.nome + "."));
    const precoBase = Number(base.preco) || 0;
    const addUnit = opcionais.reduce(function (s, o) { return s + o.preco * o.qtd; }, 0);
    subtotal += (precoBase + addUnit + avalVar.addUnit) * qtd; // composição grátis; variações somam
    itens.push({
      id: base.id, nome: base.nome, preco: precoBase, qtd: qtd,
      composicao: aval.selecoes,
      opcionais: opcionais,
      variacoes: avalVar.selecoes, // [{id,nome,preco,qtd}] p/ a comanda
      observacao: String((p && p.observacao) || "").slice(0, 200),
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

module.exports = { parseOpcionais, projetarCardapio, recalcularItens, itensSoLocal, assinarToken, verificarToken, TOKEN_TTL_MS };
