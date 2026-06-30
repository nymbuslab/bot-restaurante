-- Origem do pedido: de onde ele entrou ('web' | 'pdv' | 'mesa'). Distingue os 3
-- canais para (a) o alerta de "novo pedido" disparar SÓ para o cardápio web
-- (PDV/Mesa não alertam), (b) o agente de delivery (/api/agente/pendentes) imprimir
-- só os do web, e (c) o "Canal" na lista de Pedidos ser confiável.
-- Default 'web' (pedidos históricos vieram do cardápio web). Backfill: linhas de
-- mesa viram 'mesa'; vendas de Balcão (só o PDV produz esse tipo) viram 'pdv'.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'web';
UPDATE pedidos SET origem = 'mesa' WHERE mesa_id IS NOT NULL AND origem = 'web';
UPDATE pedidos SET origem = 'pdv'  WHERE mesa_id IS NULL AND tipo_entrega = 'Balcão' AND origem = 'web';
