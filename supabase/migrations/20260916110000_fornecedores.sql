-- ============================================================
-- fornecedores + identificadores do catálogo + vínculo fornecedor-alvo.
--
-- `fornecedores` é cadastro solto do tenant (D-16 trata o financeiro de
-- fornecedores; este é o cadastro que ele referencia). Nasce com só o nome
-- obrigatório: o fluxo de criação "inline" (dentro de uma compra futura)
-- precisa preservar um rascunho parcial sem forçar telefone/e-mail/documento
-- na hora (sprint-04/tasks.md, T-04.02).
--
-- `catalogo_identificadores` guarda código interno e GTIN por ALVO
-- (catalogo_alvos, T-04.01) — um produto ou variação tem no máximo um
-- registro de identificadores, único por tenant.
--
-- `fornecedor_alvos` é o vínculo fornecedor-alvo (qual fornecedor fornece
-- qual produto/variação), com o código que o PRÓPRIO fornecedor usa para o
-- item (opcional). Existir o vínculo é o que permite sugerir o fornecedor já
-- conhecido da próxima vez que o dono compra aquele produto.
--
-- Todas as FKs para outra tabela do tenant são COMPOSTAS (empresa_id, id) —
-- mesmo padrão de equipe_funcionarios/equipe_sessoes
-- (20260915090000_equipe_permissoes.sql) — para que vínculo cruzado entre
-- empresas seja IMPOSSÍVEL por constraint, não por disciplina do código
-- (base/06-BANCO-TENANCY-E-TRANSACOES.md: risco de FK composta).
-- ============================================================

create table if not exists public.fornecedores (
  id             bigint generated always as identity primary key,
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  nome           text not null check (btrim(nome) <> ''),
  documento      text,                 -- CNPJ ou CPF, só dígitos
  tipo_documento text check (tipo_documento in ('cnpj', 'cpf')),
  telefone       text,
  email          text,
  observacao     text,
  arquivado      boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint fornecedores_empresa_id_id_uniq unique (empresa_id, id)
);

-- Documento único por tenant ENTRE OS ATIVOS: um fornecedor arquivado não
-- deve travar o CNPJ de um cadastro novo (arquivamento preserva histórico,
-- não é uma trava definitiva do documento).
create unique index if not exists fornecedores_documento_ativo_uniq
  on public.fornecedores (empresa_id, documento)
  where documento is not null and arquivado = false;

create index if not exists fornecedores_empresa_ativos_idx
  on public.fornecedores (empresa_id, arquivado, nome);

create table if not exists public.catalogo_identificadores (
  id             bigint generated always as identity primary key,
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  alvo_id        bigint not null,
  codigo_interno text,
  gtin           text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint catalogo_identificadores_alvo_fk
    foreign key (empresa_id, alvo_id)
    references public.catalogo_alvos (empresa_id, id)
    on delete cascade,
  constraint catalogo_identificadores_alvo_uniq unique (empresa_id, alvo_id)
);

create unique index if not exists catalogo_identificadores_codigo_uniq
  on public.catalogo_identificadores (empresa_id, codigo_interno)
  where codigo_interno is not null;
create unique index if not exists catalogo_identificadores_gtin_uniq
  on public.catalogo_identificadores (empresa_id, gtin)
  where gtin is not null;

create table if not exists public.fornecedor_alvos (
  id                bigint generated always as identity primary key,
  empresa_id        uuid not null references public.empresas(id) on delete cascade,
  fornecedor_id     bigint not null,
  alvo_id           bigint not null,
  codigo_fornecedor text,             -- SKU do fornecedor para este item (opcional)
  criado_em         timestamptz not null default now(),
  constraint fornecedor_alvos_fornecedor_fk
    foreign key (empresa_id, fornecedor_id)
    references public.fornecedores (empresa_id, id)
    on delete cascade,
  constraint fornecedor_alvos_alvo_fk
    foreign key (empresa_id, alvo_id)
    references public.catalogo_alvos (empresa_id, id)
    on delete cascade,
  constraint fornecedor_alvos_uniq unique (empresa_id, fornecedor_id, alvo_id)
);

create index if not exists fornecedor_alvos_alvo_idx
  on public.fornecedor_alvos (empresa_id, alvo_id);

-- Hardening (convenção do projeto, modelo em 20260716120000_rls_hardening_2.sql):
-- acesso só pelo backend privilegiado (DATABASE_URL, que ignora RLS). RLS ligado
-- SEM policy = deny-all deliberado para anon/authenticated.
alter table public.fornecedores enable row level security;
alter table public.catalogo_identificadores enable row level security;
alter table public.fornecedor_alvos enable row level security;

revoke all on table public.fornecedores from anon, authenticated;
revoke all on table public.catalogo_identificadores from anon, authenticated;
revoke all on table public.fornecedor_alvos from anon, authenticated;
revoke all on sequence public.fornecedores_id_seq from anon, authenticated;
revoke all on sequence public.catalogo_identificadores_id_seq from anon, authenticated;
revoke all on sequence public.fornecedor_alvos_id_seq from anon, authenticated;

comment on table public.fornecedores is
  'Cadastro de fornecedores por tenant. Nasce só com nome (permite rascunho inline). Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
comment on table public.catalogo_identificadores is
  'Código interno e GTIN por alvo do catálogo (produto/variação), único por tenant. Mesmo hardening de acesso das demais tabelas deste programa.';
comment on table public.fornecedor_alvos is
  'Vínculo fornecedor-alvo (quem fornece qual produto/variação), com o código do próprio fornecedor para o item. Base da sugestão de fornecedor conhecido em compras futuras.';
