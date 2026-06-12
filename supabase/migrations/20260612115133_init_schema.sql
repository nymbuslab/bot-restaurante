-- ============================================================
-- Schema inicial — migração SQLite -> Supabase (Postgres)
-- empresas (perfil, ligado ao Supabase Auth) + pedidos.
-- config/cardápio viram jsonb; senha vive no Auth (bcrypt).
-- ============================================================

create extension if not exists "pgcrypto";

-- EMPRESAS: perfil do restaurante, 1:1 com o usuário do Supabase Auth.
-- A senha NÃO fica aqui (vive no auth.users, com bcrypt).
create table public.empresas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  slug       text not null unique,
  nome       text not null,
  email      text not null,
  ativo      boolean not null default true,
  config     jsonb not null default '{}'::jsonb,
  cardapio   jsonb not null default '{"categorias":[]}'::jsonb,
  criado_em  timestamptz not null default now()
);

-- PEDIDOS: uma tabela, isolada por empresa_id. itens em jsonb.
create table public.pedidos (
  id            bigint generated always as identity primary key,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  numero        integer not null,
  status        text,
  cliente       text,
  telefone      text,
  tipo_entrega  text,
  endereco      text,
  pagamento     text,
  taxa_entrega  numeric(10,2) default 0,
  itens         jsonb not null default '[]'::jsonb,
  total         numeric(10,2) not null default 0,
  criado_em     timestamptz not null default now(),
  avisado_em    timestamptz
);

create index pedidos_empresa_idx on public.pedidos (empresa_id, criado_em desc);
create unique index pedidos_empresa_numero_idx on public.pedidos (empresa_id, numero);

-- RLS: tranca acesso direto pela API pública (anon/authenticated). O backend usa a
-- conexão privilegiada (DATABASE_URL), que ignora RLS — o isolamento por empresa_id
-- é garantido no código do backend. RLS aqui é defesa em profundidade.
alter table public.empresas enable row level security;
alter table public.pedidos  enable row level security;
