---
expx_schema: 1
expx_tool: sprintx
kind: fechamento
trabalho_id: correcoes-auditoria-design-system
titulo: Correcao dos achados de design system (Alto, Medio e Baixo)
status: concluido
concluido_em: 2026-09-05
sprints: [sprint-01, sprint-02]
tasks_concluidas: 13 de 13
suite: "573 passed, 0 failed"
check_syntax: "141 arquivos sem erro de sintaxe"
---

# Fechamento — correcoes-auditoria-design-system

## Resultado

As 13 tasks (1 da sprint-01 + 12 da sprint-02) foram concluídas na ordem declarada em
`ORQUESTRADOR.md`: T-01.01 → T-02.01 → … → T-02.12. Método sprintx em todas: teste estático
escrito primeiro (vermelho), implementação, teste verde, suíte completa + varredura de sintaxe,
e task marcada `concluida` com `concluida_em` e `suite` em `sprint-02/tasks.md`.

**Estado final:** `npm test` → 573 passed, 0 failed. `npm run check` → 141 arquivos sem erro de
sintaxe. Nenhum bloqueio registrado (`00-BLOQUEIOS.md` vazio).

## O que cada achado virou

| Severidade | Achado | Correção |
|---|---|---|
| Alto #1 | toast sem `aria-live`/`role` | `aria-live="polite"` + `role="alert"` (T-02.01) |
| Alto #2 | botões `✕` sem `aria-label` | `aria-label="Fechar"` nos 4 botões (T-02.02, inclui D-09) |
| Alto #3 | `--text-secondary` sobre `--bg-overlay` < AA | token `--text-secondary-fg` (#9AA1BF, 5,27:1) + `.mesa-status-badge.s-livre` (T-02.03) |
| Alto #4 | 4 telas sem estado de carregando | "Carregando…" antes do fetch em Pedidos/PDV/Mesas/Caixa (T-02.04) |
| Alto #5 | erro de rede confundido com "caixa fechado" | blocos `pdvErroRede`/`mesasErroRede` com botão "Tentar de novo" (T-02.05, D-02) |
| Alto #6 | cardápio de tenant novo sem estado vazio | estado vazio com CTA "Ir para Categorias" (T-02.06, D-06) |
| Médio #1 | `.campo`/`.auth-campo` duplicando label | seletor combinado único (5 props), containers intactos (T-02.08) |
| Médio #2 | dois `<h1>` no painel master | títulos de aba viram `h2.am-titulo`; 1 h1 na área autenticada (T-02.09) |
| Médio #3 | busca vazia fora do `.estado-vazio` | usa o componente; `.cardapio-vazio-busca` removido (T-02.07) |
| Médio #4 | `button.mini` abaixo da altura de toque | `button.mini-lista` com `min-height:36px` nos 3 botões de item (T-02.10, D-03) |
| Médio #5 | breakpoint do PDV descasado da sidebar | 980px → 1100px (T-02.11, D-08) |
| Baixo #1 | abas do editor sem ARIA | `role="tablist"`/`role="tab"` + `aria-selected` dinâmico (T-02.12, D-04) |

Os 2 Bloqueios da auditoria (paginação de Pedidos, confirmação de exclusão) ficaram fora deste
trabalho, conforme o objetivo do orquestrador.

## Arquivos alterados

**Código:** `public/app.js`, `public/admin.html`, `public/admin-master.html`, `public/style.css`.

**Testes (novos):** `test/design-system-toast.test.js`, `test/design-system-botoes-fechar.test.js`,
`test/design-system-editor-tabs.test.js`, `test/design-system-contraste.test.js`,
`test/design-system-carregando.test.js`, `test/design-system-erro-rede.test.js`,
`test/design-system-cardapio-vazio.test.js`, `test/design-system-cardapio-busca-vazia.test.js`,
`test/design-system-campo-auth-campo.test.js`, `test/design-system-heading-master.test.js`,
`test/design-system-mini-lista.test.js`, `test/design-system-pdv-breakpoint.test.js`, além do
harness `test/apoio/arquivo-estatico.js` + `test/arquivo-estatico.test.js` da sprint-01.

## Ressalva — conferência visual

As tasks puramente visuais (T-02.03 contraste, T-02.09 heading, T-02.10 altura de botão, T-02.11
breakpoint) tiveram a conferência visual registrada com a ressalva prevista na seção 7 do
`ORQUESTRADOR.md`: **tool de renderização visual indisponível nesta sessão** → "build passou, UI
não validada" (regra do `CLAUDE.md`). O teste estático de cada uma está verde e obrigatório; a
conferência em duas larguras (1366×768 e 390×844) fica como passo de QA humano, e o painel deve
ser conferido visualmente no próximo uso normal (PDV em 1100–1366px, badge de mesa, títulos do
master, botões de ação do cardápio, estados vazios e de carregamento).

## Divergências não esperadas

Nenhuma. Duas adequações menores de teste durante a execução, ambas alinhadas ao rastro do
orquestrador:
- T-02.05 e T-02.06: o helper de extração de branch foi ajustado para casar com a forma real do
  código (`id` mostrado por `.hidden = false`, e não o primeiro `$(` da branch; `c.innerHTML` em
  vez de `$("...").innerHTML` no estado vazio do cardápio).
- Os arquivos `fases.md` das duas sprints tiveram o status das 6 fases marcado como `concluida` e
  o grafo mermaid atualizado, e ambos os `sprint.md` passaram a `status: concluida`.