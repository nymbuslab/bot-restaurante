# Padrão existente: função pura dual-mode para lógica de front-end testável

## Contrato de entrada

`public/busca.js` (usado como referência íntegra) recebe uma string e devolve uma
string/booleano — é o exemplo mais simples do padrão. O arquivo é um wrapper UMD
(`public/busca.js:7-10`): `(function (root, factory) { const api = factory(); if (typeof
module !== "undefined" && module.exports) module.exports = api; if (typeof window !==
"undefined") window.Busca = api; })(this, function () { ... })`.

Outros arquivos do projeto seguem o mesmo molde (confirmado por grep `typeof module` em
`public/*.js`): `comanda.js`, `comprovante-caixa.js`, `estoque.js`, `grupos.js`,
`horario.js`, `insumos.js`, `pagamentos.js`, `planos.js`, `relatorio-caixa.js`, entre
outros.

## Contrato de saída

No browser, o arquivo é incluído com `<script src="busca.js">` **antes** de
`<script src="app.js">` (`public/admin.html:1936` e `:1941`) e expõe `window.Busca`; o
`app.js` chama `Busca.itemCasaBusca(...)` direto, sem import. No Node, o mesmo arquivo é
`require("../public/busca")` (`test/busca.test.js:3`) e testado com `node:test` **de
verdade** — sem mock de DOM, sem `contemTrecho`, porque a função em si não toca `document`
nem `window`.

## Limites e cotas

NÃO DOCUMENTADO um limite formal de quando extrair uma função para este padrão vs. deixar
inline em `app.js` — a prática observada é: função pura (sem `document`/`fetch`/estado
global), reaproveitável ou testável isoladamente, vira arquivo próprio; lógica que
manipula o DOM diretamente ou depende de estado da tela inteira fica em `app.js`.

## Erros conhecidos e tratamento

Não aplicável — são funções puras (entrada determinística → saída determinística), sem
I/O e sem estado.

## Riscos para a nossa implementação

- **Isto é o que resolve o maior risco de teste desta feature.** O achado central (achar
  quantas linhas/itens cabem, ou decidir quantos itens mostrar por vez) é, no fundo, uma
  conta — `quantosItensCabem(alturaDisponivel, alturaDeUmaLinha)` ou
  `proximoTamanhoDePagina(tamanhoAtual, incremento, total)` — que **não precisa tocar o
  DOM** para ser calculada. Extraída para um arquivo dual-mode como `busca.js`, essa conta
  ganha teste real (`node:test` com `assert.equal`), não a checagem estática de texto
  (`contemTrecho`/`trechoEntre`) que a correção de design system anterior usou para tudo
  em `app.js`, por falta de alternativa.
- A checagem estática de texto (`test/apoio/arquivo-estatico.js`, usada nos 12 achados da
  auditoria anterior) continua sendo o caminho certo para o que É só marcação/CSS (ex.:
  presença de um atributo `aria-label`, uma regra `@media`) — não é substituída por este
  padrão, é complementar. O que muda aqui é que a PARTE CALCULADA da correção (a decisão
  de quantos itens mostrar) tem uma opção de teste melhor que string matching, se a F2/F3
  decidirem extrair essa conta para um arquivo próprio.
- Medir de verdade a altura do container/viewport no browser continua sem cobertura de
  teste no `npm test` (não há ambiente de DOM/browser no runner) — só a fórmula que
  transforma "altura X" em "N itens" é testável dessa forma; a leitura real de
  `window.innerHeight`/`offsetHeight` continua sem teste automatizado, como qualquer outro
  código que só roda no navegador neste projeto hoje.

## Fonte

- `public/busca.js` (arquivo inteiro, 1-24 linhas) — lido em 2026-09-06
- `test/busca.test.js:1-8` — lido em 2026-09-06
- `public/admin.html:1936, 1941` (ordem dos `<script>`) — lido em 2026-09-06
- `test/apoio/arquivo-estatico.js` (padrão alternativo, checagem estática) — lido em 2026-09-06
