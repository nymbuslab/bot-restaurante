---
expx_schema: 1
expx_tool: sprintx
kind: fechamento
trabalho_id: pdv-balcao-em-aberto
titulo: PDV - Comanda em aberto
status: concluido
concluido_em: 2026-09-11
sprints: [sprint-01, sprint-02, sprint-03, sprint-04]
tasks_concluidas: 10 de 10
suite: "714 passed, 0 failed"
suite_integracao: "67 passed, 0 failed"
check_syntax: "157 arquivos sem erro de sintaxe"
---

# Fechamento — pdv-balcao-em-aberto

## Resultado

As 10 tasks (1 de capacidade de teste + 3 de backend + 3 de UI + 3 de fechamento) foram
concluídas na ordem declarada no `ORQUESTRADOR.md`, com o caminho crítico
T-01.01 → T-02.01 → T-02.02 → T-02.03 → T-03.02 → T-03.03 → T-04.01. Método sprintx em todas:
teste escrito primeiro (vermelho), implementação, teste verde, suíte completa + varredura de
sintaxe, e task marcada `concluida` com `concluida_em` e `suite` em cada `tasks.md`.

**Estado final:** `npm test` → 714 passed, 0 failed (baseline 694 + 20 novos). `npm run
test:integracao` → 67 passed, 0 failed (baseline 54 + 13 novos do `pedidos-comanda.test.js`).
`npm run check` → 157 arquivos sem erro de sintaxe. Nenhum bloqueio registrado
(`00-BLOQUEIOS.md` vazio).

## O que a entrega virou

| Task | O que era | O que passou a ser |
|---|---|---|
| T-01.01 | nenhuma base de teste da feature | fixture de integração em `test/integracao/pedidos-comanda.test.js` (abre/lista via API) |
| T-02.01 | `/api/pdv/vender` recusava "Comanda" como tipo de venda | tipo aceito pelo mesmo caminho de Entrega/Retirada (a receber, `origem='pdv'`), **sem cupom na abertura** (D-14), só via de cozinha se houver item |
| T-02.02 | só existia criar pedido novo | `acrescentarItens` em `src/pedidos.js`: UPDATE incremental dos itens com `FOR UPDATE`, guardas de estado, 409 de estoque |
| T-02.03 | só existia `/api/pdv/vender` | rota `POST /api/pedidos/:id/itens` (pipeline completo `origem='pdv'`: recálculo, baixa de estoque atômica, via de cozinha só da rodada nova) |
| T-03.01 | tela de cobrança mostrava 3 tipos de venda | tile "Comanda" ao lado de Balcão/Entrega/Retirada, sem bloco de pagamento, botão final "Abrir Comanda" |
| T-03.02 | PDV só tinha venda direta e modo-mesa | modo "Acrescentando à Comanda #NN" (`pedidoModoId`, espelha `mesaModoId`); `#pdvCobrar` chama a rota de acréscimo |
| T-03.03 | modal de detalhe do pedido não editava | botão "Acrescentar item" no modal (vale para qualquer pedido a receber, D-07) |
| T-04.01 | cancelar item confirmava direto | aviso "Já foi para a cozinha…" antes do `confirmarComOpcao` (D-08) |
| T-04.02 | sem prova de fechamento | teste de integração prova que Comanda fecha pelo `POST /api/caixa/receber/:id` já existente, sem mudança de código |
| T-04.03 | sem fim a fim | teste de integração: abrir → acrescentar em 2 rodadas → cancelar 1 item → fechar via Receber pagamento, conferindo total final e a via de cozinha da 2ª rodada |

## Arquivos alterados

**Código:** `src/servidor.js`, `src/pedidos.js`, `public/app.js`,
`scripts/test-integracao.js` (concurrency 3).

**Novos (testes):** `test/pdv-comanda-tile.test.js` (T-03.01), `test/pdv-comanda-modo.test.js`
(T-03.02), `test/pedido-modal-acrescentar-item.test.js` (T-03.03),
`test/pedido-modal-cancelar-aviso.test.js` (T-04.01) e
`test/integracao/pedidos-comanda.test.js` (T-01.01/02.01/02.03/04.02/04.03).
Harness de front: `test/apoio/pdv-modal-harness.js`.

## Ressalva — portão de design e conferência visual (RESOLVIDA em 12/09)

As duas pendências registradas em `PROGRESSO.md` foram fechadas em 12/09/2026:

1. O **portão de design** da sprint-03 (`ORQUESTRADOR.md`, Seção 5) foi cumprido: protótipo
   (`design/canvas/pdv-comanda.dc.html`) renderizado (desktop + mobile, via Playwright) e
   **aprovado explicitamente pelo dono** — com **revisão de design** que mudou a forma: o
   tipo de venda saiu do modal "Finalizar venda" (tiles) e virou **seletor na lateral do
   carrinho** (`[Balcão] [Comanda] [Entrega]`); **Retirada foi removida do PDV** (segue no
   cardápio web e no histórico) e o campo "Cliente (opcional)" saiu da lateral (nome só na
   Entrega, via overlay). Banner corrigido para "Acrescentando **à** Comanda #NN".
   `test/pdv-comanda-tile.test.js` reescrito para o novo fluxo (T-03.01).
2. UI validada visualmente pelo dono nas capturas renderizadas do protótipo aprovado; o
   build passou (`npm test` 717/717, `check` 157).

## Divergências não esperadas

Nenhuma. O desenho planejado (D-01 a D-14) foi seguido integralmente; a única task reclassificada
no meio foi a dependência de T-04.01 sobre a cadeia de UI da sprint-03 (achado da auditoria F5,
corrigida no próprio plano antes da execução).