const { ipcMain } = require("electron");
const auth = require("./auth");
const config = require("./config");
const transporte = require("./transporte");
const poller = require("./poller");
const { montarJob } = require("./print-job");

function registrar(janela) {
  const log = (m) => janela && janela.webContents.send("log", m);
  const status = (s) => janela && janela.webContents.send("status", s);
  const opts = { onLog: log, onStatus: status };

  ipcMain.handle("auth:login", async (_e, { apiBase, email, senha }) => {
    const s = await auth.login(apiBase, email, senha);
    config.salvar({ ...config.carregar(), apiBase, email });
    poller.iniciar(opts);
    return s;
  });
  ipcMain.handle("auth:status", () => ({ logado: auth.estaLogado(), ...auth.dados() }));
  ipcMain.handle("auth:sair", () => { poller.parar(); auth.sair(); return true; });

  ipcMain.handle("config:carregar", () => config.carregar());
  ipcMain.handle("config:salvar", (_e, { cfg }) => config.salvar(cfg));

  ipcMain.handle("impressora:listar", (_e, { conexao }) => transporte.listarImpressoras(conexao));
  ipcMain.handle("impressora:teste", async () => {
    const cfg = config.carregar();
    const pedido = { numero: 0, cliente: "TESTE", tipoEntrega: "Balcão", itens: [{ nome: "Teste de impressao", qtd: 1, preco: 0 }], total: 0, criadoEm: new Date().toISOString() };
    const buffers = montarJob(pedido, { restaurante: { nome: "Nymbus" } }, cfg, {});
    await transporte.enviar(buffers, cfg);
    return true;
  });

  ipcMain.handle("poller:iniciar", () => { poller.iniciar(opts); return true; });
  ipcMain.handle("poller:parar", () => { poller.parar(); return true; });
}

module.exports = { registrar };
