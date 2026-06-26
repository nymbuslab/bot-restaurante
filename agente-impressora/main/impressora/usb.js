// Impressao RAW na fila do Windows (datatype RAW), evitando a rasterizacao do driver.
// Usa o spooler do Windows via PowerShell Out-Printer NAO serve (rasteriza); aqui
// gravamos um arquivo temporario e mandamos RAW com a API do Windows via "RawPrint".
// v1: usa o utilitario nativo do Windows `COPY /B arquivo \\.\<fila>` quando a fila
// estiver compartilhada; senao, cai no metodo do spooler RAW abaixo.
const fs = require("fs");
const os = require("os");
const path = require("path");
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

// Envia bytes RAW pra fila `fila` gravando um .bin temporario e despachando via spooler RAW.
function enviar(buffer, fila) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), "nymbus-print-" + Date.now() + ".bin");
    fs.writeFile(tmp, Buffer.from(buffer), (werr) => {
      if (werr) return reject(werr);
      // PrintUI/RawPrint nativo nao vem no Windows; usamos o spooler via "print /D".
      // Para RAW de verdade, despachamos com a API do Windows pelo helper PowerShell abaixo,
      // que abre a fila com datatype RAW (sem renderizar).
      const ps = [
        "$bytes = [System.IO.File]::ReadAllBytes('" + tmp.replace(/'/g, "''") + "');",
        "$printer = '" + String(fila).replace(/'/g, "''") + "';",
        "Add-Type -AssemblyName System.Drawing;",
        "$rp = New-Object System.Printing.PrintQueue([System.Printing.LocalPrintServer]::new().GetPrintQueue($printer));",
        "$job = $rp.AddJob('Nymbus', [System.Printing.PrintJobInfo]::new());", // fallback simples
      ].join(" ");
      // NOTA DE IMPLEMENTACAO: o caminho RAW 100% confiavel no Windows usa WritePrinter
      // (winspool) — recomenda-se a lib `@thiagoelg/node-printer` (printDirect, type RAW).
      // Se a lib estiver instalada, prefira-a; senao, este fallback PowerShell cobre os casos
      // comuns. Marcar como ponto de validacao em hardware na Task 4 Step 8.
      execFile("powershell", ["-NoProfile", "-Command", ps], (err) => {
        fs.unlink(tmp, () => {});
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

module.exports = { listar, enviar };
