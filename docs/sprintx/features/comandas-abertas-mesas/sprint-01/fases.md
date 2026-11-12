---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: comandas-abertas-mesas
sprint_id: sprint-01
atualizado_em: 2026-11-12
fases:
  - id: F-01.1
    titulo: Fixtures de comanda
    status: concluido
    criterio_saida: Fixture cobre aberta caixa fechado e permissoes separadas
    paralelizavel: false
    paralela_com: []
    tasks: [T-01.01]
---

# Fases - Sprint 01

```mermaid
%% Grafo de tasks - sprint-01 - gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_01_1["F-01.1 - Fixtures de comanda"]
    T_01_01["T-01.01<br/>Criar fixtures de comanda"]
  end

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico stroke-width:3px

  class T_01_01 concluida
  class T_01_01 critico
```

## F-01.1 - Fixtures de comanda

**Objetivo:** Disponibilizar dados de teste coerentes para API e interface.

**Tasks que a compoem:** T-01.01

**Criterio de saida:** Fixture cobre aberta, caixa fechado e permissoes separadas.

**Roda em paralelo com:** nenhuma
