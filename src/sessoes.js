// ============================================================
// GERENCIADOR DE SESSÕES
// Guarda o "estado" da conversa de cada cliente em memória.
// Estados possíveis: INICIO, MENU, PEDINDO, QUANTIDADE, FINALIZANDO_NOME,
//                    FINALIZANDO_ENTREGA, FINALIZANDO_PAGAMENTO, CONFIRMANDO
// Obs: ao reiniciar o bot, as sessões se perdem (estão em memória).
//      Para produção, troque por Redis ou banco de dados.
// ============================================================

const TEMPO_EXPIRA_MS = 30 * 60 * 1000; // 30 minutos de inatividade

const sessoes = new Map();

function getSessao(chatId) {
  let s = sessoes.get(chatId);
  const agora = Date.now();

  // Expira sessão inativa
  if (s && agora - s.atualizadoEm > TEMPO_EXPIRA_MS) {
    sessoes.delete(chatId);
    s = null;
  }

  if (!s) {
    s = {
      estado: "INICIO",
      carrinho: [], // [{ id, nome, preco, qtd }]
      itemPendente: null, // item aguardando quantidade
      pedido: {}, // { nome, tipoEntrega, endereco, pagamento }
      atualizadoEm: agora,
    };
    sessoes.set(chatId, s);
  }
  s.atualizadoEm = agora;
  return s;
}

function resetSessao(chatId) {
  sessoes.delete(chatId);
}

module.exports = { getSessao, resetSessao };
