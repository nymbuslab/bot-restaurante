---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: comandas-abertas-mesas
sprint_id: sprint-02
atualizado_em: 2026-11-12
fases:
  - id: F-02.1
    titulo: Consulta operacional
    status: bloqueado
    criterio_saida: Lista e detalhe retornam somente comandas abertas mais antigas primeiro
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.01]
  - id: F-02.2
    titulo: Acoes da comanda
    status: bloqueado
    criterio_saida: Acrescimo respeita caixa e pre-conta nao reimprime cozinha
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.02, T-02.03]
---

# Fases - Sprint 02

```mermaid
%% Grafo de tasks - sprint-02 - gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_02_1["F-02.1 - Consulta operacional"]
    T_02_01["T-02.01<br/>Listar e detalhar comandas"]
  end
  subgraph fase_02_2["F-02.2 - Acoes da comanda"]
    T_02_02["T-02.02<br/>Acrescentar itens"]
    T_02_03["T-02.03<br/>Imprimir pre-conta"]
  end
  T_02_01 --> T_02_02
  T_02_02 --> T_02_03

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico stroke-width:3px

  class T_02_01 bloqueada
  class T_02_02 bloqueada
  class T_02_03 bloqueada
  class T_02_01,T_02_02,T_02_03 critico
```

## F-02.1 - Consulta operacional

**Objetivo:** Consultar comandas abertas sem herdar o filtro Hoje.

**Tasks que a compoem:** T-02.01

**Criterio de saida:** Lista e detalhe retornam somente comandas abertas, mais antigas primeiro.

**Roda em paralelo com:** nenhuma

## F-02.2 - Acoes da comanda

**Objetivo:** Acrescentar itens e imprimir pre-conta com os gates operacionais definidos.

**Tasks que a compoem:** T-02.02, T-02.03

**Criterio de saida:** Acrescimo respeita caixa e pre-conta nao reimprime cozinha.

**Roda em paralelo com:** nenhuma
