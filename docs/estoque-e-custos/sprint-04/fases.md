---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: estoque-e-custos
atualizado_em: 2026-09-16
fases:
  - id: F-04.1
    titulo: Alvos e fornecedores
    status: concluido
    criterio_saida: Exclusao ou renomeacao no catalogo nao apaga historico do alvo.
    paralelizavel: true
    paralela_com: F-04.2
    tasks: [T-04.01, T-04.02]
  - id: F-04.2
    titulo: Contas e razao
    status: concluido
    criterio_saida: Cada transferencia fecha em zero entre origem e destino.
    paralelizavel: true
    paralela_com: F-04.1
    tasks: [T-04.03, T-04.04]
---

# Fases — Sprint 04

## F-04.1 — Alvos e fornecedores
**Objetivo:** sincronizar alvos e cadastrar fornecedores e vínculos.
**Tasks que a compõem:** T-04.01, T-04.02
**Critério de saída:** exclusão ou renomeação no catálogo não apaga histórico do alvo.
**Roda em paralelo com:** F-04.2
**Status:** concluído em 2026-09-16.

## F-04.2 — Contas e razão
**Objetivo:** criar contas, implantação e transferências em razão imutável.
**Tasks que a compõem:** T-04.03, T-04.04
**Critério de saída:** cada transferência fecha em zero entre origem e destino.
**Roda em paralelo com:** F-04.1
**Status:** concluído em 2026-09-16.
