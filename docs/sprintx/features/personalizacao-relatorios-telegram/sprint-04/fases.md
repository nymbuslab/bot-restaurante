---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-04
atualizado_em: 2026-09-07
fases:
  - id: F-04.1
    titulo: Validar fechamento, estoque e toggles
    status: concluida
    criterio_saida: Mensagens reais confirmadas, toggle desligado realmente impede envio
    paralelizavel: true
    paralela_com: [F-04.2]
    tasks: [T-04.01]
  - id: F-04.2
    titulo: Validar alerta de cancelamento com margem
    status: concluida
    criterio_saida: Alerta respeita a margem em cancelamento e estorno, confirmado real
    paralelizavel: true
    paralela_com: [F-04.1]
    tasks: [T-04.02]
---

# Fases — Sprint 04

```mermaid
%% Grafo de tasks — sprint-04 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_04_1["F-04.1 — Fechamento/estoque/toggles"]
    T_04_01["T-04.01<br/>Validar fechamento+estoque"]
  end
  subgraph fase_04_2["F-04.2 — Alerta de cancelamento"]
    T_04_02["T-04.02<br/>Validar margem"]
  end

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_04_01 pendente
  class T_04_02 pendente
  class T_04_01,T_04_02 critico
```

> As duas tasks não dependem uma da outra DENTRO desta sprint (as dependências reais apontam
> para sprint-02/03) — soltas no diagrama, mas ambas fecham a mesma Definição de Pronto (D-10).

---

## F-04.1 — Validar fechamento, estoque e toggles

**Objetivo:** Fechar a parte de fechamento/estoque/toggles da Definição de Pronto.

**Tasks que a compõem:** T-04.01

**Critério de saída:** Mensagens reais confirmadas.

**Roda em paralelo com:** F-04.2

---

## F-04.2 — Validar alerta de cancelamento com margem

**Objetivo:** Fechar a parte de cancelamento da Definição de Pronto.

**Tasks que a compõem:** T-04.02

**Critério de saída:** Margem respeitada, confirmado real.

**Roda em paralelo com:** F-04.1
