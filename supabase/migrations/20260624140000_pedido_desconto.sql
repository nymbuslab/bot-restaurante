-- Desconto aplicado na venda (em R$), usado pelo PDV (vendas no local). O `total`
-- do pedido já é o líquido (subtotal − desconto); esta coluna guarda quanto foi
-- abatido, para histórico/relatórios. Pedidos do cardápio web ficam com 0.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS desconto numeric(10,2) NOT NULL DEFAULT 0;
