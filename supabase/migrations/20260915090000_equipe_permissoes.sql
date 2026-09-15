-- ============================================================
-- Gestão de equipe, dispositivos, sessões e permissões.
--
-- A migration é somente aditiva. Todos os gates nascem desligados e nenhum
-- fluxo atual passa a usar funcionário ou PIN até o rollout explícito.
-- O PIN e o token de sessão nunca são persistidos em texto puro.
-- ============================================================

alter table public.empresas
  add column if not exists equipe_habilitada boolean not null default false,
  add column if not exists compras_habilitadas boolean not null default false,
  add column if not exists confirmacao_compras_habilitada boolean not null default false,
  add column if not exists ficha_tecnica_habilitada boolean not null default false,
  add column if not exists baixa_insumos_habilitada boolean not null default false;

create table if not exists public.equipe_perfis (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas(id) on delete cascade,
  codigo      text not null,
  nome        text not null check (btrim(nome) <> ''),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint equipe_perfis_codigo_check check (
    codigo in ('administrador', 'gerente', 'caixa', 'atendimento', 'cozinha', 'estoque_compras')
  ),
  constraint equipe_perfis_empresa_id_id_uniq unique (empresa_id, id),
  constraint equipe_perfis_empresa_codigo_uniq unique (empresa_id, codigo)
);

create table if not exists public.equipe_perfil_permissoes (
  empresa_id uuid not null,
  perfil_id  uuid not null,
  permissao  text not null check (btrim(permissao) <> ''),
  permitido  boolean not null default true,
  criado_em  timestamptz not null default now(),
  primary key (empresa_id, perfil_id, permissao),
  constraint equipe_perfil_permissoes_perfil_fk
    foreign key (empresa_id, perfil_id)
    references public.equipe_perfis (empresa_id, id)
    on delete cascade
);

create table if not exists public.equipe_funcionarios (
  id                  uuid primary key default gen_random_uuid(),
  empresa_id          uuid not null references public.empresas(id) on delete cascade,
  perfil_id           uuid not null,
  nome                text not null check (btrim(nome) <> ''),
  pin_hash            text not null,
  ativo               boolean not null default true,
  tentativas_pin      smallint not null default 0 check (tentativas_pin between 0 and 5),
  bloqueado_ate       timestamptz,
  inatividade_minutos smallint not null default 15 check (inatividade_minutos in (5, 15, 30, 60)),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  constraint equipe_funcionarios_empresa_id_id_uniq unique (empresa_id, id),
  constraint equipe_funcionarios_perfil_fk
    foreign key (empresa_id, perfil_id)
    references public.equipe_perfis (empresa_id, id)
    on delete restrict
);

create table if not exists public.equipe_funcionario_permissoes (
  empresa_id     uuid not null,
  funcionario_id uuid not null,
  permissao      text not null check (btrim(permissao) <> ''),
  permitido      boolean not null,
  criado_em      timestamptz not null default now(),
  primary key (empresa_id, funcionario_id, permissao),
  constraint equipe_funcionario_permissoes_funcionario_fk
    foreign key (empresa_id, funcionario_id)
    references public.equipe_funcionarios (empresa_id, id)
    on delete cascade
);

create table if not exists public.equipe_dispositivos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nome            text not null check (btrim(nome) <> ''),
  chave_hash      text not null,
  autorizado_em   timestamptz not null default now(),
  ultimo_acesso_em timestamptz,
  revogado_em     timestamptz,
  criado_em       timestamptz not null default now(),
  constraint equipe_dispositivos_empresa_id_id_uniq unique (empresa_id, id),
  constraint equipe_dispositivos_chave_hash_uniq unique (chave_hash)
);

create table if not exists public.equipe_sessoes (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  funcionario_id   uuid not null,
  dispositivo_id   uuid not null,
  token_hash        text not null,
  ultimo_acesso_em timestamptz not null default now(),
  criada_em        timestamptz not null default now(),
  revogada_em      timestamptz,
  constraint equipe_sessoes_token_hash_uniq unique (token_hash),
  constraint equipe_sessoes_funcionario_fk
    foreign key (empresa_id, funcionario_id)
    references public.equipe_funcionarios (empresa_id, id)
    on delete cascade,
  constraint equipe_sessoes_dispositivo_fk
    foreign key (empresa_id, dispositivo_id)
    references public.equipe_dispositivos (empresa_id, id)
    on delete cascade
);

create index if not exists equipe_funcionarios_empresa_ativo_idx
  on public.equipe_funcionarios (empresa_id, ativo, nome);
create index if not exists equipe_funcionarios_perfil_idx
  on public.equipe_funcionarios (empresa_id, perfil_id);
create index if not exists equipe_dispositivos_empresa_ativos_idx
  on public.equipe_dispositivos (empresa_id, revogado_em, autorizado_em desc);
create index if not exists equipe_sessoes_funcionario_ativas_idx
  on public.equipe_sessoes (empresa_id, funcionario_id, ultimo_acesso_em desc)
  where revogada_em is null;
create index if not exists equipe_sessoes_dispositivo_idx
  on public.equipe_sessoes (empresa_id, dispositivo_id);

alter table public.equipe_perfis enable row level security;
alter table public.equipe_perfil_permissoes enable row level security;
alter table public.equipe_funcionarios enable row level security;
alter table public.equipe_funcionario_permissoes enable row level security;
alter table public.equipe_dispositivos enable row level security;
alter table public.equipe_sessoes enable row level security;

revoke all on table public.equipe_perfis from anon, authenticated;
revoke all on table public.equipe_perfil_permissoes from anon, authenticated;
revoke all on table public.equipe_funcionarios from anon, authenticated;
revoke all on table public.equipe_funcionario_permissoes from anon, authenticated;
revoke all on table public.equipe_dispositivos from anon, authenticated;
revoke all on table public.equipe_sessoes from anon, authenticated;

comment on table public.equipe_funcionarios is
  'Funcionários operacionais por tenant. PIN somente como hash; acesso exclusivo do backend privilegiado, com RLS deny-all e grants públicos revogados.';
comment on table public.equipe_dispositivos is
  'Dispositivos autorizados pelo dono por tenant. Chave somente como hash; acesso exclusivo do backend privilegiado.';
comment on table public.equipe_sessoes is
  'Sessões opacas de funcionários vinculadas ao tenant e dispositivo; token persistido somente como hash.';
