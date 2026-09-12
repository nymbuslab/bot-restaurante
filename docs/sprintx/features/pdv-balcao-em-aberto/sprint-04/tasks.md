---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-04
atualizado_em: 2026-09-10
tasks:
  - id: T-04.01
    titulo: Segundo aviso ao cancelar item ja enviado a cozinha
    fase: F-04.1
    status: concluida
    objetivo: "No abrirModalPedido, cancelar item com cozinha:true mantem o confirmarComOpcao que ja existe hoje para qualquer item E acrescenta, antes dele, um segundo aviso especifico dizendo que o item ja foi enviado a cozinha (D-08); item sem cozinha:true continua exatamente como hoje, com um so dialogo"
    arquivos:
      cria: [test/pedido-modal-cancelar-aviso.test.js]
      altera: [public/app.js]
    teste_integracao: "Harness extrai o handler de cancelar item de abrirModalPedido (public/app.js:5541-5567) e confirma que, para um item cozinha:true, DOIS dialogos sao chamados em sequencia (o aviso de cozinha, depois confirmarComOpcao) antes do POST cancelar-item"
    teste_funcional: "Dado um item sem cozinha:true, so o confirmarComOpcao de hoje e chamado (nenhum dialogo a mais), exatamente como o comportamento atual"
    criterio_aceite: "Item cozinha:true dispara os dois dialogos antes do POST; item sem cozinha:true dispara so o confirmarComOpcao existente, sem regressao no fluxo atual (incluindo a opcao de devolver ao estoque)"
    depende_de: [T-03.03]
    paralelizavel: true
    concluida_em: 2026-09-10
    suite: "2026-09-10 · suíte: 714 passed, 0 failed"
  - id: T-04.02
    titulo: Fechamento de Comanda via Receber pagamento sem mudanca de codigo
    fase: F-04.2
    status: concluida
    objetivo: Provar por teste que um pedido tipoEntrega Comanda fecha pelo POST /api/caixa/receber/:id ja existente, sem alteracao nenhuma em src/caixa.js ou src/servidor.js
    arquivos:
      cria: []
      altera: [test/integracao/pedidos-comanda.test.js]
    teste_integracao: Cria um pedido Comanda, chama POST /api/caixa/receber/:id com pagamento igual ao total, e confirma 200 com recebidoEm preenchido
    teste_funcional: Dado pagamento diferente do total, a rota responde 400 com a mesma mensagem que ja existe para Entrega/Retirada
    criterio_aceite: Pagamento exato fecha o pedido (recebidoEm setado, caixa_movimentos criado); pagamento divergente retorna 400
    depende_de: [T-02.03]
    paralelizavel: true
    concluida_em: 2026-09-10
    suite: "2026-09-10 · suíte: 67 passed, 0 failed (integração completa)"
  - id: T-04.03
    titulo: Fim a fim - Comanda com duas rodadas
    fase: F-04.3
    status: concluida
    objetivo: Teste de integracao cobre abrir Comanda, acrescentar itens em 2 rodadas, cancelar 1 item, e fechar via Receber pagamento, conferindo total final e a via de cozinha da 2a rodada
    arquivos:
      cria: []
      altera: [test/integracao/pedidos-comanda.test.js]
    teste_integracao: Sequencia completa (criar, acrescentar 2x, cancelar item, receber) contra o Postgres de teste confirma o total final e o conteudo de impressao_fila da 2a rodada
    teste_funcional: Dado 2 rodadas com itens diferentes, o total do pedido bate com a soma das duas rodadas menos o item cancelado
    criterio_aceite: Total final correto; linha de impressao_fila da 2a rodada contem so os itens daquela rodada, nao repete a 1a
    depende_de: [T-02.03, T-04.02]
    paralelizavel: false
    concluida_em: 2026-09-10
    suite: "2026-09-10 · suíte: 67 passed, 0 failed (integração completa)"
---

# Tasks — Sprint 04

---

```yaml
id: T-04.01
titulo: Segundo aviso ao cancelar item ja enviado a cozinha
objetivo: No abrirModalPedido, cancelar item com cozinha:true mantem o confirmarComOpcao que ja existe hoje para qualquer item E acrescenta, antes dele, um segundo aviso especifico dizendo que o item ja foi enviado a cozinha (D-08); item sem cozinha:true continua exatamente como hoje, com um so dialogo
arquivos:
  cria: [test/pedido-modal-cancelar-aviso.test.js]
  altera: [public/app.js]
teste_integracao: Harness extrai o handler de cancelar item de abrirModalPedido (public/app.js:5541-5567) e confirma que, para um item cozinha:true, DOIS dialogos sao chamados em sequencia (o aviso de cozinha, depois confirmarComOpcao) antes do POST cancelar-item
teste_funcional: Dado um item sem cozinha:true, so o confirmarComOpcao de hoje e chamado (nenhum dialogo a mais), exatamente como o comportamento atual
criterio_aceite: Item cozinha:true dispara os dois dialogos antes do POST; item sem cozinha:true dispara so o confirmarComOpcao existente, sem regressao no fluxo atual (incluindo a opcao de devolver ao estoque)
depende_de: [T-03.03]
paralelizavel: true
status: concluida
concluida_em: 2026-09-10
suite: "2026-09-10 · suíte: 714 passed, 0 failed"
```

---

```yaml
id: T-04.02
titulo: Fechamento de Comanda via Receber pagamento sem mudanca de codigo
objetivo: Provar por teste que um pedido tipoEntrega Comanda fecha pelo POST /api/caixa/receber/:id ja existente, sem alteracao nenhuma em src/caixa.js ou src/servidor.js
arquivos:
  cria: []
  altera: [test/integracao/pedidos-comanda.test.js]
teste_integracao: Cria um pedido Comanda, chama POST /api/caixa/receber/:id com pagamento igual ao total, e confirma 200 com recebidoEm preenchido
teste_funcional: Dado pagamento diferente do total, a rota responde 400 com a mesma mensagem que ja existe para Entrega/Retirada
criterio_aceite: Pagamento exato fecha o pedido (recebidoEm setado, caixa_movimentos criado); pagamento divergente retorna 400
depende_de: [T-02.03]
paralelizavel: true
status: concluida
concluida_em: 2026-09-10
suite: "2026-09-10 · suíte: 67 passed, 0 failed (integração completa)"

---

```yaml
id: T-04.03
titulo: Fim a fim - Comanda com duas rodadas
objetivo: Teste de integracao cobre abrir Comanda, acrescentar itens em 2 rodadas, cancelar 1 item, e fechar via Receber pagamento, conferindo total final e a via de cozinha da 2a rodada
arquivos:
  cria: []
  altera: [test/integracao/pedidos-comanda.test.js]
teste_integracao: Sequencia completa (criar, acrescentar 2x, cancelar item, receber) contra o Postgres de teste confirma o total final e o conteudo de impressao_fila da 2a rodada
teste_funcional: Dado 2 rodadas com itens diferentes, o total do pedido bate com a soma das duas rodadas menos o item cancelado
criterio_aceite: Total final correto; linha de impressao_fila da 2a rodada contem so os itens daquela rodada, nao repete a 1a
depende_de: [T-02.03, T-04.02]
paralelizavel: false
status: concluida
concluida_em: 2026-09-10
suite: "2026-09-10 · suíte: 67 passed, 0 failed (integração completa)"
