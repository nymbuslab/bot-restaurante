---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: relatorios-telegram
sprint_id: sprint-03
titulo: Envio automatico no fechamento de caixa
status: concluido
criterio_saida: Fechar um caixa de teste real dispara as duas mensagens (fechamento + estoque) no Telegram do dono, sozinho, sem clicar em nada, e o admin-master mostra o status do ultimo envio
fases: [F-03.1, F-03.2, F-03.3]
riscos: [Depende de TELEGRAM_BOT_TOKEN configurado e de um tenant Plano Completo com chat_id ja vinculado - sprint-02 - para a validacao ponta a ponta (D-13)]
atualizado_em: 2026-09-06
---

# Sprint 03 — Envio automático no fechamento de caixa

## Objetivo

Ligar o canal Telegram (sprint-01) e a vinculação (sprint-02) ao evento de negócio real:
quando o dono fecha o caixa, o sistema manda automaticamente o fechamento e o alerta de
estoque baixo, em duas mensagens separadas (D-04, D-05, D-12), e grava o status do último
envio para o admin-master (D-07).

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-03.1 | Hook de envio no fechamento de caixa | nenhuma |
| F-03.2 | Registro do status do último envio | nenhuma |
| F-03.3 | Validação ponta a ponta (Telegram real) | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

Fechar um caixa de teste (com estoque baixo cadastrado) dispara as duas mensagens no Telegram
real do dono de teste, sem intervenção manual, e `GET /api/admin/tenants/:slug/telegram`
reflete o resultado em `ultimoEnvio`.

## Riscos conhecidos

- Esta sprint só valida ponta a ponta (D-13) se `TELEGRAM_BOT_TOKEN` estiver configurado
  (PENDENTE-01) e houver um tenant de teste no Plano Completo com `chat_id` já vinculado pela
  sprint-02.
