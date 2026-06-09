// ============================================================
// MULTI-BOT — gerencia um WhatsApp Client por tenant
//
// Cada empresa conecta o próprio número. O estado (status, qr,
// prontoEm) fica em um Map keyed por slug.
// ============================================================

const fs = require("fs");
const path = require("path");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");

const { getSessao } = require("./sessoes");
const { processarMensagem } = require("./fluxo");

// { slug → { client, status, qrDataUrl, prontoEm, watchdog } }
const tenants = new Map();

function getEstado(slug) {
  const t = tenants.get(slug);
  if (!t) return { status: "desligado", qr: null };
  return { status: t.status, qr: t.qrDataUrl };
}

function limparWatchdog(slug) {
  const t = tenants.get(slug);
  if (t && t.watchdog) { clearTimeout(t.watchdog); t.watchdog = null; }
}

function criarClient(slug, tenantDir) {
  const c = new Client({
    authStrategy: new LocalAuth({ clientId: slug, dataPath: tenantDir }),
    webVersionCache: {
      type: "remote",
      remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1015901727-alpha.html",
    },
    puppeteer: {
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  c.on("loading_screen", (pct, msg) => {
    console.log(`[${slug}] ⏳ Carregando WhatsApp: ${pct}% ${msg || ""}`);
  });

  c.on("qr", async (qr) => {
    limparWatchdog(slug);
    const t = tenants.get(slug);
    if (t) t.status = "aguardando_qr";
    console.log(`\n[${slug}] 📲 QR disponível no painel.`);
    qrcodeTerminal.generate(qr, { small: true });
    try {
      const url = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
      if (tenants.get(slug)) tenants.get(slug).qrDataUrl = url;
    } catch (e) {
      console.error(`[${slug}] Erro ao gerar QR:`, e.message);
    }
  });

  c.on("authenticated", () => console.log(`[${slug}] ✅ Autenticado.`));

  c.on("ready", () => {
    limparWatchdog(slug);
    const t = tenants.get(slug);
    if (t) { t.status = "conectado"; t.qrDataUrl = null; t.prontoEm = Date.now(); }
    console.log(`[${slug}] 🤖 Bot ONLINE.`);
  });

  c.on("auth_failure", (m) => {
    limparWatchdog(slug);
    const t = tenants.get(slug);
    if (t) { t.status = "desligado"; t.client = null; }
    console.error(`[${slug}] ❌ Falha na autenticação:`, m);
  });

  c.on("disconnected", (r) => {
    limparWatchdog(slug);
    const t = tenants.get(slug);
    if (t) { t.status = "desligado"; t.qrDataUrl = null; t.prontoEm = null; t.client = null; }
    console.warn(`[${slug}] ⚠️ Desconectado:`, r);
  });

  c.on("message", async (message) => {
    try {
      const t = tenants.get(slug);
      if (!t || t.status !== "conectado" || !t.prontoEm) return;

      const tsMsg = (message.timestamp || 0) * 1000;
      if (!tsMsg || tsMsg < t.prontoEm - 1000) return;
      if (message.fromMe) return;
      if (message.from.endsWith("@g.us")) return;
      if (message.isStatus) return;

      if (message.type !== "chat") {
        await message.reply("Por enquanto eu entendo apenas *mensagens de texto* 🙂. Digite *menu* para começar.");
        return;
      }

      // Chave de sessão inclui o slug para isolar clientes entre tenants
      const sessaoKey = `${slug}:${message.from}`;
      const sessao = getSessao(sessaoKey);
      const { respostas } = processarMensagem(message.from, message.body, sessao, tenantDir);
      for (const r of respostas) {
        if (r && r.trim()) {
          await c.sendMessage(message.from, r);
          await new Promise((res) => setTimeout(res, 400));
        }
      }
    } catch (err) {
      console.error(`[${slug}] Erro ao processar mensagem:`, err);
    }
  });

  return c;
}

function iniciar(slug, tenantDir) {
  if (tenants.has(slug) && tenants.get(slug).client) return;

  const t = { client: null, status: "iniciando", qrDataUrl: null, prontoEm: null, watchdog: null };
  tenants.set(slug, t);

  const client = criarClient(slug, tenantDir);
  t.client = client;

  t.watchdog = setTimeout(() => {
    if (tenants.get(slug)?.status === "iniciando") {
      console.error(`[${slug}] ⏱️ Tempo esgotado ao iniciar.`);
      desconectar(slug);
    }
  }, 90000);

  client.initialize().catch(async (err) => {
    limparWatchdog(slug);
    console.error(`[${slug}] ❌ Erro ao iniciar:`, err.message);
    try { await client.destroy(); } catch (_) { /* ignora */ }
    const t = tenants.get(slug);
    if (t) { t.status = "desligado"; t.client = null; }
  });
}

async function desconectar(slug) {
  limparWatchdog(slug);
  const t = tenants.get(slug);
  if (t && t.client) {
    try { await t.client.destroy(); } catch (e) { /* ignora */ }
    t.client = null;
  }
  if (t) { t.status = "desligado"; t.qrDataUrl = null; t.prontoEm = null; }
  console.log(`[${slug}] ⏹️ Bot pausado.`);
}

async function resetarSessao(slug, tenantDir) {
  await desconectar(slug);
  await new Promise((r) => setTimeout(r, 1500));
  // LocalAuth com dataPath=tenantDir guarda sessão em tenantDir/session-{slug}/
  const pasta = path.join(tenantDir, `session-${slug}`);
  try {
    fs.rmSync(pasta, { recursive: true, force: true });
    console.log(`[${slug}] 🧹 Sessão limpa.`);
  } catch (e) {
    throw new Error("Não foi possível apagar a sessão. Tente parar o bot e apagar manualmente.");
  }
}

async function enviarMensagem(slug, para, texto) {
  const t = tenants.get(slug);
  if (!t || t.status !== "conectado" || !t.client) {
    throw new Error("WhatsApp não conectado");
  }
  await t.client.sendMessage(para, texto);
}

module.exports = { iniciar, desconectar, resetarSessao, getEstado, enviarMensagem };
