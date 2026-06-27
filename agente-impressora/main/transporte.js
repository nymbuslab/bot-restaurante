const rede = require("./impressora/rede");
const serial = require("./impressora/serial");
const usb = require("./impressora/usb");

function parseAlvoRede(alvo) {
  const s = String(alvo || "").trim();
  if (!s) return null;
  const [host, portaStr] = s.split(":");
  if (!host || !host.trim()) return null;
  const porta = portaStr ? parseInt(portaStr, 10) : 9100;
  if (Number.isNaN(porta) || porta <= 0) return null;
  return { host: host.trim(), porta };
}

function validarConfigImpressora(cfg) {
  const c = cfg || {};
  if (c.conexao === "rede") {
    return parseAlvoRede(c.alvo) ? { ok: true } : { ok: false, erro: "Informe o IP da impressora (ex.: 192.168.0.50)." };
  }
  if (c.conexao === "serial") {
    return c.alvo ? { ok: true } : { ok: false, erro: "Escolha a porta COM da impressora." };
  }
  if (c.conexao === "usb") {
    return c.alvo ? { ok: true } : { ok: false, erro: "Escolha a impressora (fila do Windows)." };
  }
  return { ok: false, erro: "Tipo de conexao invalido." };
}

// Envia TODAS as vias numa unica conexao por job. As vias sao concatenadas num so stream
// ESC/POS (cada via ja traz seu init ESC @ e o corte no fim, entao a impressora processa
// via1+corte, via2+corte... em sequencia). Isso evita abrir/fechar a porta COM (ou o socket)
// uma vez por via — o reopen rapido da serial dava "porta ocupada" em jobs de 2 vias.
async function enviar(buffers, cfg) {
  const v = validarConfigImpressora(cfg);
  if (!v.ok) throw new Error(v.erro);
  if (!buffers || !buffers.length) return;
  const dados = Buffer.concat(buffers.map((b) => Buffer.from(b)));
  if (cfg.conexao === "rede") { const a = parseAlvoRede(cfg.alvo); await rede.enviar(dados, a.host, a.porta); }
  else if (cfg.conexao === "serial") await serial.enviar(dados, cfg.alvo, cfg.baud);
  else if (cfg.conexao === "usb") await usb.enviar(dados, cfg.alvo);
}

async function listarImpressoras(conexao) {
  if (conexao === "serial") return serial.listar();
  if (conexao === "usb") return usb.listar();
  return [];
}

module.exports = { parseAlvoRede, validarConfigImpressora, enviar, listarImpressoras };
