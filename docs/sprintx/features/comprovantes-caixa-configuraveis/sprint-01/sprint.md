# Sprint 01 - Comprovantes configuraveis do caixa

## Objetivo

Entregar a capacidade de testar, configurar e imprimir comprovantes de suprimento, sangria e cancelamento pago pelo fluxo existente de fila do agente.

## Fases

- F-01: Testes e contrato do comprovante.
- F-02: Implementacao backend e UI.
- F-03: Documentacao e validacao.

## Criterio de saida

- `node --test test/comprovante-caixa.test.js` passa.
- `node --test test/integracao/caixa-comprovantes.test.js` passa quando banco de integracao estiver configurado.
- `npm run check`, `npm run test:integracao` e `npm test` passam.

## Riscos conhecidos

- Falha de impressao nao pode reverter movimento financeiro.
- Configuracao fisica da impressora nao deve voltar para o painel.
- Comprovante deve ser enfileirado somente depois da acao financeira confirmar.
