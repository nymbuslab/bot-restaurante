const { app, BrowserWindow, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const ipc = require("./ipc");
const auth = require("./auth");
const poller = require("./poller");
const api = require("./api");
const config = require("./config");

// Ícone da marca embutido (PNG 32x32) — sem depender de arquivo em disco, pra o Tray
// nunca falhar por asset faltando (era o bug "some ao fechar e não aparece na bandeja").
const ICON_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAA7klEQVR42s2XwQ2DMAxFOTMQ90geIvc/QLfIFhmAHTwCAzAAA7ABVSUjuagtkAbsw7+gOH4ktmM3IG4sddagAzFAnECcQdyLsnyDrKkK0II4ipMRxMuORlkbxfYvgCCbzQccbzWLbSgFeB3nUOB4q0H2OgXwAPFUwfmqSfY8BIDKzjUE9gBCpWP/dR3hG0ArQbNcrKyzQwPEwmgvyY74CeCOv9en8AbQHSwytTSuFVNH/nKzoAGSAUDSANkAIGuA3gCgdwVgfgXmQWiehuaFyLwUu3iMzJ9j84bERUvmoil10Za7GExcjGYuhtNL9QR5wDS1JbWY7wAAAABJRU5ErkJggg==";
function icone() { return nativeImage.createFromDataURL(ICON_DATA_URL); }

let janela = null;
let tray = null;

function mostrarJanela() { if (janela) { janela.show(); janela.focus(); } }

function criarJanela() {
  janela = new BrowserWindow({
    width: 480, height: 760, resizable: true,
    icon: icone(),
    webPreferences: { preload: path.join(__dirname, "..", "renderer", "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  janela.removeMenu();
  janela.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  ipc.registrar(janela);
  // Fechar a janela = esconder na bandeja (só sai de verdade pelo menu "Sair").
  janela.on("close", (e) => { if (!app.isQuitting) { e.preventDefault(); janela.hide(); } });
  janela.webContents.on("did-finish-load", async () => {
    if (!auth.estaLogado()) return;
    // A URL do servidor (api.setBase) só era definida no login, em memória. Ao reabrir logado
    // (sessão restaurada do cofre), o login não roda → base vazia → todo request falha com
    // "Sem conexão". Restaura da config salva e renova o token ANTES do 1º poll.
    api.setBase(config.carregar().apiBase);
    await auth.renovar().catch(() => {});
    poller.iniciar({
      onLog: (m) => janela && janela.webContents.send("log", m),
      onStatus: (s) => janela && janela.webContents.send("status", s),
    });
  });
}

function criarTray() {
  try {
    tray = new Tray(icone());
    tray.setToolTip("Nymbus Impressora — imprimindo em segundo plano");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Abrir", click: mostrarJanela },
      { label: "Sair", click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    tray.on("click", mostrarJanela);
    tray.on("double-click", mostrarJanela);
  } catch (_) { /* sem tray: ignora */ }
}

// AUTO-UPDATE DESLIGADO de proposito ate o instalador ser ASSINADO (code signing).
// Sem assinatura, o electron-updater nao consegue verificar a origem do .exe baixado do
// feed `generic` — um feed comprometido/MITM instalaria um binario malicioso a cada boot
// (RCE / supply-chain). Para religar com seguranca: assinar o instalador (win.certificateFile
// + win.publisherName), travar a escrita em /downloads/ e setar verifyUpdateCodeSignature.
// Ate la, a atualizacao e MANUAL (baixar o novo Setup .exe pelo painel). NAO chamar
// autoUpdater.checkForUpdatesAndNotify() aqui.
app.whenReady().then(() => { criarJanela(); criarTray(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
