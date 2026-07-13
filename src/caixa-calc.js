// PURO: cálculos do caixa (sem banco). Testável isolado.
// "Dinheiro" é a única forma que entra na conferência física da gaveta.
function ehDinheiro(forma) {
  return String(forma || "").trim().toLowerCase() === "dinheiro";
}

function resumoCaixa(caixa, movimentos) {
  // Recebido/cancelado ficam com o TOTAL (venda + fiado) — a conferência da gaveta
  // usa esses agregados e o dinheiro do fiado também está na gaveta, então não pode
  // sair daqui. O recebimento de conta a prazo (fiado) é ADICIONALMENTE somado à parte
  // (…Prazo…) para a tela/relatório distinguir VENDA DO DIA de COBRANÇA DE DÍVIDA
  // (fiado recebido não é faturamento de hoje; a venda já contou quando foi feita).
  const recebidoPorForma = {}, canceladoPorForma = {};
  const recebidoPrazoPorForma = {}, canceladoPrazoPorForma = {};
  let totalRecebido = 0, recebidoDinheiro = 0, suprimentos = 0, sangrias = 0;
  let cancelamentos = 0, canceladoDinheiro = 0, vendasPrazo = 0;
  let totalRecebidoPrazo = 0, recebidoPrazoDinheiro = 0, canceladoPrazo = 0, canceladoPrazoDinheiro = 0;
  for (const m of movimentos || []) {
    const v = Number(m.valor) || 0;
    const forma = m.forma_pagamento || "Outros";
    const prazo = m.a_prazo === true; // recebimento/estorno ligado a pedido a_prazo (fiado)
    if (m.tipo === "recebimento") {
      recebidoPorForma[forma] = (recebidoPorForma[forma] || 0) + v;
      totalRecebido += v;
      if (ehDinheiro(forma)) recebidoDinheiro += v;
      if (prazo) {
        recebidoPrazoPorForma[forma] = (recebidoPrazoPorForma[forma] || 0) + v;
        totalRecebidoPrazo += v;
        if (ehDinheiro(forma)) recebidoPrazoDinheiro += v;
      }
    } else if (m.tipo === "cancelamento" || m.tipo === "estorno") {
      // Estorno (correção de recebimento errado) deduz igual ao cancelamento —
      // ambos reversam uma entrada, mantendo o rastro no extrato.
      canceladoPorForma[forma] = (canceladoPorForma[forma] || 0) + v;
      cancelamentos += v;
      if (ehDinheiro(forma)) canceladoDinheiro += v;
      if (prazo) {
        canceladoPrazoPorForma[forma] = (canceladoPrazoPorForma[forma] || 0) + v;
        canceladoPrazo += v;
        if (ehDinheiro(forma)) canceladoPrazoDinheiro += v;
      }
    } else if (m.tipo === "suprimento") {
      suprimentos += v;
    } else if (m.tipo === "sangria") {
      sangrias += v;
    } else if (m.tipo === "venda_prazo") {
      // Venda a prazo (fiado): INFORMATIVO. Aparece no extrato/fechamento, mas
      // NÃO entra na conferência (o dinheiro não entrou agora; entra na baixa).
      vendasPrazo += v;
    }
  }
  const fundo = Number(caixa && caixa.fundo_troco) || 0;
  // Espécie esperada na gaveta: tira o dinheiro que foi devolvido em cancelamentos.
  // (recebidoDinheiro/canceladoDinheiro já incluem o fiado — a gaveta tem esse dinheiro.)
  const esperadoEspecie = fundo + recebidoDinheiro + suprimentos - sangrias - canceladoDinheiro;
  return {
    recebidoPorForma, totalRecebido, recebidoDinheiro, suprimentos, sangrias,
    cancelamentos, canceladoPorForma, canceladoDinheiro, esperadoEspecie,
    vendasPrazo,
    // Recebimento de conta a prazo (fiado) — subconjunto do recebido, para separar na exibição.
    recebidoPrazoPorForma, totalRecebidoPrazo, recebidoPrazoDinheiro,
    canceladoPrazoPorForma, canceladoPrazo, canceladoPrazoDinheiro,
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

module.exports = { resumoCaixa, calcularDiferenca, ehDinheiro, totalContagem, esperadoEletronico, totalEmCaixa };
