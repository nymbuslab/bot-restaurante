// Monta os buffers ESC/POS de um pedido, reusando os modulos puros do app principal.
// Em dev (`electron .`) le do public/ do repo ao vivo; empacotado (.exe) usa a copia
// em vendor/ dentro do asar (ver copy-shared.js + electron-builder.yml).
function carregarCompartilhado(nome) {
  try {
    return require("../../public/" + nome);
  } catch (_) {
    return require("../vendor/" + nome);
  }
}
const Comanda = carregarCompartilhado("comanda");
const SerialEscpos = carregarCompartilhado("serial-escpos");

// pedido: shape do /api/agente/pendentes; tenantConfig: config do tenant (restaurante/impressao);
// agentConfig: config da Task 2 (vias/copias/corte/semAcento); extras: { linkCardapio }.
function montarJob(pedido, tenantConfig, agentConfig, extras) {
  const { cozinha, cupom } = Comanda.montarComanda(pedido, tenantConfig || {}, extras || {});
  const opts = { semAcento: !!(agentConfig && agentConfig.semAcento), corte: (agentConfig && agentConfig.corte) || "parcial" };
  const vias = (agentConfig && agentConfig.vias) || { cozinha: true, cupom: true };
  const copias = Math.max(1, parseInt(agentConfig && agentConfig.copias, 10) || 1);
  const textos = [];
  if (vias.cozinha) textos.push(cozinha);
  if (vias.cupom) textos.push(cupom);
  const buffers = [];
  for (let c = 0; c < copias; c++) {
    for (const txt of textos) buffers.push(SerialEscpos.montarEscPos(txt, opts));
  }
  return buffers;
}

// Monta os buffers ESC/POS a partir de VIAS JÁ RENDERIZADAS (texto) — usado pela
// fila genérica (/api/agente/fila): PDV, Mesas, Caixa, reimpressão. O texto já vem
// pronto do servidor; aqui só aplicamos o encoder ESC/POS com corte/sem-acento do
// agente. 1 cópia por via (o servidor já decidiu o que imprimir).
function montarJobDeVias(vias, agentConfig) {
  const opts = { semAcento: !!(agentConfig && agentConfig.semAcento), corte: (agentConfig && agentConfig.corte) || "parcial" };
  return (Array.isArray(vias) ? vias : [])
    .filter((v) => v != null && String(v).trim() !== "")
    .map((txt) => SerialEscpos.montarEscPos(txt, opts));
}

module.exports = { montarJob, montarJobDeVias };
