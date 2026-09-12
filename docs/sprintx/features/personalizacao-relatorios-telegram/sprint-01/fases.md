---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-01
atualizado_em: 2026-09-07
fases:
  - id: F-01.1
    titulo: Extrair formula de estado do caixa
    status: concluida
    criterio_saida: estadoCaixa exportado de public/relatorio-caixa.js, testes antigos continuam verdes
    paralelizavel: true
    paralela_com: [F-01.2, F-01.3]
    tasks: [T-01.01]
  - id: F-01.2
    titulo: Novos calculos puros (caixa-calc.js)
    status: concluida
    criterio_saida: contagemPorForma e diferencaPorForma existem e tem teste verde
    paralelizavel: true
    paralela_com: [F-01.1, F-01.3]
    tasks: [T-01.02, T-01.03]
  - id: F-01.3
    titulo: Helper de configuracao de tipos
    status: concluida
    criterio_saida: telegram.tiposAtivos existe com defaults corretos, teste verde
    paralelizavel: true
    paralela_com: [F-01.1, F-01.2]
    tasks: [T-01.04]
  - id: F-01.4
    titulo: Formatadores de mensagem reformulados
    status: concluida
    criterio_saida: os tres formatadores (fechamento, estoque, cancelamento) existem e tem teste verde
    paralelizavel: false
    paralela_com: []
    tasks: [T-01.05, T-01.06, T-01.07]
---

# Fases — Sprint 01

```mermaid
%% Grafo de tasks — sprint-01 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_01_1["F-01.1 — Extrair estado do caixa"]
    T_01_01["T-01.01<br/>Extrair estadoCaixa"]
  end
  subgraph fase_01_2["F-01.2 — Calculos puros novos"]
    T_01_02["T-01.02<br/>Contagem por forma"]
    T_01_03["T-01.03<br/>Diferenca por forma"]
  end
  subgraph fase_01_3["F-01.3 — Helper de tipos"]
    T_01_04["T-01.04<br/>tiposAtivos"]
  end
  subgraph fase_01_4["F-01.4 — Formatadores novos"]
    T_01_05["T-01.05<br/>Fechamento detalhado"]
    T_01_06["T-01.06<br/>Estoque em 2 secoes"]
    T_01_07["T-01.07<br/>Alerta cancelamento"]
  end

  T_01_02 --> T_01_03
  T_01_01 --> T_01_05
  T_01_02 --> T_01_05
  T_01_03 --> T_01_05
  T_01_05 --> T_01_06
  T_01_06 --> T_01_07

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_01_01 pendente
  class T_01_02 pendente
  class T_01_03 pendente
  class T_01_04 pendente
  class T_01_05 pendente
  class T_01_06 pendente
  class T_01_07 pendente
  class T_01_02,T_01_03,T_01_05,T_01_06,T_01_07 critico
```

> Caminho crítico: T-01.02→T-01.03→T-01.05→T-01.06→T-01.07 (5 tasks). F-01.1 e F-01.3 terminam
> bem antes e não apertam o calendário.

---

## F-01.1 — Extrair fórmula de estado do caixa

**Objetivo:** Tirar a lógica de CONFERIDO/SOBROU/FALTOU do meio de `montarRelatorioFechamento` e torná-la reutilizável.

**Tasks que a compõem:** T-01.01

**Critério de saída:** `estadoCaixa` exportado, cupom físico produz exatamente o mesmo texto de antes.

**Roda em paralelo com:** F-01.2, F-01.3

---

## F-01.2 — Novos cálculos puros (caixa-calc.js)

**Objetivo:** Fechar as duas lacunas de dado que faltavam (quantidade por forma, diferença por forma).

**Tasks que a compõem:** T-01.02, T-01.03

**Critério de saída:** As duas funções existem, com teste cobrindo caso vazio e caso normal.

**Roda em paralelo com:** F-01.1, F-01.3

---

## F-01.3 — Helper de configuração de tipos

**Objetivo:** Ponto único de leitura de `config.telegram.tipos`, com os defaults certos.

**Tasks que a compõem:** T-01.04

**Critério de saída:** `tiposAtivos` nunca lança e aplica os defaults de D-03.

**Roda em paralelo com:** F-01.1, F-01.2

---

## F-01.4 — Formatadores de mensagem reformulados

**Objetivo:** Os três formatadores (fechamento, estoque, cancelamento) prontos para os hooks de negócio da sprint 03.

**Tasks que a compõem:** T-01.05, T-01.06, T-01.07

**Critério de saída:** Os três existem, testados, sem chamada de rede.

**Roda em paralelo com:** nenhuma
