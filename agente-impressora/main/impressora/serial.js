// Lista portas COM e envia bytes pra termica serial (cobre Daruma e BT pareado).
// NOTA: require("serialport") e lazy (dentro das funcoes) para que o modulo
// possa ser carregado sem o binario nativo instalado — os testes puros nao chamam
// listar/enviar e portanto nao disparam o require.

async function listar() {
  const { SerialPort } = require("serialport"); // lazy: so carrega quando chamado
  const portas = await SerialPort.list();
  return portas.map((p) => ({ path: p.path, fabricante: p.manufacturer || p.friendlyName || "" }));
}

function enviar(buffer, caminho, baud) {
  const { SerialPort } = require("serialport"); // lazy
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: caminho, baudRate: baud || 9600, autoOpen: false });
    port.open((err) => {
      if (err) return reject(err);
      port.write(Buffer.from(buffer), (e) => {
        if (e) { port.close(() => {}); return reject(e); }
        port.drain(() => port.close(() => resolve()));
      });
    });
  });
}

module.exports = { listar, enviar };
