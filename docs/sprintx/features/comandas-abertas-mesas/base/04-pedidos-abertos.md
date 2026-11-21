# Pedidos abertos e operações da Comanda

## Contrato de entrada

`pedidos.lerTodos(dir, filtro)` recorta por hoje, 7 dias ou intervalo. A Comanda pode ser alterada enquanto `recebido_em IS NULL` e `status <> 'cancelado'`. O acréscimo usa `POST /api/pedidos/:id/itens`; o fechamento usa o recebimento existente do Caixa (`src/pedidos.js:97-122`; `src/pedidos.js:378-407`).

## Contrato de saída

O pedido mapeado inclui id, número, status, cliente, tipoEntrega, itens, total, criadoEm, recebidoEm, mesaId e origem. A aba Pedidos mostra a Comanda como tipo Local, canal Balcão e selo A receber (`src/pedidos.js:25-53`; `public/app.js:5140-5185`).

## Limites e cotas

O filtro padrão da aba Pedidos é `periodo: "hoje"`; uma Comanda aberta em dia anterior deixa de aparecer ao operador sem ampliar o período (`public/app.js:5048-5075`). Intervalos customizados com dois limites não podem superar 366 dias (`src/pedidos.js:91-95`).

## Erros conhecidos e tratamento

Acréscimo rejeita pedido inexistente, recebido ou cancelado; a rota recalcula itens, valida estoque e usa transação. Recebimento e cancelamento possuem permissões e validações próprias (`src/pedidos.js:378-407`; `test/integracao/pedidos-comanda.test.js`).

## Riscos para a nossa implementação

Buscar Comandas pela API geral de Pedidos herdaria o filtro de data e poderia continuar escondendo contas antigas. A listagem operacional deve consultar explicitamente todas as Comandas ainda abertas, sem janela temporal. As ações não podem duplicar regras de estoque, pagamento ou cancelamento já existentes.

## Fonte

`src/pedidos.js:25-122`, `src/pedidos.js:378-407`, `public/app.js:5048-5075`, `public/app.js:5140-5185`, `test/integracao/pedidos-comanda.test.js` — acessado em 2026-11-11
