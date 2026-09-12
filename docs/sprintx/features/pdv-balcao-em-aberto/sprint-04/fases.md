---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-04
atualizado_em: 2026-09-10
fases:
  - id: F-04.1
    titulo: Aviso ao cancelar item de cozinha
    status: nao_iniciado
    criterio_saida: Cancelar item cozinha:true dispara um segundo aviso especifico, alem do confirmarComOpcao que ja existe hoje; item sem cozinha:true fica igual ao comportamento atual
    paralelizavel: false
    paralela_com: [F-04.2]
    tasks: [T-04.01]
  - id: F-04.2
    titulo: Fechamento via Receber pagamento sem mudanca de codigo
    status: nao_iniciado
    criterio_saida: Pedido Comanda fecha por POST /api/caixa/receber/:id sem nenhuma alteracao em src/caixa.js ou src/servidor.js
    paralelizavel: true
    paralela_com: [F-04.1]
    tasks: [T-04.02]
  - id: F-04.3
    titulo: Fim a fim - Comanda com duas rodadas
    status: nao_iniciado
    criterio_saida: Teste fim a fim de 2 rodadas + cancelamento + fechamento passa, com total e via de cozinha corretos
    paralelizavel: false
    paralela_com: []
    tasks: [T-04.03]
---

# Fases — Sprint 04

```mermaid
%% Grafo de tasks — sprint-04 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_04_1["F-04.1 — Aviso ao cancelar item"]
    T_04_01["T-04.01<br/>Segundo aviso ao…"]
  end
  subgraph fase_04_2["F-04.2 — Fechamento sem mudanca"]
    T_04_02["T-04.02<br/>Fechamento de Comanda…"]
  end
  subgraph fase_04_3["F-04.3 — Fim a fim"]
    T_04_03["T-04.03<br/>Fim a fim - duas rodadas"]
  end

  T_04_02 --> T_04_03

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_04_01 pendente
  class T_04_02 pendente
  class T_04_03 pendente
  class T_04_02,T_04_03 critico
```

> Caminho crítico DESTA sprint: T-04.02 → T-04.03 (2 tasks; T-04.03 também depende de T-02.03, da sprint-02). **Correção da F5**: T-04.01 agora depende de T-03.03 (sprint-03) porque ambas alteram `public/app.js` — essa aresta é cross-sprint e não aparece no diagrama desta sprint (só nas fases/tasks daqui), mas torna T-04.01 mais longa que o resto da sprint no caminho crítico do FEATURE inteiro (ver `ORQUESTRADOR.md`).

---

## F-04.1 — Aviso ao cancelar item de cozinha

**Objetivo:** Adicionar um segundo aviso específico ao cancelar um item já enviado à cozinha (D-08), preservando o `confirmarComOpcao` que já existe hoje para qualquer item.

**Tasks que a compõem:** T-04.01

**Critério de saída:** Item `cozinha:true` dispara os dois diálogos; item sem `cozinha:true` fica igual a hoje.

**Roda em paralelo com:** F-04.2 (nenhuma depende da outra; F-04.1 também depende de T-03.03, da sprint-03, o que atrasa quando pode começar, mas não impede o paralelismo com F-04.2 quando ambas estiverem liberadas)

---

## F-04.2 — Fechamento via Receber pagamento sem mudança de código

**Objetivo:** Provar que a Comanda fecha pelo botão/rota "Receber pagamento" já existentes, sem regressão.

**Tasks que a compõem:** T-04.02

**Critério de saída:** Pagamento exato fecha a Comanda; pagamento divergente retorna 400, igual a Entrega/Retirada.

**Roda em paralelo com:** F-04.1 (nenhuma depende da outra diretamente, mesmo que F-04.2 dependa da sprint-02 e F-04.1 dependa da sprint-03)

---

## F-04.3 — Fim a fim — Comanda com duas rodadas

**Objetivo:** Validar o fluxo completo da feature num teste único, cobrindo os 4 critérios de pronto (D-13).

**Tasks que a compõem:** T-04.03

**Critério de saída:** Total final e via de cozinha da 2ª rodada corretos.

**Roda em paralelo com:** nenhuma
