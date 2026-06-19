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
const { limparSessoesAntigas, slugsComSessao } = require("./src/wa-auth");
const sessoes = require("./src/sessoes");
const pedidos = require("./src/pedidos");
const clientes = require("./src/clientes");
const empresas = require("./src/empresas");
const multiBot = require("./src/multi-bot");
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

// Higiene de memória: varre as sessões de conversa (em memória) e descarta as
// inativas há +30min. A expiração do sessoes.js é lazy (só limpa quando a mesma
// chave volta); conversa abandonada nunca volta, então ficaria na RAM. Barato
// (itera um Map). A cada 10min (sessão expira em 30min → memória fica enxuta).
function limparSessoesMemoria() {
  try {
    const n = sessoes.limparExpiradas();
    if (n > 0) console.log(`🧹 Sessões em memória: ${n} inativa(s) descartada(s).`);
  } catch (e) {
    console.error("Limpeza de sessões em memória falhou (ignorado):", e.message);
  }
}
setInterval(limparSessoesMemoria, 10 * 60 * 1000);   // a cada 10min

// Restaura os bots no boot: após um deploy/restart, os tenants que estavam
// conectados voltam sozinhos (sem QR), em vez de ficarem offline até alguém
// reconectar manualmente na aba Conexão. Só reconecta quem (1) já tem credencial
// salva em `wa_auth` (conectou antes → reconexão sem QR) E (2) tem acesso liberado
// (ativo + assinatura em trialing/active/cortesia). Suspenso/vencido fica desligado.
// Conexões espaçadas (~1,5s) para não abrir todos os sockets de uma vez.
// NOTA: assume instância única (ver CLAUDE.md). Com 2+ instâncias, ambas tentariam
// restaurar o mesmo tenant e o WhatsApp derrubaria uma (connectionReplaced).
const RESTAURA_INTERVALO_MS = 1500;
async function restaurarBots() {
  try {
    const comSessao = new Set(await slugsComSessao());
    if (comSessao.size === 0) return;
    const aptos = (await empresas.listar())
      .filter((emp) => empresas.acessoLiberado(emp) && comSessao.has(emp.slug));
    if (aptos.length === 0) return;
    console.log(`🔌 Restaurando ${aptos.length} bot(s) com sessão salva...`);
    for (let i = 0; i < aptos.length; i++) {
      const { slug } = aptos[i];
      multiBot.iniciar(slug, empresas.tenantDir(slug));
      if (i < aptos.length - 1) await new Promise((r) => setTimeout(r, RESTAURA_INTERVALO_MS));
    }
  } catch (e) {
    console.error("Restauração de bots no boot falhou (ignorado):", e.message);
  }
}
setTimeout(restaurarBots, 10_000);   // 10s após o boot (deixa o servidor subir)

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
