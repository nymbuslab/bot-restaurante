// ============================================================
// SUPABASE — clients de autenticação (Supabase Auth / GoTrue).
//   supabaseAdmin: service_role — cria/gerencia usuários e valida JWT.
//                  NUNCA exposto ao front; só backend.
//   supabaseAnon:  anon — usado para login (signInWithPassword).
// ============================================================

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env.");
}

const opcoes = { auth: { autoRefreshToken: false, persistSession: false } };

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, opcoes);
const supabaseAnon  = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opcoes);

module.exports = { supabaseAdmin, supabaseAnon };
