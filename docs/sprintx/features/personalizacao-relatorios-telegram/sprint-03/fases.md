---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-03
atualizado_em: 2026-09-07
fases:
  - id: F-03.1
    titulo: Disparo do alerta em cancelarRecebido
    status: nao_iniciado
    criterio_saida: cancelarRecebido dispara o alerta so quando plano+toggle+margem batem, teste verde
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.01]
  - id: F-03.2
    titulo: Disparo do alerta em estornarRecebimento
    status: nao_iniciado
    criterio_saida: estornarRecebimento dispara o mesmo alerta, teste verde
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.02]
  - id: F-03.3
    titulo: Fechamento e estoque respeitam seus toggles
    status: nao_iniciado
    criterio_saida: cada tipo (fechamento/estoque) e independente, ultimoEnvio por tipo, teste verde
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.03]
---

# Fases — Sprint 03

```mermaid
%% Grafo de tasks — sprint-03 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_03_1["F-03.1 — Cancelar pedido pago"]
    T_03_01["T-03.01<br/>Alerta cancelarRecebido"]
  end
  subgraph fase_03_2["F-03.2 — Estornar recebimento"]
    T_03_02["T-03.02<br/>Alerta estornar"]
  end
  subgraph fase_03_3["F-03.3 — Toggles fechamento/estoque"]
    T_03_03["T-03.03<br/>Respeita toggles"]
  end

  T_03_01 --> T_03_02

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_03_01 pendente
  class T_03_02 pendente
  class T_03_03 pendente
  class T_03_01,T_03_02 critico
```

> `T-03.03` não depende de `T-03.01`/`T-03.02` dentro desta sprint (suas dependências reais são
> de sprint-01) — corre solto no diagrama, mas na prática dois testes tocam o mesmo arquivo
> (`src/caixa.js`), então a ordem de execução real é sequencial (a fase não declara paralelismo).
> Caminho crítico local: T-03.01→T-03.02 (2 tasks).

---

## F-03.1 — Disparo do alerta em cancelarRecebido

**Objetivo:** Primeiro dos dois pontos de cancelamento em escopo (D-06).

**Tasks que a compõem:** T-03.01

**Critério de saída:** Alerta dispara só quando plano, toggle e margem permitem.

**Roda em paralelo com:** nenhuma

---

## F-03.2 — Disparo do alerta em estornarRecebimento

**Objetivo:** Segundo ponto de cancelamento em escopo (D-06), mesma regra.

**Tasks que a compõem:** T-03.02

**Critério de saída:** Alerta dispara com a mesma regra de T-03.01.

**Roda em paralelo com:** nenhuma

---

## F-03.3 — Fechamento e estoque respeitam seus toggles

**Objetivo:** Fechar a integração dos dois tipos já existentes com o sistema de toggles.

**Tasks que a compõem:** T-03.03

**Critério de saída:** Cada tipo independente; `ultimoEnvio` por tipo.

**Roda em paralelo com:** nenhuma
