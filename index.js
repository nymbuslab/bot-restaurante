// ============================================================
// PONTO DE ENTRADA
// Inicia o PAINEL (servidor web). O bot do WhatsApp só conecta
// quando você clicar em "Conectar ao WhatsApp" no painel.
//
// Como rodar:
//   1) npm install
//   2) npm start
//   3) Abra http://localhost:3000 -> faça login -> configure tudo
//   4) Na aba "Conexão", clique em "Conectar ao WhatsApp" e escaneie o QR
// ============================================================

require("dotenv").config();

const servidor = require("./src/servidor");
const { limparSessoesAntigas } = require("./src/wa-auth");
const PORTA = process.env.PORT || 3000;

// Higiene diária: remove sessões de clientes (`session:*`) inativas há +90 dias.
// Seguro (o Baileys recria no próximo contato) e barato. Idempotente entre
// instâncias. Roda 1x no boot e a cada 24h.
const DIAS_INATIVO_SESSAO = 90;
async function limparSessoes() {
  try {
    const n = await limparSessoesAntigas(DIAS_INATIVO_SESSAO);
    if (n > 0) console.log(`🧹 Higiene de sessões: ${n} sessão(ões) inativa(s) > ${DIAS_INATIVO_SESSAO}d removida(s).`);
  } catch (e) {
    console.error("Higiene de sessões falhou (ignorado):", e.message);
  }
}
setTimeout(limparSessoes, 30_000);                  // 30s após o boot
setInterval(limparSessoes, 24 * 60 * 60 * 1000);    // a cada 24h

// Impede que erros do bot/WhatsApp derrubem o servidor.
// O bot pode travar ou cair; o painel continua no ar.
process.on("uncaughtException", (err) => {
  console.error("❌ Erro não tratado (servidor continua):", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Promise sem tratamento (servidor continua):", reason);
});

servidor.iniciar(PORTA);
