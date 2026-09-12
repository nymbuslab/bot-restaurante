# Lacunas

1. **"Quantidade de transações por forma de pagamento"** — não existe hoje em nenhum lugar
   (`resumo`, `detalhe`, `relatorio` do cupom térmico) — só valores em R$. Precisaria ser
   calculada do zero a partir de `movimentos` (array de `caixa_movimentos`), contando ocorrências
   por `forma_pagamento`. Vira pergunta obrigatória na F2: o dono quer mesmo a CONTAGEM de
   transações, ou só o valor total por forma (que já existe pronto)? (`dados-fechamento-caixa.md`)
