---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: personalizacao-relatorios-telegram
sprint_id: sprint-01
atualizado_em: 2026-09-07
tasks:
  - id: T-01.01
    titulo: Extrair formula de estado do caixa
    fase: F-01.1
    status: concluida
    objetivo: Extrair estadoCaixa(totalOperador, totalConferencia) de public/relatorio-caixa.js:110-119 para funcao exportada reutilizavel, sem mudar o texto do cupom (D-08)
    arquivos:
      cria: []
      altera: [public/relatorio-caixa.js, test/relatorio-caixa.test.js]
    teste_integracao: Confirma que montarRelatorioFechamento continua produzindo exatamente o mesmo texto de antes do refactor, comparando com as fixtures ja usadas em test/relatorio-caixa.test.js
    teste_funcional: Dado totalOperador=100 e totalConferencia=100, estadoCaixa retorna { estado:"CONFERIDO", diferenca:0 }; dado totalOperador=105, retorna { estado:"SOBROU", diferenca:5 }; dado totalOperador=95, retorna { estado:"FALTOU", diferenca:-5 }
    criterio_aceite: estadoCaixa e exportado e usado por montarRelatorioFechamento; os testes antigos de relatorio-caixa.test.js continuam passando sem alteracao de expectativa
    depende_de: []
    paralelizavel: true
    concluida_em: 2026-09-07
    suite: 654 passed, 0 failed
  - id: T-01.02
    titulo: Contagem de vendas por forma de pagamento
    fase: F-01.2
    status: concluida
    objetivo: Adicionar caixa-calc.contagemPorForma(movimentos) - conta transacoes tipo=recebimento por forma_pagamento (D-01)
    arquivos:
      cria: []
      altera: [src/caixa-calc.js, test/caixa-calc.test.js]
    teste_integracao: Confirma que a soma dos valores de contagemPorForma bate com o numero de movimentos tipo=recebimento passados
    teste_funcional: Dado 3 movimentos recebimento (2 Dinheiro, 1 PIX) e 1 movimento cancelamento, retorna { Dinheiro:2, PIX:1 }, ignorando o cancelamento
    criterio_aceite: Lista vazia retorna {}; movimentos de tipos diferentes de recebimento nunca entram na contagem
    depende_de: []
    paralelizavel: true
    concluida_em: 2026-09-07
    suite: 660 passed, 0 failed
  - id: T-01.03
    titulo: Diferenca de caixa por forma de pagamento
    fase: F-01.2
    status: concluida
    objetivo: Adicionar caixa-calc.diferencaPorForma(contadoPorForma, esperadoPorForma) - diferenca (contado - esperado) por forma (D-04)
    arquivos:
      cria: []
      altera: [src/caixa-calc.js, test/caixa-calc.test.js]
    teste_integracao: Confirma que toda forma presente em qualquer um dos dois objetos de entrada aparece no resultado
    teste_funcional: Dado contadoPorForma={Dinheiro:105}, esperadoPorForma={Dinheiro:100, PIX:20}, retorna { Dinheiro:5, PIX:-20 }
    criterio_aceite: Forma ausente de um dos dois objetos e tratada como 0 nesse lado, nunca lanca
    depende_de: [T-01.02]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: 660 passed, 0 failed
- id: T-01.04
    titulo: Helper de leitura dos tipos de relatorio ativos
    fase: F-01.3
    status: concluida
    objetivo: Adicionar telegram.tiposAtivos(cfg) - le config.telegram.tipos com defaults corretos (fechamentoCaixa/estoque=true se ausente - D-03; cancelamentoAtivo=false e margemMinima=0 se ausentes - recurso novo)
    arquivos:
      cria: []
      altera: [src/telegram.js, test/telegram.test.js]
    teste_integracao: Confirma que config.telegram ou config.telegram.tipos ausentes ainda devolvem fechamentoCaixa:true e estoque:true, preservando o comportamento atual (D-03)
    teste_funcional: Dado cfg.telegram.tipos={fechamentoCaixa:false}, retorna { fechamentoCaixa:false, estoque:true, cancelamentoAtivo:false, margemMinima:0 }
    criterio_aceite: Nunca lanca com cfg, cfg.telegram ou cfg.telegram.tipos ausentes; defaults corretos em todos os casos
    depende_de: []
    paralelizavel: true
    concluida_em: 2026-09-07
    suite: 665 passed, 0 failed
  - id: T-01.05
    titulo: Formatador da mensagem de fechamento de caixa
    fase: F-01.4
    status: concluida
    objetivo: Reescrever formatarMensagemFechamentoCaixa para incluir operador, data/hora, quantidade e valor por forma, diferenca por forma e o estado (D-01, D-04, D-08), reaproveitando estadoCaixa de public/relatorio-caixa.js
    arquivos:
      cria: []
      altera: [src/telegram.js, test/telegram.test.js]
    teste_integracao: Confirma que o texto usa a funcao estadoCaixa importada (nao recalcula a formula de diferenca/estado internamente) - scan de fonte
    teste_funcional: Dado um objeto com operador, abertoEm, fechadoEm, contagemPorForma, recebidoPorForma, contadoPorForma e esperadoPorForma, retorna texto contendo o nome do operador, a data/hora, cada forma com quantidade e valor, e a diferenca por forma
    criterio_aceite: Texto nunca ultrapassa 4096 caracteres; sempre contem o nome do operador quando presente no objeto
    depende_de: [T-01.01, T-01.02, T-01.03]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: 668 passed, 0 failed
  - id: T-01.06
    titulo: Estoque em duas secoes (zerado e minimo)
    fase: F-01.4
    status: concluida
    objetivo: Dividir formatarMensagemEstoqueBaixo em duas secoes - Estoque zerado e Estoque minimo - em vez da lista unica atual
    arquivos:
      cria: []
      altera: [src/telegram.js, test/telegram.test.js]
    teste_integracao: Confirma que itens com esgotado=true aparecem so na secao Estoque zerado e itens com baixo=true so na secao Estoque minimo
    teste_funcional: Dado 1 item esgotado e 1 item baixo, o texto contem as duas secoes, cada uma listando so o item correspondente
    criterio_aceite: Secao sem nenhum item daquele tipo nao aparece (ou aparece dizendo que nao ha itens), nunca quebra a mensagem
    depende_de: [T-01.05]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: 670 passed, 0 failed
  - id: T-01.07
    titulo: Mensagem de alerta de cancelamento
    fase: F-01.4
    status: concluida
    objetivo: Criar formatarMensagemCancelamento(dados) - nova mensagem de alerta com numero do pedido, valor, forma de pagamento e tipo (cancelamento ou estorno) (D-05, D-06)
    arquivos:
      cria: []
      altera: [src/telegram.js, test/telegram.test.js]
    teste_integracao: Confirma que o texto sempre contem o valor cancelado formatado em R$ e o numero do pedido
    teste_funcional: Dado { pedidoNumero:42, valor:15.5, forma:"PIX", tipo:"cancelamento" }, retorna texto mencionando o pedido 42, R$ 15,50 e PIX; dado o mesmo objeto com tipo:"estorno", retorna texto contendo "estorno" e DIFERENTE do texto de cancelamento
    criterio_aceite: Texto nunca ultrapassa 4096 caracteres; o texto de tipo:"estorno" e visivelmente diferente do texto de tipo:"cancelamento" (contem a palavra "estorno")
    depende_de: [T-01.06]
    paralelizavel: false
    concluida_em: 2026-09-07
    suite: 673 passed, 0 failed
---

# Tasks — Sprint 01

> Um bloco por task. Na execução (F6), a linha `status` é atualizada em cada transição.

---

```yaml
id: T-01.01
titulo: Extrair formula de estado do caixa
objetivo: Extrair estadoCaixa(totalOperador, totalConferencia) de public/relatorio-caixa.js para funcao exportada reutilizavel, sem mudar o texto do cupom
arquivos:
  cria: []
  altera: [public/relatorio-caixa.js, test/relatorio-caixa.test.js]
teste_integracao: Confirma que montarRelatorioFechamento continua produzindo exatamente o mesmo texto de antes, comparando com as fixtures ja usadas
teste_funcional: totalOperador=100/totalConferencia=100 -> CONFERIDO/0; 105 -> SOBROU/5; 95 -> FALTOU/-5
criterio_aceite: estadoCaixa e exportado e usado por montarRelatorioFechamento; testes antigos continuam passando
depende_de: []
paralelizavel: true
status: concluida · 2026-09-07 · suíte: 654 passed, 0 failed
```

---

```yaml
id: T-01.02
titulo: Contagem de vendas por forma de pagamento
objetivo: Adicionar caixa-calc.contagemPorForma(movimentos) - conta transacoes tipo=recebimento por forma
arquivos:
  cria: []
  altera: [src/caixa-calc.js, test/caixa-calc.test.js]
teste_integracao: Confirma que a soma da contagem bate com o numero de movimentos tipo=recebimento
teste_funcional: 2 Dinheiro + 1 PIX + 1 cancelamento -> { Dinheiro:2, PIX:1 }, cancelamento ignorado
criterio_aceite: Lista vazia retorna {}; tipos diferentes de recebimento nunca entram
depende_de: []
paralelizavel: true
status: concluida · 2026-09-07 · suíte: 660 passed, 0 failed
```

---

```yaml
id: T-01.03
titulo: Diferenca de caixa por forma de pagamento
objetivo: Adicionar caixa-calc.diferencaPorForma(contadoPorForma, esperadoPorForma)
arquivos:
  cria: []
  altera: [src/caixa-calc.js, test/caixa-calc.test.js]
teste_integracao: Toda forma presente em qualquer um dos dois objetos aparece no resultado
teste_funcional: contado={Dinheiro:105}, esperado={Dinheiro:100,PIX:20} -> {Dinheiro:5, PIX:-20}
criterio_aceite: Forma ausente de um lado e tratada como 0, nunca lanca
depende_de: [T-01.02]
paralelizavel: false
status: concluida · 2026-09-07 · suíte: 660 passed, 0 failed
```

---

```yaml
id: T-01.04
titulo: Helper de leitura dos tipos de relatorio ativos
objetivo: Adicionar telegram.tiposAtivos(cfg) com defaults corretos
arquivos:
  cria: []
  altera: [src/telegram.js, test/telegram.test.js]
teste_integracao: config.telegram/tipos ausentes ainda devolvem fechamentoCaixa:true e estoque:true
teste_funcional: cfg.telegram.tipos={fechamentoCaixa:false} -> {fechamentoCaixa:false, estoque:true, cancelamentoAtivo:false, margemMinima:0}
criterio_aceite: Nunca lanca com campos ausentes; defaults corretos sempre
depende_de: []
paralelizavel: true
status: concluida · 2026-09-07 · suíte: 665 passed, 0 failed
```

---

```yaml
id: T-01.05
titulo: Fechamento de caixa detalhado no Telegram
objetivo: Reescrever formatarMensagemFechamentoCaixa com operador, data/hora, quantidade+valor por forma, diferenca por forma e estado
arquivos:
  cria: []
  altera: [src/telegram.js, test/telegram.test.js]
teste_integracao: Confirma uso da funcao estadoCaixa importada, nao recalculo interno
teste_funcional: Objeto rico -> texto com operador, data/hora, forma com quantidade+valor, diferenca por forma
criterio_aceite: Nunca ultrapassa 4096 caracteres; sempre contem o operador quando presente
depende_de: [T-01.01, T-01.02, T-01.03]
paralelizavel: false
status: concluida · 2026-09-07 · suíte: 668 passed, 0 failed
```

---

```yaml
id: T-01.06
titulo: Estoque em duas secoes (zerado e minimo)
objetivo: Dividir formatarMensagemEstoqueBaixo em Estoque zerado e Estoque minimo
arquivos:
  cria: []
  altera: [src/telegram.js, test/telegram.test.js]
teste_integracao: Esgotados so em Estoque zerado, baixos so em Estoque minimo
teste_funcional: 1 esgotado + 1 baixo -> duas secoes, cada uma com um item
criterio_aceite: Secao vazia nao quebra a mensagem
depende_de: [T-01.05]
paralelizavel: false
status: concluida · 2026-09-07 · suíte: 670 passed, 0 failed
```

---

```yaml
id: T-01.07
titulo: Mensagem de alerta de cancelamento
objetivo: Criar formatarMensagemCancelamento(dados) - pedido, valor, forma, tipo
arquivos:
  cria: []
  altera: [src/telegram.js, test/telegram.test.js]
teste_integracao: Texto sempre contem valor em R$ e numero do pedido
teste_funcional: {pedidoNumero:42, valor:15.5, forma:"PIX", tipo:"cancelamento"} -> texto com pedido 42, R$ 15,50, PIX; mesmo objeto com tipo:"estorno" -> texto contendo "estorno", diferente do de cancelamento
criterio_aceite: Nunca ultrapassa 4096 caracteres; texto de estorno visivelmente diferente do de cancelamento
depende_de: [T-01.06]
paralelizavel: false
status: concluida · 2026-09-07 · suíte: 673 passed, 0 failed
```
