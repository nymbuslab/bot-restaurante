# Tasks — Sprint 01

> Um bloco por task. Repita o bloco abaixo para cada task da sprint, preenchendo TODOS os campos — nenhum é opcional. Na execução (F6), a linha `status` é atualizada em cada transição; ao concluir, acrescente data e resultado da suíte.

---

```yaml
id: T-01.01
titulo: Arnês de extração do PDV (pdvTileClick/pdvVariacaoClick, com abrirPdvItemModal e pdvGruposDoItem stubados)
objetivo: Permitir chamar pdvTileClick e pdvVariacaoClick de public/app.js isolados, sem DOM real, com abrirPdvItemModal como spy e pdvGruposDoItem stubado por item.grupos.
arquivos:
  cria: [test/apoio/pdv-modal-harness.js]
  altera: []
teste_integracao: o arnês carrega public/app.js de verdade via fs.readFileSync, recorta pdvTileClick e pdvVariacaoClick (com assert.ok no índice do recorte, mesmo padrão de test/caixa-reimpressao-front.test.js) e roda sem lançar exceção com os stubs de abrirPdvItemModal/pdvGruposDoItem injetados no vm.Context.
teste_funcional: chamando simularCliqueTile com um item {id:"x", nome:"X", preco:10, unidade:"un", grupos:[]} sem variações/cozinha, pdvCart recebe uma linha e chamadasModal continua vazio (o stub de abrirPdvItemModal não foi chamado).
criterio_aceite: test/apoio/pdv-modal-harness.js exporta uma função que devolve { pdvCart, chamadasModal, simularCliqueTile, simularCliqueVariacao }, onde abrirPdvItemModal e pdvGruposDoItem nunca são as funções reais de public/app.js.
prototipo: nao-se-aplica
depende_de: []
paralelizavel: false
status: concluida (2026-09-03; arnês test/apoio/pdv-modal-harness.js; require + simulações verdes)
```

---

```yaml
id: T-01.02
titulo: Fixtures e testes de caracterização do clique de produto (comportamento atual)
objetivo: Documentar em teste, com 4 fixtures de item, o comportamento do PDV hoje (antes de qualquer mudança de negócio desta feature).
arquivos:
  cria: [test/pdv-clique-produto.test.js]
  altera: []
teste_integracao: usando o arnês da T-01.01, os 4 fixtures — cozinha+sem-nada `{cozinha:true, grupos:[], variacoes:[], unidade:"un"}`, cozinha+variação-sem-grupo `{cozinha:true, grupos:[], variacoes:[{id:"v1",nome:"P",preco:0}], unidade:"un"}` (chamado via simularCliqueVariacao com essa variação), cozinha+grupo `{cozinha:true, grupos:[{id:"g1"}], variacoes:[], unidade:"un"}`, sem-cozinha+sem-nada `{cozinha:false, grupos:[], variacoes:[], unidade:"un"}` — rodam contra o pdvTileClick/pdvVariacaoClick reais de public/app.js sem erro.
teste_funcional: hoje, "cozinha+sem-nada" e "sem-cozinha+sem-nada" empilham direto em pdvCart (chamadasModal continua vazio); "cozinha+variação-sem-grupo" empilha direto via pdvVariacaoClick (chamadasModal vazio); "cozinha+grupo" aciona o stub de abrirPdvItemModal (chamadasModal ganha 1 entrada).
criterio_aceite: node --test test/pdv-clique-produto.test.js termina com 0 failed, 4 casos cobertos.
prototipo: nao-se-aplica
depende_de: [T-01.01]
paralelizavel: false
status: concluida (2026-09-03; 4 fixtures de caracterização em test/pdv-clique-produto.test.js, 0 failed)
```
