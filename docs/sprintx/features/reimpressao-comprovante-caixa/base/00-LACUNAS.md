# Lacunas da base

Uma linha por coisa que foi procurada e não encontrada, com onde se procurou.

- **Marca do lote de cancelamento em `caixa_movimentos`** — procurado em `supabase/migrations/20260620120000_caixa.sql` e nas migrações posteriores que alteram a tabela. Não existe coluna de agrupamento; o lote só é dedutível por `(caixa_id, pedido_id, tipo)`.
- **Índice em `caixa_movimentos(pedido_id)`** — procurado nas migrações de `supabase/migrations/`. Não encontrado. Pode não importar no volume atual, mas o reagrupamento do cancelamento vai filtrar por essa coluna.
- **CHECK de `tipo` em `caixa_movimentos`** — procurado na migração de criação. Não existe; o comentário da coluna lista só `recebimento | sangria | suprimento`, e `cancelamento`/`estorno` foram acrescentados depois só no código. A documentação do schema está desatualizada em relação ao uso real.
- **Rate limit nas rotas de caixa** — procurado em `src/servidor.js` (chamadas a `limitador()`). Não há limitador nas rotas de caixa; os existentes cobrem autenticação e cadastro.
- **Retry ou reenfileiramento automático da fila de impressão** — procurado em `src/impressao-fila.js` e no `catch` de `enfileirarComprovanteCaixa`. Não existe nenhum: a falha vira aviso na tela e o trabalho é perdido. É exatamente o buraco que esta feature fecha, por ação manual.
- **Teste existente de reimpressão de comprovante de caixa** — procurado em `test/` e `test/integracao/`. Não existe; a feature não existe ainda.
- **Comprovante para `estorno`** — procurado em `config.impressao.caixa` (`src/servidor.js:2386-2389`) e em `public/comprovante-caixa.js`. Só existem sangria, suprimento e cancelamento. `tipoTitulo` em `public/comprovante-caixa.js` precisa ser conferido antes de assumir que aceitaria um quarto tipo.
