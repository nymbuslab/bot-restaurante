---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-03
atualizado_em: 2026-09-10
tasks:
  - id: T-03.01
    titulo: Tile Comanda na tela de cobranca do PDV
    fase: F-03.1
    status: concluida
    objetivo: renderPdvPagar ganha o tipo Comanda ao lado de Balcao/Entrega/Retirada, comportando-se como Entrega/Retirada (sem bloco de pagamento, botao Abrir Comanda)
    arquivos:
      cria: [test/pdv-comanda-tile.test.js]
      altera: [public/app.js]
    teste_integracao: Harness extrai renderPdvPagar de public/app.js real (vm.runInNewContext) e confirma que o array de tipos de venda inclui Comanda
    teste_funcional: Dado pdvTipoEntrega igual a Comanda, a funcao monta HTML sem o bloco de forma de pagamento e com o botao final rotulado Abrir Comanda
    criterio_aceite: Harness confirma ausencia do bloco de pagamento e o texto do botao final quando pdvTipoEntrega e Comanda
    depende_de: [T-02.01]
    paralelizavel: false
    concluida_em: 2026-09-10
    suite: "2026-09-10 · suíte: 705 passed, 0 failed"
  - id: T-03.02
    titulo: Modo PDV acrescentando a Comanda existente
    fase: F-03.2
    status: concluida
    objetivo: Novo estado pedidoModoId (espelha mesaModoId) troca a tela do PDV para grade e carrinho com banner Acrescentando a Comanda #NN; o botao de confirmar chama a rota T-02.03 em vez de criar um pedido novo
    arquivos:
      cria: [test/pdv-comanda-modo.test.js]
      altera: [public/app.js]
    teste_integracao: Harness confirma que, com pedidoModoId setado, o clique em #pdvCobrar chama a funcao que faz POST para /api/pedidos/:id/itens (stub de api) em vez de abrirPdvPagar
    teste_funcional: Dado um carrinho com 1 item e pedidoModoId igual a 42, a funcao monta o corpo {itens:[...]} e chama api POST /api/pedidos/42/itens
    criterio_aceite: Stub de api recebe exatamente uma chamada POST para /api/pedidos/42/itens com o carrinho montado; abrirPdvPagar nao e chamada
    depende_de: [T-02.03, T-03.01]
    paralelizavel: false
    concluida_em: 2026-09-10
    suite: "2026-09-10 · suíte: 708 passed, 0 failed"
  - id: T-03.03
    titulo: Botao Acrescentar item no modal do pedido
    fase: F-03.3
    status: concluida
    objetivo: abrirModalPedido ganha o botao Acrescentar item (visivel quando podeModificar) que aciona o modo pedidoModoId (T-03.02) e navega para a aba PDV
    arquivos:
      cria: [test/pedido-modal-acrescentar-item.test.js]
      altera: [public/app.js]
    teste_integracao: Harness extrai abrirModalPedido e confirma que, para um pedido com podeModificar true, o HTML inclui o botao Acrescentar item; para recebido ou cancelado, o botao nao aparece
    teste_funcional: Dado um pedido a receber, clicar no botao Acrescentar item chama a funcao que ativa pedidoModoId com o id e numero do pedido
    criterio_aceite: Botao presente so quando podeModificar; clique dispara a ativacao do modo com o pedido correto
    depende_de: [T-03.02]
    paralelizavel: false
    concluida_em: 2026-09-10
    suite: "2026-09-10 · suíte: 711 passed, 0 failed"
---

# Tasks — Sprint 03

---

```yaml
id: T-03.01
titulo: Tile Comanda na tela de cobranca do PDV
objetivo: renderPdvPagar ganha o tipo Comanda ao lado de Balcao/Entrega/Retirada, comportando-se como Entrega/Retirada (sem bloco de pagamento, botao Abrir Comanda)
arquivos:
  cria: [test/pdv-comanda-tile.test.js]
  altera: [public/app.js]
teste_integracao: Harness extrai renderPdvPagar de public/app.js real (vm.runInNewContext) e confirma que o array de tipos de venda inclui Comanda
teste_funcional: Dado pdvTipoEntrega igual a Comanda, a funcao monta HTML sem o bloco de forma de pagamento e com o botao final rotulado Abrir Comanda
criterio_aceite: Harness confirma ausencia do bloco de pagamento e o texto do botao final quando pdvTipoEntrega e Comanda
depende_de: [T-02.01]
paralelizavel: false
status: concluida
concluida_em: 2026-09-10
suite: "2026-09-10 · suíte: 705 passed, 0 failed"
```

---

```yaml
id: T-03.02
titulo: Modo PDV acrescentando a Comanda existente
objetivo: Novo estado pedidoModoId (espelha mesaModoId) troca a tela do PDV para grade e carrinho com banner Acrescentando a Comanda #NN; o botao de confirmar chama a rota T-02.03 em vez de criar um pedido novo
arquivos:
  cria: [test/pdv-comanda-modo.test.js]
  altera: [public/app.js]
teste_integracao: Harness confirma que, com pedidoModoId setado, o clique em #pdvCobrar chama a funcao que faz POST para /api/pedidos/:id/itens (stub de api) em vez de abrirPdvPagar
teste_funcional: Dado um carrinho com 1 item e pedidoModoId igual a 42, a funcao monta o corpo {itens:[...]} e chama api POST /api/pedidos/42/itens
criterio_aceite: Stub de api recebe exatamente uma chamada POST para /api/pedidos/42/itens com o carrinho montado; abrirPdvPagar nao e chamada
depende_de: [T-02.03, T-03.01]
paralelizavel: false
status: concluida
concluida_em: 2026-09-10
suite: "2026-09-10 · suíte: 708 passed, 0 failed"
```

---

```yaml
id: T-03.03
titulo: Botao Acrescentar item no modal do pedido
objetivo: abrirModalPedido ganha o botao Acrescentar item (visivel quando podeModificar) que aciona o modo pedidoModoId (T-03.02) e navega para a aba PDV
arquivos:
  cria: [test/pedido-modal-acrescentar-item.test.js]
  altera: [public/app.js]
teste_integracao: Harness extrai abrirModalPedido e confirma que, para um pedido com podeModificar true, o HTML inclui o botao Acrescentar item; para recebido ou cancelado, o botao nao aparece
teste_funcional: Dado um pedido a receber, clicar no botao Acrescentar item chama a funcao que ativa pedidoModoId com o id e numero do pedido
criterio_aceite: Botao presente so quando podeModificar; clique dispara a ativacao do modo com o pedido correto
depende_de: [T-03.02]
paralelizavel: false
status: concluida
concluida_em: 2026-09-10
suite: "2026-09-10 · suíte: 711 passed, 0 failed"
```
