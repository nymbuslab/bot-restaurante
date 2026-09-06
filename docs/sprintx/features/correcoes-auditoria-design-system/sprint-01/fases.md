---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: correcoes-auditoria-design-system
sprint_id: sprint-01
atualizado_em: 2026-09-05
fases:
  - id: F-01.1
    titulo: Harness de teste estatico
    status: concluida
    criterio_saida: node --test test/arquivo-estatico.test.js termina com 0 failed
    paralelizavel: false
    paralela_com: []
    tasks: [T-01.01]
---

# Fases — Sprint 01

```mermaid
%% Grafo de tasks — sprint-01 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_01_1["F-01.1 — Harness de teste estatico"]
    T_01_01["T-01.01<br/>Helpers contemTrecho..."]
  end

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_01_01 concluida
  class T_01_01 critico
```

---

## F-01.1 — Harness de teste estático

**Objetivo:** Criar os helpers `contemTrecho` e `trechoEntre` que os testes das 12 tasks da
sprint-02 vão usar
para confirmar presença de atributo/valor no arquivo-fonte.

**Tasks que a compõem:** T-01.01

**Critério de saída:** `node --test test/arquivo-estatico.test.js` termina com 0 failed.

**Roda em paralelo com:** nenhuma
