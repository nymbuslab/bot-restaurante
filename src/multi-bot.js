// ============================================================
// MULTI-BOT — gerencia um socket WhatsApp (Baileys) por tenant
//
// Cada empresa conecta o próprio número. O estado (status, qr,
// prontoEm) fica em um Map keyed por slug.
//
// Baileys é WebSocket puro (sem Puppeteer/Chromium). A biblioteca
// é ESM-only, então é carregada via import() dinâmico e cacheada.
//
// GOTCHA (disparo em massa): ao reconectar, o WhatsApp reenvia o
// histórico. O handler SÓ processa messages.upsert com type === "notify"
// (mensagens em tempo real), ignorando "append" (histórico/sync). Esse
// é o substituto do antigo filtro de timestamp do whatsapp-web.js —
// NÃO remover essa checagem.
// ============================================================

const fs = require("fs");
const path = require("path");
const pino = require("pino");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");

const { getSessao } = require("./sessoes");
const { processarMensagem } = require("./fluxo");

// Logger silencioso para o Baileys (não polui o console com debug interno).
const logger = pino({ level: "silent" });

// Baileys é ESM-only → import() dinâmico, carregado uma vez.
let _baileys = null;
async function getBaileys() {
  if (!_baileys) _baileys = await import("@whiskeysockets/baileys");
  return _baileys;
}

// Teto de reconexões automáticas para quedas transitórias (não martela o
// WhatsApp nem a CPU). Zerado a cada conexão bem-sucedida.
const MAX_RECONEXOES = 5;

// { slug → { sock, status, qrDataUrl, prontoEm, fechandoManual, tentativas } }
const tenants = new Map();

function getEstado(slug) {
  const t = tenants.get(slug);
  if (!t) return { status: "desligado", qr: null };
  return { status: t.status, qr: t.qrDataUrl };
}

function iniciar(slug, tenantDir) {
  if (tenants.has(slug) && tenants.get(slug).sock) return;

  const t = { sock: null, status: "iniciando", qrDataUrl: null, prontoEm: null, fechandoManual: false, tentativas: 0 };
  tenants.set(slug, t);

  conectar(slug, tenantDir).catch((err) => {
    console.error(`[${slug}] ❌ Erro ao iniciar:`, err.message);
    const tt = tenants.get(slug);
    if (tt) { tt.status = "desligado"; tt.sock = null; }
  });
}

async function conectar(slug, tenantDir) {
  const t = tenants.get(slug);
  if (!t) return;

  const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, Browsers, DisconnectReason, isJidUser, jidDecode } = await getBaileys();

  // Sessão isolada por tenant (substitui session-{slug}/ do whatsapp-web.js).
  const pastaSessao = path.join(tenantDir, `baileys-${slug}`);
  const { state, saveCreds } = await useMultiFileAuthState(pastaSessao);

  // Versão do WhatsApp Web mais recente suportada pelo Baileys (com fallback
  // para a embutida se a busca remota falhar).
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); }
  catch (_) { version = undefined; }

  console.log(`[${slug}] 🔗 Iniciando conexão (Baileys${version ? ` WA v${version.join(".")}` : ""}).`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.appropriate("Chrome"),
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });
  t.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update;
    const tt = tenants.get(slug);
    if (!tt) return;

    if (qr) {
      tt.status = "aguardando_qr";
      console.log(`\n[${slug}] 📲 QR disponível no painel.`);
      qrcodeTerminal.generate(qr, { small: true });
      try {
        tt.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
      } catch (e) {
        console.error(`[${slug}] Erro ao gerar QR:`, e.message);
      }
    }

    if (connection === "open") {
      tt.status = "conectado";
      tt.qrDataUrl = null;
      tt.prontoEm = Date.now();
      tt.tentativas = 0;
      console.log(`[${slug}] 🤖 Bot ONLINE.`);
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      tt.prontoEm = null;

      // Encerramento manual (desconectar/resetarSessao) — não reconecta.
      if (tt.fechandoManual) {
        tt.status = "desligado";
        tt.sock = null;
        console.log(`[${slug}] ⏹️ Bot pausado.`);
        return;
      }

      // Sessão inválida/substituída/banida — não adianta reconectar sozinho.
      const semReconexao = [
        DisconnectReason.loggedOut,
        DisconnectReason.connectionReplaced,
        DisconnectReason.forbidden,
        DisconnectReason.badSession,
        DisconnectReason.multideviceMismatch,
      ];
      if (semReconexao.includes(code)) {
        tt.status = "desligado";
        tt.sock = null;
        tt.qrDataUrl = null;
        console.warn(`[${slug}] ⚠️ Conexão encerrada (code ${code}) — sem reconexão automática.`);
        return;
      }

      // Quedas transitórias / restartRequired (515, normal após o QR) →
      // reconecta com teto.
      if (tt.tentativas >= MAX_RECONEXOES) {
        tt.status = "desligado";
        tt.sock = null;
        console.error(`[${slug}] 🛑 Reconexão esgotada após ${MAX_RECONEXOES} tentativas (code ${code}).`);
        return;
      }
      tt.tentativas++;
      const espera = code === DisconnectReason.restartRequired ? 0 : 2000;
      console.log(`[${slug}] 🔄 Reconectando (${tt.tentativas}/${MAX_RECONEXOES}, code ${code})...`);
      setTimeout(() => {
        conectar(slug, tenantDir).catch((e) => console.error(`[${slug}] reconexão falhou:`, e.message));
      }, espera);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // GOTCHA disparo em massa: só "notify" (tempo real). "append" = histórico.
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;
        if (msg.key.fromMe) continue;

        const jid = msg.key.remoteJid || "";
        if (jid.endsWith("@g.us")) continue;        // grupos
        if (jid.endsWith("@broadcast")) continue;   // status / broadcast

        const tt = tenants.get(slug);
        if (!tt || tt.status !== "conectado") continue;

        const texto = msg.message.conversation
          || msg.message.extendedTextMessage?.text
          || "";

        if (!texto.trim()) {
          await sock.sendMessage(jid, { text: "Por enquanto eu entendo apenas *mensagens de texto* 🙂. Digite *menu* para começar." });
          continue;
        }

        // Telefone real do cliente: o WhatsApp pode entregar o remoteJid como LID
        // (`<id>@lid`, identificador opaco ≠ telefone). O número fica em `senderPn`.
        // Preferir senderPn; senão remoteJid se já for phone JID; senão vazio.
        const phoneJid = msg.key.senderPn || (isJidUser(jid) ? jid : "");
        const telefone = phoneJid ? (jidDecode(phoneJid)?.user || "") : "";

        // Chave de sessão inclui o slug para isolar clientes entre tenants.
        // Mantém remoteJid (identidade estável, mesmo quando é LID).
        const sessaoKey = `${slug}:${jid}`;
        const sessao = getSessao(sessaoKey);
        const { respostas } = processarMensagem(jid, texto, sessao, tenantDir, telefone);
        for (const r of respostas) {
          if (r && r.trim()) {
            await sock.sendMessage(jid, { text: r });
            await new Promise((res) => setTimeout(res, 400));
          }
        }
      } catch (err) {
        console.error(`[${slug}] Erro ao processar mensagem:`, err.message);
      }
    }
  });
}

async function desconectar(slug) {
  const t = tenants.get(slug);
  if (t && t.sock) {
    t.fechandoManual = true;
    try { t.sock.end(undefined); } catch (e) { /* ignora */ }
    t.sock = null;
  }
  if (t) { t.status = "desligado"; t.qrDataUrl = null; t.prontoEm = null; }
  console.log(`[${slug}] ⏹️ Bot pausado.`);
}

async function resetarSessao(slug, tenantDir) {
  await desconectar(slug);
  await new Promise((r) => setTimeout(r, 1000));
  // Baileys guarda a sessão em tenantDir/baileys-{slug}/ (useMultiFileAuthState).
  const pasta = path.join(tenantDir, `baileys-${slug}`);
  try {
    fs.rmSync(pasta, { recursive: true, force: true });
    console.log(`[${slug}] 🧹 Sessão limpa.`);
  } catch (e) {
    throw new Error("Não foi possível apagar a sessão. Tente parar o bot e apagar manualmente.");
  }
}

async function enviarMensagem(slug, para, texto) {
  const t = tenants.get(slug);
  if (!t || t.status !== "conectado" || !t.sock) {
    throw new Error("WhatsApp não conectado");
  }
  await t.sock.sendMessage(para, { text: texto });
}

module.exports = { iniciar, desconectar, resetarSessao, getEstado, enviarMensagem };
