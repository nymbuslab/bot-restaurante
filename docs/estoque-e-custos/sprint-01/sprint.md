# Sprint 01 — Capacidade de testar

## Objetivo

Entregar harness, fixtures e contratos de teste para equipe, catálogo, compras, estoque e financeiro, sem funcionalidade de negócio.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-01.1 | Banco descartável e fixtures | nenhuma |
| F-01.2 | Contratos e cenários numéricos | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`npm run test:ci` e `npm run test:integracao` executam as novas fixtures sem acessar produção e terminam com zero falhas.

## Riscos conhecidos

- O `.env` local pode apontar para produção; o guard existente não pode ser contornado (`base/08-TESTES-E-INTERFACE.md`).
