-- ============================================================
-- insumos — o que o restaurante compra e consome (etapa 4/4 do split de Produtos).
--
-- Diferente do estoque de PRODUTO, que mora no jsonb `empresas.cardapio`, o saldo
-- do insumo mora aqui, numa coluna. Três motivos: o jsonb tem teto de 512 KB
-- (LIMITE_CARDAPIO_BYTES); ele é reescrito INTEIRO a cada edição de cardápio, e
-- saldo que muda a cada venda não pode depender disso; e `store.setCardapio` roda
-- `Estoque.diffEstoque` a cada salvada, que geraria movimento `ajuste` espúrio.
--
-- A FICHA TÉCNICA (a receita) continua no jsonb, junto de quem ela descreve:
-- `item.ficha` e `cardapio.grupos[].opcoes[].ficha`, ambas [{ insumoId, qtd }].
--
-- `saldo` PODE ser negativo, de propósito. Falta de insumo avisa e não bloqueia a
-- venda (decisão do dono), e é o negativo que revela o furo: travar em zero
-- esconderia o problema, que é exatamente o que o dono quer enxergar.
--
-- numeric(14,3) explícito: 3 casas é a precisão de grama e de mililitro, e o
-- arredondamento acontece no BANCO, o que mata a deriva de float do JS na soma de
-- centenas de vendas pequenas.
--
-- O HISTÓRICO reusa `estoque_movimentos` com `item_id = 'ins_' || id`. Aquela
-- coluna é text sem FK justamente porque o id vive no jsonb e não tem tipo
-- garantido, então ela acomoda os dois namespaces. Ganho: extrato, resumo de 30
-- dias e a retenção de 12 meses já agendada funcionam sem uma linha de mudança.
-- O prefixo vive numa constante única em public/insumos.js, nunca solto no código.
-- ============================================================

CREATE TABLE IF NOT EXISTS insumos (
  id         bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  unidade    text NOT NULL DEFAULT 'un',           -- 'un' | 'kg' | 'l'
  saldo      numeric(14,3) NOT NULL DEFAULT 0,     -- PODE ser negativo (ver acima)
  minimo     numeric(14,3) NOT NULL DEFAULT 0,     -- alerta de "acabando"; não afeta saldo
  custo      numeric(12,4),                        -- opcional; sem tela nesta etapa
  arquivado  boolean NOT NULL DEFAULT false,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT insumos_unidade_check CHECK (unidade IN ('un', 'kg', 'l')),
  CONSTRAINT insumos_minimo_check  CHECK (minimo >= 0)
);

-- Lista da tela (só os ativos, ordem alfabética).
CREATE INDEX IF NOT EXISTS insumos_empresa_idx
  ON insumos (empresa_id, arquivado);

-- Nome único por empresa, ignorando maiúscula. Parcial: insumo ARQUIVADO libera o
-- nome, senão o dono nunca mais consegue recadastrar "Arroz" depois de arquivar.
CREATE UNIQUE INDEX IF NOT EXISTS insumos_nome_uniq
  ON insumos (empresa_id, lower(nome)) WHERE NOT arquivado;

-- Insumo NUNCA é apagado, só arquivado: `estoque_movimentos.item_id` não tem FK,
-- então apagar deixaria o extrato com movimento órfão sem nome.
COMMENT ON COLUMN insumos.arquivado IS
  'Insumo não é apagado, só arquivado — o histórico em estoque_movimentos referencia o id sem FK.';

COMMENT ON COLUMN estoque_movimentos.item_id IS
  'Dois namespaces: id de item do cardápio (numérico) ou id de insumo prefixado (ins_N). Ver PREFIXO_INSUMO em public/insumos.js.';

-- Hardening (convenção do projeto, modelo em 20260716120000_rls_hardening_2.sql):
-- acesso só pelo backend privilegiado (DATABASE_URL, que ignora RLS). RLS ligado
-- SEM policy = deny-all deliberado para anon/authenticated.
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.insumos FROM anon, authenticated;
COMMENT ON TABLE public.insumos IS
  'Insumos (ingredientes) por tenant, com saldo próprio. Acesso só pelo backend privilegiado; RLS on + sem policy (deny-all) + grants de anon/authenticated revogados — intencional.';
