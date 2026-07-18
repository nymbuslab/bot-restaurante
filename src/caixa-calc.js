// PURO: cálculos do caixa (sem banco). Testável isolado.
// "Dinheiro" é a única forma que entra na conferência física da gaveta.
function ehDinheiro(forma) {
  return String(forma || "").trim().toLowerCase() === "dinheiro";
}

function resumoCaixa(caixa, movimentos) {
  // Vendas ficam BRUTAS (recebidoPorForma/totalRecebido) e os cancelamentos são
  // rastreados à parte (canceladoPorForma/cancelamentos) — transparência anti-fraude:
  // o relatório/extrato mostra a venda E o cancelamento, e o total deduz o cancelado.
  const recebidoPorForma = {}, canceladoPorForma = {};
  let totalRecebido = 0, recebidoDinheiro = 0, suprimentos = 0, sangrias = 0;
  let cancelamentos = 0, canceladoDinheiro = 0;
  for (const m of movimentos || []) {
    const v = Number(m.valor) || 0;
    const forma = m.forma_pagamento || "Outros";
    if (m.tipo === "recebimento") {
      recebidoPorForma[forma] = (recebidoPorForma[forma] || 0) + v;
      totalRecebido += v;
      if (ehDinheiro(forma)) recebidoDinheiro += v;
    } else if (m.tipo === "cancelamento" || m.tipo === "estorno") {
      // Estorno (correção de recebimento errado) deduz igual ao cancelamento —
      // ambos reversam uma entrada, mantendo o rastro no extrato.
      canceladoPorForma[forma] = (canceladoPorForma[forma] || 0) + v;
      cancelamentos += v;
      if (ehDinheiro(forma)) canceladoDinheiro += v;
    } else if (m.tipo === "suprimento") {
      suprimentos += v;
    } else if (m.tipo === "sangria") {
      sangrias += v;
    }
  }
  const fundo = Number(caixa && caixa.fundo_troco) || 0;
  // Espécie esperada na gaveta: tira o dinheiro que foi devolvido em cancelamentos.
  const esperadoEspecie = fundo + recebidoDinheiro + suprimentos - sangrias - canceladoDinheiro;
  return {
    recebidoPorForma, totalRecebido, recebidoDinheiro, suprimentos, sangrias,
    cancelamentos, canceladoPorForma, canceladoDinheiro, esperadoEspecie,
  };
}

function calcularDiferenca(esperadoEspecie, contadoDinheiro) {
  return (Number(contadoDinheiro) || 0) - (Number(esperadoEspecie) || 0);
}

// Total contado em cédulas/moedas. `contagem`: { "<centavos>": quantidade }.
// Soma em centavos inteiros p/ evitar imprecisão de ponto flutuante.
function totalContagem(contagem) {
  let centavos = 0;
  for (const chave in contagem || {}) {
    centavos += (Number(chave) || 0) * (Number(contagem[chave]) || 0);
  }
  return centavos / 100;
}

// Esperado em cartão/pix = recebido eletrônico menos o cancelado eletrônico.
function esperadoEletronico(resumo) {
  const r = resumo || {};
  const recebElet = (Number(r.totalRecebido) || 0) - (Number(r.recebidoDinheiro) || 0);
  const cancElet = (Number(r.cancelamentos) || 0) - (Number(r.canceladoDinheiro) || 0);
  return recebElet - cancElet;
}

// Total que deveria estar no caixa (espécie + eletrônico):
// saldo inicial + suprimento + vendas (todas as formas) - sangria - cancelamentos.
function totalEmCaixa(caixa, resumo) {
  const fundo = Number(caixa && caixa.fundo_troco) || 0;
  const r = resumo || {};
  return fundo + (Number(r.suprimentos) || 0) + (Number(r.totalRecebido) || 0)
    - (Number(r.sangrias) || 0) - (Number(r.cancelamentos) || 0);
}

// Esperado POR forma (conferência simplificada do fechamento). Dinheiro carrega a
// espécie inteira (fundo + suprimento - sangria - cancelado); as demais são só o
// recebido líquido daquela forma. Soma bate com `totalEmCaixa` (logo a soma das
// diferenças por forma = diferença global).
function esperadoPorForma(resumo, formas) {
  const r = resumo || {};
  const rec = r.recebidoPorForma || {};
  const canc = r.canceladoPorForma || {};
  const out = {};
  (formas || []).forEach((f) => {
    out[f] = ehDinheiro(f)
      ? (Number(r.esperadoEspecie) || 0)
      : ((Number(rec[f]) || 0) - (Number(canc[f]) || 0));
  });
  return out;
}

module.exports = { resumoCaixa, calcularDiferenca, ehDinheiro, totalContagem, esperadoEletronico, totalEmCaixa, esperadoPorForma };
