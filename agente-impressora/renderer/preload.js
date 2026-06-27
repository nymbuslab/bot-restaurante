const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  login: (apiBase, email, senha) => ipcRenderer.invoke("auth:login", { apiBase, email, senha }),
  authStatus: () => ipcRenderer.invoke("auth:status"),
  sair: () => ipcRenderer.invoke("auth:sair"),
  carregarConfig: () => ipcRenderer.invoke("config:carregar"),
  salvarConfig: (cfg) => ipcRenderer.invoke("config:salvar", { cfg }),
  listarImpressoras: (conexao) => ipcRenderer.invoke("impressora:listar", { conexao }),
  testeImpressao: () => ipcRenderer.invoke("impressora:teste"),
  iniciarPoller: () => ipcRenderer.invoke("poller:iniciar"),
  pararPoller: () => ipcRenderer.invoke("poller:parar"),
  onLog: (cb) => ipcRenderer.on("log", (_e, m) => cb(m)),
  onStatus: (cb) => ipcRenderer.on("status", (_e, s) => cb(s)),
});
