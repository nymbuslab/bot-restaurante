---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: relatorios-telegram
sprint_id: sprint-02
atualizado_em: 2026-09-06
fases:
  - id: F-02.1
    titulo: Rotas admin-master de configuracao
    status: concluida
    criterio_saida: As tres rotas /api/admin/tenants/:slug/telegram* existem, protegidas por exigeSuperAdmin, com teste verde
    paralelizavel: true
    paralela_com: [F-02.2]
    tasks: [T-02.01, T-02.02, T-02.03]
  - id: F-02.2
    titulo: Job de resolucao de vinculo (polling)
    status: concluida
    criterio_saida: index.js roda o job de polling seguindo o padrao dos jobs existentes, com teste verde
    paralelizavel: true
    paralela_com: [F-02.1, F-02.3]
    tasks: [T-02.04]
  - id: F-02.3
    titulo: Prototipo visual (portao obrigatorio)
    status: concluida
    criterio_saida: Prototipo publicado com os quatro estados e aprovacao explicita do usuario
    paralelizavel: true
    paralela_com: [F-02.2]
    tasks: [T-02.05]
  - id: F-02.4
    titulo: UI da aba no admin-master
    status: concluida
    criterio_saida: Bloco Relatorios Telegram renderizado no modal do tenant, conforme prototipo aprovado
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.06]
---

# Fases — Sprint 02

```mermaid
%% Grafo de tasks — sprint-02 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_02_1["F-02.1 — Rotas admin-master"]
    T_02_01["T-02.01<br/>Rota GET status"]
    T_02_02["T-02.02<br/>Rota gerar codigo"]
    T_02_03["T-02.03<br/>Rota enviar teste"]
  end
  subgraph fase_02_2["F-02.2 — Job de polling"]
    T_02_04["T-02.04<br/>Job de resolucao"]
  end
  subgraph fase_02_3["F-02.3 — Prototipo visual"]
    T_02_05["T-02.05<br/>Prototipar aba"]
  end
  subgraph fase_02_4["F-02.4 — UI da aba"]
    T_02_06["T-02.06<br/>Implementar bloco UI"]
  end

  T_02_01 --> T_02_02
  T_02_01 --> T_02_03
  T_02_01 --> T_02_05
  T_02_02 --> T_02_06
  T_02_03 --> T_02_06
  T_02_05 --> T_02_06

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_02_01 concluida
  class T_02_02 concluida
  class T_02_03 concluida
  class T_02_04 concluida
  class T_02_05 concluida
  class T_02_06 concluida
  class T_02_01,T_02_02,T_02_06 critico
```

> `T-02.04` (job de polling) nao depende de nenhuma task desta sprint — so de sprint-01 — e por
> isso corre solto no diagrama, em paralelo com tudo. O caminho critico local
> (T-02.01→T-02.02→T-02.06) e um empate de tamanho com T-02.01→T-02.03→T-02.06 e
> T-02.01→T-02.05→T-02.06; marcamos a cadeia via T-02.02 por menor id de desempate na segunda
> posicao (regra do desempate: menor id no ultimo no antes do fim, aqui T-02.02 < T-02.03 < T-02.05
> ja empatam no comprimento, e T-02.02 vence por ordem alfabetica).

---

## F-02.1 — Rotas admin-master de configuração

**Objetivo:** Expor status, geração de código e envio de teste do Telegram de um tenant, tudo sob `exigeSuperAdmin`.

**Tasks que a compõem:** T-02.01, T-02.02, T-02.03

**Critério de saída:** As três rotas existem e respondem conforme os contratos definidos em `tasks.md`.

**Roda em paralelo com:** F-02.2

---

## F-02.2 — Job de resolução de vínculo (polling)

**Objetivo:** Resolver automaticamente o `chat_id` de um tenant quando o dono manda `/start <codigo>` no bot.

**Tasks que a compõem:** T-02.04

**Critério de saída:** O job roda a cada rodada de polling sem derrubar o processo em caso de falha de rede.

**Roda em paralelo com:** F-02.1, F-02.3

---

## F-02.3 — Protótipo visual (portão obrigatório)

**Objetivo:** Desenhar a aba antes de qualquer código de interface, com todos os estados de tela.

**Tasks que a compõem:** T-02.05

**Critério de saída:** Protótipo aprovado explicitamente pelo usuário.

**Roda em paralelo com:** F-02.2

---

## F-02.4 — UI da aba no admin-master

**Objetivo:** Implementar a aba de verdade em `app-admin.js`, seguindo o protótipo aprovado.

**Tasks que a compõem:** T-02.06

**Critério de saída:** Aba funcional no modal do tenant, chamando as três rotas de F-02.1.

**Roda em paralelo com:** nenhuma
