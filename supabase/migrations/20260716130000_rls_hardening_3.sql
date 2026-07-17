-- ============================================================
-- RLS HARDENING 3 (defesa em profundidade) — grants pendentes
--
-- `auditoria` e `mesas` já tinham RLS habilitado (por isso não aparecem no
-- Advisor do Supabase), mas eram as duas últimas tabelas do schema que ainda
-- concediam acesso a anon/authenticated — exceção ao padrão firmado na
-- 20260616120000_rls_hardening.sql e repetido na 20260716120000_rls_hardening_2.
--
-- Nada estava exposto: RLS on + sem policy já é deny-all na API PostgREST. Este
-- REVOKE é a segunda camada (mesmo que o RLS fosse desligado um dia, o acesso já
-- não existe) — relevante sobretudo para `auditoria`, que é a trilha de eventos
-- sensíveis. Seguro: o backend usa a conexão privilegiada do DATABASE_URL, que
-- ignora RLS e não é afetada por estes REVOKE.
-- ============================================================

-- 1) Reafirma RLS habilitado (idempotente).
alter table public.auditoria enable row level security;
alter table public.mesas     enable row level security;

-- 2) Revoga qualquer acesso de anon/authenticated (PostgREST) a estas tabelas.
revoke all on table public.auditoria from anon, authenticated;
revoke all on table public.mesas     from anon, authenticated;

-- 3) Documenta a intenção do "RLS on + sem policy" (deny-all deliberado).
comment on table public.auditoria is
  'Trilha de auditoria dos eventos sensíveis (LGPD). Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
comment on table public.mesas is
  'Mesas do salão (Plano Completo). Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
