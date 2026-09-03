# Sprint 01 — Capacidade de testar o clique de produto no PDV isolado

## Objetivo

Montar o arnês de teste (`test/apoio/pdv-modal-harness.js`) que recorta e executa, fora de um browser, as duas funções de clique/decisão do PDV que hoje vivem só como closures dentro de `public/app.js` (`pdvTileClick`, `pdvVariacaoClick`) — com `pdvGruposDoItem` e `abrirPdvItemModal` como stubs de teste, nunca as funções reais — e um conjunto de testes de caracterização que provam, com fixtures dos 4 casos de borda relevantes, o comportamento ATUAL (antes de qualquer mudança de negócio). Nenhuma linha de `public/app.js` é alterada nesta sprint.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-01.1 | Arnês de extração do PDV | nenhuma |
| F-01.2 | Fixtures e testes de caracterização | nenhuma (depende de F-01.1) |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`node --test test/pdv-clique-produto.test.js` roda e termina com 0 failed, cobrindo os 4 casos de borda (cozinha+sem nada, cozinha+variação sem grupo, cozinha+grupo, sem-cozinha+sem nada) com o comportamento de hoje.

## Riscos conhecidos

- O recorte por string (`indexOf`) do trecho de `public/app.js` é frágil a reordenação de funções no arquivo — mesmo risco já documentado em `base/06-padrao-de-teste-frontend.md`, mitigado com `assert.ok` que falha alto e claro se o marcador sumir (mesmo padrão de `test/caixa-reimpressao-front.test.js`).
- `pdvGruposDoItem` e `abrirPdvItemModal` têm efeitos colaterais de DOM (`$`, `document.createElement`) que precisam de stub — nenhum dos dois é lido em detalhe na F1 além da assinatura; a T-01.01 pode precisar ler mais contexto de `public/app.js` ao implementar, sem sair do escopo de teste.
