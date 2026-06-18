// ============================================================
// GERENCIADOR DE SESSÕES
// Guarda o "estado" da conversa de cada cliente em memória.
// Estados possíveis: INICIO, MENU (atendimento automático) e ATENDENTE (humano).
// O pedido em si é montado no cardápio web — a sessão só guarda o estado da
// conversa e se o cliente já foi saudado (`saudou`).
// Obs: ao reiniciar o bot, as sessões se perdem (estão em memória).
//      Para produção, troque por Redis ou banco de dados.
// ============================================================

const TEMPO_EXPIRA_MS = 30 * 60 * 1000; // 30 minutos de inatividade

const sessoes = new Map();

// Estado inicial canônico de uma sessão (fonte única — usado ao criar e ao limpar).
function estadoInicial(agora) {
  return {
    estado: "INICIO",
    saudou: false, // já recebeu a saudação + menu nesta sessão?
    atualizadoEm: agora,
  };
}

function getSessao(chatId) {
  let s = sessoes.get(chatId);
  const agora = Date.now();

  // Expira sessão inativa
  if (s && agora - s.atualizadoEm > TEMPO_EXPIRA_MS) {
    sessoes.delete(chatId);
    s = null;
  }

  if (!s) {
    s = estadoInicial(agora);
    sessoes.set(chatId, s);
  }
  s.atualizadoEm = agora;
  return s;
}

// Varredura ATIVA: descarta sessões inativas há mais de TEMPO_EXPIRA_MS. A
// expiração do getSessao é lazy (só limpa quando a MESMA chave volta); conversa
// abandonada nunca volta, então ficaria na memória pra sempre. Esta varredura
// (agendada no index.js) recupera essa RAM. Deletar do Map durante a iteração é
// seguro em JS. `agora` é injetável só para teste. Retorna quantas removeu.
function limparExpiradas(agora = Date.now()) {
  let removidas = 0;
  for (const [chave, s] of sessoes) {
    if (agora - s.atualizadoEm > TEMPO_EXPIRA_MS) {
      sessoes.delete(chave);
      removidas++;
    }
  }
  return removidas;
}

// Limpa uma sessão APAGANDO por chave. Mantido para quem conhece a chave exata
// (ex.: endpoint /api/simulador/reset). NÃO usar dentro do fluxo: lá a chave de
// armazenamento (slug:jid) difere do chatId do canal — use limparSessao(sessao).
function resetSessao(chatId) {
  sessoes.delete(chatId);
}

// Limpa a sessão pelo PRÓPRIO objeto (in-place). Robusto contra divergência de
// chave: zera o mesmo objeto que está no Map, então a próxima getSessao retorna
// a sessão já no estado inicial. chatId/telefone são recapturados na próxima
// mensagem, então também são limpos aqui (reset "novo cliente").
function limparSessao(sessao) {
  if (!sessao) return;
  Object.assign(sessao, estadoInicial(Date.now()));
  delete sessao.chatId;
  delete sessao.telefone;
}

module.exports = { getSessao, resetSessao, limparSessao, limparExpiradas };
