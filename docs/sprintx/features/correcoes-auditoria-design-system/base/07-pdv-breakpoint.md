# Breakpoint do PDV descasado do da sidebar (Médio #5 do AUDIT.md)

## Contrato de entrada

- Grid principal do PDV, `public/style.css:5176`:
  `.pdv { display: grid; grid-template-columns: 140px 1fr 360px; gap: 18px; align-items: start; }`
  (rail de categorias 140px + produtos flexível + carrinho 360px).
- Grade de produtos dentro da coluna do meio, `public/style.css:5199`:
  `.pdv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; align-content: start; }`
  — cada tile de produto precisa de no mínimo 150px de largura para caber mais de 1 coluna.
- Breakpoint da sidebar do painel inteiro, `public/style.css:876-877`:
  `@media (max-width: 1100px) { .sidebar { width: 200px; } ... }` (reduz de uma largura maior,
  não documentada nesta leitura, para 200px).
- Breakpoints do PDV, `public/style.css:5461-5465`:
  ```css
  @media (max-width: 980px) {
    .pdv { grid-template-columns: 116px 1fr 320px; gap: 14px; }
  }
  @media (max-width: 860px) {
    .pdv { grid-template-columns: 116px 1fr; }  /* carrinho vira painel fixo mobile */
    ...
  }
  ```

## Contrato de saída

- Entre 861px e 980px de largura de VIEWPORT: sidebar já está em 200px (ativou em 1100px), mas
  `.pdv` ainda usa a config "larga" (`140px 1fr 360px` — só muda em 980px). Entre 981px e a
  largura em que o notebook realmente aperta, o espaço para produtos fica: viewport - sidebar
  (200px) - paddings do `main` (`22px 20px`, `style.css:878`) - colunas fixas do `.pdv`
  (140+360+gap 18px = 518px). Ex.: viewport de 1366px (notebook comum) → 1366 - 200 - 42 - 518 ≈
  606px disponíveis para `.pdv-produtos`, o que já cabe ~4 tiles de 150px — MAS a auditoria
  citou a faixa 861-980px como a crítica: aí `.pdv` já mudou para `116px 1fr 320px` (breakpoint
  980px ativo), sobrando viewport(861 a 980) - 200 (sidebar) - ~28 (padding) - 116 - 320 - 14
  (gap) = entre ~183px e ~302px para a grade de produtos — o suficiente para só 1-2 tiles de
  150px, ou seja, a grade "multi-coluna" pretendida vira funcionalmente 1 coluna espremida ao
  lado do carrinho de 320px.
- Esperado: alinhar o breakpoint do `.pdv` com o da sidebar (1100px, não 980px), ou reduzir a
  coluna fixa do carrinho nessa faixa — a auditoria aponta as duas opções sem decidir qual.

## Limites e cotas

NÃO DOCUMENTADO (não é limite de API; é layout responsivo).

## Erros conhecidos e tratamento

- Nenhum erro funcional; é aperto visual real numa faixa de largura plausível (notebook com o
  painel não maximizado, ou monitor secundário estreito) — não é um caso hipotético raro.

## Riscos para a nossa implementação

- Trocar o valor `980px` para `1100px` no seletor `@media (max-width: 980px) { .pdv {...} }`
  (`style.css:5461`) é uma mudança de 1 linha, mas isso já é território do drift #1 catalogado no
  `DESIGN-SYSTEM.md` (19 breakpoints "órfãos" fora do padrão de 1024px/640px) — mudar este
  breakpoint especificamente NÃO resolve o drift geral (que é uma tarefa maior, fora do escopo
  desta feature), só a consequência visual concreta apontada no achado Médio #5.
- Duas soluções possíveis, ambas de baixo risco isoladamente:
  1. Mudar `980px` → `1100px` no seletor do `.pdv` (alinha com a sidebar).
  2. Reduzir a largura fixa do carrinho (`360px`/`320px`) na faixa intermediária, mantendo
     980px.
  - A escolha entre as duas não está documentada como preferência do dono — decisão de
    implementação a confirmar na F3 (não é PENDENTE bloqueante de produto, é decisão técnica
    dentro do escopo já aprovado).
- Testar essa mudança exige inspecionar visualmente a faixa 861-1100px (não é uma larghura fixa
  única) — vai precisar de verificação manual/Playwright em pelo menos 2 larguras de teste
  dentro dessa faixa (ex. 900px e 1050px), já que não há teste automatizado de layout responsivo
  no projeto (ver `09-padroes-de-teste-frontend.md`).

## Fonte

- `public/style.css:876-884` (breakpoint da sidebar), `5176` (`.pdv`), `5199` (`.pdv-grid`),
  `5461-5474` (breakpoints do `.pdv`) — lido em 2026-09-05.
- `docs/design-system/DESIGN-SYSTEM.md` (drift #1, breakpoints órfãos) — lido em 2026-09-05.
- `docs/design-system/AUDIT.md` (achado Médio #5) — lido em 2026-09-05.
