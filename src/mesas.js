// ============================================================
// MESAS — lógica pura de mesas & comandas (sem I/O). Cálculo do
// total com taxa de serviço, divisão de conta (igualitária / por
// produto) e recebimento parcial. Testável isolado em test/mesas.test.js.
// ============================================================

const cent = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Preço de UMA linha de item: (base + opcionais + variações) × qtd.
// Espelha pdvPrecoLinha do front; usado na divisão por produto.
function precoLinha(item) {
  const base = Number(item.preco) || 0;
  const opc = (item.opcionais || []).reduce((s, o) => s + (Number(o.preco) || 0) * (o.qtd || 1), 0);
  const vars = (item.variacoes || []).reduce((s, v) => s + (Number(v.preco) || 0) * (v.qtd || 1), 0);
  const qtd = Number(item.qtd) || 1;
  return cent((base + opc + vars) * qtd);
}

// Total da mesa: soma o `total` autoritativo de cada pedido (já recalculado no
// servidor ao lançar) e aplica a taxa de serviço (%). Ignora pedidos cancelados.
function calcularTotalMesa(pedidos, taxaServicoPct) {
  const ativos = (pedidos || []).filter((p) => p && p.status !== "cancelado");
  let subtotal = 0;
  for (const p of ativos) {
    if (p.total != null) subtotal += Number(p.total) || 0;
    else subtotal += (p.itens || []).reduce((s, it) => s + precoLinha(it), 0);
  }
  subtotal = cent(subtotal);
  const pct = Math.max(0, Math.min(100, Number(taxaServicoPct) || 0));
  const taxaServico = cent(subtotal * (pct / 100));
  return { subtotal, taxaServico, total: cent(subtotal + taxaServico) };
}

// Divisão igualitária: reparte o total entre N pessoas distribuindo os centavos
// que sobram (resto) para as primeiras pessoas — a soma fecha EXATAMENTE no total.
function dividirIgualitario(total, nPessoas) {
  const n = Math.max(1, Math.floor(Number(nPessoas) || 1));
  const centavos = Math.round(cent(total) * 100);
  const base = Math.floor(centavos / n);
  const resto = centavos % n;
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = base + (i < resto ? 1 : 0);
    out.push({ pessoa: "Pessoa " + (i + 1), valor: cent(c / 100) });
  }
  return out;
}

// Divisão por produto: cada linha de item é atribuída a uma pessoa.
// `atribuicoes`: [{ pedidoId, itemIndex, pessoa }]. Itens sem atribuição caem em
// "Não atribuído". Retorna [{ pessoa, itens:[{nome,qtd,valor}], subtotal }].
function dividirPorProduto(pedidos, atribuicoes) {
  const mapaAttr = {};
  for (const a of (atribuicoes || [])) mapaAttr[a.pedidoId + ":" + a.itemIndex] = a.pessoa;
  const pessoas = {};
  const add = (nome, item, valor) => {
    if (!pessoas[nome]) pessoas[nome] = { pessoa: nome, itens: [], subtotal: 0 };
    pessoas[nome].itens.push({ nome: item.nome || "", qtd: item.qtd || 1, valor });
    pessoas[nome].subtotal = cent(pessoas[nome].subtotal + valor);
  };
  for (const p of (pedidos || []).filter((x) => x && x.status !== "cancelado")) {
    const ref = p.id != null ? p.id : p.numero;
    (p.itens || []).forEach((item, idx) => {
      const pessoa = mapaAttr[ref + ":" + idx] || "Não atribuído";
      add(pessoa, item, precoLinha(item));
    });
  }
  return Object.values(pessoas);
}

// Recebimento parcial: dado o total e os pagamentos já recebidos, devolve quanto
// entrou, quanto falta e o troco (se pagou a mais). Núcleo do "recebe X, falta Y".
function calcularFalta(total, pagamentosRecebidos) {
  const t = cent(total);
  const recebido = cent((pagamentosRecebidos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0));
  const falta = cent(Math.max(0, t - recebido));
  const troco = cent(Math.max(0, recebido - t));
  return { recebido, falta, troco };
}

module.exports = { precoLinha, calcularTotalMesa, dividirIgualitario, dividirPorProduto, calcularFalta };
