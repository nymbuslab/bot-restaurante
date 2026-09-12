---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: relatorios-telegram
sprint_id: sprint-01
titulo: Fundacao - nucleo puro do canal Telegram
status: concluido
criterio_saida: npm test roda verde cobrindo telegram.js e a extensao de empresas.js, sem nenhuma rota HTTP, job ou UI nova ainda
fases: [F-01.1, F-01.2]
riscos: [API do Telegram tem retry_after e erros nomeados nao documentados literalmente na fonte consultada - base/telegram-bot-api.md, lacuna 1 e 2]
atualizado_em: 2026-09-06
---

# Sprint 01 — Fundacao: nucleo puro do canal Telegram

## Objetivo

Entregar a capacidade de testar o canal Telegram isoladamente: o client de envio (`enviar`),
o gerador de codigo de vinculacao, o parser de updates, o orquestrador puro de vinculacao, os
formatadores de mensagem, e o gate de plano `temRelatoriosTelegram` — tudo testavel sem tocar
rede real nem banco real. Nenhuma rota HTTP, job agendado ou UI ainda; isso e negocio, entra
nas sprints seguintes.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-01.1 | Nucleo do canal Telegram (src/telegram.js) | F-01.2 |
| F-01.2 | Gate de plano e busca por codigo (src/empresas.js) | F-01.1 |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`npm test` termina com 0 failed cobrindo as oito tasks desta sprint, e nenhum arquivo fora de
`src/telegram.js`, `src/empresas.js` e `test/*.js` foi tocado.

## Riscos conhecidos

- Erros nomeados do Telegram ("chat not found", "bot was blocked") e o formato exato de
  `retry_after` nao foram confirmados literalmente na fonte oficial consultada
  (`base/telegram-bot-api.md`, lacunas 1-2) — `enviar()` trata qualquer falha de forma generica
  (`{ok:false, motivo}`), sem depender do texto exato do erro.
- Sem `TELEGRAM_BOT_TOKEN` configurado (pendencia PENDENTE-01, nao bloqueante), toda esta
  sprint roda em modo `CONFIGURADO=false`, testavel via o caminho no-op.
- A cadeia T-01.01→T-01.06 e sequencial por estarem todas no mesmo arquivo (`src/telegram.js`),
  nao por dependencia logica real entre todas (achado BAIXA da auditoria, `00-AUDITORIA.md`).
  Aceito deliberadamente: um agente unico executa em serie de qualquer forma, e separar em
  varios arquivos so para paralelizar seria abstracao prematura para o tamanho da feature.
