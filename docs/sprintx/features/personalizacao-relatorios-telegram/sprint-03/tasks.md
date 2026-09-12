---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-03
atualizado_em: 2026-09-07
tasks:
  - id: T-03.01
    titulo: Alerta de cancelamento ao cancelar pedido pago/PDV
    fase: F-03.1
    status: concluida · 2026-09-07 · suite: 699 passed, 0 failed
    objetivo: Apos o COMMIT de caixa.cancelarRecebido, disparar fire-and-forget o alerta de cancelamento ao chat vinculado, so quando temRelatoriosTelegram, cancelamentoAtivo (tiposAtivos) e o valor cancelado >= margemMinima (D-05, D-06, D-07); a comparacao com a margem e POR MOVIMENTO (cada linha de cancelamentos[], nao a soma do pedido) - um pedido pago em duas formas pode disparar alerta so pra uma delas; e persistir ultimoEnvio.cancelamento (mesclando com os demais tipos, nunca substituindo o objeto ultimoEnvio inteiro - D-09)
    arquivos:
      cria: [test/telegram-cancelamento.test.js]
      altera: [src/caixa.js]
    teste_integracao: Confirma que o disparo acontece DEPOIS do COMMIT da transacao de cancelarRecebido, fire-and-forget (nao atrasa a resposta da rota), e que ultimoEnvio.cancelamento e gravado preservando ultimoEnvio.fechamentoCaixa/estoque ja existentes (fixture semeada com esses dois campos nao-nulos ANTES do run)
    teste_funcional: Cancelamento de R$20 com margem R$10 dispara telegram.enviar; cancelamento de R$5 com a mesma margem NAO dispara; pedido pago em 2 formas (R$20 dinheiro + R$5 PIX) com margem R$10 dispara so para a forma dinheiro, nao para o PIX
    criterio_aceite: Sem chatId, sem plano ou com cancelamentoAtivo false nunca dispara; cada forma/movimento e comparado com a margem individualmente; ultimoEnvio.cancelamento reflete o resultado sem apagar ultimoEnvio.fechamentoCaixa/estoque
    depende_de: [T-01.04, T-01.07]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: 699 passed, 0 failed
  - id: T-03.02
    titulo: Alerta de cancelamento ao estornar recebimento
    fase: F-03.2
    status: concluida · 2026-09-07 · suite: 699 passed, 0 failed
    objetivo: Apos o COMMIT de caixa.estornarRecebimento, disparar fire-and-forget o mesmo alerta de cancelamento (tipo "estorno"), com a mesma regra de toggle+margem POR MOVIMENTO de T-03.01, e persistir ultimoEnvio.cancelamento com o mesmo cuidado de merge
    arquivos:
      cria: []
      altera: [src/caixa.js, test/telegram-cancelamento.test.js]
    teste_integracao: Confirma que o disparo acontece depois do COMMIT de estornarRecebimento, e que ultimoEnvio.cancelamento e gravado preservando os demais tipos ja existentes (mesma fixture de T-03.01)
    teste_funcional: Estorno de R$20 com margem R$10 dispara com texto contendo "estorno" (diferente do texto de cancelamento); estorno de R$5 com a mesma margem NAO dispara
    criterio_aceite: Mesmas condicoes de T-03.01 (chatId, plano, toggle, margem por movimento); mensagem distingue "estorno" de "cancelamento"; ultimoEnvio.cancelamento reflete a ultima tentativa (cancelamento OU estorno, o que ocorreu por ultimo)
    depende_de: [T-03.01]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: 699 passed, 0 failed
  - id: T-03.03
    titulo: Fechamento e estoque respeitam seus proprios toggles
    fase: F-03.3
    status: concluida · 2026-09-07 · suite: 702 passed, 0 failed
    objetivo: Atualizar _avisarRelatoriosTelegram para checar tiposAtivos.fechamentoCaixa e tiposAtivos.estoque antes de cada envio (independentemente um do outro), montar os dados ricos do fechamento (operador, contagemPorForma, diferencaPorForma) e gravar ultimoEnvio como objeto por tipo (D-09), preservando ultimoEnvio.cancelamento quando ja existir
    arquivos:
      cria: []
      altera: [src/caixa.js, test/telegram-fechamento-caixa.test.js]
    teste_integracao: Confirma que com fechamentoCaixa desativado o texto de fechamento NAO e enviado, mas o estoque continua conforme seu proprio toggle; e que gravar ultimoEnvio.fechamentoCaixa NAO apaga ultimoEnvio.estoque nem ultimoEnvio.cancelamento ja existentes (fixture semeada com os dois campos preenchidos e nao-nulos ANTES do run, nao apenas null)
    teste_funcional: Com tipos={fechamentoCaixa:true, estoque:false} e fixture com ultimoEnvio.estoque={em:"...", status:"sucesso"} e ultimoEnvio.cancelamento={em:"...", status:"falha"} ja gravados, so 1 chamada de telegram.enviar acontece (fechamento); apos o run, ultimoEnvio.fechamentoCaixa e atualizado e ultimoEnvio.estoque/cancelamento continuam EXATAMENTE iguais ao valor semeado
    criterio_aceite: Cada tipo respeita seu proprio toggle de forma independente; ultimoEnvio vira objeto com uma chave por tipo; gravar um tipo nunca apaga nem sobrescreve o valor ja gravado de outro tipo
    depende_de: [T-01.05, T-01.06, T-01.04]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: 702 passed, 0 failed
---

# Tasks — Sprint 03

> Um bloco por task. Na execução (F6), a linha `status` é atualizada em cada transição.

---

```yaml
id: T-03.01
titulo: Alerta de cancelamento ao cancelar pedido pago/PDV
objetivo: Apos COMMIT de cancelarRecebido, dispara alerta fire-and-forget so quando plano+toggle+margem (por movimento) batem, e grava ultimoEnvio.cancelamento preservando os demais tipos
arquivos:
  cria: [test/telegram-cancelamento.test.js]
  altera: [src/caixa.js]
teste_integracao: Disparo acontece depois do COMMIT, fire-and-forget; ultimoEnvio.cancelamento gravado sem apagar fechamentoCaixa/estoque ja existentes (fixture semeada com esses dois nao-nulos)
teste_funcional: R$20 com margem R$10 dispara; R$5 nao dispara; pedido em 2 formas (R$20+R$5) com margem R$10 dispara so pra forma acima da margem
criterio_aceite: Sem chatId/plano/toggle nunca dispara; comparacao e por movimento; ultimoEnvio.cancelamento nao apaga os demais tipos
depende_de: [T-01.04, T-01.07]
paralelizavel: false
status: concluida · 2026-09-07 · suite: 699 passed, 0 failed
```

---

```yaml
id: T-03.02
titulo: Alerta de cancelamento ao estornar recebimento
objetivo: Apos COMMIT de estornarRecebimento, dispara o mesmo alerta (tipo estorno) com a mesma regra de T-03.01, grava ultimoEnvio.cancelamento com o mesmo cuidado de merge
arquivos:
  cria: []
  altera: [src/caixa.js, test/telegram-cancelamento.test.js]
teste_integracao: Disparo acontece depois do COMMIT de estornarRecebimento; ultimoEnvio.cancelamento preserva os demais tipos
teste_funcional: R$20 com margem R$10 dispara com texto contendo "estorno"; R$5 nao dispara
criterio_aceite: Mesmas condicoes de T-03.01; mensagem distingue estorno de cancelamento; ultimoEnvio.cancelamento reflete a ultima tentativa
depende_de: [T-03.01]
paralelizavel: false
status: concluida · 2026-09-07 · suite: 699 passed, 0 failed
```

---

```yaml
id: T-03.03
titulo: Fechamento e estoque respeitam seus proprios toggles
objetivo: _avisarRelatoriosTelegram checa tiposAtivos por tipo, monta dados ricos do fechamento e grava ultimoEnvio por tipo, preservando cancelamento
arquivos:
  cria: []
  altera: [src/caixa.js, test/telegram-fechamento-caixa.test.js]
teste_integracao: fechamentoCaixa desativado nao envia fechamento; estoque segue seu proprio toggle; gravar um tipo nao apaga ultimoEnvio.estoque/cancelamento ja existentes (fixture com valores nao-nulos semeados antes do run)
teste_funcional: tipos={fechamentoCaixa:true,estoque:false}, com ultimoEnvio.estoque e ultimoEnvio.cancelamento ja preenchidos -> so 1 chamada; apos o run, os dois continuam identicos ao valor semeado, so fechamentoCaixa muda
criterio_aceite: Cada tipo independente; ultimoEnvio vira objeto por tipo; gravar um tipo nunca sobrescreve outro
depende_de: [T-01.05, T-01.06, T-01.04]
paralelizavel: false
status: concluida · 2026-09-07 · suite: 702 passed, 0 failed
```
