# Schema e consultas de `estoque_movimentos`

## Contrato de entrada

A tabela é escrita só por `src/estoque-db.js:registrarTx(client, empId, movimentos, ctx)`,
sempre dentro da transação de quem alterou o saldo (`store.baixarEstoqueTx` /
`devolverEstoqueTx` / `ajustarEstoqueTx`). Campos de cada linha (fonte:
`supabase/migrations/20260813120000_estoque_movimentos.sql:23-37`):

- `id` bigserial PK
- `empresa_id` uuid NOT NULL (isolamento por tenant)
- `item_id` text NOT NULL — referência SOLTA ao cardápio (jsonb), sem FK
- `variacao_id` text NULL — preenchido quando o saldo é o de uma variação
- `tipo` text NOT NULL — enum de aplicação (não enum do Postgres): `venda | devolucao | entrada | perda | contagem | ajuste` (`src/estoque-db.js:13`, `TIPOS`)
- `quantidade` numeric NOT NULL — assinada (+entrada, -perda, ±contagem)
- `saldo_depois` numeric NOT NULL
- `descricao` text NOT NULL DEFAULT '' — nome do produto no momento (snapshot)
- `unidade` text NOT NULL DEFAULT 'un' — `un` | `kg`
- `pedido_id` bigint NULL, `numero` integer NULL — venda/devolução: pedido de origem
- `obs` text NULL
- `criado_em` timestamptz NOT NULL DEFAULT now()

## Contrato de saída

`src/estoque-db.js` expõe hoje (todas escopadas a UM saldo — `itemId` obrigatório):

- `listar(dir, { itemId, variacaoId, limite=30, antes=null, antesId=null })` — `SELECT *`
  filtrado por `empresa_id + item_id + variacao_id`, paginado por cursor
  `(criado_em, id) < (antes, antesId)` (não OFFSET), `ORDER BY criado_em DESC, id DESC`,
  `limite` clampado em `[1,100]`. Fonte: `src/estoque-db.js:75-97`.
- `resumo(dir, { itemId, variacaoId, dias=30 })` — soma por `tipo` nos últimos N dias
  (clamp `[1,365]`), sempre devolve as 6 chaves de `TIPOS` zeradas quando sem movimento.
  Fonte: `src/estoque-db.js:101-116`.

Nenhuma das duas aceita filtro sem `itemId`. **Não existe hoje nenhuma consulta "todos os
produtos"** — é exatamente essa a lacuna que a feature preenche.

## Limites e cotas

- Índice já existente para consulta POR TENANT (sem filtro de produto), ordenado por data:
  `estoque_mov_data_idx ON estoque_movimentos (empresa_id, criado_em DESC)`
  (`supabase/migrations/20260813120000_estoque_movimentos.sql:43-44`). Uma consulta "extrato
  geral" filtrando só por `empresa_id` (+ opcionalmente `tipo`, `criado_em`) já tem índice
  compatível — **não é esperada migration nova para a leitura**, mas confirmar em EXPLAIN na
  F3 se o filtro por `tipo` também usa esse índice ou pede um composto.
- `resumo()` clampa `dias` em até 365; `listar()` clampa `limite` em até 100.
- Retenção: job de limpeza apaga `criado_em < now() - 12 meses` (`limparAntigos`,
  `src/estoque-db.js:120-131`), agendado em `index.js:120-129` (105s após o boot + a cada
  24h). Um extrato geral filtrando período muito antigo pode legitimamente devolver "nada"
  por causa da retenção, não por bug.

## Erros conhecidos e tratamento

- `registrarTx` lança se `tipo` não está em `TIPOS` (`src/estoque-db.js:33`) — não é caminho
  de leitura, mas mostra que "tipo" é validado por whitelist fixa, não por enum do banco.
- `limparAntigos` captura e loga erro, devolve `0` em falha (não propaga) — best-effort,
  mesmo padrão dos outros jobs do projeto (`docs/gotchas.md`, "Jobs de retenção são
  best-effort").

## Riscos para a nossa implementação

- Uma consulta "geral" sem filtro de produto pode devolver MUITAS linhas num restaurante
  ativo (toda venda com N itens gera N linhas). Precisa do mesmo padrão de paginação por
  cursor que `listar()` já usa — não reinventar, replicar assinatura e comportamento.
- `descricao` é snapshot do nome do produto no momento do movimento — o extrato geral
  não precisa (e não deve) fazer join com o cardápio atual para exibir o nome.
- Filtrar por `tipo` no extrato geral precisa aceitar `"todos"` (sem filtro) além dos 6
  valores de `TIPOS` — decisão de contrato de API a fechar na F2/F3.

## Fonte

`supabase/migrations/20260813120000_estoque_movimentos.sql`, `src/estoque-db.js` — lido em 2026-09-16.
