// Envia bytes p/ uma termica de rede (RAW / porta 9100) via socket TCP.
const net = require("net");

function enviar(buffer, host, porta) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    // settle UMA vez: qualquer erro/timeout (mesmo APÓS o connect) rejeita; o 'close'
    // depois do end() resolve. Sem isso, um reset/queda no meio do write deixava a
    // Promise pendurada pra sempre e travava o loop do poller.
    let settled = false;
    const falhar = (err) => { if (settled) return; settled = true; sock.destroy(); reject(err); };
    const ok = () => { if (settled) return; settled = true; resolve(); };
    sock.setTimeout(8000);
    sock.on("timeout", () => falhar(new Error("timeout na impressora " + host + ":" + porta)));
    sock.on("error", (e) => falhar(e));
    sock.on("close", () => ok()); // resolve quando o socket fecha após o end()
    sock.connect(porta, host, () => {
      sock.write(Buffer.from(buffer), (err) => {
        if (err) return falhar(err);
        sock.end(); // FIN após o flush → dispara 'close' → ok()
      });
    });
  });
}

module.exports = { enviar };
