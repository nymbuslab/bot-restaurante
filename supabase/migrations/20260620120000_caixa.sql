-- Caixa / Fechamento do dia (Plano Completo). Recebimento por pedido +
-- conferência de dinheiro físico. Isolado por empresa_id; RLS no padrão do projeto.

create table if not exists public.caixas (
  id               bigint generated always as identity primary key,
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  aberto_em        timestamptz not null default now(),
  fechado_em       timestamptz,
  fundo_troco      numeric(10,2) not null default 0,
  status           text not null default 'aberto',   -- 'aberto' | 'fechado'
  contado_dinheiro numeric(10,2),
  diferenca        numeric(10,2),
  observacao       text
);
-- No máximo 1 caixa aberto por empresa:
create unique index if not exists caixas_um_aberto_por_empresa
  on public.caixas (empresa_id) where (status = 'aberto');
create index if not exists idx_caixas_empresa on public.caixas (empresa_id);

create table if not exists public.caixa_movimentos (
  id              bigint generated always as identity primary key,
  caixa_id        bigint not null references public.caixas(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  tipo            text not null,                 -- 'recebimento' | 'sangria' | 'suprimento'
  forma_pagamento text,
  valor           numeric(10,2) not null,
  pedido_id       bigint references public.pedidos(id) on delete set null,
  descricao       text,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_caixa_mov_caixa on public.caixa_movimentos (caixa_id);

alter table public.pedidos add column if not exists recebido_em timestamptz;

-- Hardening (igual às demais tabelas): RLS on + sem grants p/ anon/authenticated.
alter table public.caixas enable row level security;
alter table public.caixa_movimentos enable row level security;
revoke all on public.caixas from anon, authenticated;
revoke all on public.caixa_movimentos from anon, authenticated;
comment on table public.caixas is 'Caixa do dia (Plano Completo) — abertura/fechamento';
comment on table public.caixa_movimentos is 'Movimentos do caixa: recebimento/sangria/suprimento';
