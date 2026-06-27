const api = require("./api");
const { montarJob } = require("./print-job");
const transporte = require("./transporte");
const config = require("./config");

const INTERVALO_MS = 6000;

function calcBackoff(tentativas) {
  const n = Math.max(1, parseInt(tentativas, 10) || 1);
  return Math.min(60000, 5000 * Math.pow(2, n - 1));
}

let timer = null;
let rodando = false;
let tenantConfig = null;
let linkCardapio = "";
let falhas = 0;

async function carregarTenant() {
  try {
    const rc = await api.get("/api/config");
    if (rc.ok) tenantConfig = await rc.json();
  } catch (_) {}
  try {
    const rl = await api.get("/api/cardapio/link");
    if (rl.ok) { const d = await rl.json(); linkCardapio = d.link || d.url || ""; }
  } catch (_) {}
}

async function umCiclo(opts) {
  const log = (opts && opts.onLog) || (() => {});
  const status = (opts && opts.onStatus) || (() => {});
  if (!tenantConfig) await carregarTenant();
  let r;
  try { r = await api.get("/api/agente/pendentes"); }
  catch (e) { falhas++; status({ tipo: "sem-conexao" }); log("Sem conexao com o servidor. Retentando..."); return calcBackoff(falhas); }
  if (!r.ok) { falhas++; status({ tipo: "erro", http: r.status }); log("Erro " + r.status + " ao buscar pedidos."); return calcBackoff(falhas); }
  falhas = 0;
  status({ tipo: "ok" });
  const pendentes = await r.json().catch(() => []);
  const cfg = config.carregar();
  for (const pedido of (pendentes || [])) {
    try {
      const buffers = montarJob(pedido, tenantConfig || {}, cfg, { linkCardapio });
      await transporte.enviar(buffers, cfg);
      await api.post("/api/agente/pedidos/" + pedido.numero + "/impresso", {});
      log("Pedido #" + pedido.numero + " impresso.");
    } catch (e) {
      log("Falha ao imprimir #" + pedido.numero + ": " + e.message + " (retenta).");
      // NAO marca impresso -> volta nos pendentes no proximo ciclo.
    }
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
  tenantConfig = null; linkCardapio = ""; falhas = 0;
  agendar(opts, 500); // primeiro ciclo quase imediato
}

function parar() { rodando = false; if (timer) clearTimeout(timer); timer = null; }

module.exports = { calcBackoff, iniciar, parar };
