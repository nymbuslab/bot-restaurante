---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: paginacao-pedidos
sprint_id: sprint-01
atualizado_em: 2026-09-06
tasks:
  - id: T-01.01
    titulo: criar modulo puro de contagem para carregar mais
    fase: F-01.1
    status: concluida
    objetivo: extrair a conta de quantos pedidos mostrar para um arquivo dual-mode testavel, seguindo o padrao de public/busca.js
    arquivos:
      cria: [public/paginacao-pedidos.js, test/paginacao-pedidos.test.js]
      altera: []
    teste_integracao: test/paginacao-pedidos.test.js importa o modulo via require("../public/paginacao-pedidos") e roda com node --test sem erro de carregamento
    teste_funcional: contagemInicial(100,30) retorna 30, contagemInicial(5,30) retorna 5, proximaContagem(30,20,100) retorna 50, proximaContagem(90,20,100) retorna 100, temMais(100,100) retorna false e temMais(50,100) retorna true
    criterio_aceite: as tres funcoes (contagemInicial, proximaContagem, temMais) estao exportadas via module.exports e window.PaginacaoPedidos, e node --test test/paginacao-pedidos.test.js passa 100%
    depende_de: []
    paralelizavel: false
    concluida_em: "2026-09-06"
    suite: "7 passed, 0 failed (node --test test/paginacao-pedidos.test.js)"
---

# Tasks — Sprint 01

---

```yaml
id: T-01.01
titulo: Criar módulo puro de contagem para "Carregar mais"
objetivo: Extrair a conta de quantos pedidos mostrar para um arquivo dual-mode testável, seguindo o padrão de public/busca.js
arquivos:
  cria: [public/paginacao-pedidos.js, test/paginacao-pedidos.test.js]
  altera: []
teste_integracao: test/paginacao-pedidos.test.js importa o módulo via require("../public/paginacao-pedidos") e roda com node --test sem erro de carregamento
teste_funcional: contagemInicial(100,30) retorna 30, contagemInicial(5,30) retorna 5, proximaContagem(30,20,100) retorna 50, proximaContagem(90,20,100) retorna 100, temMais(100,100) retorna false e temMais(50,100) retorna true
criterio_aceite: As três funções (contagemInicial, proximaContagem, temMais) estão exportadas via module.exports e window.PaginacaoPedidos, e `node --test test/paginacao-pedidos.test.js` passa 100%
depende_de: []
paralelizavel: false
status: concluida
```
