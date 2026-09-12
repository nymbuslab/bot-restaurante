---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: relatorios-telegram
sprint_id: sprint-01
atualizado_em: 2026-09-06
fases:
  - id: F-01.1
    titulo: Nucleo do canal Telegram
    status: concluida
    criterio_saida: src/telegram.js exporta enviar, gerarCodigoVinculacao, linkVinculacao, extrairCodigoDeUpdate, resolverVinculos, formatarMensagemFechamentoCaixa e formatarMensagemEstoqueBaixo, todos com teste verde
    paralelizavel: true
    paralela_com: [F-01.2]
    tasks: [T-01.01, T-01.02, T-01.03, T-01.04, T-01.05, T-01.06]
  - id: F-01.2
    titulo: Gate de plano e busca por codigo
    status: concluida
    criterio_saida: empresas.temRelatoriosTelegram e empresas.buscarPorCodigoVinculacaoTelegram existem, com teste verde stubando db.query
    paralelizavel: true
    paralela_com: [F-01.1]
    tasks: [T-01.07, T-01.08]
---

# Fases — Sprint 01

```mermaid
%% Grafo de tasks — sprint-01 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_01_1["F-01.1 — Nucleo do canal Telegram"]
    T_01_01["T-01.01<br/>Client de envio"]
    T_01_02["T-01.02<br/>Codigo e link de…"]
    T_01_03["T-01.03<br/>Parser do update…"]
    T_01_04["T-01.04<br/>Orquestrador de…"]
    T_01_05["T-01.05<br/>Formatador fechamento"]
    T_01_06["T-01.06<br/>Formatador estoque"]
  end
  subgraph fase_01_2["F-01.2 — Gate de plano e busca"]
    T_01_07["T-01.07<br/>Gate temRelatorios…"]
    T_01_08["T-01.08<br/>Busca por codigo"]
  end

  T_01_01 --> T_01_02
  T_01_02 --> T_01_03
  T_01_03 --> T_01_04
  T_01_04 --> T_01_05
  T_01_05 --> T_01_06
  T_01_07 --> T_01_08

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_01_01 concluida
  class T_01_02 concluida
  class T_01_03 concluida
  class T_01_04 concluida
  class T_01_05 concluida
  class T_01_06 concluida
  class T_01_07 concluida
  class T_01_08 concluida
  class T_01_01,T_01_02,T_01_03,T_01_04,T_01_05,T_01_06 critico
```

> O caminho critico desta sprint e a cadeia F-01.1 (seis tasks em serie); F-01.2 (duas tasks)
> termina bem antes e roda em paralelo, sem apertar o calendario da sprint.

---

## F-01.1 — Nucleo do canal Telegram

**Objetivo:** Construir src/telegram.js com todas as funcoes puras do canal (envio, codigo de vinculacao, parsing de update, orquestracao de vinculo, formatacao das duas mensagens).

**Tasks que a compõem:** T-01.01, T-01.02, T-01.03, T-01.04, T-01.05, T-01.06

**Critério de saída:** As seis funcoes existem em src/telegram.js e a suite cobre cada uma sem tocar rede real.

**Roda em paralelo com:** F-01.2

---

## F-01.2 — Gate de plano e busca por codigo

**Objetivo:** Estender src/empresas.js com o gate temRelatoriosTelegram e a busca de tenant por codigo de vinculacao.

**Tasks que a compõem:** T-01.07, T-01.08

**Critério de saída:** As duas funcoes existem em src/empresas.js e a suite cobre cada uma stubando db.query.

**Roda em paralelo com:** F-01.1
