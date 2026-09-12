---
expx_schema: 1
expx_tool: sprintx
kind: base_indice
trabalho_id: relatorios-telegram
atualizado_em: 2026-09-06
areas:
  - arquivo: telegram-bot-api.md
    titulo: Telegram Bot API
    lacunas: 3
  - arquivo: admin-master-cadastro-tenant.md
    titulo: Admin-master - edicao de tenant
    lacunas: 3
  - arquivo: config-empresa-jsonb.md
    titulo: Config por empresa (jsonb)
    lacunas: 1
  - arquivo: canal-notificacao-email.md
    titulo: Canal de notificacao existente (email)
    lacunas: 1
  - arquivo: jobs-agendados.md
    titulo: Jobs agendados (index.js)
    lacunas: 1
  - arquivo: fontes-dados-relatorio.md
    titulo: Fontes de dados para o relatorio
    lacunas: 1
  - arquivo: gating-plano-assinatura.md
    titulo: Gating por plano/assinatura
    lacunas: 0
---

# Índice da base — relatorios-telegram

| Arquivo | Área | Resumo |
|---|---|---|
| `telegram-bot-api.md` | Telegram Bot API | Auth, `sendMessage`, limites, obtenção de `chat_id` via `getUpdates`/`setWebhook` |
| `admin-master-cadastro-tenant.md` | Admin-master — edição de tenant | Como o operador edita dados de UM cliente hoje (modal, não aba); rotas `exigeSuperAdmin`; padrão para rota nova de config por `:slug` |
| `config-empresa-jsonb.md` | Config por empresa (jsonb) | Onde e como guardar `config.telegram.*`; ausência de precedente de segredo por tenant |
| `canal-notificacao-email.md` | Canal de notificação existente (e-mail) | Padrão fire-and-forget + no-op de `src/email.js`, a copiar para Telegram |
| `jobs-agendados.md` | Jobs agendados (`index.js`) | `setTimeout`+`setInterval` relativos ao boot, sem cron de horário fixo |
| `fontes-dados-relatorio.md` | Fontes de dados para o relatório | `caixa-calc.js`, `dashboard-calc.js`, `GET /api/estoque` já prontos |
| `gating-plano-assinatura.md` | Gating por plano/assinatura | Padrão `tem*` em `src/empresas.js`; decisão de adiar `temRelatoriosTelegram` |
