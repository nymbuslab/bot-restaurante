# Tasks — Sprint 03

> Um bloco por task, com TODOS os campos do contrato. Na F6 a linha `status` é atualizada em cada transição; ao concluir, acrescente data e resultado da suíte.

---

```yaml
id: T-03.01
titulo: Icone de reimpressao na coluna de acoes
objetivo: Mostrar o icone de impressora nas linhas que tem comprovante, usando o espaco hoje vazio da coluna de acoes.
arquivos:
  cria: []
  altera: [public/app.js, public/style.css]
teste_integracao: `npm run check` termina sem erro de sintaxe e o painel carrega sem erro de console no Playwright.
teste_funcional: Com um extrato de sangria, suprimento, cancelamento, recebimento e saldo inicial, o HTML gerado tem exatamente 3 botoes `.caixa-reimprimir`.
criterio_aceite: 3 botoes .caixa-reimprimir no HTML gerado, cada um com data-id igual ao id do movimento da sua linha, e nenhum na linha de recebimento ou de saldo inicial.
depende_de: [T-02.01]
paralelizavel: false
status: concluida - 2026-08-31 (reaberta e corrigida) - suite: node --test test/caixa-reimpressao-front.test.js => pass 2, fail 0; npm run check => OK 122 arquivos
# 1a versao passou com DEFEITO: a fixture usava pedidoId diferente no cancelamento e no
# recebimento, caso impossivel nos dados reais (so se cancela pedido pago). Com o mesmo
# pedido, o extrato condensa os dois numa linha "Venda cancelada" que carrega o movimento
# de RECEBIMENTO, e o icone sumia: a reimpressao de cancelamento ficava inalcancavel pela
# tela. Corrigido carregando `reversoes` na linha condensada e escolhendo o id por
# `idReimpressaoCaixa`. Fixture trocada para o caso real, mais teste-guarda de estorno.
```

---

```yaml
id: T-03.02
titulo: Handler do clique com bloqueio durante o envio
objetivo: Reimprimir ao clicar e impedir a rajada acidental de cliques (D-07), sem travar a segunda via legitima.
arquivos:
  cria: []
  altera: [public/app.js, test/avisos-falha.test.js]
teste_integracao: `node --test test/avisos-falha.test.js` termina com fail 0 provando, por indexOf no trecho, que o `disabled = true` vem ANTES da chamada da rota e que a reabilitacao esta DENTRO do finally.
teste_funcional: Clique no icone chama POST /api/caixa/movimento/:id/reimprimir e mostra toast de sucesso; falha da rota mostra toast de erro com a mensagem do servidor.
criterio_aceite: indexOf('disabled = true') menor que indexOf('/reimprimir'), indexOf('finally') menor que o indice da reabilitacao, e toast presente nos dois caminhos.
depende_de: [T-02.05, T-03.01]
paralelizavel: false
status: concluida - 2026-08-30 - suite: node --test test/avisos-falha.test.js => pass 9, fail 0
```

---

```yaml
id: T-03.03
titulo: Validacao visual em desktop e mobile
objetivo: Provar que a coluna de acoes com o icone nao quebra a tabela em nenhuma das duas larguras.
arquivos:
  cria: []
  altera: []
meio: Harness local servindo public/ numa porta livre com as APIs do caixa MOCKADAS, devolvendo um extrato fixo com sangria, suprimento, cancelamento, recebimento e saldo inicial. NAO depende de tenant Completo com caixa aberto de verdade; o PROGRESSO.md registra que "fluxo ao vivo nao dirigido" ja travou tarefa antes por essa exigencia.
teste_integracao: Playwright carrega o painel em 1366x768 e 390x844 sem erro de console.
teste_funcional: Em ambas as larguras, a tabela do caixa nao produz scroll horizontal na pagina e o icone fica dentro da celula.
criterio_aceite: Zero erro de console nas duas larguras e `document.documentElement.scrollWidth <= clientWidth` nas duas.
depende_de: [T-03.02]
paralelizavel: false
status: concluida - 2026-08-31 (reaberta e corrigida) - suite: Playwright 1366x768 e 390x844 => 3 icones (Sangria, Venda cancelada, Suprimento), svg 16x16 nas duas larguras, sem scroll horizontal na pagina
# 1a versao passou com DEFEITO: a checagem contava botoes e media overflow, mas nao
# conferia se o ICONE aparecia. O svg estava com largura 0 (encolhido como item de flex
# dentro do botao inline-flex), entao o painel mostrava um quadrado vazio. Corrigido com
# `.caixa-reimprimir svg { flex: none; }`, mesmo padrao de .toast-ico. Contar elemento
# nao e validar visual: a assercao agora mede o tamanho renderizado do svg.
```

---

```yaml
id: T-03.04
titulo: Documentacao viva e desdobramentos
objetivo: Registrar a entrega e abrir o que ficou pendente, para nada sumir do mapa.
arquivos:
  cria: []
  altera: [PROGRESSO.md, CLAUDE.md, docs/planos-e-frete.md]
teste_integracao: `npm test`, `npm run check` e `npm run test:integracao` terminam com fail 0 no estado final.
teste_funcional: PROGRESSO.md tem o item em Concluido com os numeros da suite, e Proximos Passos ganha a conferencia no papel real (D-08).
criterio_aceite: PROGRESSO.md contem o item concluido com data e um item novo em Proximos Passos citando a conferencia no papel da termica.
depende_de: [T-03.03]
paralelizavel: false
status: concluida - 2026-08-30 - suite: npm test => pass 522, fail 0; npm run check => OK 122 arquivos; npm run test:ci => pass 522, fail 0; npm run test:integracao => pass 52, fail 0
```
