// ============================================================
// CARDÁPIO WEB — helpers PUROS do canal de pedido por link.
// Sem I/O nem dependências além do `crypto` nativo → testável isolado
// (ver test/cardapio-web.test.js). Usado pela API pública GET /api/c/:slug
// e (depois) pela rota de pedido POST /api/c/:slug/pedido em servidor.js.
// ============================================================

const crypto = require("crypto");

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
      if (!item || item.disponivel === false) continue;
      itens.push({
        id: item.id,
        nome: item.nome,
        preco: Number(item.preco) || 0,
        desc: item.desc || "",
        imagem: item.imagem || "",
        composicao: item.composicao || "",
        opcionais: parseOpcionais(item.opcionais),
      });
    }
    if (itens.length) categorias.push({ nome: cat.nome, itens });
  }
  return { categorias };
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

module.exports = { parseOpcionais, projetarCardapio, assinarToken, verificarToken, TOKEN_TTL_MS };
