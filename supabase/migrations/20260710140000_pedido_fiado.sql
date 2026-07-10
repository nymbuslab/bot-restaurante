-- ============================================================
-- PEDIDOS — venda "A Prazo" (fiado). Fase 3.
--
-- Uma venda a prazo é um pedido normal marcado com a_prazo=true, vinculado a um
-- cliente (cliente_id), com recebido_em=NULL (é conta a receber) e SEM movimento
-- no caixa na hora. Baixas parciais acumulam em valor_recebido; quando cobre o
-- total, grava recebido_em (vai para "Recebidas", Fase 4).
--
-- Tudo aditivo (ADD COLUMN IF NOT EXISTS), sem backfill: pedidos existentes
-- ficam a_prazo=false. O caixa exclui a_prazo do "a receber" que trava o
-- fechamento (src/caixa.js) — fiado não precisa ser recebido para fechar o dia.
-- ============================================================

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_id     uuid REFERENCES clientes(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS a_prazo        boolean NOT NULL DEFAULT false;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS vencimento     date;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS valor_recebido numeric(10,2) NOT NULL DEFAULT 0;

-- Consulta das contas a prazo em aberto por cliente (resumo de crédito, Contas a Receber).
CREATE INDEX IF NOT EXISTS pedidos_cliente_fiado_idx
  ON pedidos (empresa_id, cliente_id) WHERE a_prazo;
