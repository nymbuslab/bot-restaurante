# Testes e histórico da área

## Contrato de entrada

Testes unitários usam `node:test` via `npm test`; integração usa `npm run test:integracao` contra banco de teste isolado. A feature anterior possui harnesses estáticos do front e uma suíte fim a fim de Comanda (`package.json`; `test/pdv-comanda-tile.test.js`; `test/pdv-comanda-modo.test.js`; `test/integracao/pedidos-comanda.test.js`).

## Contrato de saída

A entrega anterior provou abertura, acréscimos, baixa de estoque, impressão apenas da rodada, cancelamento e recebimento. O fechamento registrou 714 testes unitários e 67 testes de integração verdes em 2026-09-11 (`docs/sprintx/features/pdv-balcao-em-aberto/FECHAMENTO.md`).

## Limites e cotas

O runner unitário não toca produção; integração exige `.env.test` marcado como banco de teste. O projeto pede TDD, suíte completa, check de sintaxe e validação visual para UI (`CLAUDE.md:76-105`).

## Erros conhecidos e tratamento

A decisão D-03 anterior colocou a reabertura apenas em Pedidos e descartou uma tela dedicada; D-12 descartou nova indicação operacional. O chamado real mostrou que essa escolha permite esquecer a Comanda. A nova feature revisa especificamente essas decisões, preservando D-04, D-05, D-08, D-10, D-11 e D-14 (`docs/sprintx/features/pdv-balcao-em-aberto/00-DECISOES.md`).

## Riscos para a nossa implementação

O `memox` não encontrou histórico indexado para `src/mesas-db.js` nem para o módulo Mesas. Para `public/app.js` e `public/admin.html`, apontou faixa de atenção alta e a feature `extrato-geral-estoque`, sem regressão ou reprovação de QA. O histórico específico de Comanda está nos artefatos da feature anterior e deve prevalecer sobre inferência do índice.

## Fonte

`package.json`, `CLAUDE.md:76-105`, `docs/sprintx/features/pdv-balcao-em-aberto/00-DECISOES.md`, `docs/sprintx/features/pdv-balcao-em-aberto/FECHAMENTO.md`, `docs/sprintx/features/extrato-geral-estoque/00-DECISOES.md` — acessado em 2026-11-11
