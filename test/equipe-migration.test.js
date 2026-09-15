const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const caminho = path.join(__dirname, "..", "supabase", "migrations", "20260915090000_equipe_permissoes.sql");

test("a migration de equipe é aditiva, idempotente e mantém todos os gates desligados", () => {
  const sql = fs.readFileSync(caminho, "utf8");

  assert.match(sql, /create table if not exists public\.equipe_funcionarios/i);
  assert.match(sql, /create table if not exists public\.equipe_dispositivos/i);
  assert.match(sql, /create table if not exists public\.equipe_sessoes/i);
  assert.match(sql, /add column if not exists equipe_habilitada boolean not null default false/i);
  assert.match(sql, /add column if not exists compras_habilitadas boolean not null default false/i);
});

test("PIN em texto puro não existe e os limites de segurança estão no schema", () => {
  const sql = fs.readFileSync(caminho, "utf8");

  assert.doesNotMatch(sql, /^\s*pin\s+text/im);
  assert.match(sql, /pin_hash\s+text\s+not null/i);
  assert.match(sql, /tentativas_pin[^,]+check\s*\(tentativas_pin between 0 and 5\)/i);
  assert.match(sql, /inatividade_minutos[^,]+check\s*\(inatividade_minutos in \(5, 15, 30, 60\)\)/i);
});

test("todas as tabelas novas recebem RLS deny-all e grants públicos revogados", () => {
  const sql = fs.readFileSync(caminho, "utf8");
  const tabelas = [
    "equipe_perfis",
    "equipe_perfil_permissoes",
    "equipe_funcionarios",
    "equipe_funcionario_permissoes",
    "equipe_dispositivos",
    "equipe_sessoes",
  ];

  for (const tabela of tabelas) {
    assert.match(sql, new RegExp("alter table public\\." + tabela + " enable row level security", "i"));
    assert.match(sql, new RegExp("revoke all on table public\\." + tabela + " from anon, authenticated", "i"));
  }
});
