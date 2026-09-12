# Origem dos dados do fechamento de caixa (src/caixa.js, fecharCaixa)

## Contrato de entrada

`_avisarRelatoriosTelegram(dir, resumo, cfg)` (`src/caixa.js:599-634`) recebe hoje só três
parâmetros: `dir`, `resumo` (retorno de `calc.resumoCaixa`) e `cfg` (config do tenant). Chamada
em `src/caixa.js:757`, DEPOIS do `COMMIT` da transação de fechamento.

Variáveis já calculadas e disponíveis no escopo de `fecharCaixa` no momento dessa chamada
(`src/caixa.js:640-765`):

| Variável | Linha de origem | Conteúdo |
|---|---|---|
| `caixa` | 654 (`SELECT *` de `caixas`) | linha inteira — TEM `operador` (usado em :716) e `aberto_em` (usado em :714) |
| `resumo` | 671 (`calc.resumoCaixa(caixa, movimentos)`) | ver `caixa-calc.js` abaixo |
| `cfg` | 701 (`store.getConfig(dir)`) | config do tenant |
| `contadoPorForma` | 678-685, 731-733 (fallback legado) | `{ [forma]: valorContado }` |
| `eletronicoPorForma` | 677, 684, 688-693 | `{ [forma]: valor }`, só formas eletrônicas |
| `contadoDinheiro` | 676, 683, 687, 694 | total contado em espécie |
| `contadoEletronico` | 695 | soma de `eletronicoPorForma` |
| `espPorForma` (esperado por forma) | 734-735 (`calc.esperadoPorForma`) | `{ [forma]: valorEsperado }` |
| `diferenca` | 697 | diferença GLOBAL (não por forma) |
| `totalCaixa` | 696 (`calc.totalEmCaixa`) | total esperado em caixa |
| `detalhe` | 736-743 | objeto persistido em `caixas.detalhe_fechamento` |
| `relatorio` | 712-728 (`relatorioCaixa.montarRelatorioFechamento`) | string do cupom 80mm já pronta |

`calc.resumoCaixa(caixa, movimentos)` (`src/caixa-calc.js:7-40`) devolve: `recebidoPorForma`,
`totalRecebido`, `recebidoDinheiro`, `suprimentos`, `sangrias`, `cancelamentos`,
`canceladoPorForma`, `canceladoDinheiro`, `esperadoEspecie`. NÃO tem `operador`,
`contadoPorForma`, `diferenca`, nem quantidade por forma — só valores em R$.

## Contrato de saída

Não aplicável (é análise de dados existentes, não de uma função nova).

## Limites e cotas

Não aplicável.

## Erros conhecidos e tratamento

Não aplicável.

## Riscos para a nossa implementação

**Nada precisa ser calculado do zero, exceto quantidade por forma.** Operador, data/hora, total
por forma, esperado por forma e diferença global JÁ existem calculados no escopo de
`fecharCaixa`, e "diferença por forma" é trivial de derivar (`contadoPorForma[f] -
espPorForma[f]` para cada forma) — só falta mudar a assinatura de `_avisarRelatoriosTelegram`
para receber mais dados e os formatadores lerem esses campos. "Quantidade de transações por
forma" (não valor) NÃO existe em lugar nenhum hoje — nem em `resumo`, nem em `detalhe`, nem no
`relatorio`. Precisaria ser calculada a partir de `movimentos` (array de `caixa_movimentos`, cada
linha com `forma_pagamento` e `valor`, disponível em `src/caixa.js:668-670`), contando
ocorrências por forma — isso é o único cálculo genuinamente novo que a feature exigiria, se o
dono confirmar que quer "quantidade" (número de transações) e não só o valor total por forma.

## Fonte

`src/caixa.js:640-765` (fecharCaixa, lido por completo), `src/caixa-calc.js:7-40` (resumoCaixa)
— acessado em 2026-09-07
