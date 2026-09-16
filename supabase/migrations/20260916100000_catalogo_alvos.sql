-- ============================================================
-- catalogo_alvos — registro-ponte relacional do catálogo (D-02, D-26).
--
-- O catálogo continua em `empresas.cardapio` (jsonb): esta tabela NÃO duplica
-- nome, preço nem saldo. Ela só dá a produto e variação uma IDENTIDADE
-- relacional estável, para Compras/fornecedores/financeiro (sprints seguintes)
-- poderem referenciar por FK em vez de string solta.
--
-- `tipo` é a coluna que representa o alvo (produto | variacao | insumo no
-- futuro) — D-26 rejeitou prefixar o tipo dentro do ID em texto, exatamente
-- para permitir essa evolução sem colisão nem parsing.
--
-- Produto COM variações não controla saldo próprio (base/01-CATALOGO-E-
-- IDENTIDADE.md, mesma regra de `store.baixarEstoqueTx`): por isso o alvo
-- 'produto' e o alvo 'variacao' são mutuamente exclusivos por produto — a
-- sincronização (catalogo-alvos-db.sincronizarTx) só cria o alvo que faz
-- sentido para aquele item.
--
-- Somente ADITIVO: excluir ou renomear um item no cardápio NUNCA apaga a
-- linha aqui (sprint-04/fases.md, F-04.1). O alvo é histórico estável mesmo
-- que o produto suma do jsonb.
--
-- `produto_id`/`variacao_id` são TEXT sem FK para o jsonb, mesmo motivo de
-- `estoque_movimentos.item_id` (base/06-BANCO-TENANCY-E-TRANSACOES.md): o id
-- do item vive no jsonb, sem tipo garantido (a base tem numérico e string).
-- ============================================================

create table if not exists public.catalogo_alvos (
  id            bigint generated always as identity primary key,
  empresa_id    uuid not null references public.empresas(id) on delete cascade,
  tipo          text not null check (tipo in ('produto', 'variacao')),
  produto_id    text not null,
  variacao_id   text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint catalogo_alvos_empresa_id_id_uniq unique (empresa_id, id),
  constraint catalogo_alvos_tipo_variacao_ck check (
    (tipo = 'produto' and variacao_id is null) or
    (tipo = 'variacao' and variacao_id is not null)
  )
);

-- Unicidade por tenant, separada por tipo (variacao_id NULL não dá para
-- unicar num índice único comum — NULL nunca é igual a NULL em Postgres).
create unique index if not exists catalogo_alvos_produto_uniq
  on public.catalogo_alvos (empresa_id, produto_id)
  where tipo = 'produto';
create unique index if not exists catalogo_alvos_variacao_uniq
  on public.catalogo_alvos (empresa_id, produto_id, variacao_id)
  where tipo = 'variacao';

create index if not exists catalogo_alvos_empresa_idx
  on public.catalogo_alvos (empresa_id, tipo);

-- Hardening (convenção do projeto, modelo em 20260716120000_rls_hardening_2.sql):
-- acesso só pelo backend privilegiado (DATABASE_URL, que ignora RLS). RLS ligado
-- SEM policy = deny-all deliberado para anon/authenticated.
alter table public.catalogo_alvos enable row level security;
revoke all on table public.catalogo_alvos from anon, authenticated;
revoke all on sequence public.catalogo_alvos_id_seq from anon, authenticated;

comment on table public.catalogo_alvos is
  'Registro-ponte relacional do catálogo (produto/variação, D-26). Só aditivo: exclusão/renomeação no jsonb nunca apaga a linha. Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
