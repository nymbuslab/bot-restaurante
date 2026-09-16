---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: extrato-geral-estoque
sprint_id: sprint-02
titulo: Backend — consulta geral e rota
status: nao_iniciado
criterio_saida: GET /api/estoque/geral devolve movimentos de todos os produtos, paginados por cursor, filtraveis por tipo e periodo
fases: [F-02.1]
riscos: [Volume por linha pode ser maior que na gaveta de 1 produto — toda venda gera N linhas]
atualizado_em: 2026-09-16
---

# Sprint 02 — Backend: consulta geral e rota

## Objetivo

Entregar a consulta e a rota que o front-end da Sprint 03 vai consumir: uma versão de
`estoque_movimentos` sem filtro de produto, paginada por cursor (D-07), com filtro opcional
por lista de tipos e por período (D-06), reaproveitando integralmente as convenções de
`src/estoque-db.js` (`listar`/`resumo`) e os gates já usados em `/api/estoque/movimentos`.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-02.1 | Consulta e rota | F-01.1 |

Detalhe da fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`npm run test:ci` verde incluindo os testes novos, e `npm run test:integracao` verde
exercitando a rota `GET /api/estoque/geral` contra o Postgres de testes.

## Riscos conhecidos

- Volume por linha pode ser maior que na gaveta de 1 produto: uma venda com N itens gera N
  linhas na tabela geral (`base/schema-e-consultas-estoque.md`). Mitigado pela paginação por
  cursor (D-07) — sem teto de dias, mas nunca uma resposta de tamanho ilimitado.
