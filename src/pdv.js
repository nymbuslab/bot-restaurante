// ============================================================
// PDV — vendas no local (Plano Completo). Helpers PUROS (sem I/O):
// recalcular a venda a partir do cardápio (fonte de verdade dos preços,
// suporta kg + opcionais + itens só-no-local), aplicar desconto, validar
// o pagamento (split) e calcular troco. Testado isolado em test/pdv.test.js.
// A orquestração (transação caixa/pedido) vive em src/caixa.js (venderLocal).
// ============================================================

const cardapioWeb = require("./cardapio-web"); // parseOpcionais

const cent = (n) => Math.round((Number(n) || 0) * 100) / 100;
const mil = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

// Mapa id->item dos itens vendáveis (disponível e não arquivado). Inclui itens
// "só no local" e por kg — o PDV é venda de balcão.
function _mapaItens(cardapio) {
  const mapa = {};
  ((cardapio && cardapio.categorias) || []).forEach((c) => {
    ((c && c.itens) || []).forEach((it) => {
      if (it && it.disponivel !== false && it.arquivado !== true) mapa[it.id] = it;
    });
  });
  return mapa;
}

// Recalcula os itens da venda a partir do cardápio (NUNCA confia no preço do
// cliente). Suporta kg (qtd = peso decimal) e opcionais. Lança Error se um item
// não existir/indisponível. Retorna { itens (normalizados), subtotal }.
function recalcularVenda(cardapio, itensPayload) {
  const mapa = _mapaItens(cardapio);
  const itens = [];
  let subtotal = 0;
  (itensPayload || []).forEach((p) => {
    const base = mapa[p && p.id];
    if (!base) throw new Error("Item indisponível no cardápio.");
    const ehKg = base.unidade === "kg";
    let qtd;
    if (ehKg) {
      qtd = mil(parseFloat(String(p && p.qtd).replace(",", ".")) || 0);
      if (!(qtd > 0)) throw new Error("Peso inválido para " + base.nome + ".");
      if (qtd > 100) qtd = 100; // teto de sanidade (kg)
    } else {
      qtd = Math.max(1, Math.min(99, parseInt(p && p.qtd, 10) || 1));
    }
    const opsMap = {};
    cardapioWeb.parseOpcionais(base.opcionais).forEach((o) => { opsMap[o.nome] = o.preco; });
    const opcionais = [];
    ((p && p.opcionais) || []).forEach((o) => {
      const nome = o && o.nome;
      if (nome == null || !(nome in opsMap)) return; // ignora opcional desconhecido
      const oq = Math.max(1, Math.min(20, parseInt(o.qtd, 10) || 1));
      opcionais.push({ nome, preco: opsMap[nome], qtd: oq });
    });
    const precoBase = Number(base.preco) || 0;
    const addUnit = opcionais.reduce((s, o) => s + o.preco * o.qtd, 0);
    subtotal += (precoBase + addUnit) * qtd;
    itens.push({
      id: base.id, nome: base.nome, preco: precoBase, qtd,
      unidade: ehKg ? "kg" : "un",
      opcionais, observacao: String((p && p.observacao) || "").slice(0, 200),
    });
  });
  return { itens, subtotal: cent(subtotal) };
}

// Aplica o desconto ao subtotal. `desconto` = { tipo: 'valor'|'pct', valor }.
// Clampa o abatimento em [0, subtotal]. Retorna { desconto (R$ abatido), total }.
function aplicarDesconto(subtotal, desconto) {
  const sub = Math.max(0, cent(subtotal));
  let abate = 0;
  if (desconto && Number(desconto.valor) > 0) {
    abate = desconto.tipo === "pct"
      ? sub * (Math.min(100, Number(desconto.valor)) / 100)
      : Number(desconto.valor);
  }
  abate = Math.min(sub, Math.max(0, cent(abate)));
  return { desconto: abate, total: cent(sub - abate) };
}

// Valida o pagamento (split): formas não-vazias, valores positivos e soma == total
// (tolerância de 1 centavo p/ arredondamento). Lança Error com mensagem ao usuário.
function validarPagamentos(total, pagamentos) {
  const lista = Array.isArray(pagamentos) ? pagamentos : [];
  if (!lista.length) throw new Error("Informe a forma de pagamento.");
  let soma = 0;
  for (const p of lista) {
    if (!p || !String(p.forma || "").trim()) throw new Error("Forma de pagamento inválida.");
    const v = Number(p.valor) || 0;
    if (v <= 0) throw new Error("Valor de pagamento inválido.");
    soma += v;
  }
  soma = cent(soma);
  const tot = cent(total);
  if (Math.abs(soma - tot) > 0.01) {
    throw new Error("A soma das formas (R$ " + soma.toFixed(2) + ") difere do total (R$ " + tot.toFixed(2) + ").");
  }
  return true;
}

// Troco do dinheiro: max(0, recebido − valor pago em dinheiro).
function calcularTroco(recebido, totalDinheiro) {
  return Math.max(0, cent((Number(recebido) || 0) - (Number(totalDinheiro) || 0)));
}

// Resumo legível das formas, p/ o campo `pagamento` do pedido (ex.: "Dinheiro R$ 30,00 · Pix R$ 15,00").
function resumoPagamento(pagamentos) {
  return (Array.isArray(pagamentos) ? pagamentos : [])
    .map((p) => (p.forma || "Outros") + " R$ " + cent(p.valor).toFixed(2).replace(".", ","))
    .join(" · ");
}

module.exports = { recalcularVenda, aplicarDesconto, validarPagamentos, calcularTroco, resumoPagamento };
