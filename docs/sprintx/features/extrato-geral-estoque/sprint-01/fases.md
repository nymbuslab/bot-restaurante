---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: extrato-geral-estoque
sprint_id: sprint-01
atualizado_em: 2026-09-16
fases:
  - id: F-01.1
    titulo: Prototipo e aprovacao
    status: nao_iniciado
    criterio_saida: Aprovacao explicita do dono registrada, protótipo semeado com os tokens de style.css
    paralelizavel: true
    paralela_com: [F-02.1]
    tasks: [T-01.01]
---

```mermaid
%% Grafo de tasks — sprint-01 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_01_1["F-01.1 — Prototipo e aprovacao"]
    T_01_01["T-01.01<br/>Prototipo Stitch da aba…"]
  end

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_01_01 pendente
  class T_01_01 critico
```

> Sprint com uma task só: ela sozinha é o caminho crítico da sprint.

---

## F-01.1 — Protótipo e aprovação

**Objetivo:** Gerar o protótipo da aba "Relatórios" (com o extrato geral de estoque como
conteúdo) via Google Stitch, semeado com os tokens reais de `public/style.css`, e obter
aprovação explícita do dono antes de qualquer task de UI das sprints seguintes.

**Tasks que a compõem:** T-01.01

**Critério de saída:** Aprovação explícita do dono registrada (prosa) na task, protótipo
reaproveita o design system já semeado no projeto (`assets/6506830711685967852`, "Nymbus
Pedidos", per `CLAUDE.md`).

**Roda em paralelo com:** F-02.1 (backend não toca UI, não depende do protótipo aprovado)
