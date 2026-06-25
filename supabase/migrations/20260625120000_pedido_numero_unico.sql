-- Garantia de banco para o número do pedido: não pode haver dois pedidos com o
-- mesmo `numero` dentro de uma empresa. A corrida do MAX(numero)+1 já está
-- serializada em runtime pelo lock FOR UPDATE na linha do tenant (baixa de
-- estoque / venda no PDV), mas este índice é a rede de segurança no nível do
-- banco: se um futuro caminho de gravação esquecer o lock, o duplicado falha
-- em vez de passar silenciosamente.
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_empresa_numero_unico
  ON pedidos (empresa_id, numero);
