---
expx_schema: 1
expx_tool: sprintx
kind: fases
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-03
atualizado_em: 2026-09-10
fases:
  - id: F-03.1
    titulo: Tile Comanda na tela de cobranca
    status: nao_iniciado
    criterio_saida: renderPdvPagar mostra o tile Comanda com o comportamento de Entrega/Retirada
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.01]
  - id: F-03.2
    titulo: Modo PDV de acrescentar itens a Comanda existente
    status: nao_iniciado
    criterio_saida: pdvCobrar chama a rota de acrescimo quando pedidoModoId esta setado, com banner indicando a Comanda
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.02]
  - id: F-03.3
    titulo: Botao Acrescentar item no modal do pedido
    status: nao_iniciado
    criterio_saida: Botao Acrescentar item aparece so quando o pedido e editavel e aciona o modo da F-03.2
    paralelizavel: false
    paralela_com: []
    tasks: [T-03.03]
---

# Fases — Sprint 03

```mermaid
%% Grafo de tasks — sprint-03 — gerado pela sprintx a partir de tasks.md
flowchart LR
  subgraph fase_03_1["F-03.1 — Tile Comanda"]
    T_03_01["T-03.01<br/>Tile Comanda na tela…"]
  end
  subgraph fase_03_2["F-03.2 — Modo de acrescentar itens"]
    T_03_02["T-03.02<br/>Modo PDV acrescentando…"]
  end
  subgraph fase_03_3["F-03.3 — Botao no modal do pedido"]
    T_03_03["T-03.03<br/>Botao Acrescentar item"]
  end

  T_03_01 --> T_03_02
  T_03_02 --> T_03_03

  classDef concluida fill:#d4f4dd,stroke:#2e7d32,color:#1b3d20
  classDef andamento fill:#fff3cd,stroke:#b8860b,color:#4a3800
  classDef bloqueada fill:#f8d7da,stroke:#c62828,color:#4a1d1f
  classDef pendente  fill:#eceff1,stroke:#78909c,color:#263238
  classDef critico   stroke-width:3px

  class T_03_01 pendente
  class T_03_02 pendente
  class T_03_03 pendente
  class T_03_01,T_03_02,T_03_03 critico
```

> Caminho crítico: T-03.01 → T-03.02 → T-03.03 (também depende de T-02.01/T-02.03, da sprint-02) — a sprint inteira é uma cadeia única (mesmo arquivo, `public/app.js`, sequenciado de propósito).

---

## F-03.1 — Tile Comanda na tela de cobrança

**Objetivo:** Adicionar "Comanda" aos tipos de venda do PDV, com o mesmo comportamento de Entrega/Retirada.

**Tasks que a compõem:** T-03.01

**Critério de saída:** Harness confirma o tile e a ausência do bloco de pagamento quando o tipo é Comanda.

**Roda em paralelo com:** nenhuma

---

## F-03.2 — Modo PDV de acrescentar itens a Comanda existente

**Objetivo:** Dar ao PDV um modo de lançamento (espelhando `mesaModoId`) que acrescenta itens a um pedido já aberto em vez de criar um novo.

**Tasks que a compõem:** T-03.02

**Critério de saída:** Com `pedidoModoId` setado, confirmar o carrinho chama `POST /api/pedidos/:id/itens`.

**Roda em paralelo com:** nenhuma

---

## F-03.3 — Botão Acrescentar item no modal do pedido

**Objetivo:** Expor a entrada para o modo da F-03.2 a partir do modal de detalhe do pedido, na aba Pedidos.

**Tasks que a compõem:** T-03.03

**Critério de saída:** Botão "Acrescentar item" visível só quando `podeModificar`, e aciona o modo com o pedido correto.

**Roda em paralelo com:** nenhuma
