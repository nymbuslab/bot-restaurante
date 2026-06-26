-- Marca quando o AGENTE DE IMPRESSÃO desktop já imprimiu o pedido. Nulo = ainda
-- não impresso pelo agente. Usado pelo polling (/api/agente/pendentes) para não
-- reimprimir e para ser idempotente entre reinícios/instâncias do agente.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS impresso_em timestamptz;
