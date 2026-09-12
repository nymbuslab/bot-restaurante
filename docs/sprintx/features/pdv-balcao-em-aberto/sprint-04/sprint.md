---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-04
titulo: Aviso de cancelamento, fechamento e fim a fim
status: nao_iniciado
criterio_saida: Cancelar item de cozinha ja registrado pede confirmacao extra; fechamento de Comanda via Receber pagamento provado sem mudanca de codigo; teste fim a fim de duas rodadas passa
fases: [F-04.1, F-04.2, F-04.3]
riscos: ["D-08 (corrigida na F5) so acrescenta um SEGUNDO aviso para itens com cozinha:true - o dialogo confirmarComOpcao que ja existe hoje para qualquer item continua, sem regressao", "Correcao F5 (1a rodada): T-04.01 depende de T-03.03 (sprint-03), porque ambas alteram public/app.js - nao roda em paralelo com a sprint-03", "Correcao F5 (2a rodada): T-04.02 depende de T-02.03 (nao mais T-02.01), porque T-02.01/02/03 tambem alteram test/integracao/pedidos-comanda.test.js e T-04.02 escreve no mesmo arquivo", "Correcao F5 (2a rodada): o criterio 4 de D-13 (aviso de cozinha) e' coberto pelo teste proprio de T-04.01 (harness de UI), NAO pelo teste de integracao HTTP/Postgres de T-04.03"]
atualizado_em: 2026-09-10
---

# Sprint 04 — Aviso de cancelamento, fechamento e fim a fim

## Objetivo

Fechar a feature: um segundo aviso, específico de cozinha, ao cancelar item já enviado à
cozinha (D-08 — corrigida na F5: o diálogo genérico de cancelamento já existe hoje, isto
acrescenta um aviso a mais só para itens `cozinha:true`), a prova de que o fechamento (D-10,
"Receber pagamento") já funciona para Comanda sem nenhum código novo, e o teste de integração
fim a fim que valida o fluxo completo de duas rodadas.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-04.1 | Aviso ao cancelar item de cozinha | F-04.2 (não com a sprint-03: T-04.01 depende de T-03.03) |
| F-04.2 | Fechamento via Receber pagamento sem mudança de código | F-04.1 |
| F-04.3 | Fim a fim — Comanda com duas rodadas | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`node --test test/integracao/pedidos-comanda.test.js` passa com 0 failed cobrindo os critérios
1-3 de D-13 (abrir+acrescentar, cozinha recebe só o acréscimo, fechar e cobrar); `npm test`
(runner de `test/`, sem banco) passa com 0 failed cobrindo o critério 4 (`test/pedido-modal-cancelar-aviso.test.js`,
harness de T-04.01) — **correção da F5 (2ª rodada)**: os dois testes ficam em runners
diferentes, não é um único comando que cobre os 4 critérios.

## Riscos conhecidos

- D-08 (corrigida na F5) só acrescenta um SEGUNDO aviso para itens com `cozinha: true` — o diálogo `confirmarComOpcao` que já existe hoje para qualquer item continua, sem regressão; item sem `cozinha:true` cancela igual a hoje, com um diálogo só.
- Correção F5 (1ª rodada): T-04.01 depende de T-03.03 (sprint-03), porque ambas alteram `public/app.js` — não roda em paralelo com a sprint-03.
- Correção F5 (2ª rodada): T-04.02 depende de T-02.03 (não mais T-02.01), porque T-02.01/02/03 também alteram `test/integracao/pedidos-comanda.test.js` e T-04.02 escreve no mesmo arquivo.
- Correção F5 (2ª rodada): o critério 4 de D-13 é coberto pelo teste próprio de T-04.01 (harness de UI), NÃO pelo teste de integração HTTP/Postgres de T-04.03 — ver `ORQUESTRADOR.md` §7.
