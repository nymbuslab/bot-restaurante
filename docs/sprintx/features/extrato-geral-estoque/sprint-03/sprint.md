---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: extrato-geral-estoque
sprint_id: sprint-03
titulo: Frontend — aba Relatorios com extrato geral
status: concluido
criterio_saida: Dono ve todos os movimentos do restaurante numa tela so, filtra por tipo e periodo, sem abrir produto por produto
fases: [F-03.1, F-03.2]
riscos: []
atualizado_em: 2026-09-16
---

# Sprint 03 — Frontend: aba Relatórios com extrato geral

## Objetivo

Construir a aba "Relatórios" nova (D-02), com o extrato geral de estoque como conteúdo:
lista paginada por cursor, filtro por tipo (multi-seleção, D-05) e por período (presets +
customizado, D-06), reaproveitando os estados e padrões visuais já validados na gaveta de
produto único (`base/ui-tela-controle-de-estoque.md`).

Depende do protótipo aprovado (Sprint 01) e da API pronta (Sprint 02).

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-03.1 | Scaffold da aba e navegação | nenhuma |
| F-03.2 | Extrato geral: lista, filtros, paginação | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

Dono abre a aba "Relatórios", vê o extrato geral com movimentos de todos os produtos, filtra
por um ou mais tipos e por período, e carrega mais páginas sem repetir nem pular linha —
exatamente a "definição de pronto" de D-04.

## Riscos conhecidos

- Nenhum risco novo além dos já cobertos nas sprints anteriores.
