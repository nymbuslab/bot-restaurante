// ============================================================
// SIMULADOR DE CONVERSA — testa o fluxo do bot sem WhatsApp
// Uso: node testar-bot.js
// Comandos especiais:
//   /reset   — reinicia a sessão (como se o cliente fosse embora)
//   /status  — mostra o estado atual da sessão
//   /quit    — encerra o simulador
// ============================================================

const path = require("path");
const readline = require("readline");
const { getSessao, resetSessao } = require("./src/sessoes");
const { processarMensagem } = require("./src/fluxo");
const empresas = require("./src/empresas");

const CHAT_ID = "simulador@c.us";

// Usa o primeiro tenant disponível (ou o diretório padrão como fallback)
const lista = empresas.listar();
const TENANT_DIR = lista.length > 0
  ? empresas.tenantDir(lista[0].slug)
  : path.join(__dirname, "data");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

const VERDE  = "\x1b[32m";
const AZUL   = "\x1b[34m";
const CINZA  = "\x1b[90m";
const RESET  = "\x1b[0m";
const NEGRITO = "\x1b[1m";

function linha() { console.log(CINZA + "─".repeat(60) + RESET); }

function mostrarRespostas(respostas) {
  for (const r of respostas) {
    if (!r || !r.trim()) continue;
    linha();
    // Converte formatação WhatsApp (*negrito*, _itálico_) para terminal
    const txt = r
      .replace(/\*(.*?)\*/g, `${NEGRITO}$1${RESET}`)
      .replace(/_(.*?)_/g, `\x1b[3m$1${RESET}`);
    console.log(`${VERDE}🤖 Bot:${RESET}\n${txt}`);
  }
  linha();
}

function mostrarStatus() {
  const s = getSessao(CHAT_ID);
  console.log(`${CINZA}Estado: ${NEGRITO}${s.estado}${RESET}${CINZA} | Carrinho: ${s.carrinho.length} item(s)${RESET}`);
}

function prompt() {
  mostrarStatus();
  rl.question(`${AZUL}Você: ${RESET}`, (entrada) => {
    const msg = (entrada || "").trim();

    if (!msg) return prompt();

    if (msg === "/quit") {
      console.log("\nSimulador encerrado.\n");
      rl.close();
      return;
    }

    if (msg === "/reset") {
      resetSessao(CHAT_ID);
      console.log(`${CINZA}── Sessão reiniciada ──${RESET}\n`);
      return prompt();
    }

    if (msg === "/status") {
      const s = getSessao(CHAT_ID);
      console.log(JSON.stringify(s, null, 2));
      return prompt();
    }

    const sessao = getSessao(CHAT_ID);
    const { respostas } = processarMensagem(CHAT_ID, msg, sessao, TENANT_DIR);
    mostrarRespostas(respostas);
    prompt();
  });
}

console.log(`
${NEGRITO}╔══════════════════════════════════════╗
║   Simulador do Bot — Restaurante     ║
╚══════════════════════════════════════╝${RESET}
Comandos especiais: ${CINZA}/reset${RESET}  ${CINZA}/status${RESET}  ${CINZA}/quit${RESET}
Comece digitando ${NEGRITO}oi${RESET} para iniciar o atendimento.
`);

prompt();
