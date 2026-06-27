const api = require("./api");
const { montarJob } = require("./print-job");
const transporte = require("./transporte");
const config = require("./config");

const INTERVALO_MS = 6000;
const TENANT_TTL_MS = 5 * 60 * 1000; // recarrega config do tenant a cada 5 min (nome/marca/link)

function calcBackoff(tentativas) {
  const n = Math.max(1, parseInt(tentativas, 10) || 1);
  return Math.min(60000, 5000 * Math.pow(2, n - 1));
}

let timer = null;
let rodando = false;
let tenantConfig = null;
let tenantEm = 0;        // quando o tenantConfig foi carregado (ms) — p/ expirar pelo TTL
let linkCardapio = "";
let falhas = 0;
// numeros ja IMPRESSOS nesta sessao mas ainda nao confirmados no servidor. Evita reimprimir
// o cupom quando a impressao deu certo mas o POST /impresso falhou (rede caiu na hora de marcar).
const impressosLocais = new Set();

async function carregarTenant() {
  try {
    const rc = await api.get("/api/config");
    if (rc.ok) tenantConfig = await rc.json();
  } catch (_) {}
  try {
    const rl = await api.get("/api/cardapio/link");
    if (rl.ok) { const d = await rl.json(); linkCardapio = d.link || d.url || ""; }
  } catch (_) {}
  tenantEm = Date.now();
}

async function marcarImpresso(numero) {
  await api.post("/api/agente/pedidos/" + numero + "/impresso", {});
}

async function umCiclo(opts) {
  const log = (opts && opts.onLog) || (() => {});
  const status = (opts && opts.onStatus) || (() => {});
  if (!tenantConfig || (Date.now() - tenantEm) > TENANT_TTL_MS) await carregarTenant();
  let r;
  try { r = await api.get("/api/agente/pendentes"); }
  catch (e) { falhas++; status({ tipo: "sem-conexao" }); log("Sem conexao com o servidor. Retentando..."); return calcBackoff(falhas); }
  if (!r.ok) { falhas++; status({ tipo: "erro", http: r.status }); log("Erro " + r.status + " ao buscar pedidos."); return calcBackoff(falhas); }
  falhas = 0;
  status({ tipo: "ok" });
  const pendentes = await r.json().catch(() => []);
  const cfg = config.carregar();
  for (const pedido of (pendentes || [])) {
    const num = pedido.numero;
    // Ja foi impresso nesta sessao, so a marcacao falhou antes: retenta marcar SEM reimprimir.
    if (impressosLocais.has(num)) {
      try { await marcarImpresso(num); impressosLocais.delete(num); log("Pedido #" + num + " confirmado no servidor."); }
      catch (_) { /* tenta de novo no proximo ciclo */ }
      continue;
    }
    try {
      const buffers = montarJob(pedido, tenantConfig || {}, cfg, { linkCardapio });
      await transporte.enviar(buffers, cfg);
      impressosLocais.add(num); // impresso de fato; a partir daqui nunca reimprime
    } catch (e) {
      log("Falha ao imprimir #" + num + ": " + e.message + " (retenta).");
      continue; // NAO marca nem entra no set -> volta nos pendentes p/ tentar imprimir de novo
    }
    try { await marcarImpresso(num); impressosLocais.delete(num); log("Pedido #" + num + " impresso."); }
    catch (e) { log("Pedido #" + num + " impresso, mas falhou ao confirmar no servidor (remarca depois)."); }
  }
  return INTERVALO_MS;
}

function agendar(opts, ms) {
  timer = setTimeout(async () => {
    if (!rodando) return;
    const proximo = await umCiclo(opts).catch(() => calcBackoff(1));
    if (rodando) agendar(opts, proximo);
  }, ms);
}

function iniciar(opts) {
  if (rodando) return;
  rodando = true;
  tenantConfig = null; tenantEm = 0; linkCardapio = ""; falhas = 0;
  impressosLocais.clear();
  agendar(opts, 500); // primeiro ciclo quase imediato
}

function parar() { rodando = false; if (timer) clearTimeout(timer); timer = null; }

module.exports = { calcBackoff, iniciar, parar };
