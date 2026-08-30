# Tasks

## T-01.01

id: T-01.01
titulo: testes do comprovante
objetivo: cobrir texto puro e integracao caixa/fila antes do codigo.
arquivos: cria: `test/comprovante-caixa.test.js`, `test/integracao/caixa-comprovantes.test.js`; altera: nenhum.
teste_integracao: `node --test test/integracao/caixa-comprovantes.test.js` prova que config desligada nao enfileira e config ligada enfileira tres comprovantes.
teste_funcional: `node --test test/comprovante-caixa.test.js` prova que o texto contem tipo, valor, caixa, operador, motivo e pedido quando existir.
criterio_aceite: os dois arquivos de teste existem e o teste puro falha por modulo ausente antes da implementacao.
depende_de: []
paralelizavel: false
status: concluida - 2026-08-29 - vermelho confirmado em `node --test test/comprovante-caixa.test.js`

## T-01.02

id: T-01.02
titulo: comprovantes configuraveis
objetivo: implementar configuracao, texto e enfileiramento condicional.
arquivos: cria: `public/comprovante-caixa.js`; altera: `src/servidor.js`, `src/caixa.js`, `public/admin.html`, `public/app.js`, `public/style.css`.
teste_integracao: `node --test test/integracao/caixa-comprovantes.test.js` prova a fila para suprimento, sangria e cancelamento.
teste_funcional: `node --test test/comprovante-caixa.test.js` prova o formato do texto.
criterio_aceite: com config desligada nenhuma fila nova aparece; com as tres opcoes ligadas aparecem tres trabalhos `caixa-comprovante`.
depende_de: [T-01.01]
paralelizavel: false
status: concluida - 2026-08-29 - suite: `node --test test/comprovante-caixa.test.js` 2 passed; `node --test test/integracao/caixa-comprovantes.test.js` 1 passed

## T-01.03

id: T-01.03
titulo: documentacao e suite
objetivo: atualizar documentacao viva e validar a feature financeira.
arquivos: cria: nenhum; altera: `PROGRESSO.md`, `CHANGELOG.md`, `CLAUDE.md`, `docs/planos-e-frete.md`, `docs/modelo-dados.md`.
teste_integracao: `npm run test:integracao` passa.
teste_funcional: `npm test` e `npm run check` passam.
criterio_aceite: documentacao cita `config.impressao.caixa` e a ultima validacao esta registrada.
depende_de: [T-01.02]
paralelizavel: false
status: concluida - 2026-08-29 - suite: `npm run check` OK; `npm run test:integracao` 45 passed; `npm test` 510 passed
