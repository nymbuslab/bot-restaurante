const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  apiBase: "https://bot-restaurante.fly.dev",
  email: "",
  conexao: "rede",          // "rede" | "serial" | "usb"
  alvo: "",                  // rede: "IP:porta" | serial: "COM3" | usb: nome da fila
  baud: 9600,
  corte: "parcial",          // "parcial" | "total" | "nenhum"
  semAcento: false,
  vias: { cozinha: true, cupom: true },
  copias: 1,
};

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
    apiBase: (typeof p.apiBase === "string" && p.apiBase.trim()) ? p.apiBase.trim().replace(/\/+$/, "") : DEFAULTS.apiBase,
    email: typeof p.email === "string" ? p.email : "",
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

function carregar() {
  try { return normalizarConfig(JSON.parse(fs.readFileSync(caminho(), "utf8"))); }
  catch (_) { return normalizarConfig({}); }
}

function salvar(parcial) {
  const cfg = normalizarConfig(parcial);
  fs.writeFileSync(caminho(), JSON.stringify(cfg, null, 2));
  return cfg;
}

module.exports = { DEFAULTS, normalizarConfig, carregar, salvar };
