---
expx_schema: 1
expx_tool: sprintx
kind: sprint
trabalho_id: correcoes-auditoria-design-system
sprint_id: sprint-02
titulo: Correcao dos 12 achados Alto/Medio/Baixo da auditoria de design system
status: concluida
criterio_saida: npm test e npm run check verdes (inclui os 12 test/design-system-*.test.js); as 12 tasks concluidas
fases: [F-02.1, F-02.2, F-02.3, F-02.4, F-02.5, F-02.6]
riscos: [Regressao visual em toolbars/headers ao mexer em button.mini se a task nao usar o modificador dedicado (D-03), Unificar .campo/.auth-campo exige nao tocar o container flex de .auth-campo -- so o label]
atualizado_em: 2026-09-05
---

# Sprint 02 — Correção dos 12 achados Alto/Médio/Baixo da auditoria de design system

## Objetivo

Corrigir, um a um, os 12 achados de severidade Alto (6), Médio (5) e Baixo (1) registrados em
`docs/design-system/AUDIT.md` (mais o 4º botão sem `aria-label` encontrado na ingestão, D-09) —
acessibilidade de toast e botões de fechar, contraste de cor, estados de carregamento e erro,
estados vazios do cardápio, unificação de padrões de formulário/heading/botão, e o breakpoint do
PDV. Os 2 Bloqueios da mesma auditoria (paginação de Pedidos e confirmação de exclusão sem nome)
ficam FORA deste trabalho, por decisão do dono no pedido original.

## Fases

| Fase | Título | Roda em paralelo com |
|---|---|---|
| F-02.1 | Acessibilidade de componentes | nenhuma |
| F-02.2 | Contraste de cor | nenhuma |
| F-02.3 | Estados de carregamento e erro | nenhuma |
| F-02.4 | Cardápio: estados vazios | nenhuma |
| F-02.5 | Consistência de padrões | nenhuma |
| F-02.6 | Responsividade do PDV | nenhuma |

Detalhe de cada fase em `fases.md`; tasks em `tasks.md`.

## Critério de saída

`npm test` (inclui os 12 arquivos `test/design-system-*.test.js`, um por task) e `npm run check`
terminam verdes, e as 12 tasks desta sprint estão com `status: concluida`.

## Riscos conhecidos

- Regressão visual em toolbars/headers ao mexer em `button.mini`, mitigado pela decisão D-03
  (modificador `.mini-lista` dedicado, sem tocar `.mini` global) — ver
  `base/06-button-mini-touch.md`.
- Unificar `.campo`/`.auth-campo` exige tocar só a regra do `label` (mesmo visual nos dois); os
  containers têm `display` diferente (`margin-bottom` vs. `flex`) e não devem ser fundidos — ver
  `base/04-campo-vs-auth-campo.md`.

**Risco descartado durante a reauditoria (F5):** o risco "trocar `<h1>` por `<h2>` no painel
master pode perder o `letter-spacing` exclusivo da tag `h1`" (registrado em
`base/05-heading-painel-master.md`) foi verificado e NÃO se confirma — `.am-titulo`
(`style.css:3746`) já declara seu próprio `letter-spacing: -0.3px`, independente da tag. T-02.09
inclui uma checagem estática desse fato em vez de qualquer edição em `style.css`.
