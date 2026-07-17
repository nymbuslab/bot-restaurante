-- ============================================================
-- RLS HARDENING 2 (defesa em profundidade)
--
-- Mesma decisão da 20260616120000_rls_hardening.sql, aplicada às tabelas que
-- nasceram depois dela e ficaram de fora: impressao_fila (2026-06-29),
-- incidentes (2026-07-03) e itens_venda (2026-07-04). Era esquecimento, não
-- decisão — o Advisor do Supabase apontou as três como "RLS Disabled in Public".
--
-- Como nas demais, estas tabelas são acessadas SOMENTE pelo backend, via a
-- conexão privilegiada do DATABASE_URL (que IGNORA RLS). O app NÃO usa a API
-- PostgREST (anon/authenticated) para elas — a anon key nem chega ao navegador.
-- Portanto:
--   * RLS HABILITADO sem policy = deny-all para anon/authenticated (estado mais
--     trancado; adicionar policy só ABRIRIA um caminho que hoje está fechado).
--     Isto é INTENCIONAL, não um esquecimento.
--   * Revogamos explicitamente qualquer grant de anon/authenticated (cinto +
--     suspensório: mesmo que o RLS fosse desligado um dia, o acesso já não
--     existe). Vale sobretudo para impressao_fila (o texto das vias inclui nome e
--     endereço do cliente de delivery) e itens_venda (histórico de vendas).
-- Seguro: o backend usa role privilegiada, não afetada por estes REVOKE.
-- ============================================================

-- 1) Habilita RLS (idempotente).
alter table public.impressao_fila enable row level security;
alter table public.incidentes     enable row level security;
alter table public.itens_venda    enable row level security;

-- 2) Revoga qualquer acesso de anon/authenticated (PostgREST) a estas tabelas.
revoke all on table public.impressao_fila from anon, authenticated;
revoke all on table public.incidentes     from anon, authenticated;
revoke all on table public.itens_venda    from anon, authenticated;

-- 3) Documenta a intenção do "RLS on + sem policy" (deny-all deliberado).
comment on table public.impressao_fila is
  'Fila de impressão do agente desktop; as vias trazem nome/endereço do cliente. Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
comment on table public.incidentes is
  'Histórico de incidentes de infraestrutura (painel master). Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
comment on table public.itens_venda is
  'Projeção relacional dos itens vendidos (mantida por trigger sobre pedidos). Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
