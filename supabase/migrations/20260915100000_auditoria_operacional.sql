-- Auditoria operacional separada da trilha LGPD de 24 meses.
-- Aplicar somente depois dos portoes de backup e rollout em producao.
create table if not exists public.auditoria_operacional (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  ator_tipo text not null check (ator_tipo in ('dono', 'funcionario', 'sistema')),
  ator_id text,
  evento text not null check (length(evento) between 1 and 80),
  detalhe jsonb not null default '{}'::jsonb check (jsonb_typeof(detalhe) = 'object'),
  criado_em timestamptz not null default now()
);
create index if not exists auditoria_operacional_empresa_cursor_idx on public.auditoria_operacional (empresa_id, id desc);
create index if not exists auditoria_operacional_empresa_evento_idx on public.auditoria_operacional (empresa_id, evento, id desc);
create index if not exists auditoria_operacional_empresa_ator_idx on public.auditoria_operacional (empresa_id, ator_id, id desc);
alter table public.auditoria_operacional enable row level security;
revoke all on public.auditoria_operacional from anon, authenticated;
revoke all on sequence public.auditoria_operacional_id_seq from anon, authenticated;
comment on table public.auditoria_operacional is 'Auditoria transacional. Retencao minima de cinco anos; sem PIN, token ou dado pessoal no detalhe.';
