-- ============================================================
-- itens_venda — projeção RELACIONAL dos itens vendidos (Fase 1 da normalização).
--
-- Motivação: `pedidos.itens` é um JSONB (snapshot do pedido, ótimo pra operação:
-- impressão da comanda, recálculo, PDV). Mas para RELATÓRIO/BI ("quanto vendi de
-- cada item no mês") desaninhar JSONB é chato. Esta tabela dá cada item vendido em
-- COLUNAS (descrição, qtd, preço unitário, adicionais, subtotal), indexável e
-- agregável com um GROUP BY simples.
--
-- Decisão de arquitetura: NÃO é dual-write no app (5+ pontos de criação/edição →
-- risco de divergência). É uma PROJEÇÃO mantida por TRIGGER sobre `pedidos`: sempre
-- que `pedidos.itens` muda (INSERT ou UPDATE OF itens — cobre PDV, cardápio web,
-- mesa e cancelamento de item), o trigger reprojeta as linhas deste pedido. O JSONB
-- continua sendo a fonte da verdade operacional; esta tabela é o espelho relacional
-- (nunca diverge, o código do app não muda). A lógica de projeção foi validada
-- read-only contra 100% dos pedidos de produção (reconcilia com o total).
--
-- `descricao`/`preco_unit` são SNAPSHOT (como vendido). `item_id` é referência SOLTA
-- ao cardápio (que é JSONB em `empresas.cardapio`, editável/arquivável) — sem FK.
-- ============================================================

CREATE TABLE IF NOT EXISTS itens_venda (
  id          bigserial PRIMARY KEY,
  empresa_id  uuid   NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  pedido_id   bigint NOT NULL REFERENCES pedidos(id)  ON DELETE CASCADE,
  numero      integer,                              -- nº do pedido (conveniência p/ relatório sem join)
  origem      text,                                 -- 'web' | 'pdv' | 'mesa' (herdado do pedido)
  item_id     bigint,                               -- referência SOLTA ao item do cardápio (sem FK)
  descricao   text    NOT NULL DEFAULT '',          -- nome COMO VENDIDO (snapshot)
  unidade     text    NOT NULL DEFAULT 'un',        -- 'un' | 'kg'
  qtd         numeric NOT NULL DEFAULT 0,           -- decimal (suporta kg)
  preco_unit  numeric NOT NULL DEFAULT 0,           -- preço BASE unitário como vendido
  adicionais  numeric NOT NULL DEFAULT 0,           -- soma opcionais+variações POR UNIDADE
  subtotal    numeric NOT NULL DEFAULT 0,           -- (preco_unit + adicionais) * qtd
  opcionais   jsonb   NOT NULL DEFAULT '[]'::jsonb, -- extras (display), raramente agregados
  variacoes   jsonb   NOT NULL DEFAULT '[]'::jsonb,
  composicao  jsonb   NOT NULL DEFAULT '[]'::jsonb,
  observacao  text,
  criado_em   timestamptz NOT NULL DEFAULT now()    -- = criado_em do pedido (relatório por data sem join)
);

CREATE INDEX IF NOT EXISTS itens_venda_pedido_idx  ON itens_venda (pedido_id);
CREATE INDEX IF NOT EXISTS itens_venda_item_idx    ON itens_venda (empresa_id, item_id);
CREATE INDEX IF NOT EXISTS itens_venda_data_idx    ON itens_venda (empresa_id, criado_em);

-- Reprojeta as linhas de UM pedido a partir do seu itens JSONB. Idempotente
-- (apaga e reinsere). Mesma lógica validada na reconciliação read-only.
CREATE OR REPLACE FUNCTION sync_itens_venda() RETURNS trigger AS $$
BEGIN
  DELETE FROM itens_venda WHERE pedido_id = NEW.id;
  INSERT INTO itens_venda
    (empresa_id, pedido_id, numero, origem, item_id, descricao, unidade, qtd,
     preco_unit, adicionais, subtotal, opcionais, variacoes, composicao, observacao, criado_em)
  SELECT
    NEW.empresa_id, NEW.id, NEW.numero, NEW.origem,
    NULLIF(it->>'id','')::bigint,
    COALESCE(it->>'nome',''),
    COALESCE(NULLIF(it->>'unidade',''),'un'),
    calc.qtd, calc.preco, calc.add,
    round((calc.preco + calc.add) * calc.qtd, 2),
    COALESCE(it->'opcionais','[]'::jsonb),
    COALESCE(it->'variacoes','[]'::jsonb),
    COALESCE(it->'composicao','[]'::jsonb),
    NULLIF(it->>'observacao',''),
    NEW.criado_em
  FROM jsonb_array_elements(COALESCE(NEW.itens,'[]'::jsonb)) AS it
  CROSS JOIN LATERAL (
    SELECT
      COALESCE((it->>'qtd')::numeric, 0) AS qtd,
      COALESCE((it->>'preco')::numeric, 0) AS preco,
      COALESCE((SELECT sum((o->>'preco')::numeric * COALESCE(NULLIF(o->>'qtd','')::numeric,1))
                 FROM jsonb_array_elements(COALESCE(it->'opcionais','[]'::jsonb)) o),0)
    + COALESCE((SELECT sum((v->>'preco')::numeric * COALESCE(NULLIF(v->>'qtd','')::numeric,1))
                 FROM jsonb_array_elements(COALESCE(it->'variacoes','[]'::jsonb)) v),0) AS add
  ) calc;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Só dispara quando `itens` de fato muda (não em updates de recebido_em/status/etc.).
DROP TRIGGER IF EXISTS trg_sync_itens_venda ON pedidos;
CREATE TRIGGER trg_sync_itens_venda
  AFTER INSERT OR UPDATE OF itens ON pedidos
  FOR EACH ROW EXECUTE FUNCTION sync_itens_venda();

-- Backfill do histórico: reprojeta todos os pedidos existentes uma vez.
-- (Idempotente: a tabela nasce vazia; se rodar de novo, limpa antes.)
TRUNCATE itens_venda;
INSERT INTO itens_venda
  (empresa_id, pedido_id, numero, origem, item_id, descricao, unidade, qtd,
   preco_unit, adicionais, subtotal, opcionais, variacoes, composicao, observacao, criado_em)
SELECT
  p.empresa_id, p.id, p.numero, p.origem,
  NULLIF(it->>'id','')::bigint,
  COALESCE(it->>'nome',''),
  COALESCE(NULLIF(it->>'unidade',''),'un'),
  calc.qtd, calc.preco, calc.add,
  round((calc.preco + calc.add) * calc.qtd, 2),
  COALESCE(it->'opcionais','[]'::jsonb),
  COALESCE(it->'variacoes','[]'::jsonb),
  COALESCE(it->'composicao','[]'::jsonb),
  NULLIF(it->>'observacao',''),
  p.criado_em
FROM pedidos p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.itens,'[]'::jsonb)) AS it
CROSS JOIN LATERAL (
  SELECT
    COALESCE((it->>'qtd')::numeric, 0) AS qtd,
    COALESCE((it->>'preco')::numeric, 0) AS preco,
    COALESCE((SELECT sum((o->>'preco')::numeric * COALESCE(NULLIF(o->>'qtd','')::numeric,1))
               FROM jsonb_array_elements(COALESCE(it->'opcionais','[]'::jsonb)) o),0)
  + COALESCE((SELECT sum((v->>'preco')::numeric * COALESCE(NULLIF(v->>'qtd','')::numeric,1))
               FROM jsonb_array_elements(COALESCE(it->'variacoes','[]'::jsonb)) v),0) AS add
) calc;
