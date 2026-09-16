---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: extrato-geral-estoque
sprint_id: sprint-02
atualizado_em: 2026-09-16
fases:
  - id: F-02.1
    titulo: Consulta e rota
    status: nao_iniciado
    criterio_saida: Rota GET /api/estoque/geral devolve movimentos paginados, com suite verde
    paralelizavel: true
    paralela_com: [F-01.1]
    tasks: [T-02.01, T-02.02]
---

```mermaid
%% Grafo de tasks — sprint-02 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_02_1["F-02.1 — Consulta e rota"]
    T_02_01["T-02.01<br/>listarGeral em…"]
    T_02_02["T-02.02<br/>Rota GET /api/estoque/…"]
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

## F-02.1 — Consulta e rota

**Objetivo:** Criar a função de consulta geral em `src/estoque-db.js` e a rota HTTP que a
expõe, com os mesmos gates de plano/permissão da rota de produto único.

**Tasks que a compõem:** T-02.01, T-02.02

**Critério de saída:** Rota `GET /api/estoque/geral` devolve movimentos de todos os produtos,
paginados por cursor, filtráveis por `tipos` (lista) e `desde`/`ate` (opcionais); suíte verde.

**Roda em paralelo com:** F-01.1 (esta fase não toca UI, não depende do protótipo aprovado)
