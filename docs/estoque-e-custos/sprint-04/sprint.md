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
