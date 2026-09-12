---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-04
atualizado_em: 2026-09-07
tasks:
  - id: T-04.01
    titulo: Validar fechamento detalhado, estoque em 2 secoes e toggles
    fase: F-04.1
    status: concluida · 2026-09-08 · validado com Telegram real (nymbus-teste)
    objetivo: Com Telegram real, confirmar o fechamento de caixa detalhado (operador, quantidade+valor por forma, diferenca por forma), o estoque em duas secoes, e que desligar um toggle realmente para de mandar aquele tipo
    arquivos:
      cria: []
      altera: []
    teste_integracao: Fechar um caixa de teste real com fechamentoCaixa e estoque ligados; confirmar as duas mensagens detalhadas chegando; desligar um dos dois, fechar de novo, confirmar que so o outro chega
    teste_funcional: Com um item de estoque zerado E um item de estoque minimo cadastrados no tenant de teste, confirmar as duas secoes distintas na mensagem real
    criterio_aceite: Mensagens reais batem com o formato esperado (operador, quantidade+valor por forma, diferenca por forma, duas secoes de estoque); toggle desligado realmente impede o envio daquele tipo
    depende_de: [T-02.05, T-03.03]
    paralelizavel: true
    concluida_em: 2026-09-08
    suite: validacao manual (script direto contra src/caixa.js no tenant nymbus-teste, mesmas funcoes que a rota HTTP chama) - dois fechamentos reais, ultimoEnvio.fechamentoCaixa e ultimoEnvio.estoque com status "sucesso" no 1o fechamento (2 toggles ligados); no 2o fechamento (estoque desligado), fechamentoCaixa ganhou timestamp novo e estoque manteve o timestamp do fechamento anterior - toggle confirmado. Estoque de teste (Coca=3/min 5, Coxinha de Frango=0) usado so para forcar as 2 secoes e restaurado ao original ao final. Conteudo visual (emoji/formatacao no celular) fica a cargo do dono conferir no proprio Telegram.
  - id: T-04.02
    titulo: Validar alerta de cancelamento com margem real
    fase: F-04.2
    status: concluida · 2026-09-08 · validado com Telegram real (nymbus-teste)
    objetivo: Com Telegram real, confirmar que o alerta de cancelamento so chega quando o valor e maior ou igual a margem configurada, tanto pra cancelamento de pedido pago quanto pra estorno
    arquivos:
      cria: []
      altera: []
    teste_integracao: Cancelar uma venda paga ACIMA da margem configurada e confirmar chegada do alerta; cancelar uma venda ABAIXO da margem e confirmar que NAO chega
    teste_funcional: Repetir o mesmo teste para um estorno de recebimento (nao so cancelamento de pedido)
    criterio_aceite: Alerta chega so quando o valor e maior ou igual a margem, tanto para cancelamento quanto para estorno
    depende_de: [T-02.05, T-03.01, T-03.02]
    paralelizavel: true
    concluida_em: 2026-09-08
    suite: validacao manual (mesmo script/tenant de T-04.01), margem configurada em R$10 - cancelamento de R$20 disparou alerta (ultimoEnvio.cancelamento com status sucesso, pedido correto); cancelamento de R$5 nao disparou (registro nao mudou); estorno de R$20 disparou com tipo "estorno"; estorno de R$5 nao disparou. Os 4 casos confirmados via envio real ao chat vinculado.
---

# Tasks — Sprint 04

> Um bloco por task. Na execução (F6), a linha `status` é atualizada em cada transição.

---

```yaml
id: T-04.01
titulo: Validar fechamento detalhado, estoque em 2 secoes e toggles
objetivo: Confirmar com Telegram real o fechamento detalhado, o estoque em duas secoes e que os toggles funcionam
arquivos:
  cria: []
  altera: []
teste_integracao: Fechamento real com os dois toggles ligados chega detalhado; desligar um para de mandar so aquele
teste_funcional: Item zerado + item minimo -> duas secoes distintas na mensagem real
criterio_aceite: Formato bate com o esperado; toggle desligado impede o envio
depende_de: [T-02.05, T-03.03]
paralelizavel: true
status: concluida · 2026-09-08 · validado com Telegram real (nymbus-teste): 2 toggles ligados enviaram fechamentoCaixa+estoque; desligar estoque manteve so fechamentoCaixa no fechamento seguinte
```

---

```yaml
id: T-04.02
titulo: Validar alerta de cancelamento com margem real
objetivo: Confirmar que o alerta so chega acima da margem, para cancelamento e para estorno
arquivos:
  cria: []
  altera: []
teste_integracao: Cancelamento acima da margem chega; abaixo nao chega
teste_funcional: Mesmo teste repetido para estorno de recebimento
criterio_aceite: Alerta respeita a margem nos dois casos (cancelamento e estorno)
depende_de: [T-02.05, T-03.01, T-03.02]
paralelizavel: true
status: concluida · 2026-09-08 · validado com Telegram real (nymbus-teste): R$20 disparou (cancelamento e estorno), R$5 nao disparou nos dois casos, margem R$10
```
