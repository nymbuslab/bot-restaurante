const { app, BrowserWindow } = require("electron");
const path = require("path");

let janela = null;

function criarJanela() {
  janela = new BrowserWindow({
    width: 480,
    height: 760,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "..", "renderer", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  janela.removeMenu();
  janela.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(criarJanela);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) criarJanela(); });
