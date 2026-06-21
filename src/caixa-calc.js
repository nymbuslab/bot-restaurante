// PURO: cálculos do caixa (sem banco). Testável isolado.
// "Dinheiro" é a única forma que entra na conferência física da gaveta.
function ehDinheiro(forma) {
  return String(forma || "").trim().toLowerCase() === "dinheiro";
}

function resumoCaixa(caixa, movimentos) {
  const recebidoPorForma = {};
  let totalRecebido = 0, recebidoDinheiro = 0, suprimentos = 0, sangrias = 0;
  for (const m of movimentos || []) {
    const v = Number(m.valor) || 0;
    if (m.tipo === "recebimento") {
      const forma = m.forma_pagamento || "Outros";
      recebidoPorForma[forma] = (recebidoPorForma[forma] || 0) + v;
      totalRecebido += v;
      if (ehDinheiro(forma)) recebidoDinheiro += v;
    } else if (m.tipo === "suprimento") {
      suprimentos += v;
    } else if (m.tipo === "sangria") {
      sangrias += v;
    }
  }
  const fundo = Number(caixa && caixa.fundo_troco) || 0;
  const esperadoEspecie = fundo + recebidoDinheiro + suprimentos - sangrias;
  return { recebidoPorForma, totalRecebido, recebidoDinheiro, suprimentos, sangrias, esperadoEspecie };
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

// Esperado em cartão/pix = tudo que foi recebido menos o que entrou em dinheiro.
function esperadoEletronico(resumo) {
  const r = resumo || {};
  return (Number(r.totalRecebido) || 0) - (Number(r.recebidoDinheiro) || 0);
}

// Total que deveria estar no caixa (espécie + eletrônico):
// saldo inicial + suprimento + vendas (todas as formas) - sangria.
function totalEmCaixa(caixa, resumo) {
  const fundo = Number(caixa && caixa.fundo_troco) || 0;
  const r = resumo || {};
  return fundo + (Number(r.suprimentos) || 0) + (Number(r.totalRecebido) || 0) - (Number(r.sangrias) || 0);
}

module.exports = { resumoCaixa, calcularDiferenca, ehDinheiro, totalContagem, esperadoEletronico, totalEmCaixa };
