---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: extrato-geral-estoque
sprint_id: sprint-03
atualizado_em: 2026-09-16
tasks:
  - id: T-03.01
    titulo: Item de menu e secao Relatorios com bloqueio de plano
    fase: F-03.1
    status: concluida
    objetivo: Criar o item de menu Relatorios e a secao HTML, com o mesmo bloqueio de Plano Completo ja usado em Controle de estoque
    arquivos:
      cria: [test/relatorios-aba-scaffold.test.js]
      altera: [public/admin.html]
    teste_integracao: "contemTrecho confirma que admin.html tem o botao de nav data-aba=relatorios e a secao #aba-relatorios"
    teste_funcional: "contemTrecho confirma que a secao tem o bloco de bloqueio (ex.: #relatoriosLock) no mesmo padrao visual de #estoqueLock"
    criterio_aceite: "nav tem botao data-aba='relatorios'; secao #aba-relatorios existe com bloqueio de Plano Completo; sem conteudo do extrato ainda"
    depende_de: [T-01.01]
    paralelizavel: true
    concluida_em: 2026-09-16
    suite: verde
  - id: T-03.02
    titulo: Montagem da query string dos filtros
    fase: F-03.1
    status: concluida
    objetivo: Funcao pura que monta os query params de GET /api/estoque/geral a partir dos filtros de tipo e periodo escolhidos na tela
    arquivos:
      cria: [public/extrato-estoque.js, test/extrato-estoque.test.js]
      altera: []
    teste_integracao: "modulo e dual-mode: expoe window.ExtratoEstoque no browser (contemTrecho)"
    teste_funcional: "dado tipos=[entrada,perda] e periodo customizado com desde/ate, monta tipos=entrada,perda&desde=...&ate=...; dado periodo hoje, monta so periodo=hoje sem desde/ate"
    criterio_aceite: "funcao pura, sem DOM, testavel isoladamente, seguindo o padrao dual-mode de public/busca.js"
    depende_de: [T-01.01]
    paralelizavel: true
    concluida_em: 2026-09-16
    suite: verde
  - id: T-03.03
    titulo: Carregamento e renderizacao do extrato geral
    fase: F-03.2
    status: concluida
    objetivo: Carregar e renderizar a lista de movimentos com Carregar mais por cursor, reaproveitando os estados padrao (vazio/erro/carregando)
    arquivos:
      cria: []
      altera: [public/app.js, public/admin.html]
    teste_integracao: "recorte por funcao (padrao trechoDaFuncaoAntesDoAwait de test/design-system-carregando.test.js), NAO contemTrecho no arquivo inteiro — antes= e antesId= ja existem em app.js:1132 (estCarregarExtrato, gaveta de 1 produto); sem recorte o teste acharia o trecho errado. Isolar o corpo da nova funcao (ex.: carregarExtratoGeral) antes de checar antes=/antesId= dentro dele"
    teste_funcional: "verificarCarregando confirma que o estado Carregando e atribuido antes do await api(...), mesmo padrao de carregarPedidos/carregarEstoque"
    criterio_aceite: "lista renderiza os movimentos devolvidos pela API; Carregar mais nunca repete nem pula linha (cursor por par criado_em+id); estado carregando coberto por teste (verificarCarregando); estados vazio/erro reaproveitam literalmente o HTML/CSS ja testado em #estoqueLock e no vazio/erro de carregarEstoque, sem teste proprio nesta task"
    depende_de: [T-03.01, T-03.02, T-02.02]
    paralelizavel: false
    concluida_em: 2026-09-16
    suite: verde
  - id: T-03.04
    titulo: Chips de filtro por tipo e periodo
    fase: F-03.2
    status: concluida
    objetivo: Ligar os chips de filtro por tipo (multi-selecao, default aos 4 operacionais) e os presets de periodo ao carregamento do extrato geral
    arquivos:
      cria: []
      altera: [public/app.js, public/admin.html, public/extrato-estoque.js, test/extrato-estoque.test.js]
    teste_integracao: "trechoEntre recorta SO a secao #aba-relatorios (abertura/fechamento da secao) antes de checar os 6 chips de tipo e os presets hoje/7dias/customizado — NAO contemTrecho no arquivo inteiro, que daria falso positivo (venda/hoje/entrada ja aparecem em PDV/Caixa)"
    teste_funcional: "funcao pura alternarTipo(selecionados, tipo) em extrato-estoque.js: alterna um tipo dentro/fora do array sem duplicar; tiposPadrao() devolve exatamente os 4 operacionais (D-01). O clique do chip so chama essas funcoes e recarrega — a ligacao DOM em si fica para validacao visual (Playwright/QA manual), mesmo padrao ja aceito no projeto para wiring de app.js"
    criterio_aceite: "alternarTipo e tiposPadrao tem teste proprio, sem DOM; chips de tipo renderizam com tiposPadrao() marcado por default; mudar qualquer filtro recarrega a lista do zero, sem misturar paginas de filtros diferentes"
    depende_de: [T-03.03]
    paralelizavel: false
    concluida_em: 2026-09-16
    suite: verde
---

# Tasks — Sprint 03

---

```yaml
id: T-03.01
titulo: Item de menu e seção Relatórios com bloqueio de plano
objetivo: Criar o item de menu "Relatórios" e a seção HTML, com o mesmo bloqueio de Plano Completo já usado em Controle de estoque
arquivos:
  cria: [test/relatorios-aba-scaffold.test.js]
  altera: [public/admin.html]
teste_integracao: contemTrecho confirma que `admin.html` tem o botão de nav `data-aba="relatorios"` e a seção `#aba-relatorios`
teste_funcional: contemTrecho confirma que a seção tem o bloco de bloqueio (ex. `#relatoriosLock`) no mesmo padrão visual de `#estoqueLock`
criterio_aceite: "nav tem botão `data-aba='relatorios'`; seção `#aba-relatorios` existe com bloqueio de Plano Completo; sem conteúdo do extrato ainda"
depende_de: [T-01.01]
paralelizavel: true
status: concluida
```

**Divergência da F6 (D-10):** o texto original previa item de nível principal "ao lado de
Caixa, Mesas". A geração do protótipo (T-01.01) descobriu que `admin.html` já tem um acordeão
"Relatórios" com 3 placeholders "Em breve" — o item real entrou DENTRO desse acordeão
(`navsub-relatorios`), como "Estoque", em vez de aba solta. `data-aba="relatorios"` e
`#aba-relatorios` continuam os mesmos (só o lugar no DOM do botão de nav mudou). Reaproveitada
literalmente a estrutura de `#estoqueLock`/`#estoqueConteudo` (`public/admin.html`), trocando
os textos. A terceira asserção original da task ("sem conteúdo do extrato ainda") foi removida
do teste ao final da Sprint 03: era um guarda de escopo só válido enquanto só esta task
existia — depois que T-03.03/T-03.04 adicionaram a lista de verdade, a asserção ficou
obsoleta por definição, não por regressão.

Suíte: `test/relatorios-aba-scaffold.test.js` (2 testes), incluída nos 784/784 de `npm test` — 2026-09-16 · real: 0,4 h.

---

```yaml
id: T-03.02
titulo: Montagem da query string dos filtros
objetivo: Função pura que monta os query params de GET /api/estoque/geral a partir dos filtros de tipo e período escolhidos na tela
arquivos:
  cria: [public/extrato-estoque.js, test/extrato-estoque.test.js]
  altera: []
teste_integracao: módulo é dual-mode — expõe `window.ExtratoEstoque` no browser (contemTrecho)
teste_funcional: "dado `tipos=[entrada,perda]` e período customizado com `desde`/`ate`, monta `tipos=entrada,perda&desde=...&ate=...`; dado período `hoje`, monta só `periodo=hoje` sem `desde`/`ate`"
criterio_aceite: função pura, sem DOM, testável isoladamente, seguindo o padrão dual-mode de `public/busca.js`
depende_de: [T-01.01]
paralelizavel: true
status: concluida
```

`montarQueryString` ganhou também suporte a `periodo` (`'hoje'|'7dias'`), além de `desde`/`ate`
— ver a divergência já registrada em `sprint-02/tasks.md` (T-02.01), que é a mesma decisão
espelhada dos dois lados (front manda `periodo=hoje`, back sabe interpretar). `tiposPadrao()`
e `alternarTipo()` entraram no mesmo módulo durante a T-03.04 (mesmo arquivo, task diferente).

Suíte: `test/extrato-estoque.test.js` (13 testes ao final da Sprint 03), incluída nos 784/784
de `npm test` — 2026-09-16 · real: 0,4 h.

---

```yaml
id: T-03.03
titulo: Carregamento e renderização do extrato geral
objetivo: Carregar e renderizar a lista de movimentos com "Carregar mais" por cursor, reaproveitando os estados padrão (vazio/erro/carregando)
arquivos:
  cria: []
  altera: [public/app.js, public/admin.html]
teste_integracao: recorte por função (padrão `trechoDaFuncaoAntesDoAwait` de `test/design-system-carregando.test.js`), NÃO `contemTrecho` no arquivo inteiro — `antes=`/`antesId=` já existem em `app.js:1132` (`estCarregarExtrato`, gaveta de 1 produto); sem recorte o teste acharia o trecho errado. Isolar o corpo da nova função (ex. `carregarExtratoGeral`) antes de checar `antes=`/`antesId=` dentro dele
teste_funcional: verificarCarregando confirma que o estado "Carregando" é atribuído antes do `await api(...)`, mesmo padrão de `carregarPedidos`/`carregarEstoque`
criterio_aceite: "lista renderiza os movimentos devolvidos pela API; Carregar mais nunca repete nem pula linha (cursor por par `criado_em`+`id`); estado carregando coberto por teste (`verificarCarregando`); estados vazio/erro reaproveitam literalmente o HTML/CSS já testado em `#estoqueLock` e no vazio/erro de `carregarEstoque`, sem teste próprio nesta task"
depende_de: [T-03.01, T-03.02, T-02.02]
paralelizavel: false
status: concluida
```

`T-02.02` é da Sprint 02 — a API precisa estar pronta antes desta task, mesmo não aparecendo
no diagrama desta sprint (o diagrama é só intra-sprint).

`carregarExtratoGeral`/`renderExtratoGeral` reaproveitam literalmente `EST_TIPO_ROTULO`,
`estQuando`, `escapar` e `Estoque.formatarQtd` já usados na gaveta de produto único; as linhas
reusam as classes `.est-g-mov*`/`.est-g-mais`/`.est-g-pedido` já existentes no CSS (sem tocar
`style.css`, fora do `arquivos` desta task). Diferença real da gaveta: cada linha mostra o
nome do produto (campo `descricao`, snapshot gravado no momento do movimento — sem join com o
cardápio, confirmado em `base/schema-e-consultas-estoque.md`). Validado visualmente ao vivo
(Playwright, tenant descartável com Plano Completo no projeto de testes): estado carregando,
lista com 4 tipos padrão, filtro "Venda" adicionando linha com pill de pedido, período
"Personalizado" revelando os campos De/Até, desktop e mobile (390px). Estado bloqueado
(`#relatoriosLock`) não fotografado de novo — é a mesma estrutura de `#estoqueLock`, já
validada visualmente na feature de Controle de estoque, e coberta pelo teste de integração
403 (T-02.02).

Suíte: `test/design-system-carregando.test.js` (5 testes, 1 novo), incluída nos 784/784 de
`npm test` — 2026-09-16 · real: 0,75 h.

---

```yaml
id: T-03.04
titulo: Chips de filtro por tipo e período
objetivo: "Ligar os chips de filtro por tipo (multi-seleção, default aos 4 operacionais) e os presets de período ao carregamento do extrato geral"
arquivos:
  cria: []
  altera: [public/app.js, public/admin.html, public/extrato-estoque.js, test/extrato-estoque.test.js]
teste_integracao: "`trechoEntre` recorta SÓ a seção `#aba-relatorios` (abertura/fechamento da seção) antes de checar os 6 chips de tipo e os presets hoje/7dias/customizado — NÃO `contemTrecho` no arquivo inteiro, que daria falso positivo (\"venda\"/\"hoje\"/\"entrada\" já aparecem em PDV/Caixa)"
teste_funcional: "função pura `alternarTipo(selecionados, tipo)` em `extrato-estoque.js`: alterna um tipo dentro/fora do array sem duplicar; `tiposPadrao()` devolve exatamente os 4 operacionais (D-01). O clique do chip só chama essas funções e recarrega — a ligação DOM em si fica para validação visual (Playwright/QA manual), mesmo padrão já aceito no projeto para wiring de `app.js`"
criterio_aceite: "`alternarTipo` e `tiposPadrao` têm teste próprio, sem DOM; chips de tipo renderizam com `tiposPadrao()` marcado por default; mudar qualquer filtro recarrega a lista do zero, sem misturar páginas de filtros diferentes"
depende_de: [T-03.03]
paralelizavel: false
status: concluida
```

Chips de tipo (multi-seleção) e período (seleção única, preset substitui preset) ligados via
delegação de evento nos containers `#relTipoFiltros`/`#relPeriodoFiltros`. Período
"Personalizado" só recarrega quando `desde` E `ate` estão preenchidos (evita pedir sem
filtro no meio da digitação). Validado ao vivo: clicar em "Venda" acrescenta a linha certa
sem duplicar as demais; "Personalizado" revela os campos De/Até sem recarregar até os dois
serem preenchidos.

Suíte: `test/extrato-estoque.test.js` (13 testes) + `test/design-system-carregando.test.js`,
incluídas nos 784/784 de `npm test` — 2026-09-16 · real: 0,6 h.
