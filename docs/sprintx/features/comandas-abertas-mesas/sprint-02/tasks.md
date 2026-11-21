---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: comandas-abertas-mesas
sprint_id: sprint-02
atualizado_em: 2026-11-12
tasks:
  - id: T-02.01
    titulo: Listar e detalhar comandas
    fase: F-02.1
    status: bloqueada
    objetivo: Expor lista e detalhe de comandas abertas sem filtro de data
    arquivos:
      cria: [test/integracao/comandas-abertas.test.js]
      altera: [src/pedidos.js, src/servidor.js]
    teste_integracao: Consulta duas comandas de datas distintas e recebe ambas na ordem mais antiga primeiro
    teste_funcional: Rejeita pedido recebido cancelado ou de origem diferente de pdv comanda
    criterio_aceite: GET de lista e detalhe exige pdv.operar e retorna somente comandas abertas
    origem: [D-03, D-04, D-07, D-09, D-12, D-13]
    depende_de: []
    paralelizavel: false
    concluida_em: null
    suite: nao_executada
  - id: T-02.02
    titulo: Acrescentar itens na comanda
    fase: F-02.2
    status: bloqueada
    objetivo: Acrescentar rodada com pdv.operar e caixa valido usando o servico existente
    arquivos:
      cria: []
      altera: [src/servidor.js, test/integracao/comandas-abertas.test.js]
    teste_integracao: POST acrescenta item com caixa aberto e recusa caixa fechado ou vencido
    teste_funcional: Mantem a comanda original quando a validacao da nova rodada falha
    criterio_aceite: Endpoint dedicado acrescenta itens sem duplicar regra de estoque ou pedido
    origem: [D-02, D-07, D-09, D-13]
    depende_de: [T-02.01]
    paralelizavel: false
    concluida_em: null
    suite: nao_executada
  - id: T-02.03
    titulo: Imprimir pre-conta
    fase: F-02.2
    status: bloqueada
    objetivo: Enfileirar apenas a pre-conta da comanda aberta
    arquivos:
      cria: []
      altera: [src/servidor.js, test/integracao/comandas-abertas.test.js]
    teste_integracao: POST de impressao cria somente uma via de pre-conta para a comanda aberta
    teste_funcional: Permite imprimir com caixa fechado e recusa pedido que nao seja comanda aberta
    criterio_aceite: Impressao manual nao cria via de cozinha
    origem: [D-07, D-09, D-10, D-13]
    depende_de: [T-02.02]
    paralelizavel: false
    concluida_em: null
    suite: nao_executada
---

# Tasks - Sprint 02

## T-02.01 - Listar e detalhar comandas

```yaml
id: T-02.01
titulo: Listar e detalhar comandas
objetivo: Expor lista e detalhe de comandas abertas sem filtro de data
arquivos:
  cria: [test/integracao/comandas-abertas.test.js]
  altera: [src/pedidos.js, src/servidor.js]
teste_integracao: Consulta duas comandas de datas distintas e recebe ambas na ordem mais antiga primeiro
teste_funcional: Rejeita pedido recebido cancelado ou de origem diferente de pdv comanda
criterio_aceite: GET de lista e detalhe exige pdv.operar e retorna somente comandas abertas
origem: [D-03, D-04, D-07, D-09, D-12, D-13]
depende_de: []
paralelizavel: false
status: bloqueada
```

BLOQUEADA (B-01). Implementação pronta: `listarComandasAbertas`/`lerComandaAberta` em `src/pedidos.js` (origem `pdv`, `tipo_entrega = 'Comanda'`, `recebido_em IS NULL`, `status <> 'cancelado'`, ordem `criado_em ASC`) e as rotas `GET /api/comandas/abertas` e `GET /api/comandas/:id` com `exigePermissao("pdv.operar")` + `exigePdv`. O teste de integração está escrito em `test/integracao/comandas-abertas.test.js`, mas `npm run test:integracao` não roda neste ambiente: falta `.env.test` de um projeto Supabase descartável. A cobertura executável hoje é unitária, com `db.query` por stub (`test/comandas-pedidos.test.js`).

## T-02.02 - Acrescentar itens na comanda

```yaml
id: T-02.02
titulo: Acrescentar itens na comanda
objetivo: Acrescentar rodada com pdv.operar e caixa valido usando o servico existente
arquivos:
  cria: []
  altera: [src/servidor.js, test/integracao/comandas-abertas.test.js]
teste_integracao: POST acrescenta item com caixa aberto e recusa caixa fechado ou vencido
teste_funcional: Mantem a comanda original quando a validacao da nova rodada falha
criterio_aceite: Endpoint dedicado acrescenta itens sem duplicar regra de estoque ou pedido
origem: [D-02, D-07, D-09, D-13]
depende_de: [T-02.01]
paralelizavel: false
status: bloqueada
```

BLOQUEADA (B-02, mesmo ambiente de B-01 e dependente de T-02.01). Implementação pronta: `POST /api/comandas/:id/itens` exige `pdv.operar`, confere caixa aberto e não vencido (400 com `caixaFechado`/`caixaVencido`), confere que o id é comanda aberta e delega para `acrescentarItensPedido` (mesma regra de estoque/impressão da rota de Pedidos). O caso de integração está escrito e não executado.

## T-02.03 - Imprimir pré-conta

```yaml
id: T-02.03
titulo: Imprimir pre-conta
objetivo: Enfileirar apenas a pre-conta da comanda aberta
arquivos:
  cria: []
  altera: [src/servidor.js, test/integracao/comandas-abertas.test.js]
teste_integracao: POST de impressao cria somente uma via de pre-conta para a comanda aberta
teste_funcional: Permite imprimir com caixa fechado e recusa pedido que nao seja comanda aberta
criterio_aceite: Impressao manual nao cria via de cozinha
origem: [D-07, D-09, D-10, D-13]
depende_de: [T-02.02]
paralelizavel: false
status: bloqueada
```

BLOQUEADA (B-03, mesmo ambiente de B-01 e dependente de T-02.02). Implementação pronta: `POST /api/comandas/:id/imprimir-pre-conta` exige `pdv.operar` + `exigeImpressao`, monta a via com `montarPreConta({rotulo: "Comanda"})` e enfileira só em `comanda-pre-conta` (sem via de cozinha). O caso de integração está escrito e não executado.
