-- Observação do PEDIDO (nível do pedido, ex.: "tocar a campainha / entregar na
-- portaria"), informada no checkout do cardápio web. Diferente da observação por
-- item (que vive no jsonb `itens`). Texto livre do cliente → é PII e é limpa na
-- rotina de retenção (anonimizarAntigos em src/pedidos.js).
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS observacao text NOT NULL DEFAULT '';
