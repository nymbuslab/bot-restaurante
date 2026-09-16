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
    status: concluida
    objetivo: Consultar estoque_movimentos de todos os produtos do tenant, paginada por cursor, com filtro opcional por tipos e periodo
    arquivos:
      cria: [test/estoque-db-geral.test.js]
      altera: [src/estoque-db.js]
    teste_integracao: "Mock de db.query confirma o SQL gerado filtra so por empresa_id + tipo = ANY(tipos) + periodo quando informados, nunca por item_id, inspecionando o SQL/params reais (nao um mock que ja devolve linhas pre-filtradas)"
    teste_funcional: "Dado tipos=[entrada,perda] e um cursor antes/antesId, listarGeral devolve so linhas desses tipos anteriores ao cursor, ordenadas por criado_em DESC"
    criterio_aceite: "listarGeral(dir, {}) sem filtro nenhum devolve todas as linhas do tenant; com tipos, o SQL gerado tem tipo = ANY($n) com os valores certos; com periodo, o SQL tem a clausula de data certa; paginacao por cursor nunca repete nem pula linha"
    depende_de: []
    paralelizavel: false
    concluida_em: 2026-09-16
    suite: verde
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
status: concluida
```

Assinatura real: `listarGeral(dir, { tipos = null, periodo = null, desde = null, ate = null, limite = 30, antes = null, antesId = null })`
(`src/estoque-db.js`). `tipos` é um array de valores de `TIPOS` ou `null`/`undefined` (sem
filtro — devolve todos os 6 tipos); a decisão de qual subconjunto vem marcado por padrão na
tela é do front-end (D-01), não desta função. Mesma forma de paginação de `listar()` (cursor
`(criado_em, id) < (antes, antesId)`, `ORDER BY criado_em DESC, id DESC`, `limite` clampado
`[1,100]`). Reaproveita `mapRow` já existente.

**Divergência da F6 em relação ao texto original da task:** o parâmetro `periodo`
(`'hoje'|'7dias'`) foi acrescentado além de `desde`/`ate` — a especificação original desta task
só citava `desde`/`ate`, mas o teste funcional da T-03.02 (Sprint 03) já esperava a query string
`periodo=hoje` chegando pronta na API para o preset "Hoje" (D-06: "mesmo padrão já usado na aba
Pedidos"), e `GET /api/pedidos` resolve esse preset no servidor via `pedidos.lerTodos`, não no
front. Sem o parâmetro `periodo` aqui, os botões de preset da Sprint 03 filtrariam silenciosamente
errado (a API ignoraria o parâmetro e devolveria tudo). `listarGeral` replica literalmente o mesmo
recorte por fuso `America/Sao_Paulo` de `pedidos.lerTodos` (`src/pedidos.js:110-123`) para `hoje`
e `7dias`; presets têm prioridade sobre `desde`/`ate` quando os dois vierem juntos, mesma regra
de `pedidos.lerTodos`.

**Nota de execução (achado MÉDIA da F5) — resultado do EXPLAIN:** semeadas 5.000 linhas
sintéticas em `estoque_movimentos` num tenant descartável do projeto de testes (6 tipos
intercalados, datas espalhadas) e rodado `EXPLAIN ANALYZE` da consulta com `tipo = ANY(...)`,
com e sem cursor. Em ambos os casos o planner usa `Index Scan` em `estoque_mov_data_idx`
(`empresa_id, criado_em DESC`) por `empresa_id`, aplica o filtro de `tipo` como `Filter`
pós-scan e para assim que enche o `LIMIT 30` (poucas dezenas de linhas removidas pelo filtro,
não milhares) — `Execution Time` ~0,1-0,7 ms nos dois casos. **Decisão: o índice existente é
suficiente**; não é preciso o índice composto `(empresa_id, tipo, criado_em DESC)` agora. Motivo:
o corte por `empresa_id` já reduz o conjunto para o tamanho de um tenant antes do filtro de tipo
entrar, e a ordenação por `criado_em DESC` já é servida pelo índice (`Incremental Sort`,
`Presorted Key: criado_em`) — o filtro de tipo nunca precisa varrer além de poucas páginas para
achar 30 linhas. Reavaliar se o volume por tenant crescer múltiplas ordens de grandeza (o risco
segue registrado em `base/schema-e-consultas-estoque.md`).

Suíte: `test/estoque-db-geral.test.js` (7 testes) + `test/estoque-db.test.js` (6 testes),
incluídos nos 768/768 de `npm test` — 2026-09-16 · real: 1,0 h.

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
status: concluida
```

**Divergência da F6:** o cenário de permissão ausente não reaproveitou
`test/integracao/equipe-rotas.test.js:94-112` literalmente (aquele teste usa a mesma conta
dono/funcionário de um `before` já montado para outro assunto) — replicou o MESMO padrão
(criar funcionário perfil `caixa`, autorizar dispositivo, login por PIN) num `before` próprio
deste arquivo, porque o cenário aqui precisa de um tenant com Plano Completo e movimentos
semeados que o harness de equipe não monta. `tipos` foi testado; `desde`/`ate` como filtro de
data já tem cobertura equivalente em `test/estoque-db-geral.test.js` (T-02.01) — o teste
funcional desta task focou em `tipos` para não duplicar asserção de SQL já provada uma camada
abaixo.

Suíte: `test/integracao/estoque-extrato-geral.test.js` (4 testes), verde isoladamente
(`node --test test/integracao/estoque-extrato-geral.test.js`) e no `npm run test:integracao`
completo (96/96) — 2026-09-16 · real: 0,75 h.

Rota fica junto das demais em `src/servidor.js` (bloco "CONTROLE DE ESTOQUE"), abaixo de
`GET /api/estoque/movimentos`. Query params: `tipos` (string separada por vírgula, ex.
`entrada,perda`), `desde`, `ate` (`YYYY-MM-DD`, mesma validação `dataOk` já usada em Pedidos),
`limite`, `antes`, `antesId` — mesmos nomes da rota de produto único, para consistência.
