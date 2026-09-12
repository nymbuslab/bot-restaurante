---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-02
atualizado_em: 2026-09-10
tasks:
  - id: T-02.01
    titulo: Comanda como tipo de venda valido no PDV, sem cupom na abertura
    fase: F-02.1
    status: concluida
    objetivo: POST /api/pdv/vender aceita tipoEntrega Comanda, segue o mesmo caminho de Entrega/Retirada (sem caixa, a receber, origem pdv) e NAO enfileira cupom (D-14), so via de cozinha se houver item cozinha:true
    arquivos:
      cria: []
      altera: [src/servidor.js, test/integracao/pedidos-comanda.test.js]
    teste_integracao: POST /api/pdv/vender com tipoEntrega Comanda contra a fixture de pedidos-comanda.test.js retorna 200 com pedido.recebidoEm nulo, pedido.origem pdv, e nenhuma via de cupom na fila de impressao
    teste_funcional: Dado tipoEntrega Comanda e 1 item com cozinha:true, o pedido criado tem tipo_entrega Comanda, nao gera movimento de caixa, e a fila de impressao so tem a via de cozinha
    criterio_aceite: Resposta 200 com recebidoEm null; nenhuma linha nova em caixa_movimentos; impressao_fila nao contem via de cupom para esse pedido
    depende_de: [T-01.01]
    paralelizavel: false
    concluida_em: 2026-09-10
    suite: "2026-09-10 · suíte: 5 passed, 0 failed"
  - id: T-02.02
    titulo: Funcao acrescentarItens em pedidos.js
    fase: F-02.2
    status: concluida
    objetivo: src/pedidos.js ganha acrescentarItens(dir, pedidoId, {itens, subtotal}, client), que faz UPDATE incremental (append itens, soma total) so quando o pedido ainda esta editavel
    arquivos:
      cria: []
      altera: [src/pedidos.js, test/integracao/pedidos-comanda.test.js]
    teste_integracao: Chamando pedidos.acrescentarItens direto contra o Postgres de teste sobre um pedido a receber existente, o itens do banco cresce e o total soma o valor da rodada
    teste_funcional: Dado um pedido ja com recebido_em preenchido, acrescentarItens lanca erro e nao altera a linha
    criterio_aceite: Chamar a funcao sobre pedido recebido lanca Error; sobre pedido a receber, SELECT itens, total reflete o append e a soma
    depende_de: [T-01.01, T-02.01]
    paralelizavel: false
    concluida_em: 2026-09-10
    suite: "2026-09-10 · suíte: 7 passed, 0 failed"
  - id: T-02.03
    titulo: Rota POST /api/pedidos/:id/itens
    fase: F-02.2
    status: concluida
    objetivo: Nova rota replica o pipeline de POST /api/mesas/:id/pedido (recalcular, validar estoque, baixar estoque atomicamente, acrescentarItens, amarrar movimento, enfileirar cozinha so da rodada nova) para um pedido avulso
    arquivos:
      cria: []
      altera: [src/servidor.js, test/integracao/pedidos-comanda.test.js]
    teste_integracao: POST /api/pedidos/:id/itens com 1 item novo sobre um pedido a receber da fixture retorna 200, o GET seguinte do pedido mostra os itens antigos mais o novo, e o saldo de estoque do item caiu na mesma quantidade
    teste_funcional: Dado um item com estoque insuficiente, a rota responde 409 e nem o pedido nem o estoque sao alterados
    criterio_aceite: 200 com itens acrescidos, total correto e estoque baixado no caso feliz; 409 sem alteracao de pedido nem de estoque no caso de estoque insuficiente
    depende_de: [T-02.02]
    paralelizavel: false
    concluida_em: 2026-09-10
    suite: "2026-09-10 · suíte: 64 passed, 0 failed (integração completa)"
---

# Tasks — Sprint 02

---

```yaml
id: T-02.01
titulo: Comanda como tipo de venda valido no PDV, sem cupom na abertura
objetivo: POST /api/pdv/vender aceita tipoEntrega Comanda, segue o mesmo caminho de Entrega/Retirada (sem caixa, a receber, origem pdv) e NAO enfileira cupom (D-14), so via de cozinha se houver item cozinha:true
arquivos:
  cria: []
  altera: [src/servidor.js, test/integracao/pedidos-comanda.test.js]
teste_integracao: POST /api/pdv/vender com tipoEntrega Comanda contra a fixture de pedidos-comanda.test.js retorna 200 com pedido.recebidoEm nulo, pedido.origem pdv, e nenhuma via de cupom na fila de impressao
teste_funcional: Dado tipoEntrega Comanda e 1 item com cozinha:true, o pedido criado tem tipo_entrega Comanda, nao gera movimento de caixa, e a fila de impressao so tem a via de cozinha
criterio_aceite: Resposta 200 com recebidoEm null; nenhuma linha nova em caixa_movimentos; impressao_fila nao contem via de cupom para esse pedido
depende_de: [T-01.01]
paralelizavel: false
status: concluida
concluida_em: 2026-09-10
suite: "2026-09-10 · suíte: 5 passed, 0 failed"
```

---

```yaml
id: T-02.02
titulo: Funcao acrescentarItens em pedidos.js
objetivo: src/pedidos.js ganha acrescentarItens(dir, pedidoId, {itens, subtotal}, client), que faz UPDATE incremental (append itens, soma total) so quando o pedido ainda esta editavel
arquivos:
  cria: []
  altera: [src/pedidos.js, test/integracao/pedidos-comanda.test.js]
teste_integracao: Chamando pedidos.acrescentarItens direto contra o Postgres de teste sobre um pedido a receber existente, o itens do banco cresce e o total soma o valor da rodada
teste_funcional: Dado um pedido ja com recebido_em preenchido, acrescentarItens lanca erro e nao altera a linha
criterio_aceite: Chamar a funcao sobre pedido recebido lanca Error; sobre pedido a receber, SELECT itens, total reflete o append e a soma
depende_de: [T-01.01, T-02.01]
paralelizavel: false
status: concluida
concluida_em: 2026-09-10
suite: "2026-09-10 · suíte: 7 passed, 0 failed"
```

---

```yaml
id: T-02.03
titulo: Rota POST /api/pedidos/:id/itens
objetivo: Nova rota replica o pipeline de POST /api/mesas/:id/pedido (recalcular, validar estoque, baixar estoque atomicamente, acrescentarItens, amarrar movimento, enfileirar cozinha so da rodada nova) para um pedido avulso
arquivos:
  cria: []
  altera: [src/servidor.js, test/integracao/pedidos-comanda.test.js]
teste_integracao: POST /api/pedidos/:id/itens com 1 item novo sobre um pedido a receber da fixture retorna 200, o GET seguinte do pedido mostra os itens antigos mais o novo, e o saldo de estoque do item caiu na mesma quantidade
teste_funcional: Dado um item com estoque insuficiente, a rota responde 409 e nem o pedido nem o estoque sao alterados
criterio_aceite: 200 com itens acrescidos, total correto e estoque baixado no caso feliz; 409 sem alteracao de pedido nem de estoque no caso de estoque insuficiente
depende_de: [T-02.02]
paralelizavel: false
status: concluida
concluida_em: 2026-09-10
suite: "2026-09-10 · suíte: 64 passed, 0 failed (integração completa)"
```
