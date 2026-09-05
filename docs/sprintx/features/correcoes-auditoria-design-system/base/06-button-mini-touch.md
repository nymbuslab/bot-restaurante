# `button.mini` abaixo da altura mínima de toque (Médio #4 do AUDIT.md)

## Contrato de entrada

- Botão base, `public/style.css:955-967`: `padding: 9px 16px; font-size: 13px;` (sem
  `height`/`min-height` explícito — a altura nasce do padding + line-height do texto).
- Modificador `.mini`, `public/style.css:995`: `button.mini { padding: 6px 12px; font-size:
  12px; }` — reduz padding vertical de 9px para 6px e a fonte de 13px para 12px.
- Usos de `.mini` em contexto de linha de tabela/lista (os citados pela auditoria):
  - `public/app.js:2360-2368` (`renderCardapio`, dentro da lista de itens do cardápio):
    botões "Restaurar item" (`data-restore-item`), "Editar item" (`data-edit-item`, classe só
    `mini`) e "Excluir item" (`data-del-item`, classe `perigo mini`) — todos com `<svg
    width="14" height="14">` dentro.
  - `public/style.css:3147` (citado pela auditoria): `.pedido-acoes button.mini` — ações de
    linha na lista/detalhe de pedidos.
  - Essas linhas de tabela também aparecem em layout mobile (cards de pedido) conforme já
    documentado no redesign de Pedidos (`PROGRESSO.md`, "Redesign Pedidos" — paginação e
    detalhe em 2 colunas), portanto `.mini` está presente tanto em contexto desktop/mouse quanto
    mobile/toque.

## Contrato de saída

- Altura resultante aproximada de `.mini`: `padding: 6px 12px` + `line-height` do texto/ícone
  (12px de fonte, `line-height: 1.5` herdado do body — `style.css:117-125`) ≈ 6+6+18 ≈ 30px de
  altura total. Diretriz comum de alvo de toque (WCAG 2.5.5 AA / Material Design) recomenda
  ~44px (WCAG) ou ~36-48px (Material); 30px fica abaixo de ambas.
- Botão base (sem `.mini`) fica em `padding: 9px 16px` + `font-size: 13px`/`line-height: 1.5` ≈
  9+9+19.5 ≈ 37.5px — mais perto do alvo, mas ainda não documentado como "atende WCAG" aqui
  (fora do escopo deste achado, que é só sobre `.mini`).

## Limites e cotas

NÃO DOCUMENTADO (não há uma diretriz de acessibilidade formalmente adotada pelo projeto para
tamanho mínimo de alvo de toque — `docs/design-system.md` e `DESIGN-SYSTEM.md` não mencionam
esse critério).

## Erros conhecidos e tratamento

- Nenhum bug funcional; é ergonomia de toque em telas usadas no balcão/PDV (mobile ou tablet).

## Riscos para a nossa implementação

- `.mini` é usado em MUITOS lugares do projeto além dos citados (a cartografia de design system
  lista `button.mini` como classe genérica reutilizada amplamente — ex.
  `admin-master.html:127,140,166,193,293` também usam `class="... mini ..."`). Aumentar o
  padding vertical de `.mini` GLOBALMENTE muda a altura de TODOS esses botões, não só os de
  linha de tabela — pode alterar o alinhamento vertical em headers/toolbars que hoje foram
  ajustados visualmente para a altura atual de ~30px.
- Duas estratégias possíveis, a decidir na F2/F3:
  1. Aumentar o padding vertical de `.mini` globalmente (risco de regressão visual em vários
     lugares, exige checagem visual ampla).
  2. Criar um modificador novo (ex. `.mini-toque` ou similar) só para os contextos de lista/mobile
     citados pela auditoria, sem tocar o `.mini` usado em toolbars/headers desktop.
  - A auditoria já registra essa mesma ressalva: "Se o alvo é mobile/toque, subir o padding
    vertical de `.mini`... ou reservar `.mini` só para contextos claramente desktop/mouse."
    **NÃO DOCUMENTADO** qual das duas o dono prefere — pergunta obrigatória da F2.

## Fonte

- `public/style.css:955-967` (botão base), `995` (`.mini`), `117-125` (line-height do body) —
  lido em 2026-09-05.
- `public/app.js:2358-2369` (botões de ação da linha de item do cardápio) — lido em 2026-09-05.
- `docs/design-system/AUDIT.md` (achado Médio #4, citando também `style.css:3147`) — lido em
  2026-09-05.
