// ============================================================
// BOT — conexão com o WhatsApp (whatsapp-web.js)
//
// O bot NÃO conecta sozinho. Só conecta quando você clica em
// "Conectar ao WhatsApp" no painel (chama iniciar()).
//
// SEGURANÇA: ignora mensagens recebidas ANTES da conexão (mensagens
// não lidas que o WhatsApp reenvia ao sincronizar). Só responde a
// mensagens que chegam AO VIVO, depois de conectado.
// ============================================================

const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");

const estado = require("./estado");
const { getSessao } = require("./sessoes");
const { processarMensagem } = require("./fluxo");

const PASTA_SESSAO = path.join(__dirname, "..", ".wwebjs_auth");

let client = null;
let watchdog = null;

function limparWatchdog() {
  if (watchdog) { clearTimeout(watchdog); watchdog = null; }
}

function criarClient() {
  const c = new Client({
    authStrategy: new LocalAuth({ clientId: "bot-restaurante" }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  c.on("loading_screen", (percent, message) => {
    console.log(`⏳ Carregando WhatsApp: ${percent}% ${message || ""}`);
  });

  c.on("qr", async (qr) => {
    limparWatchdog();
    estado.botStatus = "aguardando_qr";
    console.log("\n📲 Escaneie o QR (terminal ou painel web):\n");
    qrcodeTerminal.generate(qr, { small: true });
    try {
      estado.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
    } catch (e) {
      console.error("Erro gerando QR:", e.message);
    }
  });

  c.on("authenticated", () => console.log("✅ Autenticado."));

  c.on("ready", () => {
    limparWatchdog();
    estado.botStatus = "conectado";
    estado.qrDataUrl = null;
    estado.prontoEm = Date.now(); // só responde ao que vier depois deste momento
    console.log("🤖 Bot ONLINE. Respondendo apenas a mensagens novas a partir de agora.");
  });

  c.on("auth_failure", (m) => {
    limparWatchdog();
    estado.botStatus = "desligado";
    console.error("❌ Falha na autenticação:", m, "(tente 'Gerar novo QR')");
  });

  c.on("disconnected", (r) => {
    limparWatchdog();
    estado.botStatus = "desligado";
    estado.qrDataUrl = null;
    estado.prontoEm = null;
    client = null;
    console.warn("⚠️ Desconectado:", r);
  });

  c.on("message", async (message) => {
    try {
      if (estado.botStatus !== "conectado" || !estado.prontoEm) return; // ainda não pronto

      // Filtro anti-disparo em massa: ignora mensagens sem timestamp ou
      // enviadas antes do bot estar pronto. Tolerância de 1000ms para
      // arredondamento do timestamp (WhatsApp usa segundos inteiros).
      const tsMsg = (message.timestamp || 0) * 1000;
      if (!tsMsg || tsMsg < estado.prontoEm - 1000) {
        console.log(`⏩ Ignorada (anterior à conexão): ${message.from} — ${new Date(tsMsg).toLocaleTimeString("pt-BR")}`);
        return;
      }
      if (message.fromMe) return;
      if (message.from.endsWith("@g.us")) return; // grupos
      if (message.isStatus) return;

      if (message.type !== "chat") {
        await message.reply("Por enquanto eu entendo apenas *mensagens de texto* 🙂. Digite *menu* para começar.");
        return;
      }

      const chatId = message.from;
      const sessao = getSessao(chatId);
      const { respostas } = processarMensagem(chatId, message.body, sessao);
      for (const r of respostas) {
        if (r && r.trim()) {
          await c.sendMessage(chatId, r);
          await new Promise((res) => setTimeout(res, 400));
        }
      }
    } catch (err) {
      console.error("Erro ao processar mensagem:", err);
    }
  });

  return c;
}

// Conecta ao WhatsApp (mostra o QR). Chamado pelo painel.
function iniciar() {
  if (client) return;
  estado.botStatus = "iniciando";
  estado.qrDataUrl = null;
  client = criarClient();

  // Watchdog: se em 90s não gerou QR nem conectou, volta para "desligado"
  // para o painel não ficar preso em "iniciando" para sempre.
  limparWatchdog();
  watchdog = setTimeout(() => {
    if (estado.botStatus === "iniciando") {
      console.error("⏱️ Tempo esgotado ao iniciar. Tente novamente ou use 'Gerar novo QR'.");
      desconectar();
    }
  }, 90000);

  client.initialize().catch((err) => {
    limparWatchdog();
    console.error("❌ Erro ao iniciar o WhatsApp:", err.message);
    estado.botStatus = "desligado";
    client = null;
  });
}

// Pausa o bot (mantém a sessão salva; reconectar não pede QR de novo).
async function desconectar() {
  limparWatchdog();
  if (client) {
    try { await client.destroy(); } catch (e) { /* ignora */ }
  }
  client = null;
  estado.botStatus = "desligado";
  estado.qrDataUrl = null;
  estado.prontoEm = null;
  console.log("⏹️ Bot pausado.");
}

// Limpa a sessão salva para forçar um QR novo (use quando travar em "iniciando").
async function resetarSessao() {
  await desconectar();
  await new Promise((r) => setTimeout(r, 1500)); // espera liberar arquivos (Windows)
  try {
    fs.rmSync(PASTA_SESSAO, { recursive: true, force: true });
    console.log("🧹 Sessão limpa. Clique em Conectar para gerar um novo QR.");
  } catch (e) {
    console.error("Não consegui apagar .wwebjs_auth:", e.message);
    throw new Error("Pare o bot e apague a pasta .wwebjs_auth manualmente.");
  }
}

module.exports = { iniciar, desconectar, resetarSessao };
