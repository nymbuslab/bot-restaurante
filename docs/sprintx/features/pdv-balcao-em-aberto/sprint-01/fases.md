---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-01
atualizado_em: 2026-09-10
fases:
  - id: F-01.1
    titulo: Fixture de teste da feature
    status: nao_iniciado
    criterio_saida: test/integracao/pedidos-comanda.test.js existe e roda com pelo menos 1 teste verde
    paralelizavel: false
    paralela_com: []
    tasks: [T-01.01]
---

# Fases — Sprint 01

```mermaid
%% Grafo de tasks — sprint-01 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_01_1["F-01.1 — Fixture de teste da feature"]
    T_01_01["T-01.01<br/>Fixture de teste da…"]
  end

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_01_01 pendente
  class T_01_01 critico
```

> Caminho crítico: T-01.01 (única task da sprint).

---

## F-01.1 — Fixture de teste da feature

**Objetivo:** Preparar a empresa/cardápio/caixa de teste que as demais sprints da feature vão reusar.

**Tasks que a compõem:** T-01.01

**Critério de saída:** `test/integracao/pedidos-comanda.test.js` existe e roda com pelo menos 1 teste verde.

**Roda em paralelo com:** nenhuma
