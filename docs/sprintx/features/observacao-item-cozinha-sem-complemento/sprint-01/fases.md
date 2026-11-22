# Fases — Sprint 01

> Um bloco por fase. Repita o bloco quantas vezes forem necessárias. O paralelismo declarado aqui é definitivo: a execução nunca decide paralelismo sozinha.

---

## F-01.1 — Arnês de extração do PDV

**Objetivo:** criar um módulo de apoio de teste que carrega `public/app.js`, recorta SOMENTE as funções `pdvTileClick` e `pdvVariacaoClick` (a decisão de abrir modal ou não — é isso que está sob teste), e as executa num `vm.Context` onde `pdvGruposDoItem` e `abrirPdvItemModal` são STUBS de teste, nunca as funções reais recortadas: `abrirPdvItemModal` é um spy que só registra que foi chamado e com qual `item` (não constrói HTML — a real toca dezenas de `$("id")`/`document.createElement`/`innerHTML`, fora do escopo deste arnês), e `pdvGruposDoItem` é um stub que devolve `item.grupos || []` direto (a resolução de verdade via `window.Grupos.resolverGrupos` já tem cobertura própria em `test/grupos.test.js` — não é o que este arnês testa). A fixture de item carrega o campo `grupos` já no formato "resolvido" que o stub espera (array vazio = sem grupo; array não vazio = com grupo).

**Tasks que a compõem:** T-01.01

**Critério de saída:** `require("./apoio/pdv-modal-harness")` carrega sem lançar exceção e devolve um objeto com `simularCliqueTile(item)`, `simularCliqueVariacao(item, variacao)`, `pdvCart` e `chamadasModal` (array com cada `item` para o qual o stub de `abrirPdvItemModal` foi chamado).

**Roda em paralelo com:** nenhuma

---

## F-01.2 — Fixtures e testes de caracterização

**Objetivo:** criar as fixtures dos 4 casos de borda e um teste que documenta, em código, o comportamento atual do PDV para cada um (antes de qualquer mudança de negócio).

**Tasks que a compõem:** T-01.02

**Critério de saída:** `node --test test/pdv-clique-produto.test.js` passa com as 4 fixtures, sem qualquer alteração em `public/app.js`.

**Roda em paralelo com:** nenhuma
