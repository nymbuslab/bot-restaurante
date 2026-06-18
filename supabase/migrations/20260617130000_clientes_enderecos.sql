-- ============================================================
-- CLIENTES + ENDEREÇOS — cadastro do cliente final, por empresa.
--
-- Alimentado pelo checkout do cardápio web (best-effort, não bloqueia o
-- pedido). Habilita: o bot reconhecer o cliente ("Bem-vindo de novo, Fulano")
-- e o checkout pré-preencher nome/endereços salvos (sem refazer a busca de CEP).
--
-- PII (nome, telefone, chat_id, endereço) → entram no fluxo LGPD
-- (exportar/excluir conta + retenção). Isoladas por empresa_id.
--
-- Acesso SOMENTE pelo backend (conexão privilegiada do DATABASE_URL, que
-- ignora RLS). Mesmo padrão de pedidos/empresas: RLS on + sem policy
-- (deny-all p/ anon/authenticated) + grants revogados (defesa em profundidade).
-- ============================================================

create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nome          text not null default '',
  telefone      text not null default '',
  chat_id       text not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, telefone)
);
-- Lookup do bot pelo canal da conversa (chat_id), só quando preenchido.
create index if not exists clientes_empresa_chat_idx
  on public.clientes (empresa_id, chat_id) where chat_id <> '';

create table if not exists public.enderecos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references public.clientes(id) on delete cascade,
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  cep         text not null default '',
  logradouro  text not null default '',
  numero      text not null default '',
  complemento text not null default '',
  bairro      text not null default '',
  cidade      text not null default '',
  uf          text not null default '',
  apelido     text not null default '',
  criado_em   timestamptz not null default now()
);
create index if not exists enderecos_cliente_idx on public.enderecos (cliente_id);

-- RLS hardening (igual a 20260616120000_rls_hardening.sql).
alter table public.clientes  enable row level security;
alter table public.enderecos enable row level security;
revoke all on table public.clientes  from anon, authenticated;
revoke all on table public.enderecos from anon, authenticated;

comment on table public.clientes is
  'Clientes finais por empresa (PII: nome/telefone/chat_id). Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants anon/authenticated revogados. Entra no fluxo LGPD (exportar/excluir/retenção).';
comment on table public.enderecos is
  'Endereços salvos dos clientes (PII). Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants anon/authenticated revogados. Entra no fluxo LGPD.';
