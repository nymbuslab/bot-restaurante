---
expx_schema: 1
expx_tool: sprintx
kind: fechamento
trabalho_id: paginacao-pedidos
titulo: Trocas da paginacao numerada por carregar mais em pedidos
status: concluido
concluido_em: 2026-09-06
sprints: [sprint-01, sprint-02]
tasks_concluidas: 3 de 3
suite: "588 passed, 0 failed"
check_syntax: "144 arquivos sem erro de sintaxe"
---

# Fechamento — paginacao-pedidos

## Resultado

As 3 tasks (1 da sprint-01 + 2 da sprint-02) foram concluídas na ordem declarada em
`ORQUESTRADOR.md`: T-01.01 → T-02.01 → T-02.02. Método sprintx em todas: teste escrito primeiro
(vermelho), implementação, teste verde, suíte completa + varredura de sintaxe, e task marcada
`concluida` com `concluida_em` e `suite` em cada `tasks.md`.

**Estado final:** `npm test` → 588 passed, 0 failed (baseline 573 + 15 novos). `npm run check` →
144 arquivos sem erro de sintaxe. Nenhum bloqueio registrado (`00-BLOQUEIOS.md` vazio).

## O que a entrega virou

| Task | O que era | O que passou a ser |
|---|---|---|
| T-01.01 | contagem embutida em `app.js` (não testável) | módulo puro dual-mode `public/paginacao-pedidos.js` (`contagemInicial`, `proximaContagem`, `temMais`) + 7 testes unitários |
| T-02.01 | `PEDIDOS_POR_PAGINA=10` + `paginaPedidos`; corte por página numerada; 8 pontos resetando `paginaPedidos = 1` | `LIMITE_INICIAL_PEDIDOS=30`/`INCREMENTO_PEDIDOS=20` + `pedidosVisiveis`; corte via `PaginacaoPedidos.contagemInicial`; os 8 pontos resetam `pedidosVisiveis`; `<script>` de `paginacao-pedidos.js` em `admin.html` antes de `app.js` |
| T-02.02 | `paginacaoHtml`/`paginasVisiveis`/`irParaPagina` + botões de página numerada | botão único "Carregar mais" (`class="ped-mais"` + `data-carregar-mais`), aparece via `PaginacaoPedidos.temMais`; regra `.ped-mais` em `style.css` |

A contagem vive em `PaginacaoPedidos`, nunca no servidor: o clique cresce a lista já em memória
(`listaPedidosAtual`) sem nova requisição. No final da lista (quando `visiveis >= total`) o botão
some e o resumo informa "Mostrando X de Y pedidos".

## Arquivos alterados

**Código:** `public/app.js`, `public/admin.html`, `public/style.css`.

**Novos:** `public/paginacao-pedidos.js`, `test/paginacao-pedidos.test.js` (T-01.01),
`test/paginacao-pedidos-app.test.js` (T-02.01 + T-02.02).

**Removidos:** `test/paginacao-pedidos-caracterizacao.test.js` — criado na fase de caracterização
para congelar o comportamento antigo e antecipar o raio; deixou de ter propósito (e passou a falhar)
assim que o comportamento foi trocado, como previsto no plano. A validação do novo comportamento
ficou por conta do teste do app, que é escopo-estático sobre o trecho isolado de
`renderListaPedidos` e sobre os 8 pontos de reset.

## Ressalva — conferência visual e de comportamento

A tela de Pedidos não é coberta por teste de DOM/Execução — a cobertura desta entrega é por
checagem estática de texto sobre `public/app.js` (`contemTrecho`/`trechoEntre` em
`test/apoio/arquivo-estatico.js`), além dos testes unitários do módulo puro. **Tool de
renderização visual indisponível nesta sessão** → "build passou, UI não validada" (regra do
`CLAUDE.md`). O roteiro manual em `docs/legado/manual/paginacao-pedidos.md` cobre os cenários
chave e segue como passo de QA humano no próximo uso normal do painel.

## Divergências não esperadas

Uma, planejada: T-02.01 removeu `paginaPedidos`, que era a única consumidora de
`paginacaoHtml`/`paginasVisiveis`/`irParaPagina` — essas funções e o botão "Carregar mais" já
saíram na T-02.01, e à T-02.02 coube o CSS e a confirmação estática. O grafo de dependência
(T-01.01 → T-02.01 → T-02.02) não mudou; apenas o conteúdo dos dois fechamentos de T-02.02 foi
antecipado. Marcações de status ajustadas nos dois blocos (frontmatter e corpo) de cada `tasks.md`,
`fases.md` e `sprint.md` das duas sprints.