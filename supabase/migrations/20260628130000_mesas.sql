-- Módulo Mesas e Comandas (Plano Completo) — v2.
-- Controle de salão: mesas/comandas como um conceito só (nome livre), pedidos por
-- rodada vinculados à mesa, recebimento parcial via caixa_movimentos.mesa_id.
-- Timestamp posterior a 20260628120001_revert_mesas.sql (a tabela foi dropada lá).
-- ============================================================

create table if not exists public.mesas (
  id              bigint generated always as identity primary key,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nome            varchar(20) not null,
  status          varchar(20) not null default 'livre'
                    check (status in ('livre','ocupada','pediu_conta','fechando')),
  taxa_servico    numeric(5,2) default 0,    -- % do garçom; snapshot na abertura
  total_consumido numeric(10,2) default 0,
  qr_code_token   text,
  ordem           integer default 0,
  aberta_em       timestamptz,
  fechada_em      timestamptz,
  criado_em       timestamptz not null default now(),
  unique (empresa_id, nome)
);

alter table public.mesas enable row level security;

-- Vínculo do pedido (rodada) com a mesa. null = pedido fora de mesa (delivery/PDV).
alter table public.pedidos
  add column if not exists mesa_id bigint references public.mesas(id) on delete set null;

-- Recebimento parcial: cada pagamento parcial de uma mesa é um movimento de
-- recebimento ligado à mesa (pedido_id nulo). recebido = SUM por mesa_id.
alter table public.caixa_movimentos
  add column if not exists mesa_id bigint references public.mesas(id) on delete set null;

create index if not exists pedidos_mesa_id_idx on public.pedidos (mesa_id) where mesa_id is not null;
create index if not exists caixa_movimentos_mesa_id_idx on public.caixa_movimentos (mesa_id) where mesa_id is not null;
create index if not exists mesas_empresa_id_idx on public.mesas (empresa_id);
