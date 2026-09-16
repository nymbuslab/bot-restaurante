---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: estoque-e-custos
sprint_id: sprint-04
titulo: Cadastros e financeiro-base
status: concluido
criterio_saida: Produtos, variacoes, fornecedores e contas possuem identidade relacional isolada e extrato imutavel.
fases: [F-04.1, F-04.2]
riscos: ["O catalogo JSONB continua sendo fonte do produto (base/01-CATALOGO-E-IDENTIDADE.md)."]
atualizado_em: 2026-09-16
---

# Sprint 04 — Cadastros e financeiro-base

## Objetivo

Entregar registro-ponte, fornecedores, identificadores e contas financeiras sem confirmar compras.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-04.1 | Alvos e fornecedores | F-04.2 |
| F-04.2 | Contas e razão | F-04.1 |

Detalhe em `fases.md`; tasks em `tasks.md`.

## Critério de saída

Produtos, variações, fornecedores e contas possuem identidade relacional isolada e extrato imutável.

## Riscos conhecidos

- O catálogo JSONB continua sendo fonte do produto (`base/01-CATALOGO-E-IDENTIDADE.md`).
