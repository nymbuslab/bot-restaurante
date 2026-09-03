# Fases — Sprint 02

> Um bloco por fase. Repita o bloco quantas vezes forem necessárias. O paralelismo declarado aqui é definitivo: a execução nunca decide paralelismo sozinha.

---

## F-02.1 — Mudança de condição (pdvTileClick + pdvVariacaoClick) e protótipo

**Objetivo:** alterar as duas condições que decidem se o clique no produto abre o modal ou empilha direto, para incluir `item.cozinha === true`, e gerar o protótipo exigido em D-06 para aprovação do dono.

**Tasks que a compõem:** T-02.01, T-02.02

**Critério de saída:** os dois testes (novo caso RED→GREEN) passam, os testes de caracterização da sprint 1 para os casos que não mudam continuam GREEN, e o protótipo está aprovado (`prototipo: aprovado: <caminho>` nas duas tasks).

**Roda em paralelo com:** nenhuma

---

## F-02.2 — Validação end-to-end real (PDV avulso + Mesa)

**Objetivo:** confirmar, rodando o sistema de verdade, que um item de teste marcado como cozinha sem complemento abre o modal, aceita observação e ela aparece na via da cozinha — tanto vendido pelo PDV avulso quanto lançado numa mesa.

**Tasks que a compõem:** T-02.03

**Critério de saída:** a observação digitada aparece literalmente como `Obs: <texto>` no texto da via da cozinha enfileirada, nos dois fluxos (PDV avulso e Mesa).

**Roda em paralelo com:** nenhuma
