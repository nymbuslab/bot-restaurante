# Tasks — Sprint 02

> Um bloco por task. Repita o bloco abaixo para cada task da sprint, preenchendo TODOS os campos — nenhum é opcional. Na execução (F6), a linha `status` é atualizada em cada transição; ao concluir, acrescente data e resultado da suíte.

---

```yaml
id: T-02.01
titulo: pdvTileClick abre modal para item de cozinha sem grupo/variação/kg
objetivo: Fazer o clique no card de produto do PDV/Mesas abrir abrirPdvItemModal em vez de empilhar direto quando item.cozinha === true, mesmo sem grupo/variação/kg.
arquivos:
  cria: []
  altera: [public/app.js, test/pdv-clique-produto.test.js]
teste_integracao: usando o arnês de T-01.01, o fixture "cozinha+sem-nada" passa a acionar abrirPdvItemModal (RED antes da mudança em public/app.js, GREEN depois).
teste_funcional: item fixture {cozinha:true, sem grupos, sem variações, unidade:"un"} clicado não gera linha em pdvCart antes do modal confirmar.
criterio_aceite: a condição em public/app.js:6047 passa a incluir "|| item.cozinha === true"; o teste do fixture "cozinha+sem-nada" fica GREEN e os fixtures "sem-cozinha+sem-nada" e "cozinha+grupo" continuam com o resultado documentado em T-01.02 (regressão zero, D-10).
prototipo: aprovado (design/prototipos/pdv-item-cozinha-observacao.html — aprovado pelo dono em 2026-09-03)
depende_de: [T-01.01, T-01.02]
paralelizavel: false
status: concluida (2026-09-03; protótipo aprovado; pdv-clique-produto.test.js verde, npm test 531/531)
```

---

```yaml
id: T-02.02
titulo: pdvVariacaoClick abre modal para item de cozinha com variação e sem grupo
objetivo: Fazer o clique num resultado de busca por sabor (variação) abrir abrirPdvItemModal quando item.cozinha === true, mesmo sem grupo de complemento (D-02).
arquivos:
  cria: []
  altera: [public/app.js, test/pdv-clique-produto.test.js]
teste_integracao: usando o arnês de T-01.01, o fixture "cozinha+variação-sem-grupo" passa a acionar abrirPdvItemModal via pdvVariacaoClick (RED antes, GREEN depois).
teste_funcional: mesmo fixture com cozinha:false continua empilhando a variação direto em pdvCart (regressão, D-10).
criterio_aceite: a condição em public/app.js:6008 passa a incluir "|| item.cozinha === true"; o teste do fixture "cozinha+variação-sem-grupo" fica GREEN.
prototipo: aprovado (design/prototipos/pdv-item-cozinha-observacao.html — aprovado pelo dono em 2026-09-03)
depende_de: [T-01.01, T-01.02]
paralelizavel: false
status: concluida (2026-09-03; protótipo aprovado; verde e 531/531)
```

---

```yaml
id: T-02.03
titulo: Validar observação de item de cozinha na via da cozinha (PDV avulso + Mesa)
objetivo: Confirmar, rodando o sistema real, que a observação digitada no modal chega na via da cozinha nos dois fluxos (D-07).
arquivos:
  cria: [test/integracao/cozinha-observacao.test.js]
  altera: []
teste_integracao: no PDV avulso (venda balcão), com um item de teste cozinha=true sem grupo, vender com uma observação digitada e conferir que o texto enfileirado para a impressora (impressao_fila / Comanda.montarCozinha) contém "Obs: <texto>".
teste_funcional: no mesmo item, lançado numa mesa aberta (modo PDV de Mesas), a via da cozinha da rodada também contém "Obs: <texto>" com a observação digitada.
criterio_aceite: as duas execuções mostram a observação literal no texto da via da cozinha; nenhum erro de console/rede durante o fluxo.
prototipo: nao-se-aplica
depende_de: [T-02.01, T-02.02]
paralelizavel: false
status: concluida (2026-09-03; cozinha-observacao.test.js verde no PDV avulso e na mesa; integração 54/54)
```
