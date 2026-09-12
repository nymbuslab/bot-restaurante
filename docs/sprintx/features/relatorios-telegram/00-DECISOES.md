---
expx_schema: 1
expx_tool: sprintx
kind: decisoes
trabalho_id: relatorios-telegram
atualizado_em: 2026-09-06
decisoes:
  - id: D-01
    decisao: Bot unico da plataforma, um token so, tenants diferenciados por chat_id
    alternativa_descartada: Bot proprio por cliente com token individual
    motivo: Sem precedente de segredo por tenant no projeto (Geoapify/Stripe usam chave unica ou coluna dedicada); mais simples de configurar e manter
    status: fechada
    bloqueante: false
  - id: D-02
    decisao: Backend resolve o chat_id sozinho via polling de getUpdates, casando com um codigo de vinculacao
    alternativa_descartada: Operador descobre o chat_id por fora e digita manualmente
    motivo: Zero digitacao manual, menos erro operacional
    status: fechada
    bloqueante: false
  - id: D-03
    decisao: Conteudo desta entrega e fechamento de caixa do dia e alerta de estoque baixo/esgotado
    alternativa_descartada: Resumo diario de vendas (dashboard) e alerta em tempo real de novo pedido
    motivo: Sao os dois dados que o usuario escolheu nesta rodada; os demais ficam fora do escopo agora
    status: fechada
    bloqueante: false
  - id: D-04
    decisao: Disparo e por evento (quando o dono fecha o caixa), nao por job agendado de horario fixo
    alternativa_descartada: Job novo rodando a cada 24h desde o boot do servidor
    motivo: Fechamento de caixa e acao manual do usuario, nao horario de relogio; o mecanismo de job existente nao tem hora fixa e deslocaria a cada deploy
    status: fechada
    bloqueante: false
  - id: D-05
    decisao: Relatorios Telegram fica restrito a tenants com Plano Completo, via funcao de elegibilidade temRelatoriosTelegram (nao e cobranca nova, so reaproveita o gate ja existente de caixa/estoque)
    alternativa_descartada: Disponibilizar a aba para qualquer plano
    motivo: Caixa e estoque (fonte dos dados) ja sao exclusivos do Plano Completo; sem eles nao ha o que mandar. A funcao criada e so elegibilidade por plano ja cobrado, nao adiciona cobranca nova - a logica de cobranca EXCLUSIVA do modulo Telegram (ex: add-on separado) continua fora de escopo por enquanto, conforme pedido do usuario
    status: fechada
    bloqueante: false
  - id: D-06
    decisao: Configuracao (ligar/desligar, vincular chat_id) fica exclusiva do admin-master
    alternativa_descartada: Dono tambem visualiza status no proprio painel
    motivo: Pedido explicito do usuario nesta rodada; pode evoluir depois
    status: fechada
    bloqueante: false
  - id: D-07
    decisao: Falha no envio ao Telegram e sinalizada no admin-master (guarda status do ultimo envio)
    alternativa_descartada: So logar no servidor, sem sinalizacao visivel (padrao puro do email.js)
    motivo: Usuario preferiu visibilidade operacional maior que o padrao de email
    status: fechada
    bloqueante: false
  - id: D-08
    decisao: Codigo de vinculacao e um token aleatorio de uso unico, nunca o slug do tenant
    alternativa_descartada: Usar o slug do restaurante como codigo do link t.me/<bot>?start=<codigo>
    motivo: Slug e publico (aparece no link do cardapio /c/:slug); usar como codigo permitiria qualquer pessoa vincular o chat_id dela ao tenant de outro dono e roubar o fechamento de caixa/estoque alheio
    status: fechada
    bloqueante: false
  - id: D-09
    decisao: Codigo de vinculacao nao expira; permanece valido ate ser usado ou regenerado pelo operador
    alternativa_descartada: Expiracao curta (15-30min)
    motivo: Escolha explicita do usuario
    status: fechada
    bloqueante: false
  - id: D-10
    decisao: Token do bot fica em variavel de ambiente TELEGRAM_BOT_TOKEN, mesmo padrao de RESEND_API_KEY/GEOAPIFY_API_KEY
    alternativa_descartada: Guardar token em config jsonb ou em tabela do banco
    motivo: E segredo global da plataforma (um bot so, D-01), nao dado por tenant; segue a convencao do projeto de segredo global em env
    status: fechada
    bloqueante: false
  - id: D-11
    decisao: Admin-master ganha botao "Enviar teste agora" na aba, independente do fechamento de caixa real
    alternativa_descartada: Confiar so no proximo fechamento de caixa real para validar a vinculacao
    motivo: Da feedback imediato ao operador de que o chat_id vinculado esta correto
    status: fechada
    bloqueante: false
  - id: D-12
    decisao: Fechamento de caixa e alerta de estoque baixo saem como duas mensagens separadas no Telegram
    alternativa_descartada: Uma mensagem so combinando os dois blocos
    motivo: Escolha explicita do usuario; facilita reaproveitar cada bloco de texto separadamente no futuro
    status: fechada
    bloqueante: false
  - id: D-13
    decisao: Definicao de pronto inclui teste ponta a ponta com Telegram real (vinculacao + botao de teste) e um fechamento de caixa de teste real disparando a mensagem sozinho
    alternativa_descartada: Aceitar suite automatizada verde como suficiente, sem validar com Telegram real
    motivo: Escolha explicita do usuario; a F1 confirmou que ha comportamento nao totalmente documentado da API (erros nomeados, retry_after) que so um teste real revela
    status: fechada
    bloqueante: false
  - id: PENDENTE-01
    decisao: Bot da plataforma no Telegram (via BotFather) ainda nao foi criado
    alternativa_descartada: null
    motivo: null
    status: pendente
    bloqueante: false
---

# Decisões — relatorios-telegram

## Decisões

```
D-01 | Bot unico da plataforma, diferenciado por chat_id por tenant | Bot proprio por cliente | Sem precedente de segredo por tenant no projeto; mais simples
D-02 | Backend resolve chat_id via polling de getUpdates + codigo de vinculacao | Operador digita manualmente | Zero digitacao manual
D-03 | Conteudo: fechamento de caixa do dia + estoque baixo/esgotado | Resumo diario de vendas + alerta de pedido em tempo real | Escopo escolhido para esta entrega
D-04 | Disparo por evento (ao fechar o caixa) | Job agendado de horario fixo | Fechamento de caixa e acao manual, nao horario de relogio
D-05 | Restrito a tenants com Plano Completo, via gate de elegibilidade temRelatoriosTelegram (reaproveita regra existente, nao e cobranca nova) | Disponivel para qualquer plano | Dados de origem (caixa/estoque) ja sao exclusivos do Plano Completo
D-06 | Configuracao exclusiva do admin-master | Dono tambem visualiza no proprio painel | Pedido explicito do usuario
D-07 | Falha de envio sinalizada no admin-master (status do ultimo envio) | So logar no servidor | Usuario quis visibilidade operacional
D-08 | Codigo de vinculacao aleatorio de uso unico, nunca o slug | Usar o slug como codigo do deep link | Slug e publico; usar como codigo permitiria sequestro do chat_id de outro tenant
D-09 | Codigo de vinculacao nao expira | Expiracao curta (15-30min) | Escolha explicita do usuario
D-10 | Token do bot em TELEGRAM_BOT_TOKEN (env, global da plataforma) | Guardar em config jsonb ou banco | Segredo global (um bot so), segue convencao de segredo global em env
D-11 | Botao "Enviar teste agora" no admin-master | Confiar so no fechamento de caixa real | Feedback imediato da vinculacao
D-12 | Fechamento de caixa e estoque baixo saem em mensagens separadas | Uma mensagem combinada | Escolha explicita do usuario
D-13 | Definicao de pronto exige teste ponta a ponta com Telegram real + fechamento de caixa de teste real | Suite automatizada verde basta | Escolha explicita do usuario; API do Telegram tem comportamento nao totalmente documentado (erros nomeados, retry_after)
```

## Pendências

```
PENDENTE-01 (NÃO BLOQUEANTE) | Bot da plataforma no Telegram (via @BotFather) ainda não foi criado | trava: nada no planejamento — a premissa assumida é que o usuário cria o bot e configura TELEGRAM_BOT_TOKEN no ambiente antes da F6 (execução); até lá, o módulo roda em modo no-op, igual ao padrão de src/email.js sem RESEND_API_KEY
```
