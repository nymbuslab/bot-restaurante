# Caixa

## Contrato de entrada

`POST /api/caixa/movimento` recebe `tipo`, `valor` e `descricao`; `tipo` aceita apenas `sangria` ou `suprimento`. Fonte: `src/servidor.js`, `src/caixa.js` - acessado em 2026-08-29.

`POST /api/pedidos/:id/cancelar` recebe `devolver`; quando o pedido ja esta recebido, chama `caixa.cancelarRecebido`. Fonte: `src/servidor.js`, `src/caixa.js` - acessado em 2026-08-29.

## Contrato de saida

`registrarMovimento` devolve a linha inserida em `caixa_movimentos`. `cancelarRecebido` devolve `{ ok: true, cancelado: true }` antes desta feature. Fonte: `src/caixa.js` - acessado em 2026-08-29.

## Limites e cotas

Valor de sangria/suprimento deve ser positivo; sangria nao pode passar do dinheiro em caixa. Fonte: `src/caixa.js` - acessado em 2026-08-29.

## Erros conhecidos e tratamento

Sem caixa aberto, movimento e cancelamento pago falham. Pedido pago de caixa fechado nao pode ser cancelado com reflexo no caixa aberto. Fonte: `src/caixa.js` - acessado em 2026-08-29.

## Riscos para a nossa implementacao

O comprovante nao pode ser gravado antes do movimento financeiro confirmar. Falha de impressao nao pode desfazer movimento ja registrado.

## Fonte

`src/servidor.js`, `src/caixa.js` - acessado em 2026-08-29.
