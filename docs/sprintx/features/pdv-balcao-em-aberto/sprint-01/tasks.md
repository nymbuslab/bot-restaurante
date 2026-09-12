---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: pdv-balcao-em-aberto
sprint_id: sprint-01
atualizado_em: 2026-09-10
tasks:
  - id: T-01.01
    titulo: Fixture de teste da feature Comanda
    fase: F-01.1
    status: concluida
    objetivo: Criar o arquivo de teste de integracao com a fixture (empresa Plano Completo, cardapio com item cozinha e item sem cozinha, caixa aberto) que as demais sprints da feature vao usar
    arquivos:
      cria: [test/integracao/pedidos-comanda.test.js]
      altera: []
    teste_integracao: O arquivo sobe uma empresa Plano Completo com cardapio de 2 itens (um cozinha:true, outro sem) e caixa aberto, e GET /api/cardapio confirma os 2 itens
    teste_funcional: Dado o before() da fixture, loja.token e o cardapio ficam disponiveis para os testes seguintes do arquivo
    criterio_aceite: "node --test test/integracao/pedidos-comanda.test.js roda e passa com pelo menos 1 teste verde"
    depende_de: []
    paralelizavel: true
    concluida_em: 2026-09-10
    suite: "2026-09-10 · suíte: 1 passed, 0 failed"
---

# Tasks — Sprint 01

---

```yaml
id: T-01.01
titulo: Fixture de teste da feature Comanda
objetivo: Criar o arquivo de teste de integracao com a fixture (empresa Plano Completo, cardapio com item cozinha e item sem cozinha, caixa aberto) que as demais sprints da feature vao usar
arquivos:
  cria: [test/integracao/pedidos-comanda.test.js]
  altera: []
teste_integracao: O arquivo sobe uma empresa Plano Completo com cardapio de 2 itens (um cozinha:true, outro sem) e caixa aberto, e GET /api/cardapio confirma os 2 itens
teste_funcional: Dado o before() da fixture, loja.token e o cardapio ficam disponiveis para os testes seguintes do arquivo
criterio_aceite: node --test test/integracao/pedidos-comanda.test.js roda e passa com pelo menos 1 teste verde
depende_de: []
paralelizavel: true
status: pendente
```
