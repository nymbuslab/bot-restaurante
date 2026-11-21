---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: comandas-abertas-mesas
sprint_id: sprint-01
atualizado_em: 2026-11-12
tasks:
  - id: T-01.01
    titulo: Criar fixtures de comanda
    fase: F-01.1
    status: concluida
    objetivo: Criar dados reutilizaveis para os testes de listagem detalhe e estados operacionais
    arquivos:
      cria: [test/fixtures/comandas.js, test/comandas-fixtures.test.js]
      altera: []
    teste_integracao: Importa a fixture no runner nativo e valida seu contrato compartilhado
    teste_funcional: Monta comanda aberta com caixa fechado e permissoes distintas
    criterio_aceite: npm test executa a fixture sem acessar banco real
    origem: [capacidade-teste]
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-11-12
    suite: verde
---

# Tasks - Sprint 01

## T-01.01 - Criar fixtures de comanda

```yaml
id: T-01.01
titulo: Criar fixtures de comanda
objetivo: Criar dados reutilizaveis para os testes de listagem detalhe e estados operacionais
arquivos:
  cria: [test/fixtures/comandas.js, test/comandas-fixtures.test.js]
  altera: []
teste_integracao: Importa a fixture no runner nativo e valida seu contrato compartilhado
teste_funcional: Monta comanda aberta com caixa fechado e permissoes distintas
criterio_aceite: npm test executa a fixture sem acessar banco real
origem: [capacidade-teste]
depende_de: []
paralelizavel: false
status: concluida
```

2026-11-12 · suíte: 806 passed, 0 failed · real: 0,4 h

A fixture é importada pelo runner nativo (`node --test`) e não toca banco: `test/comandas-fixtures.test.js` valida o contrato (comanda aberta, caixa fechado e permissões separadas) e é usada pelos testes de domínio de comanda.
