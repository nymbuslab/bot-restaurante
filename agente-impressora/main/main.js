const { app, BrowserWindow, Tray, Menu } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const ipc = require("./ipc");
const auth = require("./auth");
const poller = require("./poller");

let janela = null;
let tray = null;

function criarJanela() {
  janela = new BrowserWindow({
    width: 480, height: 760, resizable: true,
    webPreferences: { preload: path.join(__dirname, "..", "renderer", "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  janela.removeMenu();
  janela.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  ipc.registrar(janela);
  janela.on("close", (e) => { if (!app.isQuitting) { e.preventDefault(); janela.hide(); } });
  janela.webContents.on("did-finish-load", () => {
    if (auth.estaLogado()) poller.iniciar({ onLog: (m) => janela.webContents.send("log", m), onStatus: (s) => janela.webContents.send("status", s) });
  });
}

function criarTray() {
  try {
    tray = new Tray(path.join(__dirname, "..", "renderer", "icone.png"));
    tray.setToolTip("Nymbus Impressora");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Abrir", click: () => janela.show() },
      { label: "Sair", click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    tray.on("click", () => janela.show());
  } catch (_) { /* sem icone: ignora o tray */ }
}

app.whenReady().then(() => { criarJanela(); criarTray(); try { autoUpdater.checkForUpdatesAndNotify(); } catch (_) {} });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
