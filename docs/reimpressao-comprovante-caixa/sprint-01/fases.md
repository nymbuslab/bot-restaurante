# Fases — Sprint 01

> Um bloco por fase. O paralelismo declarado aqui é definitivo: a execução nunca decide paralelismo sozinha.

---

## F-01.1 — Infraestrutura de banco

**Objetivo:** criar o índice em `caixa_movimentos(pedido_id)` que o reagrupamento do cancelamento (D-02) vai usar.

**Tasks que a compõem:** T-01.01

**Critério de saída:** consulta a `pg_indexes` no projeto de teste devolve exatamente 1 linha para `indexname = 'caixa_movimentos_pedido_id_idx'`.

**Roda em paralelo com:** F-01.2

---

## F-01.2 — Harness de teste

**Objetivo:** dar às sprints seguintes um jeito de ler a fila de impressão duas vezes e uma fixture que cria os três tipos de movimento com comprovante.

**Tasks que a compõem:** T-01.02, T-01.03

**Critério de saída:** `node --test test/integracao/caixa-comprovantes.test.js` termina com `fail 0` usando o helper novo, e a fixture devolve três ids de movimento que aparecem em `movimentos[].id` de `GET /api/caixa`.

**Roda em paralelo com:** F-01.1
