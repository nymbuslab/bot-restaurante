-- ============================================================
-- RLS HARDENING (defesa em profundidade)
--
-- Estas tabelas são acessadas SOMENTE pelo backend, via a conexão
-- privilegiada do DATABASE_URL (que IGNORA RLS). O app NÃO usa a API
-- PostgREST (anon/authenticated) para elas — a anon key nem chega ao
-- navegador. Portanto:
--   * RLS continua HABILITADO sem policy = deny-all para anon/authenticated
--     (estado mais trancado; adicionar policy só ABRIRIA um caminho que hoje
--     está fechado). Isto é INTENCIONAL, não um esquecimento.
--   * Revogamos explicitamente qualquer grant de anon/authenticated (cinto +
--     suspensório: mesmo que o RLS fosse desligado um dia, o acesso já não
--     existe). Crítico para wa_auth (sessão WhatsApp, sequestrável) e
--     plataforma_config (hash da senha master).
-- Seguro: o backend usa role privilegiada, não afetada por estes REVOKE.
-- ============================================================

-- 1) Reafirma RLS habilitado (idempotente).
alter table public.empresas          enable row level security;
alter table public.pedidos           enable row level security;
alter table public.wa_auth           enable row level security;
alter table public.plataforma_config enable row level security;

-- 2) Revoga qualquer acesso de anon/authenticated (PostgREST) a estas tabelas.
revoke all on table public.empresas          from anon, authenticated;
revoke all on table public.pedidos           from anon, authenticated;
revoke all on table public.wa_auth           from anon, authenticated;
revoke all on table public.plataforma_config from anon, authenticated;

-- 3) Documenta a intenção do "RLS on + sem policy" (deny-all deliberado).
comment on table public.wa_auth is
  'Sessões WhatsApp (sequestráveis). Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
comment on table public.plataforma_config is
  'Config da plataforma + hash da senha master. Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
