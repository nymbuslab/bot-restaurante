---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: paginacao-pedidos
sprint_id: sprint-02
titulo: troca da paginacao numerada por carregar mais em pedidos
status: concluida
criterio_saida: npm test termina com 0 failed e npm run check sem erro de sintaxe
fases: [F-02.1]
riscos: [nenhum teste automatizado cobre renderListaPedidos hoje - cobertura via checagem estatica de texto, nao execucao real do DOM]
atualizado_em: 2026-09-06
---

# Sprint 02 — Troca da paginação numerada por "Carregar mais" em Pedidos

## Objetivo

Substituir a paginação numerada fixa (10 por página) da tela de Pedidos por um único botão
"Carregar mais" (30 pedidos de cara, +20 por clique), valendo tanto para a tabela do
computador quanto para os cards do celular (D-01, D-03, D-04, D-05, D-07), usando o módulo
puro criado na sprint-01.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-02.1 | Estado e render usam contagem visível em vez de página numerada | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`npm test` termina com 0 failed (inclui `test/paginacao-pedidos.test.js` da sprint-01 e os
novos testes desta sprint) e `npm run check` sem erro de sintaxe.

## Riscos conhecidos

- Nenhum teste automatizado cobre `renderListaPedidos`/`paginacaoHtml` hoje
  (`base/00-pedidos-renderizacao-e-paginacao.md`) — a cobertura desta sprint é por checagem
  estática de texto (`contemTrecho`/`trechoEntre`, já existente em
  `test/apoio/arquivo-estatico.js`), não por execução real do DOM. A conferência visual
  (o botão aparece, some quando não há mais pedidos, funciona no celular) precisa de
  conferência manual/navegador antes do fechamento (mesma exceção documentada no
  `CLAUDE.md` do projeto para UI sem ferramenta de renderização disponível).
