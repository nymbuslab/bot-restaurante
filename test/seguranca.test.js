const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Env dummy: empresas.js cria os clients do Supabase no require (sem conectar).
// Valores fake só para o módulo CARREGAR sem .env — nenhum teste toca a rede.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "anon-dummy";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-dummy";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://u:p@localhost:5432/db";

const empresas = require("../src/empresas");
const SALT = "nymbus-lab-bot-v2"; // mesmo salt do hash legado

// ---- Hash da senha master (bcrypt + migração graciosa do SHA-256) ----
test("hashSenha gera bcrypt ($2)", () => {
  const h = empresas.hashSenha("SenhaForte#1");
  assert.equal(typeof h, "string");
  assert.ok(h.startsWith("$2"), "hash deve ser bcrypt");
});

test("verificarSenhaMaster: bcrypt — senha certa/errada", () => {
  const h = empresas.hashSenha("SenhaForte#1");
  assert.equal(empresas.verificarSenhaMaster("SenhaForte#1", h), true);
  assert.equal(empresas.verificarSenhaMaster("errada", h), false);
});

test("verificarSenhaMaster: aceita SHA-256 legado (migração graciosa)", () => {
  const legado = crypto.createHash("sha256").update("SenhaForte#1" + SALT).digest("hex");
  assert.equal(empresas.verificarSenhaMaster("SenhaForte#1", legado), true);
  assert.equal(empresas.verificarSenhaMaster("errada", legado), false);
});

test("verificarSenhaMaster: hash vazio/inválido → false", () => {
  assert.equal(empresas.verificarSenhaMaster("x", ""), false);
  assert.equal(empresas.verificarSenhaMaster("x", null), false);
  assert.equal(empresas.verificarSenhaMaster("x", undefined), false);
});

// ---- Geração de slug do tenant ----
test("slugBase: normaliza nome em slug seguro", () => {
  assert.equal(empresas.slugBase("Restaurante do João"), "restaurante-do-joao");
  assert.equal(empresas.slugBase("Açaí & Cia!!!"), "acai-cia");
  assert.equal(empresas.slugBase(""), "empresa");
  assert.equal(empresas.slugBase("---"), "empresa");
});
