---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-02
atualizado_em: 2026-09-10
fases:
  - id: F-02.1
    titulo: Comanda como tipo de venda valido
    status: nao_iniciado
    criterio_saida: POST /api/pdv/vender aceita tipoEntrega Comanda, nasce a receber sem caixa, e nao emite cupom na abertura (D-14)
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.01]
  - id: F-02.2
    titulo: Acrescentar itens a pedido aberto
    status: nao_iniciado
    criterio_saida: POST /api/pedidos/:id/itens soma itens e total num pedido a receber, com estoque baixado e cozinha da rodada enfileirada
    paralelizavel: false
    paralela_com: []
    tasks: [T-02.02, T-02.03]
---

# Fases — Sprint 02

```mermaid
%% Grafo de tasks — sprint-02 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_02_1["F-02.1 — Comanda como tipo de venda"]
    T_02_01["T-02.01<br/>Comanda como tipo de…"]
  end
  subgraph fase_02_2["F-02.2 — Acrescentar itens a pedido"]
    T_02_02["T-02.02<br/>Funcao acrescentarItens"]
    T_02_03["T-02.03<br/>Rota POST /api/pedidos…"]
  end

  T_02_01 --> T_02_02
  T_02_02 --> T_02_03

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_02_01 pendente
  class T_02_02 pendente
  class T_02_03 pendente
  class T_02_01,T_02_02,T_02_03 critico
```

> Caminho crítico: T-02.01 → T-02.02 → T-02.03 (3 tasks; a sprint inteira é uma cadeia única). Correção da F5: T-02.01 e T-02.03 alteram o mesmo `src/servidor.js`, então F-02.1 e F-02.2 deixaram de ser declaradas paralelas — T-02.02 agora depende também de T-02.01.

---

## F-02.1 — Comanda como tipo de venda válido

**Objetivo:** Fazer `/api/pdv/vender` aceitar o novo tipo "Comanda" pelo mesmo caminho de Entrega/Retirada, sem emitir cupom na abertura.

**Tasks que a compõem:** T-02.01

**Critério de saída:** Pedido `tipoEntrega:"Comanda"` nasce `recebido_em: null`, `origem: "pdv"`, sem movimento de caixa e sem via de cupom na fila.

**Roda em paralelo com:** nenhuma

---

## F-02.2 — Acrescentar itens a pedido aberto

**Objetivo:** Criar a função de persistência e a rota HTTP que acrescentam itens a um pedido a receber já existente, seguindo o padrão de `mesasDb.lancarItens`.

**Tasks que a compõem:** T-02.02, T-02.03

**Critério de saída:** `POST /api/pedidos/:id/itens` soma itens/total, baixa estoque atomicamente e enfileira a via de cozinha só da rodada nova.

**Roda em paralelo com:** nenhuma
