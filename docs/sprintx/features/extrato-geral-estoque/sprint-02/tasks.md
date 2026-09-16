---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: extrato-geral-estoque
sprint_id: sprint-02
atualizado_em: 2026-09-16
tasks:
  - id: T-02.01
    titulo: listarGeral em estoque-db.js
    fase: F-02.1
    status: pendente
    objetivo: Consultar estoque_movimentos de todos os produtos do tenant, paginada por cursor, com filtro opcional por tipos e periodo
    arquivos:
      cria: [test/estoque-db-geral.test.js]
      altera: [src/estoque-db.js]
    teste_integracao: "Mock de db.query confirma o SQL gerado filtra so por empresa_id + tipo = ANY(tipos) + periodo quando informados, nunca por item_id, inspecionando o SQL/params reais (nao um mock que ja devolve linhas pre-filtradas)"
    teste_funcional: "Dado tipos=[entrada,perda] e um cursor antes/antesId, listarGeral devolve so linhas desses tipos anteriores ao cursor, ordenadas por criado_em DESC"
    criterio_aceite: "listarGeral(dir, {}) sem filtro nenhum devolve todas as linhas do tenant; com tipos, o SQL gerado tem tipo = ANY($n) com os valores certos; com periodo, o SQL tem a clausula de data certa; paginacao por cursor nunca repete nem pula linha"
    depende_de: []
    paralelizavel: false
    concluida_em: null
    suite: nao_executada
  - id: T-02.02
    titulo: Rota GET /api/estoque/geral
    fase: F-02.1
    status: pendente
    objetivo: Expor listarGeral via HTTP com os mesmos gates de plano e permissao da rota de produto unico
    arquivos:
      cria: [test/integracao/estoque-extrato-geral.test.js]
      altera: [src/servidor.js]
    teste_integracao: "HTTP real (test:integracao) contra Postgres de testes: 200 com movimentos para tenant com Plano Completo e permissao estoque.ver; 403 sem o plano (exigePdv); 403 com o plano mas SEM a permissao estoque.ver (exigePermissao), reaproveitando o padrao de criar ator sem a permissao de test/integracao/equipe-rotas.test.js:94-112"
    teste_funcional: "Requisicao com tipos=entrada,perda e desde/ate devolve so os movimentos que casam com esse filtro, no formato { movimentos: [...] }"
    criterio_aceite: "Rota aplica exigeAuth + exigePermissao(estoque.ver) + exigePdv, na mesma ordem das rotas irmas; ambos os 403 (sem plano, sem permissao) tem teste proprio; resposta tem o mesmo shape de campos que /api/estoque/movimentos (mapRow)"
    depende_de: [T-02.01]
    paralelizavel: false
    concluida_em: null
    suite: nao_executada
---

# Tasks — Sprint 02

---

```yaml
id: T-02.01
titulo: listarGeral em estoque-db.js
objetivo: Consultar estoque_movimentos de todos os produtos do tenant, paginada por cursor, com filtro opcional por tipos e período
arquivos:
  cria: [test/estoque-db-geral.test.js]
  altera: [src/estoque-db.js]
teste_integracao: Mock de `db.query` confirma o SQL gerado filtra só por `empresa_id` + `tipo = ANY(tipos)` + período quando informados, nunca por `item_id` — inspecionando o SQL/params reais, não um mock que já devolve linhas pré-filtradas
teste_funcional: Dado `tipos=[entrada,perda]` e um cursor `antes`/`antesId`, `listarGeral` devolve só linhas desses tipos anteriores ao cursor, ordenadas por `criado_em DESC`
criterio_aceite: "`listarGeral(dir, {})` sem filtro nenhum devolve todas as linhas do tenant; com `tipos`, o SQL gerado tem `tipo = ANY($n)` com os valores certos; com período, o SQL tem a cláusula de data certa; paginação por cursor nunca repete nem pula linha"
depende_de: []
paralelizavel: false
status: pendente
```

Assinatura: `listarGeral(dir, { tipos = null, desde = null, ate = null, limite = 30, antes = null, antesId = null })`.
`tipos` é um array de valores de `TIPOS` ou `null`/`undefined` (sem filtro — devolve todos os
6 tipos); a decisão de qual subconjunto vem marcado por padrão na tela é do front-end (D-01),
não desta função. Mesma forma de paginação de `listar()` (cursor `(criado_em, id) <
(antes, antesId)`, `ORDER BY criado_em DESC, id DESC`, `limite` clampado `[1,100]`).
Reaproveitar `mapRow` já existente.

**Nota de execução (achado MÉDIA da F5):** antes de fechar a task, semear ao menos 5.000 linhas
sintéticas em `estoque_movimentos` (no projeto de testes) e rodar `EXPLAIN` da consulta com
filtro de `tipo` contra esse volume, decidindo ali se o índice existente
(`estoque_mov_data_idx`, `empresa_id, criado_em DESC`) é suficiente ou se pede um índice
composto `(empresa_id, tipo, criado_em DESC)`. Registrar o resultado em prosa nesta task ao
concluir — é o risco já levantado em `base/schema-e-consultas-estoque.md` que a F3 original
tinha deixado sem tratamento.

---

```yaml
id: T-02.02
titulo: Rota GET /api/estoque/geral
objetivo: Expor listarGeral via HTTP com os mesmos gates de plano e permissão da rota de produto único
arquivos:
  cria: [test/integracao/estoque-extrato-geral.test.js]
  altera: [src/servidor.js]
teste_integracao: HTTP real (`test:integracao`) contra Postgres de testes — 200 com movimentos para tenant com Plano Completo e permissão `estoque.ver`; 403 sem o plano (`exigePdv`); 403 com o plano mas SEM a permissão `estoque.ver` (`exigePermissao`), reaproveitando o padrão de criar ator sem a permissão de `test/integracao/equipe-rotas.test.js:94-112`
teste_funcional: Requisição com `tipos=entrada,perda` e `desde`/`ate` devolve só os movimentos que casam com esse filtro, no formato `{ movimentos: [...] }`
criterio_aceite: Rota aplica `exigeAuth` + `exigePermissao("estoque.ver")` + `exigePdv`, na mesma ordem das rotas irmãs; ambos os 403 (sem plano, sem permissão) têm teste próprio; resposta tem o mesmo shape de campos que `/api/estoque/movimentos` (`mapRow`)
depende_de: [T-02.01]
paralelizavel: false
status: pendente
```

Rota fica junto das demais em `src/servidor.js` (bloco "CONTROLE DE ESTOQUE"), abaixo de
`GET /api/estoque/movimentos`. Query params: `tipos` (string separada por vírgula, ex.
`entrada,perda`), `desde`, `ate` (`YYYY-MM-DD`, mesma validação `dataOk` já usada em Pedidos),
`limite`, `antes`, `antesId` — mesmos nomes da rota de produto único, para consistência.
