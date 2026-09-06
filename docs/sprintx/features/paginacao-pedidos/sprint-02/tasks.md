---
expx_schema: 1
expx_tool: sprintx
kind: tasks
trabalho_id: paginacao-pedidos
sprint_id: sprint-02
atualizado_em: 2026-09-06
tasks:
  - id: T-02.01
    titulo: trocar pagina numerada por contagem visivel
    fase: F-02.1
    objetivo: substituir PEDIDOS_POR_PAGINA/paginaPedidos por uma variavel de contagem visivel calculada via PaginacaoPedidos, usada no corte da lista renderizada, e resetada nos 8 pontos que resetavam a pagina
    arquivos:
      cria: [test/paginacao-pedidos-app.test.js]
      altera: [public/app.js, public/admin.html]
    teste_integracao: test/paginacao-pedidos-app.test.js usa trechoEntre para isolar o corpo de renderListaPedidos e confirma que ele corta a lista com uma contagem visivel, e contemTrecho confirma que admin.html carrega paginacao-pedidos.js antes de app.js
    teste_funcional: o mesmo teste confirma, via trechoEntre isolando cada um dos 8 pontos (os 6 listeners de filtro/busca/datas, a funcao irParaPedidosAReceber e o listener de clique do chip de periodo), que cada um reseta a nova variavel de contagem visivel para o valor inicial, e que PEDIDOS_POR_PAGINA e paginaPedidos nao existem mais no arquivo
    criterio_aceite: nenhuma ocorrencia de PEDIDOS_POR_PAGINA ou paginaPedidos em public/app.js, public/admin.html tem a tag script de paginacao-pedidos.js antes da tag script de app.js, e os 8 pontos (linhas 4205, 5411, 5414-5419 na numeracao atual) resetam a nova variavel
    depende_de: [T-01.01]
    paralelizavel: false
    status: concluida
    concluida_em: "2026-09-06"
    suite: "app.js/admin.html: 7/7 assercoes T-02.01 verdes no test/paginacao-pedidos-app.test.js (arquivo completa na T-02.02)"
  - id: T-02.02
    titulo: trocar paginacao numerada pelo botao unico carregar mais
    fase: F-02.1
    status: concluida
    objetivo: remover os botoes de pagina numerada (paginacaoHtml/paginasVisiveis/irParaPagina) e desenhar um unico botao carregar mais com a classe ped-mais, valendo para tabela e cards igualmente
    arquivos:
      cria: []
      altera: [public/app.js, public/style.css, test/paginacao-pedidos-app.test.js]
    teste_integracao: test/paginacao-pedidos-app.test.js usa trechoEntre para isolar o corpo/retorno de renderListaPedidos e, dentro desse trecho isolado (nunca no arquivo inteiro), confirma a presenca de um botao com o texto Carregar mais; confirma tambem a ausencia das funcoes paginacaoHtml, paginasVisiveis e irParaPagina no arquivo
    teste_funcional: o mesmo teste confirma, dentro do trecho isolado de renderListaPedidos, que o botao usa PaginacaoPedidos.temMais para decidir se aparece e que o HTML do botao contem class="ped-mais" (nao so que a classe existe em algum lugar do CSS); contemTrecho confirma que public/style.css define a regra .ped-mais
    criterio_aceite: as funcoes paginacaoHtml, paginasVisiveis e irParaPagina nao existem mais em public/app.js, o botao renderizado por renderListaPedidos usa literalmente a classe ped-mais, e existe o seletor .ped-mais em public/style.css
    depende_de: [T-02.01]
    paralelizavel: false
    concluida_em: "2026-09-06"
    suite: "npm test 588/588 pass (15 paginacao-pedidos), check 144 arquivos OK. Ressalva documentada (item 7 do ORQUESTRADOR): build passou, UI nao validada - conferencia visual pendente (tool indisponivel); roteiro manual em docs/legado/manual/paginacao-pedidos.md"
---

# Tasks — Sprint 02

---

```yaml
id: T-02.01
titulo: Trocar página numerada por contagem visível
objetivo: Substituir PEDIDOS_POR_PAGINA/paginaPedidos por uma variável de contagem visível calculada via PaginacaoPedidos, usada no corte da lista renderizada, e resetada nos 8 pontos que resetavam a página
arquivos:
  cria: [test/paginacao-pedidos-app.test.js]
  altera: [public/app.js, public/admin.html]
teste_integracao: test/paginacao-pedidos-app.test.js usa trechoEntre para isolar o corpo de renderListaPedidos e confirma que ele corta a lista com uma contagem visível, e contemTrecho confirma que admin.html carrega paginacao-pedidos.js antes de app.js
teste_funcional: o mesmo teste confirma, via trechoEntre isolando cada um dos 8 pontos (os 6 listeners de filtro/busca/datas em `public/app.js:5414-5419`, a função `irParaPedidosAReceber` em `:4205` e o listener de clique do chip de período em `:5411`), que cada um reseta a nova variável de contagem visível para o valor inicial, e que PEDIDOS_POR_PAGINA e paginaPedidos não existem mais no arquivo
criterio_aceite: Nenhuma ocorrência de PEDIDOS_POR_PAGINA ou paginaPedidos em public/app.js, public/admin.html tem a tag `<script>` de paginacao-pedidos.js antes da tag `<script>` de app.js, e os 8 pontos citados resetam a nova variável
depende_de: [T-01.01]
paralelizavel: false
status: concluida
```

> **Nota da reauditoria (F5, 2026-09-06):** a versão anterior desta task citava "6 pontos". A auditoria conferiu o código real e achou 8 — os 6 listeners de filtro mais `irParaPedidosAReceber` (`app.js:4205`, atalho do bloqueio de fechamento de caixa) e o clique do chip de período (`app.js:5411`, hoje/7dias/custom). Corrigido aqui; ver achado ALTA em `00-AUDITORIA.md`.

---

```yaml
id: T-02.02
titulo: Trocar paginação numerada pelo botão único "Carregar mais"
objetivo: Remover os botões de página numerada (paginacaoHtml/paginasVisiveis/irParaPagina) e desenhar um único botão "Carregar mais" com a classe ped-mais, valendo para tabela (desktop) e cards (celular) igualmente
arquivos:
  cria: []
  altera: [public/app.js, public/style.css, test/paginacao-pedidos-app.test.js]
teste_integracao: test/paginacao-pedidos-app.test.js usa trechoEntre para isolar o corpo/retorno de renderListaPedidos e, dentro desse trecho isolado (nunca no arquivo inteiro), confirma a presença de um botão com o texto "Carregar mais"; confirma também a ausência das funções paginacaoHtml, paginasVisiveis e irParaPagina no arquivo
teste_funcional: o mesmo teste confirma, dentro do trecho isolado de renderListaPedidos, que o botão usa PaginacaoPedidos.temMais para decidir se aparece e que o HTML do botão contém `class="ped-mais"` (não só que a classe existe em algum lugar do CSS); contemTrecho confirma que public/style.css define a regra .ped-mais
criterio_aceite: As funções paginacaoHtml, paginasVisiveis e irParaPagina não existem mais em public/app.js, o botão renderizado por renderListaPedidos usa literalmente a classe `ped-mais`, e existe o seletor .ped-mais em public/style.css
depende_de: [T-02.01]
paralelizavel: false
status: concluida
```

> **Nota da reauditoria (F5, 2026-09-06):** a versão anterior desta task checava o texto "Carregar mais" no arquivo `public/app.js` inteiro, sem escopo — esse texto já existe hoje num comentário em `app.js:903`, sem relação com o botão, então o teste passaria mesmo sem a implementação. Corrigido para checar dentro do trecho isolado de `renderListaPedidos`, e acrescentada a checagem de que a classe usada no botão é de fato `ped-mais` (antes o teste só confirmava que a classe existia em algum lugar do CSS, não que o botão a usava). Ver achados ALTA e MÉDIA em `00-AUDITORIA.md`.

> **Correção pós-F6 (verificação E2 da mergex, 2026-09-06):** o plano original (F3) nunca declarou `test/paginacao-pedidos-app.test.js` em `arquivos.cria`/`arquivos.altera` de nenhuma das duas tasks — um esquecimento do planejamento, não da execução. O arquivo foi criado de fato na T-02.01 e estendido na T-02.02 (conforme `FECHAMENTO.md`, seção "Divergências não esperadas"); a declaração acima foi corrigida para refletir isso. Também corrigido, em `sprint-01/tasks.md`: o frontmatter de T-01.01 estava com `status: em_andamento`, divergindo do corpo da própria task (`concluida`) e da suíte já verde — igualado para `concluida`.
