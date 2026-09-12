---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-02
titulo: Backend - Comanda e acrescimo de itens
status: nao_iniciado
criterio_saida: POST /api/pdv/vender aceita tipoEntrega Comanda sem emitir cupom na abertura; POST /api/pedidos/:id/itens acrescenta itens a um pedido a receber existente, com estoque baixado e via de cozinha da rodada enfileirada
fases: [F-02.1, F-02.2]
riscos: ["Guarda de edicao (recebido_em IS NULL AND status <> cancelado) precisa ser identica a cancelarPedido/cancelarItemPedido - ver base/03-pedidos-modelo-e-rotas.md", "Correcao F5 (1a rodada): T-02.01 e T-02.03 alteram o mesmo src/servidor.js - sprint sequenciada (T-02.02 depende tambem de T-02.01)", "Correcao F5 (2a rodada): as 3 tasks tambem alteram o MESMO arquivo test/integracao/pedidos-comanda.test.js (cada uma acrescenta seu proprio teste) - por isso T-02.02 continua dependendo de T-02.01 mesmo que nao compartilhem arquivo de producao, e T-04.02 (sprint-04) passou a depender de T-02.03 em vez de T-02.01, para nao escrever no arquivo de teste ao mesmo tempo que esta sprint", "D-14: Comanda nao pode emitir cupom na abertura - tratada como Retirada na regra de cupom"]
atualizado_em: 2026-09-10
---

# Sprint 02 — Backend - Comanda e acrescimo de itens

## Objetivo

Entregar o backend puro da feature: o tipo de venda "Comanda" no PDV (sem cupom na abertura,
D-14) e a rota que acrescenta itens a um pedido a receber já existente, replicando o padrão já
testado em produção de `mesasDb.lancarItens` (append incremental, baixa de estoque atômica,
impressão só da rodada nova). TDD contra a fixture da sprint-01.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-02.1 | Comanda como tipo de venda válido | nenhuma |
| F-02.2 | Acrescentar itens a pedido aberto | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`node --test test/integracao/pedidos-comanda.test.js` passa com 0 failed, cobrindo: criação de
pedido `tipoEntrega:"Comanda"` sem movimento de caixa e sem cupom na fila de impressão, e
`POST /api/pedidos/:id/itens` somando itens/total e baixando estoque num pedido a receber
existente.

## Riscos conhecidos

- A rota nova precisa reusar a MESMA guarda de edição (`recebido_em IS NULL AND status <> 'cancelado'`) que `cancelarPedido`/`cancelarItemPedido` já usam (`base/03-pedidos-modelo-e-rotas.md`).
- `itensDeCozinha`/`Comanda.montarCozinha`/`impressaoFila.enfileirar` já são best-effort e fora de transação no padrão de mesa (`base/04-impressao-cozinha.md`) — a rota nova deve seguir o mesmo isolamento.
- **Correção da auditoria F5 (1ª rodada)**: T-02.01 (tipo Comanda) e T-02.03 (rota de acréscimo) alteram o mesmo `src/servidor.js`. A sprint foi sequenciada (T-02.02 agora depende também de T-02.01) para eliminar o paralelismo falso que a F5 apontou.
- **Correção da auditoria F5 (2ª rodada)**: as 3 tasks desta sprint TAMBÉM alteram o mesmo `test/integracao/pedidos-comanda.test.js` (cada uma acrescenta seu próprio teste) — por isso a dependência T-02.02→T-02.01 continua válida mesmo sem conflito de arquivo de produção entre elas, e `T-04.02` (sprint-04) passou a depender de `T-02.03` em vez de `T-02.01`, para não escrever no arquivo de teste compartilhado antes desta sprint terminar.
- **D-14 (achado da F5)**: sem tratar Comanda como Retirada na regra de cupom de `/api/pdv/vender` (`tipoEntrega !== "Retirada"`), uma Comanda recém-aberta imprimiria cupom antes de qualquer pagamento — contradiz o conceito "em aberto".
