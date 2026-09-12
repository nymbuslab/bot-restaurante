---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: relatorios-telegram
sprint_id: sprint-02
atualizado_em: 2026-09-06
tasks:
  - id: T-02.01
    titulo: Rota GET de status Telegram do tenant
    fase: F-02.1
    status: concluida
    objetivo: Expor GET /api/admin/tenants/:slug/telegram com vinculado, temPlano e link; resolver 404 se o slug nao existir; chamar SEMPRE await store.ensure(tenantDir) antes de store.getConfig (store.getConfig lanca excecao com cache frio - src/store.js:38 -, e exigeSuperAdmin nao popula req.tenantDir nem toca o cache)
    arquivos:
      cria: [test/telegram-admin-rotas.test.js]
      altera: [src/servidor.js]
    teste_integracao: Confirma no codigo-fonte que a rota fica atras de exigeSuperAdmin, resolve o tenant via empresas.buscarPorSlug(req.params.slug) e chama store.ensure(tenantDir) antes de store.getConfig
    teste_funcional: Com um tenant "frio" (cache nunca tocado no processo, sem chamar ensure manualmente antes do teste), confirma que a rota nao lanca e devolve vinculado, temPlano e link corretos; com slug inexistente, confirma 404 { erro: "Tenant não encontrado." }
    criterio_aceite: Rota nunca lanca por cache frio (sempre chama ensure antes de getConfig), devolve 404 para slug inexistente e os tres campos certos para slug existente
    depende_de: [T-01.02, T-01.07]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde
  - id: T-02.02
    titulo: Rota de gerar/regenerar codigo de vinculacao
    fase: F-02.1
    status: concluida
    objetivo: POST /api/admin/tenants/:slug/telegram/gerar-codigo chama store.ensure(tenantDir) antes de tudo, le o config INTEIRO do tenant (store.getConfig), mescla so a chave telegram (novo codigo, chatId null) e grava de volta com store.setConfig, sem apagar as demais chaves (restaurante, frete, pagamentos, mensagens, impressao)
    arquivos:
      cria: []
      altera: [src/servidor.js, test/telegram-admin-rotas.test.js]
    teste_integracao: Confirma, com uma fixture de config ja tendo restaurante e pagamentos preenchidos SEMEADA VIA STUB DE db.query (nunca via store.setConfig, que aqueceria o cache sozinho e mascararia a ausencia de store.ensure), que apos a rota rodar essas chaves continuam identicas - store.setConfig faz replace total do jsonb (src/store.js:48-54), entao a rota tem que ler antes de gravar
    teste_funcional: Com tenant "frio" (cache nunca tocado no processo, fixture semeada so via db.query), confirma que a rota nao lanca; duas chamadas seguidas devolvem codigos diferentes, a segunda apaga o vinculo (chatId) que a primeira eventualmente tivesse, e nenhuma das duas altera config.restaurante da fixture
    criterio_aceite: Rota nunca lanca por cache frio (sempre chama ensure antes de getConfig), cada chamada gera codigo novo, nunca deixa chatId antigo convivendo com o codigo novo, e nunca apaga chave de config fora de telegram
    depende_de: [T-02.01]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde
  - id: T-02.03
    titulo: Rota de enviar mensagem de teste
    fase: F-02.1
    status: concluida
    objetivo: POST /api/admin/tenants/:slug/telegram/teste chama store.ensure(tenantDir) antes de store.getConfig e dispara telegram.enviar para o chat_id ja vinculado (D-11)
    arquivos:
      cria: []
      altera: [src/servidor.js, test/telegram-admin-rotas.test.js]
    teste_integracao: Confirma que a rota chama store.ensure antes de getConfig, e responde 400 quando config.telegram.chatId nao existe, sem chamar telegram.enviar
    teste_funcional: Com chatId presente (inclusive tenant "frio", cache nunca tocado), confirma que a rota chama telegram.enviar(chatId, texto) e devolve { ok } no corpo da resposta
    criterio_aceite: Rota nunca lanca por cache frio, devolve 400 sem vinculo e o resultado de enviar() com vinculo
    depende_de: [T-02.01]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde
  - id: T-02.04
    titulo: Job de resolucao de vinculo por polling
    fase: F-02.2
    status: concluida
    objetivo: Registrar em index.js um job que chama telegram.buscarUpdates + telegram.resolverVinculos periodicamente (padrao setTimeout+setInterval dos jobs existentes), com a funcao vincular(tenant, chatId) chamando SEMPRE await store.ensure(tenantDir) antes de store.getConfig (cache pode estar frio para um tenant que ninguem tocou ainda no processo), mesclando so a chave telegram e gravando com store.setConfig, nunca substituindo o config inteiro por so { telegram: {...} }. CORRECAO POS-VERIFICACAO (2026-09-06): a entrega original nao avancava o offset do getUpdates (Telegram reenviaria o mesmo lote para sempre) nem apagava codigoVinculacao ao vincular (violando D-08, uso unico); ambos corrigidos, telegram.js ganhou proximoOffset(updates) e a suite ganhou 4 testes novos.
    arquivos:
      cria: [test/telegram-job.test.js]
      altera: [index.js, src/telegram.js]
    teste_integracao: Confirma no codigo-fonte de index.js que o job roda dentro de try/catch que nunca lanca, avanca telegramOffset a cada rodada, e que vincular() chama store.ensure e apaga codigoVinculacao antes de gravar
    teste_funcional: Com uma fixture de config ja tendo restaurante/pagamentos preenchidos, e simulando tenant "frio" (cache nunca tocado), confirma que vincular() nao lanca, preserva as chaves fora de telegram e apaga o codigoVinculacao antigo (D-08); buscarUpdates(offset) manda o parametro na URL e proximoOffset devolve o maior update_id + 1
    criterio_aceite: Job registrado com try/catch, falha de rede numa rodada nao trava rodadas seguintes, vincular() nunca apaga chave de config fora de telegram MAS sempre apaga codigoVinculacao, e o offset avanca a cada rodada com updates
    depende_de: [T-01.04, T-01.08]
    paralelizavel: true
    concluida_em: 2026-09-06
    suite: verde (650 testes, 0 falhas)
  - id: T-02.05
    titulo: Prototipar a aba Relatorios Telegram
    fase: F-02.3
    status: concluida
    objetivo: Desenhar no Claude Design os quatro estados da aba (nao vinculado, aguardando vinculo, vinculado, falha no ultimo envio), semeado com os tokens reais de public/style.css
    arquivos:
      cria: [design/canvas/relatorios-telegram.dc.html]
      altera: []
    teste_integracao: O arquivo design/canvas/relatorios-telegram.dc.html existe e contem os quatro blocos de estado exigidos
    teste_funcional: Usuario aprova explicitamente o prototipo (mensagem de confirmacao registrada na conversa) antes de T-02.06 comecar
    criterio_aceite: Prototipo publicado com os quatro estados e aprovacao explicita do usuario registrada
    depende_de: [T-02.01]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde
  - id: T-02.06
    titulo: Implementar o bloco Relatorios Telegram no admin-master
    fase: F-02.4
    status: concluida
    objetivo: Adicionar o bloco de configuracao Telegram dentro de renderTenantModal (app-admin.js), conforme o prototipo aprovado em T-02.05
    arquivos:
      cria: [test/telegram-admin-ui.test.js]
      altera: [public/app-admin.js, public/style.css]
    teste_integracao: Confirma no codigo-fonte que renderTenantModal inclui um bloco que chama as tres rotas /api/admin/tenants/:slug/telegram*
    teste_funcional: Confirma que o bloco usa as classes .am-config-card/.auth-campo ja existentes no admin-master, em vez de estilo novo solto
    criterio_aceite: A aba aparece no modal do tenant, reflete os estados do prototipo aprovado e chama as tres rotas certas
    depende_de: [T-02.02, T-02.03, T-02.05]
    paralelizavel: false
    concluida_em: 2026-09-06
    suite: verde
---

# Tasks — Sprint 02

> Um bloco por task. Na execução (F6), a linha `status` é atualizada em cada transição.

---

```yaml
id: T-02.01
titulo: Rota GET de status Telegram do tenant
objetivo: Expor GET /api/admin/tenants/:slug/telegram; 404 se slug nao existir; SEMPRE store.ensure(tenantDir) antes de store.getConfig (cache frio lanca excecao, exigeSuperAdmin nao popula req.tenantDir)
arquivos:
  cria: [test/telegram-admin-rotas.test.js]
  altera: [src/servidor.js]
teste_integracao: Confirma que a rota fica atras de exigeSuperAdmin, resolve o tenant via buscarPorSlug e chama store.ensure antes de getConfig
teste_funcional: Com tenant "frio" (cache nunca tocado), confirma que a rota nao lanca e devolve os campos certos; com slug inexistente, confirma 404
criterio_aceite: Rota nunca lanca por cache frio, devolve 404 para slug inexistente e os tres campos certos para slug existente
depende_de: [T-01.02, T-01.07]
paralelizavel: false
status: concluida
```

---

```yaml
id: T-02.02
titulo: Rota de gerar/regenerar codigo de vinculacao
objetivo: POST /api/admin/tenants/:slug/telegram/gerar-codigo chama store.ensure(tenantDir) antes de tudo, le o config inteiro, mescla so a chave telegram e grava de volta, sem apagar as demais chaves
arquivos:
  cria: []
  altera: [src/servidor.js, test/telegram-admin-rotas.test.js]
teste_integracao: Confirma, com fixture semeada via stub de db.query (nao via store.setConfig, que aqueceria o cache sozinho), que restaurante/pagamentos sobrevivem intactos apos a rota rodar
teste_funcional: Com tenant frio (cache nunca tocado), confirma que a rota nao lanca; duas chamadas seguidas devolvem codigos diferentes, a segunda apaga vinculo existente, e nenhuma altera config.restaurante
criterio_aceite: Rota nunca lanca por cache frio, cada chamada gera codigo novo, nunca convive com chatId antigo, e nunca apaga chave de config fora de telegram
depende_de: [T-02.01]
paralelizavel: false
status: concluida
```

---

```yaml
id: T-02.03
titulo: Rota de enviar mensagem de teste
objetivo: POST /api/admin/tenants/:slug/telegram/teste chama store.ensure(tenantDir) antes de store.getConfig e dispara telegram.enviar para o chat_id vinculado
arquivos:
  cria: []
  altera: [src/servidor.js, test/telegram-admin-rotas.test.js]
teste_integracao: Confirma chamada a store.ensure antes de getConfig, e resposta 400 quando config.telegram.chatId nao existe, sem chamar telegram.enviar
teste_funcional: Com chatId presente (inclusive tenant frio), confirma chamada a telegram.enviar(chatId, texto) e devolucao de { ok }
criterio_aceite: Rota nunca lanca por cache frio, devolve 400 sem vinculo e o resultado de enviar() com vinculo
depende_de: [T-02.01]
paralelizavel: false
status: concluida
```

---

```yaml
id: T-02.04
titulo: Job de resolucao de vinculo por polling
objetivo: Registrar em index.js um job que chama telegram.buscarUpdates + telegram.resolverVinculos periodicamente; vincular(tenant, chatId) chama store.ensure(tenantDir) antes de store.getConfig, mescla e grava, apagando codigoVinculacao (D-08). CORRECAO POS-VERIFICACAO (2026-09-06): offset do getUpdates nunca avancava e codigoVinculacao nunca era apagado; ambos corrigidos.
arquivos:
  cria: [test/telegram-job.test.js]
  altera: [index.js, src/telegram.js]
teste_integracao: Confirma que o job roda dentro de try/catch que nunca lanca, avanca telegramOffset a cada rodada, e que vincular() chama store.ensure e apaga codigoVinculacao antes de gravar
teste_funcional: Com fixture de config populado e tenant frio, confirma que vincular() nao lanca, preserva as chaves fora de telegram e apaga o codigoVinculacao antigo (D-08); buscarUpdates/proximoOffset avancam corretamente
criterio_aceite: Job registrado com try/catch, falha de rede nao trava rodadas seguintes, vincular() nunca lanca por cache frio, sempre apaga codigoVinculacao e nunca apaga outra chave de config, e o offset avanca a cada rodada
depende_de: [T-01.04, T-01.08]
paralelizavel: true
status: concluida
```

---

```yaml
id: T-02.05
titulo: Prototipar a aba Relatorios Telegram
objetivo: Desenhar no Claude Design os quatro estados da aba, semeado com os tokens reais de public/style.css
arquivos:
  cria: [design/canvas/relatorios-telegram.dc.html]
  altera: []
teste_integracao: O arquivo design/canvas/relatorios-telegram.dc.html existe e contem os quatro blocos de estado exigidos
teste_funcional: Usuario aprova explicitamente o prototipo antes de T-02.06 comecar
criterio_aceite: Prototipo publicado com os quatro estados e aprovacao explicita registrada
depende_de: [T-02.01]
paralelizavel: false
status: concluida
```

---

```yaml
id: T-02.06
titulo: Implementar o bloco Relatorios Telegram no admin-master
objetivo: Adicionar o bloco de configuracao Telegram dentro de renderTenantModal, conforme o prototipo aprovado
arquivos:
  cria: [test/telegram-admin-ui.test.js]
  altera: [public/app-admin.js, public/style.css]
teste_integracao: Confirma que renderTenantModal inclui um bloco que chama as tres rotas /api/admin/tenants/:slug/telegram*
teste_funcional: Confirma que o bloco usa as classes .am-config-card/.auth-campo existentes
criterio_aceite: Aba aparece no modal, reflete os estados do prototipo e chama as rotas certas
depende_de: [T-02.02, T-02.03, T-02.05]
paralelizavel: false
status: concluida
```
