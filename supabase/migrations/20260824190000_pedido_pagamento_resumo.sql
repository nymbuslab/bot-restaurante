-- `pedidos.pagamento` guardava duas coisas diferentes, dependendo de quem gravou:
-- o cardápio web e o bot escreviam a FORMA que o cliente escolheu ("PIX"), e o
-- PDV, o recebimento e o fechamento de mesa escreviam o RESUMO com valor
-- ("PIX R$ 20,00 · Dinheiro R$ 5,00"). Uma coluna, duas semânticas.
--
-- Já produziu efeito mais de uma vez: o indicador de formas de pagamento do
-- Dashboard agrupava por essa coluna e cada venda virava um grupo de um (passou a
-- ler `caixa_movimentos` em 2026-08-21); um resumo foi copiado para
-- `caixa_movimentos.forma_pagamento` e precisou de migração para sair de lá
-- (2026-08-22); e o painel, ao abrir o recebimento de um pedido, pré-seleciona a
-- forma com um `indexOf` que nunca casa com um resumo e cai calado na primeira
-- forma da lista.
--
-- A partir daqui: `pagamento` guarda a FORMA (vazio quando a venda foi dividida)
-- e `pagamento_resumo` guarda como foi pago de fato.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pagamento_resumo text;

COMMENT ON COLUMN pedidos.pagamento IS
  'Forma de pagamento (Dinheiro/PIX/Cartão de Crédito/Cartão de Débito). Vazio quando a venda foi dividida entre formas. Linhas antigas podem trazer grafia fora do vocabulário atual.';
COMMENT ON COLUMN pedidos.pagamento_resumo IS
  'Como foi pago de fato, com valor por forma ("PIX R$ 20,00 · Dinheiro R$ 5,00"). NULL em pedido que ainda não foi recebido.';

-- Backfill. Só as linhas em formato de resumo são tocadas: as 12 que já guardavam
-- forma pura ficam como estão (inclusive duas "A Prazo", do fiado que saiu do
-- produto — é o que aconteceu, não cabe reescrever).
--
-- Atenção ao regex: `' R\$ '` NÃO casa nada neste Postgres (conferido na base de
-- produção: 0 linhas, contra 610 do `LIKE`). O `$` vai entre colchetes.
--
-- O resumo inteiro vai para a coluna nova. Na antiga fica a forma, quando dá para
-- saber, já normalizada para o vocabulário atual — o histórico traz "Pix",
-- "Cartão Crédito" e "Cartão Débito", grafias anteriores ao vocabulário fechado
-- (a migração de 2026-08-22 limpou `caixa_movimentos`, não esta coluna).
--
-- Ficam com `pagamento` vazio de propósito, e a verdade completa na coluna nova:
--   - venda DIVIDIDA (21 linhas): escolher uma das formas seria inventar
--     informação num registro financeiro;
--   - "Cartão (na entrega)" (36 linhas): pode ter sido crédito ou débito e não há
--     como saber. Mesma decisão tomada em 2026-08-22 para os registros do caixa.
UPDATE pedidos
   SET pagamento_resumo = pagamento,
       pagamento = CASE
         WHEN pagamento LIKE '%·%' THEN ''
         ELSE CASE btrim(regexp_replace(pagamento, ' R[$] [0-9].*$', ''))
           WHEN 'Pix'                 THEN 'PIX'
           WHEN 'Cartão Crédito'      THEN 'Cartão de Crédito'
           WHEN 'Cartão Débito'       THEN 'Cartão de Débito'
           WHEN 'Cartão (na entrega)' THEN ''
           ELSE btrim(regexp_replace(pagamento, ' R[$] [0-9].*$', ''))
         END
       END
 WHERE pagamento ~ ' R[$] [0-9]';
