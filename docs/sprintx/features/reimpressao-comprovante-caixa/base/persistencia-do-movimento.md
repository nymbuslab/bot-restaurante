# Persistência do movimento de caixa (o que dá para remontar depois)

## Contrato de entrada

Tabela `public.caixa_movimentos` (`supabase/migrations/20260620120000_caixa.sql:20-31`):

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | bigint identity PK | é o handle da reimpressão; já exposto na API |
| `caixa_id` | bigint NOT NULL → `caixas(id)` | cascade on delete |
| `empresa_id` | uuid NOT NULL → `empresas(id)` | isolamento do tenant |
| `tipo` | text NOT NULL | comentário da migração diz `'recebimento' \| 'sangria' \| 'suprimento'`; `'cancelamento'` e `'estorno'` foram acrescentados depois pelo código, sem CHECK no banco |
| `forma_pagamento` | text | |
| `valor` | numeric(10,2) NOT NULL | |
| `pedido_id` | bigint → `pedidos(id)` on delete SET NULL | |
| `descricao` | text | |
| `criado_em` | timestamptz NOT NULL default now() | |
| `mesa_id` | bigint → `mesas(id)` on delete SET NULL | acrescentado em `supabase/migrations/20260628130000_mesas.sql:31-32` |

Escrita de sangria/suprimento: `registrarMovimento(dir, { tipo, valor, descricao })` (`src/caixa.js:416`), dentro de transação com trava do caixa, gravando `(caixa_id, empresa_id, tipo, valor, descricao)` e devolvendo `RETURNING *` (`src/caixa.js:442-446`). Só aceita `sangria` e `suprimento` (`src/caixa.js:418`).

## Contrato de saída

`GET /api/caixa` → `caixa.resumo(dir)` devolve `movimentos[]` com (`src/caixa.js:501-512`): `id`, `tipo`, `pedidoId`, `numero`, `cliente`, `forma`, `valor`, `descricao`, `valorPago`, `troco`, `quando` (ISO de `criado_em`), `estornavel`.

A query faz `LEFT JOIN pedidos p ON p.id = m.pedido_id` e traz `p.numero`, `p.cliente`, `p.origem`, `p.tipo_entrega`, `p.recebido_em`, `p.status` (`src/caixa.js:475-479`). Só os movimentos do caixa aberto entram.

`caixas` guarda `operador` (usado no cabeçalho do comprovante) — ver `src/caixa.js` (`caixaAberto`) e a migração de caixa.

## Limites e cotas

- `valor` é `numeric(10,2)`: teto de 99.999.999,99 (`supabase/migrations/20260620120000_caixa.sql:26`).
- `tipo` cortado em nada no banco (text livre); no enfileiramento vira chave de `config.impressao.caixa`.
- `NÃO DOCUMENTADO`: não há índice declarado em `caixa_movimentos(pedido_id)` nas migrações lidas; o índice criado em `20260628130000_mesas.sql:34` é em `pedidos(mesa_id)`.

## Erros conhecidos e tratamento

- `pedido_id` é `ON DELETE SET NULL`: um pedido excluído deixa o movimento órfão, e a reimpressão perderia o número do pedido. Não há tratamento hoje.
- RLS ligado sem policy (`supabase/migrations/20260620120000_caixa.sql:37-39`), deny-all deliberado: o backend usa a conexão privilegiada do `DATABASE_URL`.

## Riscos para a nossa implementação

1. **Tudo que o comprovante precisa está guardado, com duas exceções:** `operador` (mora em `caixas`, alcançável por `caixa_id`) e `pedidoNumero` (mora em `pedidos`, alcançável pelo JOIN que `resumo` já faz). Nenhuma coluna nova é necessária.
2. **Não existe marca do lote de cancelamento** (risco 1 do arquivo de montagem). O agrupamento tem que ser deduzido por `(caixa_id, pedido_id, tipo)`.
3. **`estorno` também é movimento e também deduz**, mas NÃO tem toggle nem comprovante hoje (`config.impressao.caixa` só tem sangria/suprimento/cancelamento). Decidir se entra ou fica fora do escopo.
4. O extrato só mostra o caixa ABERTO, então na prática a reimpressão pela grade só alcança movimentos do turno atual. Reimprimir de caixa fechado exigiria outra porta (relatório de caixas anteriores), fora deste escopo.

## Fonte

`supabase/migrations/20260620120000_caixa.sql:20-40`, `supabase/migrations/20260628130000_mesas.sql:31-34`, `src/caixa.js:416-446`, `src/caixa.js:470-513` — acessado em 2026-08-30
