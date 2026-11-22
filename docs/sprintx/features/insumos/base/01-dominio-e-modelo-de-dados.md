# Domínio e modelo de dados de Insumos

## Contrato de entrada

O módulo dual-mode `public/insumos.js` recebe:

- insumo bruto com `nome`, `unidade`, `saldo`, `minimo` e `custo` em `normalizarInsumo`;
- ficha como lista de `{ insumoId, qtd }` em `normalizarFicha`;
- valor digitado, unidade de origem e unidade do insumo em `converterEntrada`;
- itens já recalculados e o cardápio completo em `calcularConsumo`.

A tabela recebe `empresa_id`, `nome`, `unidade`, `saldo`, `minimo`, `custo`, `arquivado` e `criado_em` (`supabase/migrations/20260816210000_insumos.sql:28-40`).

## Contrato de saída

`normalizarInsumo` devolve um objeto normalizado ou `null` quando não há nome (`public/insumos.js:48-61`). `normalizarFicha` devolve uma lista única por insumo, descarta linhas inválidas e soma repetições (`public/insumos.js:65-79`). `calcularConsumo` devolve `[{ insumoId, delta }]`, agregado e com delta negativo (`public/insumos.js:101-148`).

O namespace de movimento é gerado por `chaveMovimento(insumoId)` com a constante `PREFIXO_INSUMO`; `ehInsumo` e `idDaChave` fazem a identificação e a volta para o id (`public/insumos.js:27-45`).

## Limites e cotas

- Unidades persistidas: `un`, `kg` e `l` (`public/insumos.js:28`; migration `20260816210000_insumos.sql:38`).
- Saldo e mínimo usam `numeric(14,3)` e custo usa `numeric(12,4)` (`supabase/migrations/20260816210000_insumos.sql:33-35`).
- A lógica pura arredonda quantidades para 3 casas e custo para 4 casas (`public/insumos.js:38-39,48-61`).
- O mínimo não pode ser negativo; o saldo pode (`public/insumos.js:47-61`; migration `20260816210000_insumos.sql:33-39`).
- Nome ativo é único por empresa sem diferenciar maiúsculas e minúsculas (`supabase/migrations/20260816210000_insumos.sql:48-49`).

## Erros conhecidos e tratamento

Insumo sem nome vira `null`; unidade desconhecida cai para `un`; ficha ausente vira lista vazia; linha sem id ou com quantidade não positiva é descartada (`public/insumos.js:48-79`). A migration impede unidade fora da whitelist e mínimo negativo (`supabase/migrations/20260816210000_insumos.sql:38-39`).

Insumo não é apagado, apenas arquivado, para preservar o histórico que usa `estoque_movimentos.item_id` sem chave estrangeira (`supabase/migrations/20260816210000_insumos.sql:52-57`).

## Riscos para a nossa implementação

Criar uma segunda regra de normalização na API ou na tela pode divergir do módulo puro. Gravar saldo no JSON do cardápio criaria duas fontes de verdade. Usar a string do prefixo fora de `public/insumos.js` pode misturar ids de produto e de insumo no extrato.

## Fonte

`public/insumos.js`, `supabase/migrations/20260816210000_insumos.sql` e `test/insumos.test.js` — acessados em 2026-09-13
