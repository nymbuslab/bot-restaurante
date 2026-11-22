# Fases — Sprint 02

> Um bloco por fase. O paralelismo declarado aqui é definitivo: a execução nunca decide paralelismo sozinha.

---

## F-02.1 — Vocabulário compartilhado dos tipos

**Objetivo:** ter UMA fonte de verdade sobre quais tipos de movimento têm comprovante, para o ícone do front e a recusa do backend não discordarem.

**Tasks que a compõem:** T-02.01

**Critério de saída:** `podeReimprimirComprovante` devolve `true` para `sangria`, `suprimento` e `cancelamento`, e `false` para `recebimento`, `estorno`, `""` e `undefined`.

**Roda em paralelo com:** nenhuma

---

## F-02.2 — Leitura do movimento guardado

**Objetivo:** devolver, a partir de um id de movimento, tudo que o comprovante precisa: operador do caixa daquele movimento, número do pedido, hora original e, no cancelamento, os movimentos irmãos reagrupados.

**Tasks que a compõem:** T-02.02, T-02.03

**Critério de saída:** para um cancelamento pago em duas formas, a leitura devolve UM registro com o valor somado e as duas formas em `formas[]`.

**Roda em paralelo com:** nenhuma

---

## F-02.3 — Rota de reimpressão

**Objetivo:** expor a reimpressão por HTTP, com os dois gates de plano (D-05) e isolamento por empresa.

**Tasks que a compõem:** T-02.04, T-02.05

**Critério de saída:** `POST /api/caixa/movimento/:id/reimprimir` devolve 200 e enfileira 1 trabalho; devolve 404 para id de outra empresa; devolve 400 para movimento de tipo sem comprovante; dois POST no mesmo id dentro da janela fazem a fila crescer em 1, não em 2 (D-11).

**Roda em paralelo com:** nenhuma
