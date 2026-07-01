const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Lista as filas de impressao instaladas no Windows (nome amigavel).
function listar() {
  return new Promise((resolve) => {
    execFile("powershell", ["-NoProfile", "-NonInteractive", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"], (err, stdout) => {
      if (err) return resolve([]);
      resolve(String(stdout).split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((nome) => ({ path: nome, fabricante: "" })));
    });
  });
}

// Impressao USB = envio RAW (ESC/POS cru) para a fila de impressao do Windows, via
// winspool (OpenPrinter/StartDocPrinter datatype "RAW"/WritePrinter) — o mecanismo do
// proprio spooler para dados crus, o mesmo que térmicas usam. Roda por PowerShell +
// Add-Type (sem dependencia nativa; casa com o listar() acima). Nome da fila e caminho
// do arquivo vao por variavel de ambiente (nunca interpolados no script -> sem problema
// de aspas/injecao). So resolve em sucesso real (senao o poller marcaria impresso sem
// sair papel -> pedido perdido); qualquer falha do winspool vira erro e o job fica pendente.
const PS_RAW = `
$ErrorActionPreference = 'Stop'
$name = $env:NYMBUS_PRINTER
$dataPath = $env:NYMBUS_DATA
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class NymbusRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static void Send(string printer, byte[] bytes) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) throw new Exception("OpenPrinter falhou (" + Marshal.GetLastWin32Error() + ")");
    try {
      DOCINFOA di = new DOCINFOA(); di.pDocName = "Nymbus"; di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di)) throw new Exception("StartDocPrinter falhou (" + Marshal.GetLastWin32Error() + ")");
      try {
        if (!StartPagePrinter(h)) throw new Exception("StartPagePrinter falhou (" + Marshal.GetLastWin32Error() + ")");
        IntPtr p = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, p, bytes.Length);
        try {
          int escrito;
          if (!WritePrinter(h, p, bytes.Length, out escrito)) throw new Exception("WritePrinter falhou (" + Marshal.GetLastWin32Error() + ")");
          if (escrito != bytes.Length) throw new Exception("Escrita parcial " + escrito + "/" + bytes.Length);
        } finally { Marshal.FreeCoTaskMem(p); EndPagePrinter(h); }
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
'@
$bytes = [System.IO.File]::ReadAllBytes($dataPath)
[NymbusRawPrinter]::Send($name, $bytes)
Write-Output 'NYMBUS_OK'
`;

function enviar(buffer, fila) {
  return new Promise((resolve, reject) => {
    const nome = String(fila || "").trim();
    if (!nome) return reject(new Error("Escolha a impressora (fila do Windows)."));
    let tmp;
    try {
      tmp = path.join(os.tmpdir(), "nymbus-print-" + process.pid + "-" + Date.now() + ".bin");
      fs.writeFileSync(tmp, Buffer.from(buffer));
    } catch (e) {
      return reject(new Error("Falha ao preparar impressao USB: " + e.message));
    }
    const env = Object.assign({}, process.env, { NYMBUS_PRINTER: nome, NYMBUS_DATA: tmp });
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", PS_RAW],
      { env, windowsHide: true },
      (err, stdout, stderr) => {
        try { fs.unlinkSync(tmp); } catch (_) {}
        const saida = String(stdout || "");
        if (err || !/NYMBUS_OK/.test(saida)) {
          const motivo = String(stderr || (err && err.message) || "erro desconhecido").trim().split(/\r?\n/)[0] || "erro desconhecido";
          return reject(new Error("Impressao USB falhou: " + motivo));
        }
        resolve();
      }
    );
  });
}

module.exports = { listar, enviar };
