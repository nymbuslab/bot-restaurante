const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  apiBase: "https://bot-restaurante.fly.dev",
  email: "",
  nome: "",                  // nome do restaurante (identidade da sessão, exibido na UI)
  slug: "",                  // slug do tenant (identidade da sessão)
  conexao: "rede",          // "rede" | "serial" | "usb"
  alvo: "",                  // rede: "IP:porta" | serial: "COM3" | usb: nome da fila
  baud: 9600,
  corte: "parcial",          // "parcial" | "total" | "nenhum"
  semAcento: false,
  vias: { cozinha: true, cupom: true },
  copias: 1,
};

// Allowlist do servidor: o agente só fala com os domínios de PRODUÇÃO. Sem isto, um
// config.json local adulterado (malware) para `http://host-atacante` faria o próximo boot
// entregar o JWT do dono (e, no login, e-mail+senha) ao atacante. Fora da lista → default.
const APIBASE_PERMITIDAS = ["https://bot-restaurante.fly.dev", "https://pedidos.nymbuslab.com.br"];
function apiBaseSegura(v) {
  const s = (typeof v === "string" ? v.trim().replace(/\/+$/, "") : "");
  return APIBASE_PERMITIDAS.includes(s) ? s : DEFAULTS.apiBase;
}

function umDe(v, lista, padrao) { return lista.includes(v) ? v : padrao; }
function clamp(n, min, max, padrao) {
  const x = parseInt(n, 10);
  if (Number.isNaN(x)) return padrao;
  return Math.min(max, Math.max(min, x));
}

function normalizarConfig(parcial) {
  const p = parcial || {};
  const vias = p.vias || {};
  let cozinha = vias.cozinha !== false;
  let cupom = vias.cupom !== false;
  if (!cozinha && !cupom) cozinha = true; // nunca zera as duas (senao nao imprime nada)
  return {
    apiBase: apiBaseSegura(p.apiBase),
    email: typeof p.email === "string" ? p.email : "",
    nome: typeof p.nome === "string" ? p.nome : "",
    slug: typeof p.slug === "string" ? p.slug : "",
    conexao: umDe(p.conexao, ["rede", "serial", "usb"], DEFAULTS.conexao),
    alvo: typeof p.alvo === "string" ? p.alvo.trim() : "",
    baud: clamp(p.baud, 1200, 921600, DEFAULTS.baud),
    corte: umDe(p.corte, ["parcial", "total", "nenhum"], DEFAULTS.corte),
    semAcento: !!p.semAcento,
    vias: { cozinha, cupom },
    copias: clamp(p.copias, 1, 10, DEFAULTS.copias),
  };
}

function caminho() {
  const { app } = require("electron");
  return path.join(app.getPath("userData"), "config.json");
}

let cache = null; // a config so muda via salvar() neste app -> seguro cachear (o poller le a cada 6s)

function carregar() {
  if (cache) return cache;
  try { cache = normalizarConfig(JSON.parse(fs.readFileSync(caminho(), "utf8"))); }
  catch (_) { cache = normalizarConfig({}); }
  return cache;
}

function salvar(parcial) {
  const cfg = normalizarConfig(parcial);
  fs.writeFileSync(caminho(), JSON.stringify(cfg, null, 2));
  cache = cfg; // mantem o cache em dia
  return cfg;
}

module.exports = { DEFAULTS, normalizarConfig, carregar, salvar };
