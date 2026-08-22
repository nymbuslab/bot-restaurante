-- Troco pedido pelo cliente no cardápio web ("Troco para R$ 100"). O front já
-- coletava e mandava esse valor no pedido, mas nada no servidor lia: não havia
-- coluna, o cupom não imprimia e o painel não mostrava. Quem ia entregar
-- descobria na porta do cliente que precisava de troco e não tinha.
--
-- NULL = cliente não pediu troco (ou não pagou em dinheiro). Só é gravado
-- quando a forma de pagamento escolhida é dinheiro; nas outras não significa
-- nada. Guarda o valor que o cliente vai dar na mão, não o troco a devolver —
-- o que voltar é `troco_para - total`, calculado na hora de mostrar, para não
-- congelar uma conta que o pedido pode mudar (cancelamento de item).
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS troco_para numeric(10,2);

COMMENT ON COLUMN pedidos.troco_para IS
  'Cardápio web, pagamento em dinheiro: valor que o cliente vai entregar. NULL quando não pediu troco.';
