const { test } = require("node:test");
const assert = require("node:assert/strict");

// Env dummy: empresas.js cria os clients do Supabase no require (sem conectar).
// Valores fake só para o módulo CARREGAR sem .env — nenhum teste toca a rede.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "anon-dummy";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-dummy";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://u:p@localhost:5432/db";

const empresas = require("../src/empresas");

// ---- Geração de slug do tenant ----
test("slugBase: normaliza nome em slug seguro", () => {
  assert.equal(empresas.slugBase("Restaurante do João"), "restaurante-do-joao");
  assert.equal(empresas.slugBase("Açaí & Cia!!!"), "acai-cia");
  assert.equal(empresas.slugBase(""), "empresa");
  assert.equal(empresas.slugBase("---"), "empresa");
});
