---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-02
atualizado_em: 2026-09-07
tasks:
  - id: T-02.01
    titulo: Estender GET de status com tipos e ultimoEnvio por tipo
    fase: F-02.1
    status: concluida · 2026-09-07 · suíte: 681 passed, 0 failed
    objetivo: GET /api/admin/tenants/:slug/telegram passa a incluir tipos (via telegram.tiposAtivos) e ultimoEnvio como objeto por tipo (fechamentoCaixa/estoque/cancelamento), mantendo store.ensure(tenantDir) antes de store.getConfig; ultimoEnvio no formato ANTIGO (flat, herdado da feature relatorios-telegram) e tratado como todos os tipos null, sem lancar e sem migrar (D-11)
    arquivos:
      cria: []
      altera: [src/servidor.js, test/telegram-admin-rotas.test.js]
    teste_integracao: Confirma que a rota chama telegram.tiposAtivos(cfg) e inclui o resultado na resposta, e que store.ensure continua vindo antes de store.getConfig
    teste_funcional: Com tenant "frio" (cache nunca tocado, config.telegram.tipos ausente), a resposta inclui tipos { fechamentoCaixa:true, estoque:true, cancelamentoAtivo:false, margemMinima:0 }; com fixture no formato ANTIGO de ultimoEnvio ({ em, status:"sucesso" }, sem chaves por tipo - D-11), a rota nao lanca e devolve ultimoEnvio.fechamentoCaixa/estoque/cancelamento todos null
    criterio_aceite: Rota nunca lanca por cache frio nem por ultimoEnvio no formato antigo; resposta sempre inclui tipos e ultimoEnvio (objeto, cada chave podendo ser null)
    depende_de: [T-01.04]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: 681 passed, 0 failed
  - id: T-02.02
    titulo: Rota de salvar tipos e margem
    fase: F-02.2
    status: concluida · 2026-09-07 · suíte: 681 passed, 0 failed
    objetivo: Nova rota POST /api/admin/tenants/:slug/telegram/tipos - le o config INTEIRO (store.ensure+getConfig), mescla so config.telegram.tipos e grava com store.setConfig, sem apagar chatId/codigoVinculacao/ultimoEnvio nem outras chaves de config
    arquivos:
      cria: []
      altera: [src/servidor.js, test/telegram-admin-rotas.test.js]
    teste_integracao: Confirma, com fixture semeada via stub de db.query (nunca via store.setConfig), que chatId e as demais chaves de config sobrevivem intactas apos a rota rodar
    teste_funcional: Com tenant frio, POST { fechamentoCaixa:false, estoque:true, cancelamentoAtivo:true, margemMinima:10 } grava exatamente esses valores em config.telegram.tipos, sem apagar config.telegram.chatId existente; POST com margemMinima:-5 responde 400 sem gravar nada
    criterio_aceite: Rota nunca lanca por cache frio; responde 400 com margemMinima negativa, sem alterar o config; nunca apaga chave de config fora de telegram.tipos
    depende_de: [T-02.01]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: 681 passed, 0 failed
  - id: T-02.03
    titulo: Prototipar as abas Assinatura e Relatorios Telegram
    fase: F-02.3
    status: concluida · 2026-09-07 · aprovacao explicita do usuario registrada
    objetivo: Desenhar no Claude Design as duas abas do modal Gerenciar (Assinatura reagrupando o que ja existe; Relatorios Telegram com vinculo + 3 checkboxes de tipo + campo de margem + status por tipo), semeado com os tokens reais de public/style.css
    arquivos:
      cria: [design/canvas/personalizacao-relatorios-telegram.dc.html]
      altera: []
    teste_integracao: O arquivo existe e contem os dois estados de aba e os tres controles de tipo, cada um com indicador de ultimo envio
    teste_funcional: Usuario aprova explicitamente o prototipo antes de T-02.04/T-02.05 comecarem
    criterio_aceite: Prototipo publicado com as duas abas e aprovacao explicita do usuario registrada
    depende_de: [T-02.01]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: aprovacao do usuario (sem suite nova)
  - id: T-02.04
    titulo: Reestruturar o modal Gerenciar em duas abas
    fase: F-02.4
    status: concluida · 2026-09-07 · suite: 686 passed, 0 failed
    objetivo: renderTenantModal passa a montar duas abas - Assinatura (resumo, acoes, historico, como hoje) e Relatorios Telegram (bloco existente) - conforme o prototipo aprovado em T-02.03
    arquivos:
      cria: []
      altera: [public/app-admin.js, public/style.css]
    teste_integracao: Confirma no codigo-fonte que existem dois containers de aba distintos e que o conteudo de Assinatura e Relatorios Telegram fica cada um no seu container
    teste_funcional: Confirma que trocar de aba altera qual container fica visivel, sem recarregar a pagina nem perder o estado do outro
    criterio_aceite: As duas abas existem e alternam corretamente, conforme o prototipo aprovado
    depende_de: [T-02.03]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: 686 passed, 0 failed
  - id: T-02.05
    titulo: Checkboxes de tipo e campo de margem
    fase: F-02.4
    status: concluida · 2026-09-07 · suite: 686 passed, 0 failed
    objetivo: Dentro da aba Relatorios Telegram, adicionar os 3 checkboxes (fechamento de caixa, estoque, alerta de cancelamento) e o campo de margem em R$ (habilitado so quando cancelamento esta marcado), chamando POST .../telegram/tipos ao alterar, e mostrando o ultimoEnvio de cada tipo
    arquivos:
      cria: []
      altera: [public/app-admin.js, test/telegram-admin-ui.test.js]
    teste_integracao: Confirma no codigo-fonte que marcar/desmarcar um checkbox ou editar a margem dispara POST /api/admin/tenants/:slug/telegram/tipos
    teste_funcional: Confirma que os tres checkboxes e o campo de margem refletem o que o GET devolveu, e que o campo de margem fica desabilitado quando o checkbox de cancelamento esta desmarcado
    criterio_aceite: Alterar qualquer controle dispara o salvamento; status de ultimo envio aparece por tipo, conforme D-09
    depende_de: [T-02.02, T-02.04]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: 686 passed, 0 failed
---

# Tasks — Sprint 02

> Um bloco por task. Na execução (F6), a linha `status` é atualizada em cada transição.

---

```yaml
id: T-02.01
titulo: Estender GET de status com tipos e ultimoEnvio por tipo
objetivo: GET .../telegram inclui tipos (telegram.tiposAtivos) e ultimoEnvio por tipo, mantendo store.ensure antes de getConfig
arquivos:
  cria: []
  altera: [src/servidor.js, test/telegram-admin-rotas.test.js]
teste_integracao: Confirma chamada a telegram.tiposAtivos(cfg) e store.ensure antes de getConfig
teste_funcional: Tenant frio, tipos ausente -> resposta com defaults corretos; ultimoEnvio no formato antigo (flat, D-11) -> nao lanca, devolve todos os tipos null
criterio_aceite: Nunca lanca por cache frio nem por formato antigo; resposta sempre inclui tipos e ultimoEnvio
depende_de: [T-01.04]
paralelizavel: false
status: concluida · 2026-09-07 · suíte: 681 passed, 0 failed
```

---

```yaml
id: T-02.02
titulo: Rota de salvar tipos e margem
objetivo: POST .../telegram/tipos le o config inteiro, mescla so tipos e grava, preservando o resto
arquivos:
  cria: []
  altera: [src/servidor.js, test/telegram-admin-rotas.test.js]
teste_integracao: Fixture via stub de db.query confirma que chatId e demais chaves sobrevivem intactas
teste_funcional: POST com os 4 campos grava exatamente isso em config.telegram.tipos sem apagar chatId; margemMinima:-5 responde 400 sem gravar
criterio_aceite: Nunca lanca por cache frio; 400 com margem negativa sem alterar config; nunca apaga chave fora de tipos
depende_de: [T-02.01]
paralelizavel: false
status: concluida · 2026-09-07 · suíte: 681 passed, 0 failed
```

---

```yaml
id: T-02.03
titulo: Prototipar as abas Assinatura e Relatorios Telegram
objetivo: Desenhar as duas abas do modal Gerenciar, semeado com os tokens de public/style.css
arquivos:
  cria: [design/canvas/personalizacao-relatorios-telegram.dc.html]
  altera: []
teste_integracao: Arquivo existe com os dois estados de aba e os tres controles de tipo
teste_funcional: Usuario aprova explicitamente antes de T-02.04/T-02.05 comecarem
criterio_aceite: Prototipo publicado e aprovacao explicita registrada
depende_de: [T-02.01]
paralelizavel: false
status: concluida · 2026-09-07 · aprovacao explicita do usuario registrada
```

---

```yaml
id: T-02.04
titulo: Reestruturar o modal Gerenciar em duas abas
objetivo: renderTenantModal monta duas abas - Assinatura e Relatorios Telegram - conforme prototipo aprovado
arquivos:
  cria: []
  altera: [public/app-admin.js, public/style.css]
teste_integracao: Dois containers de aba distintos, conteudo separado
teste_funcional: Trocar de aba alterna visibilidade sem recarregar a pagina
criterio_aceite: As duas abas existem e alternam corretamente
depende_de: [T-02.03]
paralelizavel: false
status: concluida · 2026-09-07 · suite: 686 passed, 0 failed
```

---

```yaml
id: T-02.05
titulo: Checkboxes de tipo e campo de margem
objetivo: Adicionar os 3 checkboxes + campo de margem na aba Relatorios Telegram, chamando a rota de salvar
arquivos:
  cria: []
  altera: [public/app-admin.js, test/telegram-admin-ui.test.js]
teste_integracao: Alterar checkbox/margem dispara POST .../telegram/tipos
teste_funcional: Controles refletem o GET; campo de margem desabilitado sem cancelamento marcado
criterio_aceite: Alterar controle salva; status de ultimo envio aparece por tipo
depende_de: [T-02.02, T-02.04]
paralelizavel: false
status: concluida · 2026-09-07 · suite: 686 passed, 0 failed
```
