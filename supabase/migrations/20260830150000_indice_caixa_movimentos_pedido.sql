-- Suporte ao reagrupamento de cancelamentos por pedido na reimpressao
-- de comprovante de caixa.
CREATE INDEX IF NOT EXISTS caixa_movimentos_pedido_id_idx
  ON public.caixa_movimentos (pedido_id)
  WHERE pedido_id IS NOT NULL;
