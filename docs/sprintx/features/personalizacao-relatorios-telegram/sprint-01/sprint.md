---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-01
titulo: Fundacao - calculos e formatadores puros
status: concluida
criterio_saida: npm test roda verde cobrindo os novos calculos (caixa-calc.js), a formula de estado extraida (relatorio-caixa.js) e os tres formatadores de mensagem (telegram.js), sem nenhuma rota, hook de negocio ou UI nova ainda
fases: [F-01.1, F-01.2, F-01.3, F-01.4]
riscos: [Extrair estadoCaixa de public/relatorio-caixa.js sem mudar o texto do cupom exige teste de caracterizacao contra a saida atual, senao um refactor descuidado muda o cupom impresso sem querer]
atualizado_em: 2026-09-07
---

# Sprint 01 — Fundação: cálculos e formatadores puros

## Objetivo

Extrair a fórmula de estado do caixa (CONFERIDO/SOBROU/FALTOU) pra reuso (D-08), acrescentar os
cálculos puros novos que faltam (contagem por forma, diferença por forma — D-01, D-04) e
reescrever os três formatadores de mensagem do Telegram (fechamento detalhado, estoque em duas
seções, alerta de cancelamento novo), tudo testável sem tocar rede nem banco.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-01.1 | Extrair fórmula de estado do caixa | F-01.2, F-01.3 |
| F-01.2 | Novos cálculos puros (caixa-calc.js) | F-01.1, F-01.3 |
| F-01.3 | Helper de configuração de tipos | F-01.1, F-01.2 |
| F-01.4 | Formatadores de mensagem reformulados | nenhuma (depende de F-01.1/F-01.2/F-01.3) |

## Critério de saída

`npm test` termina com 0 failed cobrindo as sete tasks desta sprint; `public/relatorio-caixa.js`
continua produzindo exatamente o mesmo texto de cupom que produzia antes do refactor.

## Riscos conhecidos

- `estadoCaixa` está inline hoje em `public/relatorio-caixa.js:110-119`, dentro de uma função já
  coberta por `test/relatorio-caixa.test.js` — extrair sem teste de caracterização prévio
  arrisca mudar o cupom físico sem querer (regressão em produção, papel térmico já em uso).
