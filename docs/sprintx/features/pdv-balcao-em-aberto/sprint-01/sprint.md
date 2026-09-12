---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-01
titulo: Capacidade de testar
status: concluido
criterio_saida: test/integracao/pedidos-comanda.test.js existe e roda com pelo menos 1 teste verde
fases: [F-01.1]
riscos: []
atualizado_em: 2026-09-10
---

# Sprint 01 — Capacidade de testar

## Objetivo

Preparar a fixture de teste de integração específica desta feature (empresa Plano Completo,
cardápio com item de cozinha e item sem cozinha, caixa aberto), reaproveitando o harness
genérico que o projeto já tem em `test/integracao/ajuda/`. É o único propósito desta sprint —
nenhuma funcionalidade de negócio entra aqui (regra estrutural do método): o backend e a UI da
feature vivem nas sprints seguintes, todos em TDD contra esta fixture.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-01.1 | Fixture de teste da feature | nenhuma |

Detalhe da fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`node --test test/integracao/pedidos-comanda.test.js` roda e passa com pelo menos 1 teste verde.

## Riscos conhecidos

- Nenhum risco registrado.
