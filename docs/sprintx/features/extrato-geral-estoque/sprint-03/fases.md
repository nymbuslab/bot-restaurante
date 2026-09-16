---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: extrato-geral-estoque
sprint_id: sprint-03
atualizado_em: 2026-09-16
fases:
  - id: F-03.1
    titulo: Scaffold da aba e navegacao
    status: nao_iniciado
    criterio_saida: Item de menu Relatorios existe, com bloqueio de plano identico ao de Controle de estoque
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.01, T-03.02]
  - id: F-03.2
    titulo: Extrato geral - lista, filtros, paginacao
    status: nao_iniciado
    criterio_saida: Lista carrega, filtra por tipo e periodo, e pagina por cursor sem repetir nem pular linha
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.03, T-03.04]
---

```mermaid
%% Grafo de tasks — sprint-03 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_03_1["F-03.1 — Scaffold da aba e navegacao"]
    T_03_01["T-03.01<br/>Item de menu e secao…"]
    T_03_02["T-03.02<br/>Montagem da query…"]
  end
  subgraph fase_03_2["F-03.2 — Extrato geral"]
    T_03_03["T-03.03<br/>Carregamento e lista…"]
    T_03_04["T-03.04<br/>Chips de filtro tipo…"]
  end

  T_03_01 --> T_03_03
  T_03_02 --> T_03_03
  T_03_03 --> T_03_04

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_03_01 pendente
  class T_03_02 pendente
  class T_03_03 pendente
  class T_03_04 pendente
  class T_03_01,T_03_03,T_03_04 critico
```

> `T-03.01` e `T-03.02` também dependem de `T-01.01` (Sprint 01) e não aparecem aqui por
> serem de outra sprint — não é aresta omitida por engano. `T-03.03` também depende de
> `T-02.02` (Sprint 02), pelo mesmo motivo.

---

## F-03.1 — Scaffold da aba e navegação

**Objetivo:** Criar o item de menu "Relatórios" e a seção da tela, com o mesmo padrão de
bloqueio de Plano Completo já usado em Controle de estoque (D-09), e a função pura que monta
a query string dos filtros.

**Tasks que a compõem:** T-03.01, T-03.02

**Critério de saída:** Item de menu existe, seção renderiza o estado de bloqueio quando sem
Plano Completo, e a função de montagem de query tem cobertura de teste.

**Roda em paralelo com:** nenhuma

---

## F-03.2 — Extrato geral: lista, filtros, paginação

**Objetivo:** Carregar e renderizar a lista de movimentos com paginação por cursor, e ligar os
filtros de tipo (multi-seleção) e período (presets + customizado) ao carregamento.

**Tasks que a compõem:** T-03.03, T-03.04

**Critério de saída:** Lista carrega, "Carregar mais" nunca repete/pula linha, filtros
recarregam a lista do zero ao mudar.

**Roda em paralelo com:** nenhuma
