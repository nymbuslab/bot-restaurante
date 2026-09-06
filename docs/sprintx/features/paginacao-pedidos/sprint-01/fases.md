---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: paginacao-pedidos
sprint_id: sprint-01
atualizado_em: 2026-09-06
fases:
  - id: F-01.1
    titulo: modulo de contagem de pedidos visiveis
    status: concluida
    criterio_saida: node --test test/paginacao-pedidos.test.js termina com 0 failed
    paralelizavel: false
    paralela_com: []
    tasks: [T-01.01]
---

# Fases — Sprint 01

```mermaid
%% Grafo de tasks — sprint-01 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_01_1["F-01.1 — Modulo de contagem de pedidos visiveis"]
    T_01_01["T-01.01<br/>Criar modulo de contagem"]
  end

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_01_01 pendente
  class T_01_01 critico
```

---

## F-01.1 — Módulo de contagem de pedidos visíveis

**Objetivo:** Criar o arquivo dual-mode com a conta pura de quantos pedidos mostrar, testável com `node:test`.

**Tasks que a compõem:** T-01.01

**Critério de saída:** `node --test test/paginacao-pedidos.test.js` termina com 0 failed.

**Roda em paralelo com:** nenhuma
