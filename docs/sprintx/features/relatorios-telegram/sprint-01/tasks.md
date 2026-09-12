---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: relatorios-telegram
sprint_id: sprint-01
atualizado_em: 2026-09-06
tasks:
  - id: T-01.01
    titulo: Criar client de envio do Telegram
    fase: F-01.1
    status: concluida
    objetivo: Criar src/telegram.js com enviar(chatId, texto) seguindo o padrao no-op/fire-and-forget de src/email.js
    arquivos:
      cria: [src/telegram.js, test/telegram.test.js]
      altera: []
    teste_integracao: Confirma que enviar() monta a URL https://api.telegram.org/bot<token>/sendMessage e nunca lanca excecao mesmo se o fetch rejeitar
    teste_funcional: Chama enviar() sem TELEGRAM_BOT_TOKEN definido e recebe { ok:false, motivo:"nao_configurado" }
    criterio_aceite: Modulo exporta CONFIGURADO e enviar(); suite roda verde sem chamada de rede real
    depende_de: []
    paralelizavel: true
    concluida_em: 2026-09-06
    suite: verde (608 testes, 0 falhas)
  - id: T-01.02
    titulo: Gerador de codigo e link de vinculacao
    fase: F-01.1
    status: concluida
    objetivo: Adicionar gerarCodigoVinculacao() e linkVinculacao(codigo) a src/telegram.js
    arquivos:
      cria: []
      altera: [src/telegram.js, test/telegram.test.js]
    teste_integracao: Confirma que linkVinculacao(codigo) monta https://t.me/<TELEGRAM_BOT_USERNAME>?start=<codigo> a partir da env var
    teste_funcional: Chama gerarCodigoVinculacao() duas vezes e confirma que os dois valores retornados sao diferentes entre si
    criterio_aceite: gerarCodigoVinculacao() nunca repete valor em 1000 chamadas seguidas no teste, e linkVinculacao() embute o codigo recebido
    depende_de: [T-01.01]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde (608 testes, 0 falhas)
  - id: T-01.03
    titulo: Parser do update de vinculacao (/start)
    fase: F-01.1
    status: concluida
    objetivo: Adicionar extrairCodigoDeUpdate(update) a src/telegram.js, extraindo codigo e chat_id de uma mensagem /start
    arquivos:
      cria: []
      altera: [src/telegram.js, test/telegram.test.js]
    teste_integracao: Confirma que extrairCodigoDeUpdate le message.chat.id e o texto apos "/start " conforme o formato de Update documentado em base/telegram-bot-api.md
    teste_funcional: Dado um update com message.text "/start abc123" e message.chat.id 555, retorna { codigo:"abc123", chatId:555 }
    criterio_aceite: Update sem "/start" ou sem message retorna null, sem lancar excecao
    depende_de: [T-01.02]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde (608 testes, 0 falhas)
  - id: T-01.04
    titulo: Orquestrador puro de resolucao de vinculos
    fase: F-01.1
    status: concluida
    objetivo: Adicionar resolverVinculos(updates, buscarTenantPorCodigo, vincular) a src/telegram.js, casando updates com tenants via funcoes injetadas
    arquivos:
      cria: []
      altera: [src/telegram.js, test/telegram.test.js]
    teste_integracao: Confirma que resolverVinculos chama vincular(tenant, chatId) somente quando buscarTenantPorCodigo(codigo) devolve um tenant
    teste_funcional: Dado dois updates, um com codigo que bate com um tenant fake e outro com codigo que nao bate com nenhum, confirma que vincular e chamado uma unica vez, para o certo
    criterio_aceite: resolverVinculos nunca chama vincular para codigo sem tenant correspondente
    depende_de: [T-01.03]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde (608 testes, 0 falhas)
  - id: T-01.05
    titulo: Formatador da mensagem de fechamento de caixa
    fase: F-01.1
    status: concluida
    objetivo: Adicionar formatarMensagemFechamentoCaixa(detalhe) a src/telegram.js, texto pronto para sendMessage a partir do objeto de fechamento de caixa.js
    arquivos:
      cria: []
      altera: [src/telegram.js, test/telegram.test.js]
    teste_integracao: Confirma que o texto gerado fica dentro do limite de 4096 caracteres documentado em base/telegram-bot-api.md
    teste_funcional: Dado um objeto de fechamento com totalRecebido e recebidoPorForma (formato de caixa-calc.js), retorna texto contendo o total e cada forma de pagamento
    criterio_aceite: Texto gerado nunca ultrapassa 4096 caracteres e sempre contem o total recebido
    depende_de: [T-01.04]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde (608 testes, 0 falhas)
  - id: T-01.06
    titulo: Formatador da mensagem de estoque baixo
    fase: F-01.1
    status: concluida
    objetivo: Adicionar formatarMensagemEstoqueBaixo(linhas) a src/telegram.js, a partir das linhas filtradas de public/estoque.js
    arquivos:
      cria: []
      altera: [src/telegram.js, test/telegram.test.js]
    teste_integracao: Confirma que o texto lista cada item com status baixo/esgotado, no formato de public/estoque.js (statusEstoque)
    teste_funcional: Dado um array vazio de linhas, retorna um texto informando que nao ha itens com estoque baixo, sem lancar
    criterio_aceite: Lista vazia produz mensagem valida (nao vazia, nao erro); lista com itens lista cada um
    depende_de: [T-01.05]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde (608 testes, 0 falhas)
  - id: T-01.07
    titulo: Gate de plano temRelatoriosTelegram
    fase: F-01.2
    status: concluida
    objetivo: Adicionar empresas.temRelatoriosTelegram(emp) em src/empresas.js, mesma regra de temCaixa/temPdv (Plano Completo)
    arquivos:
      cria: [test/empresas-telegram.test.js]
      altera: [src/empresas.js]
    teste_integracao: Confirma que temRelatoriosTelegram usa acessoLiberado(emp) e planoDe(emp) === "completo", mesma fonte unica de temCaixa (src/empresas.js:326-358)
    teste_funcional: Dado um emp ativo com plano "completo", retorna true; dado um emp com plano "essencial", retorna false
    criterio_aceite: temRelatoriosTelegram(emp) devolve false para emp nulo, inativo, ou plano essencial
    depende_de: []
    paralelizavel: true
    concluida_em: 2026-09-06
    suite: verde (613 testes, 0 falhas)
  - id: T-01.08
    titulo: Busca de tenant por codigo de vinculacao
    fase: F-01.2
    status: concluida
    objetivo: Adicionar empresas.buscarPorCodigoVinculacaoTelegram(codigo), consulta SQL em config->telegram->>codigoVinculacao
    arquivos:
      cria: []
      altera: [src/empresas.js, test/empresas-telegram.test.js]
    teste_integracao: Confirma, stubando db.query (padrao de test/sessao-revogacao.test.js), que a query filtra por config->'telegram'->>'codigoVinculacao' = $1
    teste_funcional: Dado um db.query fake que devolve uma linha com slug "padaria-x", buscarPorCodigoVinculacaoTelegram("abc123") retorna "padaria-x"; dado zero linhas, retorna null
    criterio_aceite: Funcao nunca lanca quando a query nao encontra nenhum tenant, retorna null
    depende_de: [T-01.07]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde (613 testes, 0 falhas)
---

# Tasks — Sprint 01

> Um bloco por task. Na execução (F6), a linha `status` é atualizada em cada transição; ao concluir, acrescente data e resultado da suíte.

---

```yaml
id: T-01.01
titulo: Criar client de envio do Telegram
objetivo: Criar src/telegram.js com enviar(chatId, texto) seguindo o padrao no-op/fire-and-forget de src/email.js
arquivos:
  cria: [src/telegram.js, test/telegram.test.js]
  altera: []
teste_integracao: Confirma que enviar() monta a URL https://api.telegram.org/bot<token>/sendMessage e nunca lanca excecao mesmo se o fetch rejeitar
teste_funcional: Chama enviar() sem TELEGRAM_BOT_TOKEN definido e recebe { ok:false, motivo:"nao_configurado" }
criterio_aceite: Modulo exporta CONFIGURADO e enviar(); suite roda verde sem chamada de rede real
depende_de: []
paralelizavel: true
status: concluida
```

---

```yaml
id: T-01.02
titulo: Gerador de codigo e link de vinculacao
objetivo: Adicionar gerarCodigoVinculacao() e linkVinculacao(codigo) a src/telegram.js
arquivos:
  cria: []
  altera: [src/telegram.js, test/telegram.test.js]
teste_integracao: Confirma que linkVinculacao(codigo) monta https://t.me/<TELEGRAM_BOT_USERNAME>?start=<codigo> a partir da env var
teste_funcional: Chama gerarCodigoVinculacao() duas vezes e confirma que os dois valores retornados sao diferentes entre si
criterio_aceite: gerarCodigoVinculacao() nunca repete valor em 1000 chamadas seguidas no teste, e linkVinculacao() embute o codigo recebido
depende_de: [T-01.01]
paralelizavel: false
status: concluida
```

---

```yaml
id: T-01.03
titulo: Parser do update de vinculacao (/start)
objetivo: Adicionar extrairCodigoDeUpdate(update) a src/telegram.js, extraindo codigo e chat_id de uma mensagem /start
arquivos:
  cria: []
  altera: [src/telegram.js, test/telegram.test.js]
teste_integracao: Confirma que extrairCodigoDeUpdate le message.chat.id e o texto apos "/start " conforme o formato de Update documentado em base/telegram-bot-api.md
teste_funcional: Dado um update com message.text "/start abc123" e message.chat.id 555, retorna { codigo:"abc123", chatId:555 }
criterio_aceite: Update sem "/start" ou sem message retorna null, sem lancar excecao
depende_de: [T-01.02]
paralelizavel: false
status: concluida
```

---

```yaml
id: T-01.04
titulo: Orquestrador puro de resolucao de vinculos
objetivo: Adicionar resolverVinculos(updates, buscarTenantPorCodigo, vincular) a src/telegram.js
arquivos:
  cria: []
  altera: [src/telegram.js, test/telegram.test.js]
teste_integracao: Confirma que resolverVinculos chama vincular(tenant, chatId) somente quando buscarTenantPorCodigo(codigo) devolve um tenant
teste_funcional: Dado dois updates, um com codigo que bate com um tenant fake e outro que nao bate com nenhum, confirma que vincular e chamado uma unica vez, para o certo
criterio_aceite: resolverVinculos nunca chama vincular para codigo sem tenant correspondente
depende_de: [T-01.03]
paralelizavel: false
status: concluida
```

---

```yaml
id: T-01.05
titulo: Formatador da mensagem de fechamento de caixa
objetivo: Adicionar formatarMensagemFechamentoCaixa(detalhe) a src/telegram.js
arquivos:
  cria: []
  altera: [src/telegram.js, test/telegram.test.js]
teste_integracao: Confirma que o texto gerado fica dentro do limite de 4096 caracteres documentado em base/telegram-bot-api.md
teste_funcional: Dado um objeto de fechamento com totalRecebido e recebidoPorForma, retorna texto contendo o total e cada forma de pagamento
criterio_aceite: Texto gerado nunca ultrapassa 4096 caracteres e sempre contem o total recebido
depende_de: [T-01.04]
paralelizavel: false
status: concluida
```

---

```yaml
id: T-01.06
titulo: Formatador da mensagem de estoque baixo
objetivo: Adicionar formatarMensagemEstoqueBaixo(linhas) a src/telegram.js
arquivos:
  cria: []
  altera: [src/telegram.js, test/telegram.test.js]
teste_integracao: Confirma que o texto lista cada item com status baixo/esgotado, no formato de public/estoque.js (statusEstoque)
teste_funcional: Dado um array vazio de linhas, retorna um texto informando que nao ha itens com estoque baixo, sem lancar
criterio_aceite: Lista vazia produz mensagem valida (nao vazia, nao erro); lista com itens lista cada um
depende_de: [T-01.05]
paralelizavel: false
status: concluida
```

---

```yaml
id: T-01.07
titulo: Gate de plano temRelatoriosTelegram
objetivo: Adicionar empresas.temRelatoriosTelegram(emp) em src/empresas.js, mesma regra de temCaixa/temPdv (Plano Completo)
arquivos:
  cria: [test/empresas-telegram.test.js]
  altera: [src/empresas.js]
teste_integracao: Confirma que temRelatoriosTelegram usa acessoLiberado(emp) e planoDe(emp) === "completo", mesma fonte unica de temCaixa
teste_funcional: Dado um emp ativo com plano "completo", retorna true; dado um emp com plano "essencial", retorna false
criterio_aceite: temRelatoriosTelegram(emp) devolve false para emp nulo, inativo, ou plano essencial
depende_de: []
paralelizavel: true
status: concluida
```

---

```yaml
id: T-01.08
titulo: Busca de tenant por codigo de vinculacao
objetivo: Adicionar empresas.buscarPorCodigoVinculacaoTelegram(codigo), consulta SQL em config->telegram->>codigoVinculacao
arquivos:
  cria: []
  altera: [src/empresas.js, test/empresas-telegram.test.js]
teste_integracao: Confirma, stubando db.query, que a query filtra por config->'telegram'->>'codigoVinculacao' = $1
teste_funcional: Dado um db.query fake que devolve uma linha com slug "padaria-x", retorna "padaria-x"; dado zero linhas, retorna null
criterio_aceite: Funcao nunca lanca quando a query nao encontra nenhum tenant, retorna null
depende_de: [T-01.07]
paralelizavel: false
status: concluida
```
