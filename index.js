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
const pedidos = require("./src/pedidos");
const clientes = require("./src/clientes");
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

// Retenção (LGPD): anonimiza dados pessoais de pedidos com mais de 12 meses
// (mantém número/itens/total/datas). Job global, idempotente. Boot + 24h.
const MESES_RETENCAO_PEDIDOS = 12;
async function anonimizarPedidos() {
  try {
    const n = await pedidos.anonimizarAntigos(MESES_RETENCAO_PEDIDOS);
    if (n > 0) console.log(`🔒 Retenção: ${n} pedido(s) > ${MESES_RETENCAO_PEDIDOS} meses anonimizado(s).`);
  } catch (e) {
    console.error("Retenção de pedidos falhou (ignorado):", e.message);
  }
}
setTimeout(anonimizarPedidos, 45_000);              // 45s após o boot
setInterval(anonimizarPedidos, 24 * 60 * 60 * 1000); // a cada 24h

// Retenção (LGPD): remove clientes inativos há mais de 12 meses (por
// atualizado_em) — cascata apaga os endereços. PII pura sem valor estatístico,
// então apaga de vez (≠ pedidos, que anonimiza). Job global, idempotente.
const MESES_RETENCAO_CLIENTES = 12;
async function removerClientesInativos() {
  try {
    const n = await clientes.removerInativos(MESES_RETENCAO_CLIENTES);
    if (n > 0) console.log(`🔒 Retenção: ${n} cliente(s) inativo(s) > ${MESES_RETENCAO_CLIENTES} meses removido(s).`);
  } catch (e) {
    console.error("Retenção de clientes falhou (ignorado):", e.message);
  }
}
setTimeout(removerClientesInativos, 60_000);             // 60s após o boot
setInterval(removerClientesInativos, 24 * 60 * 60 * 1000); // a cada 24h

// Impede que erros do bot/WhatsApp derrubem o servidor.
// O bot pode travar ou cair; o painel continua no ar.
process.on("uncaughtException", (err) => {
  console.error("❌ Erro não tratado (servidor continua):", err.message);
});

process.on("unhandledRejection", (reason) => {
  // Loga só a mensagem (não o objeto inteiro) — evita despejar payload/PII no log.
  console.error("❌ Promise sem tratamento (servidor continua):", reason?.message || reason);
});

servidor.iniciar(PORTA);
