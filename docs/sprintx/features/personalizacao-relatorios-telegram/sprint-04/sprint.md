---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-04
titulo: Validacao ponta a ponta com Telegram real
status: concluida
criterio_saida: Fechamento detalhado, estoque em duas secoes, checkboxes e alerta de cancelamento com margem, todos confirmados com Telegram real (D-10)
fases: [F-04.1, F-04.2]
riscos: [Depende de um tenant Plano Completo com Telegram ja vinculado - reaproveitar nymbus-teste da feature anterior]
atualizado_em: 2026-09-08
---

# Sprint 04 — Validação ponta a ponta com Telegram real

## Objetivo

Fechar a Definição de Pronto (D-10): confirmar com Telegram de verdade que os checkboxes
funcionam, o fechamento de caixa chega detalhado, o estoque chega em duas seções e o alerta de
cancelamento respeita a margem configurada — tanto para cancelamento quanto para estorno.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-04.1 | Validar fechamento, estoque e toggles | F-04.2 |
| F-04.2 | Validar alerta de cancelamento com margem | F-04.1 |

## Critério de saída

As duas tasks manuais confirmadas com mensagens reais chegando no Telegram do tenant de teste.

## Riscos conhecidos

Reaproveita o tenant `nymbus-teste` e o vínculo já resolvido pela feature `relatorios-telegram`
— sem pré-requisito ambiental novo (bot e secrets já existem em produção).
