# Banco, multi-tenant e transações

## Contrato de entrada

- O acesso usa `pg.Pool` e queries parametrizadas; em teste há proteção contra conexão acidental a
  banco real. Fonte: `../../../src/db.js:1-45`.
- Módulos resolvem slug para `empresa_id` e filtram operações por empresa. Exemplo:
  `../../../src/pedidos.js:15-17` e `../../../src/pedidos.js:56-85`.
- Operações críticas recebem um `client` compartilhado para participar da transação do chamador.
  Fontes: `../../../src/pedidos.js:56-61` e `../../../src/store.js:104-117`.

## Contrato de saída

- Saldo JSONB e movimento de estoque são gravados na mesma transação; cache só é sincronizado após
  commit. Fonte: `../../../src/store.js:104-117` e `../../../src/store.js:270-275`.
- Exclusão de empresa usa cascata nas tabelas vinculadas e limpa caches locais. Fontes:
  `../../../supabase/migrations/20260813120000_estoque_movimentos.sql:23-26` e
  `../../../src/empresas.js:481-495`.

## Limites e cotas

- O pool e seus limites são configurados pelo ambiente; valores operacionais: **NÃO DOCUMENTADO
  NESTA BASE**.
- `estoque_movimentos` usa inserção em lote com doze parâmetros por linha. Fonte:
  `../../../src/estoque-db.js:29-56`.

## Erros conhecidos e tratamento

- A linha da empresa é travada com `FOR UPDATE` para serializar baixas e impedir lost update no
  JSONB. Fonte: `../../../src/store.js:92-117`.
- Fluxos de venda e cancelamento usam rollback protegido e liberam o client em `finally`. Fontes:
  `../../../src/caixa.js:237-291` e `../../../src/pedidos.js:255-283`.
- `estoque_movimentos` e `insumos` têm RLS habilitado e privilégios revogados de `anon` e
  `authenticated`; o backend continua obrigado a filtrar por tenant. Fontes:
  `../../../supabase/migrations/20260813120000_estoque_movimentos.sql:47-51` e
  `../../../supabase/migrations/20260816210000_insumos.sql:60-64`.

## Riscos

- Uma compra que trave alvos em ordem variável pode criar deadlock; a arquitetura deve impor ordem
  determinística por tipo e ID.
- O papel usado pela aplicação contorna RLS, conforme auditoria, então nenhum `UPDATE`, `DELETE` ou
  `SELECT` operacional pode omitir `empresa_id`. Fonte: `../00-AUDITORIA-BASELINE.md:93-100`.
- FK composta ou validação equivalente é necessária para impedir vínculo cruzado entre empresas.

## Fonte

- `../../../src/db.js`
- `../../../src/store.js:56-275`
- `../../../src/pedidos.js:15-95`
- `../../../src/estoque-db.js:1-138`
- `../../../supabase/migrations/20260813120000_estoque_movimentos.sql`
- `../../../supabase/migrations/20260816210000_insumos.sql`
