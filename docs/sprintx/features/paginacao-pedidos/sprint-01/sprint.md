---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: paginacao-pedidos
sprint_id: sprint-01
titulo: modulo puro de contagem para carregar mais
status: concluida
criterio_saida: node --test test/paginacao-pedidos.test.js termina com 0 failed
fases: [F-01.1]
riscos: []
atualizado_em: 2026-09-06
---

# Sprint 01 — Módulo puro de contagem para "Carregar mais"

## Objetivo

Entregar a capacidade de testar a conta central desta feature (quantos pedidos mostrar
depois de cada "Carregar mais") num arquivo dual-mode, seguindo o padrão já usado em
`public/busca.js` — testável com `node:test` de verdade, sem precisar de DOM (D-06).

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-01.1 | Módulo de contagem de pedidos visíveis | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`public/paginacao-pedidos.js` existe, exporta `contagemInicial`, `proximaContagem` e
`temMais` (dual-mode: `module.exports` e `window.PaginacaoPedidos`), e
`node --test test/paginacao-pedidos.test.js` termina com 0 failed.

## Riscos conhecidos

Nenhum risco registrado.
