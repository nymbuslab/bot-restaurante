# Sprint 02 — Backend: remontar e reenfileirar

## Objetivo

Fazer o servidor remontar o comprovante a partir do movimento **guardado** e enfileirá-lo de novo, saindo idêntico ao papel original (D-02), inclusive quando o toggle daquele tipo está desligado (D-01).

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-02.1 | Vocabulário compartilhado dos tipos | nenhuma |
| F-02.2 | Leitura do movimento guardado | nenhuma |
| F-02.3 | Rota de reimpressão | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`POST /api/caixa/movimento/:id/reimprimir` devolve 200 para sangria, suprimento e cancelamento, e o texto enfileirado é **string-idêntico** ao que foi enfileirado no registro original; `npm test` e `npm run test:integracao` terminam com `fail 0`.

## Riscos conhecidos

- **Cancelamento é feito de vários movimentos** (`base/montagem-e-enfileiramento.md`, risco 1). Sem reagrupar por `(caixa_id, pedido_id, tipo)`, o papel sai com valor parcial e uma forma só. É o risco mais alto da feature.
- **`operador` hoje vem do caixa ABERTO agora, não do caixa do movimento** (`base/montagem-e-enfileiramento.md`, risco 2). Como D-04 limita ao turno aberto, os dois coincidem; mas a leitura deve buscar pelo `caixa_id` do movimento para não depender dessa coincidência.
- **`criadoEm` cai para `new Date()` quando ausente** (`base/montagem-e-enfileiramento.md`, risco 3). Passar o `criado_em` guardado, senão o papel sai com a hora de agora e deixa de bater com o extrato.
- **`pedidoNumero` não está em `caixa_movimentos`** (`base/montagem-e-enfileiramento.md`, risco 4): exige JOIN com `pedidos`, senão o papel imprime "Pedido ID" cru.
- **O toggle é consultado dentro de `enfileirarComprovanteCaixa`** (`base/montagem-e-enfileiramento.md`, risco 5). D-01 diz que a reimpressão manual ignora o toggle, então a rota NÃO pode reusar essa função como está.
