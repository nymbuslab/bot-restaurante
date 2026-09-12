---
expx_schema: 1
expx_tool: sprintx
kind: fechamento
trabalho_id: relatorios-telegram
titulo: Relatorios via Telegram para o dono do restaurante
tipo_trabalho: feature
fechado_em: 2026-09-06
modulo_afetado: [raiz, test, design, public]
arquivos_alterados: [src/telegram.js, test/telegram.test.js, src/empresas.js, test/empresas-telegram.test.js, test/telegram-admin-rotas.test.js, src/servidor.js, test/telegram-job.test.js, index.js, design/canvas/relatorios-telegram.dc.html, test/telegram-admin-ui.test.js, public/app-admin.js, public/style.css, test/telegram-fechamento-caixa.test.js, src/caixa.js]
palavras_chave: [telegram, relatorios, caixa, estoque, admin-master, vinculacao, notificacao, fechamento]
resumo: Ao fechar o caixa, o sistema manda automaticamente ao Telegram do dono o fechamento de caixa e o alerta de estoque baixo, em duas mensagens separadas, configuravel pelo admin-master.
decisao_principal: D-01 - bot unico da plataforma (um token so), cada tenant diferenciado pelo proprio chat_id, sem precedente de segredo por tenant no projeto.
risco_residual: Validacao ponta a ponta (T-03.03) confirmada com Telegram real em 2026-09-06 (vinculo, botao de teste e fechamento de caixa real, todos entregando mensagem). Risco que permanece: os testes funcionais de T-02.01/02/03 reimplementam a logica da rota dentro do proprio teste em vez de exercitar o handler real de src/servidor.js - uma regressao futura na rota pode passar sem ser pega por esses testes especificos (a cobertura estrutural por regex continua pegando ausencia de exigeSuperAdmin/store.ensure/etc.).
testes_adicionados: 62
---

# Fechamento — relatorios-telegram

## O que foi entregue

O restaurante com Plano Completo passa a receber, no Telegram do dono, o fechamento de caixa e
o alerta de estoque baixo assim que o caixa fecha pelo painel — sem precisar abrir o sistema. A
vinculação do Telegram é feita pelo operador no admin-master (aba "Relatórios Telegram" na
ficha do cliente): gera um link de uso único, o dono manda `/start` no bot, e o sistema resolve
o vínculo sozinho.

## Decisão principal

**D-01** — Bot único da plataforma, um token só (`TELEGRAM_BOT_TOKEN`), com cada tenant
diferenciado pelo próprio `chat_id` guardado em `config.telegram.chatId`. Motivo: o projeto não
tinha precedente de guardar segredo por tenant em `config` jsonb (Geoapify e Stripe usam chave
única global ou coluna dedicada) — um bot por cliente seria o primeiro caso desse tipo e traria
trabalho extra para o dono sem necessidade.

## Risco residual

A **validação ponta a ponta com Telegram real foi confirmada em 2026-09-06** (bloqueio B-01
resolvido): o usuário criou o bot no `@BotFather`, os secrets foram configurados no Fly, o
vínculo via `/start` resolveu no restaurante de teste, o botão "Enviar teste" e um fechamento de
caixa real dispararam as duas mensagens (fechamento + estoque). Antes desse fechamento, a
verificação pós-entrega (2026-09-06) encontrou e corrigiu dois defeitos reais: o código de
vinculação nunca era invalidado após o uso (violando o design de uso único, D-08) e o polling do
Telegram nunca avançava o `offset` do `getUpdates` (reenviaria o mesmo lote para sempre). Os dois
foram corrigidos com teste novo cobrindo o comportamento certo. Ficou como risco residual, sem
correção nesta rodada: os testes funcionais de T-02.01/T-02.02/T-02.03 reimplementam a lógica das
rotas dentro do próprio teste, em vez de invocar o handler real de `src/servidor.js` — uma
regressão futura na lógica condicional dessas rotas pode não ser pega por esses testes
específicos (a cobertura estrutural por regex continua alertando sobre a ausência de
`exigeSuperAdmin`/`store.ensure`/etc., mas não sobre um `if` invertido, por exemplo).

## Onde isto mexeu

- **Módulos:** raiz, test, design, public
- **Arquivos:** `src/telegram.js`, `test/telegram.test.js`, `src/empresas.js`,
  `test/empresas-telegram.test.js`, `test/telegram-admin-rotas.test.js`, `src/servidor.js`,
  `test/telegram-job.test.js`, `index.js`, `design/canvas/relatorios-telegram.dc.html`,
  `test/telegram-admin-ui.test.js`, `public/app-admin.js`, `public/style.css`,
  `test/telegram-fechamento-caixa.test.js`, `src/caixa.js`
- **Testes adicionados:** 62
