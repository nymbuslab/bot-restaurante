---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: paginacao-pedidos
sprint_id: sprint-02
atualizado_em: 2026-09-06
fases:
  - id: F-02.1
    titulo: estado e render usam contagem visivel em vez de pagina numerada
    status: concluida
    criterio_saida: npm test termina com 0 failed e npm run check sem erro de sintaxe
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.01, T-02.02]
---

# Fases — Sprint 02

```mermaid
%% Grafo de tasks — sprint-02 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_02_1["F-02.1 — Estado e render usam contagem visivel"]
    T_02_01["T-02.01<br/>Trocar pagina por…"]
    T_02_02["T-02.02<br/>Botao carregar mais"]
  end

  T_02_01 --> T_02_02

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_02_01 pendente
  class T_02_02 pendente
  class T_02_01,T_02_02 critico
```

---

## F-02.1 — Estado e render usam contagem visível em vez de página numerada

**Objetivo:** Trocar o mecanismo de paginação numerada por uma contagem visível crescente, com um único botão "Carregar mais".

**Tasks que a compõem:** T-02.01, T-02.02

**Critério de saída:** `npm test` termina com 0 failed e `npm run check` sem erro de sintaxe.

**Roda em paralelo com:** nenhuma
