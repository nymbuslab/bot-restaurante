-- Índices de performance para os polls quentes (auditoria geral da plataforma).

-- Poll do agente de impressão (delivery) a cada 3s: a fila real é quase sempre vazia,
-- então um índice PARCIAL torna o SELECT O(1) em vez de varrer os pedidos do tenant a
-- cada 3s por agente conectado (mesmo padrão do impressao_fila_pendentes_idx).
CREATE INDEX IF NOT EXISTS pedidos_fila_agente_idx
  ON pedidos (empresa_id, numero)
  WHERE impresso_em IS NULL AND recebido_em IS NULL AND origem = 'web';

-- Poll de "pedido novo" a cada 6s: ultimo() faz ORDER BY id DESC LIMIT 1 filtrando
-- origem='web'. Índice parcial serve o LIMIT 1 sem ordenar o conjunto de pedidos web.
CREATE INDEX IF NOT EXISTS pedidos_web_ultimo_idx
  ON pedidos (empresa_id, id DESC)
  WHERE origem = 'web';
