---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: comandas-abertas-mesas
sprint_id: sprint-03
atualizado_em: 2026-11-12
fases:
  - id: F-03.1
    titulo: Lista e navegacao
    status: concluido
    criterio_saida: Menu contador e cards aparecem conforme as permissoes do operador
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.01]
  - id: F-03.2
    titulo: Detalhe e fluxo completo
    status: concluido
    criterio_saida: Drawer executa acoes e PDV abre a comanda criada sem repetir o POST
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.02, T-03.03]
---

# Fases - Sprint 03

```mermaid
%% Grafo de tasks - sprint-03 - gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_03_1["F-03.1 - Lista e navegacao"]
    T_03_01["T-03.01<br/>Exibir comandas abertas"]
  end
  subgraph fase_03_2["F-03.2 - Detalhe e fluxo completo"]
    T_03_02["T-03.02<br/>Operar comanda no drawer"]
    T_03_03["T-03.03<br/>Abrir apos criar no PDV"]
  end
  T_03_01 --> T_03_02
  T_03_02 --> T_03_03

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico stroke-width:3px

  class T_03_01 concluida
  class T_03_02 concluida
  class T_03_03 concluida
  class T_03_01,T_03_02,T_03_03 critico
```

## F-03.1 - Lista e navegacao

**Objetivo:** Exibir comandas acima das mesas com contador e gates independentes.

**Tasks que a compoem:** T-03.01

**Criterio de saida:** Menu, contador e cards aparecem conforme as permissoes do operador.

**Roda em paralelo com:** nenhuma

## F-03.2 - Detalhe e fluxo completo

**Objetivo:** Operar a comanda e abrir o registro criado no PDV.

**Tasks que a compoem:** T-03.02, T-03.03

**Criterio de saida:** Drawer executa acoes e PDV abre a comanda criada sem repetir o POST.

**Roda em paralelo com:** nenhuma
