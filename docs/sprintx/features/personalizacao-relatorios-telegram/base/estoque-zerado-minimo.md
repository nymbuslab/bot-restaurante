# Separação estoque zerado vs mínimo — public/estoque.js

## Contrato de entrada

`statusEstoque(item)` (`public/estoque.js:17-26`) calcula, a partir da quantidade e do mínimo:
`esgotado: q === 0`, `baixo: q > 0 && q <= min` (:25). Os dois flags são MUTUAMENTE EXCLUSIVOS
por construção — não há sobreposição possível (baixo exige q>0, esgotado exige q===0).

`linhasDeEstoque(cardapio)` (`public/estoque.js:484-510`) devolve um array plano (item +
variação, uma linha por saldo controlado) com: `itemId`, `variacaoId`, `nome`, `categoria`,
`controlado`, `quantidade`, `minimo`, `unidade`, `esgotado`, `baixo`, `temVariacoes` (:491-495);
variações também têm `pai` (nome do item pai, :502).

## Contrato de saída

Array de objetos, ver acima.

## Limites e cotas

Não aplicável.

## Erros conhecidos e tratamento

Não aplicável (função pura).

## Riscos para a nossa implementação

Separar as duas seções é trivial: `linhas.filter(l => l.esgotado)` (zerado) e
`linhas.filter(l => l.baixo)` (mínimo) — é exatamente o padrão que `src/telegram.js:203` já usa
hoje pra UNIR as duas (`l.esgotado || l.baixo`), só que sem separar. Nenhum cálculo novo
necessário, é reorganização do formatador existente.

## Fonte

`public/estoque.js:17-26,484-510` — acessado em 2026-09-07
