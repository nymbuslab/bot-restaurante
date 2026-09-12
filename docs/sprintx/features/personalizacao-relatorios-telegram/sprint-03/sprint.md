---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-03
titulo: Hooks de negocio - cancelamento e integracao dos toggles
status: nao_iniciado
criterio_saida: Cancelar um pedido pago ou estornar um recebimento acima da margem dispara o alerta; fechamento e estoque respeitam seus proprios toggles e gravam ultimoEnvio por tipo
fases: [F-03.1, F-03.2, F-03.3]
riscos: [Nenhum risco novo alem dos ja tratados nos formatadores/helpers da sprint-01 - os dois pontos de hook (cancelarRecebido, estornarRecebimento) ja vivem no mesmo arquivo que fala com o Telegram, sem risco de dependencia circular]
atualizado_em: 2026-09-07
---

# Sprint 03 — Hooks de negócio: cancelamento e integração dos toggles

## Objetivo

Ligar os formatadores e o helper de tipos (sprint-01) aos eventos de negócio: disparar o alerta
de cancelamento/estorno (D-05, D-06, D-07) e fazer o fechamento de caixa e o estoque baixo
respeitarem seus próprios toggles (D-03), com `ultimoEnvio` separado por tipo (D-09).

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-03.1 | Disparo do alerta em cancelarRecebido | nenhuma |
| F-03.2 | Disparo do alerta em estornarRecebimento | nenhuma |
| F-03.3 | Integração do fechamento/estoque com os toggles | nenhuma |

## Critério de saída

`npm test` verde cobrindo as três tasks; `_avisarRelatoriosTelegram` passa a checar
`tiposAtivos` antes de cada envio e grava `ultimoEnvio` como objeto por tipo.

## Riscos conhecidos

Nenhum risco novo além dos já tratados na base (`pontos-de-cancelamento.md`): o escopo (D-06)
evitou deliberadamente os pontos que exigiriam import novo com risco de ciclo
`pedidos.js ⇄ empresas.js`.
