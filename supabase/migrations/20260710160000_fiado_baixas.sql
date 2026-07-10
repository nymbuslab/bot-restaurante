-- ============================================================
-- FIADO — log de baixas de contas a prazo. Fase 4 (Contas a Receber).
--
-- Cada baixa (recebimento) de uma venda a prazo gera uma linha aqui, mesmo as
-- parciais. Serve de histórico ("Baixado R$ 5,00 em 10/07 14:20 · restante
-- R$ 20,00") na tela de Receber e de trilha do que entrou no caixa.
--
-- `caixa_movimento_id` liga a baixa ao movimento do caixa quando o tenant é
-- Completo (tem caixa) e o dinheiro entrou no caixa do dia; fica NULL no
-- Essencial (que não tem caixa — a baixa só quita a conta). Ver src/fiado.js.
-- ============================================================

create table if not exists public.fiado_baixas (
  id                 bigint generated always as identity primary key,
  empresa_id         uuid   not null references public.empresas(id) on delete cascade,
  pedido_id          bigint not null references public.pedidos(id) on delete cascade,
  cliente_id         uuid   references public.clientes(id) on delete set null,
  valor              numeric(10,2) not null,
  forma_pagamento    text   not null default '',
  restante           numeric(10,2) not null default 0,   -- quanto faltava DEPOIS desta baixa
  caixa_movimento_id bigint references public.caixa_movimentos(id) on delete set null,
  criado_em          timestamptz not null default now()
);

create index if not exists fiado_baixas_pedido_idx  on public.fiado_baixas (pedido_id);
create index if not exists fiado_baixas_empresa_idx on public.fiado_baixas (empresa_id, criado_em desc);

-- Hardening (igual às demais tabelas): RLS on + sem grants p/ anon/authenticated.
alter table public.fiado_baixas enable row level security;
revoke all on public.fiado_baixas from anon, authenticated;
comment on table public.fiado_baixas is 'Log de baixas (recebimentos) das contas a prazo (fiado)';
