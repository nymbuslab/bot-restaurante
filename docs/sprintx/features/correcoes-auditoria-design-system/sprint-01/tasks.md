---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: correcoes-auditoria-design-system
sprint_id: sprint-01
atualizado_em: 2026-09-05
tasks:
  - id: T-01.01
    titulo: Criar helpers de teste estatico contemTrecho e trechoEntre
    fase: F-01.1
    status: concluida
    objetivo: Prover duas funcoes reutilizaveis -- uma que confirma presenca de texto num arquivo, outra que isola um trecho por marcadores -- para lastrear os testes escopados da sprint-02
    arquivos:
      cria: [test/apoio/arquivo-estatico.js, test/arquivo-estatico.test.js]
      altera: []
    teste_integracao: Um teste node:test importa os dois helpers e confirma que contemTrecho encontra o aria-label="Fechar" ja existente em public/admin-master.html:293, e que trechoEntre isola corretamente o corpo de uma funcao conhecida (ex. painelCarregando, public/app.js:2067-2069) usando o nome da funcao e o proximo "function" como marcadores
    teste_funcional: Dado um caminho e um trecho presente no arquivo, contemTrecho retorna true; dado um trecho ausente, retorna false; dado um caminho e dois marcadores presentes na ordem certa, trechoEntre retorna a substring entre eles; dado marcadores na ordem errada ou ausentes, trechoEntre retorna null
    criterio_aceite: node --test test/arquivo-estatico.test.js termina com 0 failed; test/apoio/arquivo-estatico.js exporta contemTrecho e trechoEntre via module.exports
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-05
    suite: 546 passed, 0 failed
---

# Tasks — Sprint 01

> **Ajuste da F5 (reauditoria, achado MÉDIA):** a primeira versão desta task só criava
> `contemTrecho` (presença de texto no arquivo inteiro). Seis tasks da sprint-02 (T-02.01,
> T-02.04, T-02.05, T-02.06, T-02.07, T-02.12) precisam ISOLAR um trecho (corpo de função,
> bloco de um id/seletor) antes de aplicar `contemTrecho`, para não colidir com texto igual em
> outro lugar do mesmo arquivo — sem um helper de escopo compartilhado, cada uma reimplementaria
> essa extração de forma própria e não testada. `trechoEntre` fecha essa lacuna.

---

```yaml
id: T-01.01
titulo: Criar helpers de teste estático contemTrecho e trechoEntre
objetivo: Prover duas funções reutilizáveis — uma que confirma presença de texto num arquivo, outra que isola um trecho por marcadores — para lastrear os testes escopados da sprint-02
arquivos:
  cria: [test/apoio/arquivo-estatico.js, test/arquivo-estatico.test.js]
  altera: []
teste_integracao: Um teste node:test importa os dois helpers e confirma que contemTrecho encontra o aria-label="Fechar" já existente em public/admin-master.html:293, e que trechoEntre isola corretamente o corpo de uma função conhecida (ex. painelCarregando, public/app.js:2067-2069) usando o nome da função e o próximo "function" como marcadores
teste_funcional: Dado um caminho e um trecho presente no arquivo, contemTrecho retorna true; dado um trecho ausente, retorna false; dado um caminho e dois marcadores presentes na ordem certa, trechoEntre retorna a substring entre eles; dado marcadores na ordem errada ou ausentes, trechoEntre retorna null
criterio_aceite: node --test test/arquivo-estatico.test.js termina com 0 failed; test/apoio/arquivo-estatico.js exporta contemTrecho e trechoEntre via module.exports
depende_de: []
paralelizavel: false
status: pendente
```
