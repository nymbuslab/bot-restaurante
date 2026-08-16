-- ============================================================
-- estoque_movimentos — trilha de TODA mudança de saldo de estoque.
--
-- O saldo continua morando no jsonb `empresas.cardapio` (item.estoque e
-- item.variacoes[].estoque). Esta tabela NÃO é fonte de verdade do saldo: é o
-- histórico. Cada linha é gravada DENTRO da mesma transação que altera o jsonb,
-- pela mesma função (store.baixarEstoqueTx / devolverEstoqueTx / ajustarEstoqueTx),
-- então não tem como divergir do número.
--
-- Por que não derivar a venda de `itens_venda`: ao cancelar UM item do pedido, o
-- `pedidos.itens` muda, o trigger reprojeta e a linha de venda DESAPARECE de lá.
-- Com a devolução entrando como movimento, o mesmo estoque seria contado duas
-- vezes. Não é escrita dupla do mesmo fato: itens_venda conta FATURAMENTO (inclui
-- item sem controle de estoque); esta conta PRATELEIRA.
--
-- Como o saldo não é a soma das linhas, a retenção (12 meses) pode apagar
-- movimento antigo sem estragar o número.
--
-- item_id é TEXT e sem FK: o id do item vive no jsonb e não tem tipo garantido
-- (a base tem numérico e string). Mesmo motivo de itens_venda.item_id ser solto.
-- ============================================================

CREATE TABLE IF NOT EXISTS estoque_movimentos (
  id           bigserial PRIMARY KEY,
  empresa_id   uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  item_id      text NOT NULL,              -- referência SOLTA ao cardápio (jsonb)
  variacao_id  text,                       -- preenchido quando o saldo é o da variação
  tipo         text NOT NULL,              -- venda|devolucao|entrada|perda|contagem|ajuste
  quantidade   numeric NOT NULL,           -- assinada: +20 entrada, -3 perda, ±N contagem
  saldo_depois numeric NOT NULL,           -- saldo após aplicar o movimento
  descricao    text NOT NULL DEFAULT '',   -- nome do produto COMO ESTAVA (snapshot)
  unidade      text NOT NULL DEFAULT 'un', -- 'un' | 'kg'
  pedido_id    bigint,                     -- venda/devolução: pedido que originou
  numero       integer,                    -- nº do pedido (conveniência, sem join)
  obs          text,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

-- Extrato de UM saldo (gaveta do produto), mais recente primeiro.
CREATE INDEX IF NOT EXISTS estoque_mov_saldo_idx
  ON estoque_movimentos (empresa_id, item_id, variacao_id, criado_em DESC);
-- Resumo por período e retenção.
CREATE INDEX IF NOT EXISTS estoque_mov_data_idx
  ON estoque_movimentos (empresa_id, criado_em DESC);

-- Hardening (convenção do projeto, modelo em 20260716120000_rls_hardening_2.sql):
-- acesso só pelo backend privilegiado (DATABASE_URL, que ignora RLS). RLS ligado
-- SEM policy = deny-all deliberado para anon/authenticated.
ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.estoque_movimentos FROM anon, authenticated;
COMMENT ON TABLE public.estoque_movimentos IS
  'Trilha de movimentação de estoque por tenant. Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
