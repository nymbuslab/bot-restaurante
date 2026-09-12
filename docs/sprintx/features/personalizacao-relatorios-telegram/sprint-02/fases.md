---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-02
atualizado_em: 2026-09-07
fases:
  - id: F-02.1
    titulo: Rota GET estendida
    status: nao_iniciado
    criterio_saida: GET .../telegram devolve tipos e ultimoEnvio por tipo, com teste verde
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.01]
  - id: F-02.2
    titulo: Rota de salvar tipos e margem
    status: nao_iniciado
    criterio_saida: POST .../telegram/tipos grava preservando o resto do config, teste verde
    paralelizavel: true
    paralela_com: [F-02.3]
    tasks: [T-02.02]
  - id: F-02.3
    titulo: Prototipo visual (portao obrigatorio)
    status: nao_iniciado
    criterio_saida: Prototipo publicado com as duas abas, aprovacao explicita do usuario
    paralelizavel: true
    paralela_com: [F-02.2]
    tasks: [T-02.03]
  - id: F-02.4
    titulo: Implementar abas e checkboxes
    status: nao_iniciado
    criterio_saida: Duas abas funcionais no modal, checkboxes e margem salvando de verdade
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.04, T-02.05]
---

# Fases — Sprint 02

```mermaid
%% Grafo de tasks — sprint-02 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_02_1["F-02.1 — Rota GET estendida"]
    T_02_01["T-02.01<br/>GET com tipos"]
  end
  subgraph fase_02_2["F-02.2 — Rota de salvar"]
    T_02_02["T-02.02<br/>POST tipos"]
  end
  subgraph fase_02_3["F-02.3 — Prototipo visual"]
    T_02_03["T-02.03<br/>Prototipar abas"]
  end
  subgraph fase_02_4["F-02.4 — Abas e checkboxes"]
    T_02_04["T-02.04<br/>Reestruturar abas"]
    T_02_05["T-02.05<br/>Checkboxes+margem"]
  end

  T_02_01 --> T_02_02
  T_02_01 --> T_02_03
  T_02_03 --> T_02_04
  T_02_02 --> T_02_05
  T_02_04 --> T_02_05

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_02_01 pendente
  class T_02_02 pendente
  class T_02_03 pendente
  class T_02_04 pendente
  class T_02_05 pendente
  class T_02_01,T_02_03,T_02_04,T_02_05 critico
```

> `T-02.02` corre em paralelo com `T-02.03` (ambas só dependem de `T-02.01`, sem depender uma da
> outra). O caminho crítico é T-02.01→T-02.03→T-02.04→T-02.05 (4 tasks) — a mesma extensão de
> T-02.01→T-02.02→T-02.05, mas passar pelo protótipo/abas é o que trava a UI, então essa é a
> cadeia real.

---

## F-02.1 — Rota GET estendida

**Objetivo:** Base de dados que a UI (T-02.03 em diante) e a rota de salvar (T-02.02) precisam.

**Tasks que a compõem:** T-02.01

**Critério de saída:** GET reflete `tiposAtivos` e `ultimoEnvio` por tipo.

**Roda em paralelo com:** nenhuma

---

## F-02.2 — Rota de salvar tipos e margem

**Objetivo:** Persistir a escolha do operador sem apagar o resto do config do tenant.

**Tasks que a compõem:** T-02.02

**Critério de saída:** POST grava e preserva, com teste de fixture "tenant frio".

**Roda em paralelo com:** F-02.3

---

## F-02.3 — Protótipo visual (portão obrigatório)

**Objetivo:** Desenhar as duas abas antes de qualquer código de interface.

**Tasks que a compõem:** T-02.03

**Critério de saída:** Protótipo aprovado explicitamente.

**Roda em paralelo com:** F-02.2

---

## F-02.4 — Implementar abas e checkboxes

**Objetivo:** Levar o protótipo aprovado a código de verdade, ligado às rotas de F-02.1/F-02.2.

**Tasks que a compõem:** T-02.04, T-02.05

**Critério de saída:** Abas alternam corretamente; checkboxes e margem salvam e refletem o status por tipo.

**Roda em paralelo com:** nenhuma
