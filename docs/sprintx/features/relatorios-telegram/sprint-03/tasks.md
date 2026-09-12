---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: relatorios-telegram
sprint_id: sprint-03
atualizado_em: 2026-09-06
tasks:
  - id: T-03.01
    titulo: Disparar mensagens ao fechar o caixa
    fase: F-03.1
    status: concluida
    objetivo: Apos persistir o fechamento em fecharCaixa, enviar fire-and-forget o fechamento de caixa e o alerta de estoque baixo ao chat_id vinculado, quando o tenant tiver Plano Completo
    arquivos:
      cria: [test/telegram-fechamento-caixa.test.js]
      altera: [src/caixa.js]
    teste_integracao: Confirma que fecharCaixa so dispara telegram.enviar quando empresas.temRelatoriosTelegram(emp) e config.telegram.chatId existem
    teste_funcional: Dado um tenant COM chatId vinculado, confirma que telegram.enviar e chamado exatamente DUAS vezes, com dois textos diferentes entre si (fechamento e estoque, D-12); dado um tenant SEM chatId, confirma zero chamadas
    criterio_aceite: fecharCaixa dispara exatamente duas chamadas de telegram.enviar, com textos distintos, so quando plano completo + chatId presentes, e nenhuma chamada caso contrario
    depende_de: [T-01.05, T-01.06, T-01.07]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde
  - id: T-03.02
    titulo: Persistir status do ultimo envio
    fase: F-03.2
    status: concluida
    objetivo: Gravar { status, em, erro } em config.telegram.ultimoEnvio apos cada tentativa de envio do fechamento (D-07)
    arquivos:
      cria: []
      altera: [src/caixa.js, test/telegram-fechamento-caixa.test.js]
    teste_integracao: Confirma que o resultado do envio e persistido via store.setConfig com status "sucesso" ou "falha", reaproveitando o cfg = store.getConfig(dir) ja carregado em fecharCaixa (src/caixa.js:653-654) para nao substituir o config inteiro
    teste_funcional: Com fixture de config ja tendo restaurante/pagamentos preenchidos, simulando telegram.enviar retornando { ok:false, motivo:"chat not found" }, confirma que ultimoEnvio.status vira "falha", ultimoEnvio.erro guarda o motivo, e config.restaurante continua identico
    criterio_aceite: config.telegram.ultimoEnvio reflete o resultado real da ultima tentativa e nenhuma chave de config fora de telegram e alterada
    depende_de: [T-03.01]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde
  - id: T-03.03
    titulo: Validar o fluxo completo com Telegram real
    fase: F-03.3
    status: concluida
    objetivo: Confirmar, com TELEGRAM_BOT_TOKEN configurado e um chat_id real vinculado, que o botao de teste e o fechamento de caixa real disparam mensagens de verdade (D-13)
    arquivos:
      cria: []
      altera: []
    teste_integracao: Executar o roteiro manual ponta a ponta (gerar link, vincular via /start real, botao "enviar teste") e confirmar chegada da mensagem no Telegram
    teste_funcional: Fechar um caixa de teste com pelo menos um item de estoque baixo cadastrado e confirmar que as duas mensagens (fechamento e estoque) chegam separadas no Telegram, como D-12
    criterio_aceite: As mensagens chegam no Telegram real do dono de teste, em duas mensagens separadas, sem intervencao manual alem de fechar o caixa
    depende_de: [T-02.06, T-03.02]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde
---

# Tasks — Sprint 03

> Um bloco por task. Na execução (F6), a linha `status` é atualizada em cada transição.

---

```yaml
id: T-03.01
titulo: Disparar mensagens ao fechar o caixa
objetivo: Apos persistir o fechamento, enviar fire-and-forget o fechamento e o alerta de estoque ao chat_id vinculado, se Plano Completo
arquivos:
  cria: [test/telegram-fechamento-caixa.test.js]
  altera: [src/caixa.js]
teste_integracao: Confirma que fecharCaixa so dispara telegram.enviar quando temRelatoriosTelegram(emp) e chatId existem
teste_funcional: Dado tenant COM chatId, confirma telegram.enviar chamado exatamente DUAS vezes com textos diferentes (D-12); dado tenant sem chatId, confirma zero chamadas
criterio_aceite: fecharCaixa dispara exatamente duas chamadas de envio, com textos distintos, so quando plano completo + chatId presentes
depende_de: [T-01.05, T-01.06, T-01.07]
paralelizavel: false
status: concluida
```

---

```yaml
id: T-03.02
titulo: Persistir status do ultimo envio
objetivo: Gravar { status, em, erro } em config.telegram.ultimoEnvio apos cada tentativa de envio
arquivos:
  cria: []
  altera: [src/caixa.js, test/telegram-fechamento-caixa.test.js]
teste_integracao: Confirma que o resultado do envio e persistido via store.setConfig reaproveitando o cfg ja carregado por fecharCaixa, sem substituir o config inteiro
teste_funcional: Com fixture de config populado, simulando enviar() com falha, confirma ultimoEnvio.status "falha", erro preenchido, e config.restaurante intacto
criterio_aceite: ultimoEnvio reflete o resultado real da ultima tentativa e nenhuma chave fora de telegram e alterada
depende_de: [T-03.01]
paralelizavel: false
status: concluida
```

---

```yaml
id: T-03.03
titulo: Validar o fluxo completo com Telegram real
objetivo: Confirmar com Telegram real que o botao de teste e o fechamento de caixa disparam mensagens de verdade
arquivos:
  cria: []
  altera: []
teste_integracao: Executar o roteiro manual ponta a ponta e confirmar chegada da mensagem
teste_funcional: Fechar caixa de teste com estoque baixo e confirmar as duas mensagens separadas
criterio_aceite: Mensagens chegam no Telegram real, separadas, sem intervencao alem de fechar o caixa
depende_de: [T-02.06, T-03.02]
paralelizavel: false
status: concluida
```
