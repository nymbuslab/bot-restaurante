---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: relatorios-telegram
sprint_id: sprint-02
titulo: Vinculacao - configuracao no admin-master
status: concluido
criterio_saida: Operador gera o link no admin-master, o dono manda /start no Telegram real, o admin-master mostra vinculado e o botao de teste envia mensagem real
fases: [F-02.1, F-02.2, F-02.3, F-02.4]
riscos: [Sem TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_USERNAME configurados - PENDENTE-01 nao bloqueante -, a validacao ponta a ponta desta sprint fica pendente ate o usuario criar o bot, Portao de design (D-06.md do CLAUDE.md do usuario) obriga pausa em T-02.05 ate aprovacao explicita antes de escrever qualquer codigo de interface]
atualizado_em: 2026-09-06
---

# Sprint 02 — Vinculação: configuração no admin-master

## Objetivo

Dar ao operador uma forma de vincular o Telegram de um dono ao tenant certo: gerar um link de
vinculação seguro (D-08/D-09), um job que resolve esse vínculo automaticamente quando o dono
manda `/start` no bot (D-02), e a aba "Relatórios Telegram" no admin-master (D-06/D-07) com
botão de teste (D-11).

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-02.1 | Rotas admin-master de configuração | F-02.2 |
| F-02.2 | Job de resolução de vínculo (polling) | F-02.1, F-02.3 |
| F-02.3 | Protótipo visual (portão obrigatório) | F-02.2 |
| F-02.4 | UI da aba no admin-master | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

Com `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` configurados, o operador consegue: gerar um
link, o dono manda `/start <codigo>` de verdade, o admin-master reflete "vinculado" e o botão
"Enviar teste agora" entrega mensagem real no Telegram do dono.

## Riscos conhecidos

- PENDENTE-01 (`00-DECISOES.md`): sem o bot criado, a validação ponta a ponta desta sprint fica
  bloqueada até o usuário configurar `TELEGRAM_BOT_TOKEN`/`TELEGRAM_BOT_USERNAME` — o código
  em si roda e testa em modo no-op.
- T-02.05 é um portão de design do `CLAUDE.md` global do usuário: a execução autônoma da F6
  PARA nesta task e aguarda aprovação explícita antes de qualquer código de interface
  (T-02.06), mesmo que isso pareça contradizer a regra padrão de "nunca parar" da sprintx — o
  próprio método reconhece que instruções do usuário prevalecem sobre esse default.
