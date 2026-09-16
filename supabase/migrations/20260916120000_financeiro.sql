-- ============================================================
-- Financeiro de fornecedores — contas próprias e razão imutável (D-16/D-17).
--
-- `contas_financeiras` é SEPARADA do caixa operacional do PDV (D-16): serve
-- para acompanhar dinheiro ligado a fornecedores (conta corrente, carteira),
-- não o turno de venda do restaurante.
--
-- `financeiro_movimentos` é o RAZÃO: cada linha é um fato imutável (nenhuma
-- rota deste programa faz UPDATE no valor/tipo de um movimento — só o campo
-- de conciliação muda depois, e isso não altera saldo nem histórico). Saldo
-- não é derivado por SUM() a cada leitura: é mantido em `contas_financeiras.
-- saldo`, atualizado ATOMICAMENTE (mesma transação) a cada INSERT em
-- `financeiro_movimentos` — mesmo padrão de `estoque_movimentos` (saldo no
-- jsonb, trilha relacional): o número de leitura é sempre O(1), e a
-- integridade vem da transação, não de recomputar toda vez.
--
-- Esta migration já contempla as colunas de TRANSFERÊNCIA e CONCILIAÇÃO
-- (T-04.04, sprint-04/tasks.md): `vinculo_id` amarra o par débito/crédito de
-- uma transferência; `estorno_de` aponta pro movimento que uma linha de
-- estorno reverte; `conciliado*` é metadata da conciliação manual (D-18) —
-- nenhuma delas MUDA valor ou saldo_depois de um movimento já gravado.
-- ============================================================

create table if not exists public.contas_financeiras (
  id            bigint generated always as identity primary key,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  nome          text not null check (btrim(nome) <> ''),
  tipo          text not null default 'geral' check (tipo in ('geral', 'banco', 'caixinha', 'fornecedor')),
  saldo         numeric(10,2) not null default 0,
  arquivada     boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint contas_financeiras_empresa_id_id_uniq unique (empresa_id, id)
);

create index if not exists contas_financeiras_empresa_idx
  on public.contas_financeiras (empresa_id, arquivada, nome);

create table if not exists public.financeiro_movimentos (
  id                 bigint generated always as identity primary key,
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  conta_id           bigint not null,
  tipo               text not null check (
    tipo in ('implantacao', 'pagamento', 'estorno', 'transferencia_debito', 'transferencia_credito')
  ),
  valor              numeric(10,2) not null,       -- assinado: + credita, - debita
  saldo_depois       numeric(10,2) not null,       -- saldo da conta APÓS este movimento
  descricao          text not null default '',
  vinculo_id         bigint,                        -- amarra o par de uma transferência (o outro lado)
  estorno_de         bigint,                        -- aponta pro movimento revertido por este estorno
  conciliado         boolean not null default false,
  conciliado_em      timestamptz,
  conciliado_por_tipo text check (conciliado_por_tipo in ('dono', 'funcionario', 'sistema')),
  conciliado_por_id  text,
  ator_tipo          text not null check (ator_tipo in ('dono', 'funcionario', 'sistema')),
  ator_id            text,
  criado_em          timestamptz not null default now(),
  constraint financeiro_movimentos_conta_fk
    foreign key (empresa_id, conta_id)
    references public.contas_financeiras (empresa_id, id)
    on delete restrict,
  constraint financeiro_movimentos_empresa_id_id_uniq unique (empresa_id, id)
);

-- FK auto-referenciada (estorno_de -> id, MESMO tenant): impede estornar um
-- movimento de outra empresa. Precisa vir depois do unique acima existir.
-- Guardada por DO $$ (sem "ADD CONSTRAINT IF NOT EXISTS" em Postgres) para a
-- migration continuar segura de rodar mais de uma vez, mesmo padrão aditivo
-- do resto do arquivo.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'financeiro_movimentos_estorno_fk'
  ) then
    alter table public.financeiro_movimentos
      add constraint financeiro_movimentos_estorno_fk
      foreign key (empresa_id, estorno_de)
      references public.financeiro_movimentos (empresa_id, id);
  end if;
end $$;

create index if not exists financeiro_movimentos_conta_idx
  on public.financeiro_movimentos (empresa_id, conta_id, criado_em desc, id desc);
create index if not exists financeiro_movimentos_vinculo_idx
  on public.financeiro_movimentos (empresa_id, vinculo_id) where vinculo_id is not null;
create index if not exists financeiro_movimentos_conciliacao_idx
  on public.financeiro_movimentos (empresa_id, conta_id, conciliado);

-- Hardening (convenção do projeto, modelo em 20260716120000_rls_hardening_2.sql):
-- acesso só pelo backend privilegiado (DATABASE_URL, que ignora RLS). RLS ligado
-- SEM policy = deny-all deliberado para anon/authenticated.
alter table public.contas_financeiras enable row level security;
alter table public.financeiro_movimentos enable row level security;

revoke all on table public.contas_financeiras from anon, authenticated;
revoke all on table public.financeiro_movimentos from anon, authenticated;
revoke all on sequence public.contas_financeiras_id_seq from anon, authenticated;
revoke all on sequence public.financeiro_movimentos_id_seq from anon, authenticated;

comment on table public.contas_financeiras is
  'Contas financeiras do tenant, separadas do caixa operacional do PDV (D-16). Saldo mantido atomicamente pela mesma transação de cada movimento. Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
comment on table public.financeiro_movimentos is
  'Razão imutável das contas financeiras (D-17). Nenhuma rota atualiza valor/saldo_depois de uma linha já gravada; conciliação é metadata (D-18), não reescreve o fato. Mesmo hardening de acesso das demais tabelas deste programa.';
