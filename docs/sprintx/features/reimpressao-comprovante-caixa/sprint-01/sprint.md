# Sprint 01 — Capacidade de testar e infraestrutura

## Objetivo

Entregar o que as sprints seguintes precisam para fazer TDD: o índice que o reagrupamento do cancelamento vai usar, um helper de leitura da fila de impressão que **não consome** os trabalhos (hoje a leitura reserva, e a prova de reimpressão precisa ler a fila duas vezes) e uma fixture que cria os três tipos de movimento com comprovante. Nenhuma funcionalidade de negócio.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-01.1 | Infraestrutura de banco | F-01.2 |
| F-01.2 | Harness de teste | F-01.1 |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`npm run test:integracao` termina com `fail 0` e `npm test` termina com `fail 0`, com o índice aplicado no projeto de teste e a fixture dos três movimentos exercitada por pelo menos um teste.

## Riscos conhecidos

- **Leitura da fila reserva os trabalhos.** `impressaoFila.pendentes` faz claim atômico gravando `reservado_em`/`reservado_por` (`base/montagem-e-enfileiramento.md`, fonte `src/impressao-fila.js:49-56`). O teste de reimpressão precisa comparar o texto ANTES e DEPOIS, ou seja, ler duas vezes. Se o helper não resolver isso, toda a Sprint 03 fica sem como provar o que faz.
- **Não assumir ordem na fila.** Um teste de integração já quebrou por depender da ordem e foi trocado por busca pelo conteúdo (`base/padroes-de-teste.md`). O helper novo deve devolver a lista sem prometer ordem.
- **A migração roda contra o projeto de teste, não o de produção.** O `.env` local aponta para produção (`CLAUDE.md`); o `db push` desta sprint é no projeto descartável do `.env.test`.
