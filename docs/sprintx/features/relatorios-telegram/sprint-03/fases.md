---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: relatorios-telegram
sprint_id: sprint-03
atualizado_em: 2026-09-06
fases:
  - id: F-03.1
    titulo: Hook de envio no fechamento de caixa
    status: concluida
    criterio_saida: fecharCaixa dispara as duas mensagens quando plano completo + chatId presentes, teste verde
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.01]
  - id: F-03.2
    titulo: Registro do status do ultimo envio
    status: concluida
    criterio_saida: config.telegram.ultimoEnvio reflete sucesso/falha da ultima tentativa, teste verde
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.02]
  - id: F-03.3
    titulo: Validacao ponta a ponta (Telegram real)
    status: concluida
    criterio_saida: Roteiro manual executado com sucesso, mensagens reais confirmadas
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.03]
---

# Fases — Sprint 03

```mermaid
%% Grafo de tasks — sprint-03 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_03_1["F-03.1 — Hook de envio"]
    T_03_01["T-03.01<br/>Disparar mensagens…"]
  end
  subgraph fase_03_2["F-03.2 — Status do envio"]
    T_03_02["T-03.02<br/>Persistir status"]
  end
  subgraph fase_03_3["F-03.3 — Validacao real"]
    T_03_03["T-03.03<br/>Validar fluxo real"]
  end

  T_03_01 --> T_03_02
  T_03_02 --> T_03_03

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_03_01 concluida
  class T_03_02 concluida
  class T_03_03 concluida
  class T_03_01,T_03_02,T_03_03 critico
```

> Sprint inteira e uma cadeia unica (sem paralelismo) — a informacao "nao ha nada em paralelo
> aqui" e o proprio resultado, e o caminho critico e a sprint inteira.

---

## F-03.1 — Hook de envio no fechamento de caixa

**Objetivo:** Disparar as duas mensagens no momento em que o caixa fecha, gated por plano e vínculo.

**Tasks que a compõem:** T-03.01

**Critério de saída:** `fecharCaixa` chama `telegram.enviar` duas vezes quando as condições batem, zero vezes quando não.

**Roda em paralelo com:** nenhuma

---

## F-03.2 — Registro do status do último envio

**Objetivo:** Persistir sucesso/falha do envio para o admin-master exibir.

**Tasks que a compõem:** T-03.02

**Critério de saída:** `config.telegram.ultimoEnvio` reflete o resultado real.

**Roda em paralelo com:** nenhuma

---

## F-03.3 — Validação ponta a ponta (Telegram real)

**Objetivo:** Fechar a Definição de Pronto (D-13) com um teste real, não só suíte automatizada.

**Tasks que a compõem:** T-03.03

**Critério de saída:** Mensagens reais confirmadas no Telegram do dono de teste.

**Roda em paralelo com:** nenhuma
