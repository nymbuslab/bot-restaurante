---
expx_schema: 1
expx_tool: sprintx
kind: bloqueios
trabalho_id: relatorios-telegram
atualizado_em: 2026-09-06
bloqueios:
  - id: B-01
    task: T-03.03
    aberto_em: 2026-09-06
    resolvido_em: 2026-09-06
    descricao: TELEGRAM_BOT_TOKEN e TELEGRAM_BOT_USERNAME ausentes (PENDENTE-01) - resolvido quando o usuario criou o bot no @BotFather e os secrets foram configurados no Fly
---

# Bloqueios

| ID | Task | Bloqueio | Resolvido em |
|----|------|----------|--------------|
| B-01 | T-03.03 | TELEGRAM_BOT_TOKEN e TELEGRAM_BOT_USERNAME ausentes (PENDENTE-01) | 2026-09-06 — bot criado, secrets configurados no Fly, vinculo e envio real confirmados |

> Registrado em 2026-09-06, resolvido no mesmo dia: a validação real (T-03.03) ficou bloqueada
> só pelo pré-requisito ambiental — assim que o bot e os secrets existiram, o vínculo e as
> mensagens reais (fechamento de caixa + estoque) chegaram no Telegram do dono de teste.
