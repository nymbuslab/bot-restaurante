// Envia bytes p/ uma termica de rede (RAW / porta 9100) via socket TCP.
const net = require("net");

function enviar(buffer, host, porta) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let pronto = false;
    sock.setTimeout(8000);
    sock.on("timeout", () => { sock.destroy(); if (!pronto) reject(new Error("timeout conectando " + host + ":" + porta)); });
    sock.on("error", (e) => { if (!pronto) reject(e); });
    sock.connect(porta, host, () => {
      pronto = true;
      sock.write(Buffer.from(buffer), () => sock.end(() => resolve()));
    });
  });
}

module.exports = { enviar };
