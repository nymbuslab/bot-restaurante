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
const impressaoFila = require("./src/impressao-fila");
const clientes = require("./src/clientes");
const empresas = require("./src/empresas");
const auditoria = require("./src/auditoria");
const incidentes = require("./src/incidentes");
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

// Retenção (LGPD Art. 15): apaga registros da trilha de auditoria com mais de
// 24 meses (já não têm valor para investigação). Global, idempotente.
const MESES_RETENCAO_AUDITORIA = 24;
async function limparAuditoria() {
  try {
    const n = await auditoria.limparAntigos(MESES_RETENCAO_AUDITORIA);
    if (n > 0) console.log(`🔒 Retenção: ${n} registro(s) de auditoria > ${MESES_RETENCAO_AUDITORIA} meses apagado(s).`);
  } catch (e) {
    console.error("Retenção de auditoria falhou (ignorado):", e.message);
  }
}
setTimeout(limparAuditoria, 75_000);              // 75s após o boot
setInterval(limparAuditoria, 24 * 60 * 60 * 1000); // a cada 24h

// Higiene da fila de impressão: apaga trabalhos já impressos com mais de 7 dias
// (a fila é volátil; o histórico de impressão fica em pedidos/caixas). Global,
// idempotente. Boot + 24h.
const DIAS_RETENCAO_FILA_IMPRESSAO = 7;
async function limparFilaImpressao() {
  try {
    const n = await impressaoFila.limparAntigos(DIAS_RETENCAO_FILA_IMPRESSAO);
    if (n > 0) console.log(`🧹 Fila de impressão: ${n} trabalho(s) impresso(s) > ${DIAS_RETENCAO_FILA_IMPRESSAO} dias apagado(s).`);
  } catch (e) {
    console.error("Limpeza da fila de impressão falhou (ignorado):", e.message);
  }
}
setTimeout(limparFilaImpressao, 90_000);              // 90s após o boot
setInterval(limparFilaImpressao, 24 * 60 * 60 * 1000); // a cada 24h

// Retenção do histórico de incidentes (Monitoramento): apaga episódios com mais de
// 90 dias (o valor é temporal — investigação recente). Global, idempotente. Boot + 24h.
const DIAS_RETENCAO_INCIDENTES = 90;
async function limparIncidentes() {
  try {
    const n = await incidentes.limparAntigos(DIAS_RETENCAO_INCIDENTES);
    if (n > 0) console.log(`🧹 Incidentes: ${n} episódio(s) > ${DIAS_RETENCAO_INCIDENTES} dias apagado(s).`);
  } catch (e) {
    console.error("Retenção de incidentes falhou (ignorado):", e.message);
  }
}
setTimeout(limparIncidentes, 105_000);              // 105s após o boot
setInterval(limparIncidentes, 24 * 60 * 60 * 1000); // a cada 24h

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
