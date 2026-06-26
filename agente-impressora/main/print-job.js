// Monta os buffers ESC/POS de um pedido, reusando os modulos puros do app principal.
const Comanda = require("../../public/comanda");
const SerialEscpos = require("../../public/serial-escpos");

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

module.exports = { montarJob };
