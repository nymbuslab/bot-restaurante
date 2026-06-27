const { execFile } = require("child_process");

// Lista as filas de impressao instaladas no Windows (nome amigavel).
function listar() {
  return new Promise((resolve) => {
    execFile("powershell", ["-NoProfile", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"], (err, stdout) => {
      if (err) return resolve([]);
      resolve(String(stdout).split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((nome) => ({ path: nome, fabricante: "" })));
    });
  });
}

// USB RAW ainda nao suportado no v1: o caminho via PowerShell nao grava os bytes no job
// (sairia "sucesso" sem imprimir, e o poller marcaria o pedido como impresso sem ter saido
// papel -> pedido perdido). Falha honesta: o pedido fica pendente e o usuario usa Rede ou Serial.
// Futuro: implementar com @thiagoelg/node-printer (printDirect type RAW) e validar em hardware.
function enviar(buffer, fila) {
  return Promise.reject(new Error("Impressao USB ainda nao suportada nesta versao. Use Rede ou Serial."));
}

module.exports = { listar, enviar };
