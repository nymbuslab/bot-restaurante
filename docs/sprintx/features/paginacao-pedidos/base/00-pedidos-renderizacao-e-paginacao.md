# Pedidos — renderização e paginação atual

## Contrato de entrada

`carregarPedidos()` (`public/app.js:4876-4893`) busca `GET /api/pedidos` (rota autenticada,
`src/servidor.js:2226`) com query opcional `periodo` (`hoje`|`7dias`) OU `desde`/`ate`
(`AAAA-MM-DD`). O servidor filtra por período/intervalo no SQL (`src/pedidos.js:101-117`,
`lerTodos`) e devolve **todos** os pedidos da empresa naquele recorte, `ORDER BY id ASC`,
sem `LIMIT` nenhum (confirmado lendo a query em `src/pedidos.js:115`) — depois `.reverse()`
no servidor (mais recente primeiro). O resultado inteiro vira `pedidosCache`
(`public/app.js:4891`).

A partir daí, **tudo é client-side**: `renderPedidos()` (não lido linha a linha nesta
ingestão, mas referenciado em `public/app.js:5283-5284` como quem monta `lista` e chama
`renderListaPedidos(lista)`) aplica os filtros de tipo/canal/busca/pagamento sobre
`pedidosCache` inteiro, e `renderListaPedidos(lista)` (`public/app.js:5292-5385`) fatia essa
`lista` já filtrada em páginas de `PEDIDOS_POR_PAGINA = 10` (`public/app.js:4870`), usando o
estado global `paginaPedidos` (`public/app.js:4871`, inicia em `1`).

## Contrato de saída

`renderListaPedidos` não devolve valor — grava HTML diretamente em `#pedidosContainer`
(`public/app.js:5292`): o resumo do recorte, a tabela desktop (`.pedidos-tabela`), os cards
mobile (`.pedidos-cards`, escondidos em desktop por CSS — `public/style.css:2045`,
`3611`) e o bloco de paginação (`paginacaoHtml`, `public/app.js:5227-5240`), que só
aparece quando `totalPaginas > 1`.

`paginacaoHtml(total, totalPaginas, ini, qtdNaPagina)` monta: texto "Mostrando X–Y de N
pedidos", botões `‹`/`›` (desabilitados nas pontas) e os números de página visíveis
(`paginasVisiveis`, `public/app.js:5215-5225` — mostra até 5 números cheios, reticências
para o resto, sempre a primeira e a última página). Clique num botão `[data-pag]`
chama `irParaPagina(n)` (`public/app.js:5243-5246`), que só atualiza `paginaPedidos` e
re-renderiza a partir do array **já em memória** (`listaPedidosAtual`) — trocar de página
não faz nova requisição ao servidor.

## Limites e cotas

- `PEDIDOS_POR_PAGINA = 10`, fixo, sem relação com altura de tela — é exatamente o achado
  da auditoria (`docs/design-system/AUDIT.md`, Bloqueio #1: `public/app.js:4847` na
  numeração da auditoria, hoje em `public/app.js:4870` porque o arquivo cresceu com a
  correção de design system mergeada em 2026-09-06).
- Nenhum limite de linhas no servidor: `GET /api/pedidos?periodo=7dias` pode devolver
  centenas de linhas para uma empresa de movimento alto, tudo de uma vez, antes mesmo da
  paginação de 10 entrar em ação. NÃO DOCUMENTADO um teto de linhas para o filtro
  `desde`/`ate` (intervalo customizado) — a validação em `src/servidor.js:2231-2232` só
  confere o formato da data, não o tamanho do intervalo.
- `.tabela-scroll` (`public/style.css:2168`) só tem `overflow-x: auto` (rolagem
  horizontal para não quebrar em telas estreitas) — **não há rolagem vertical própria
  nem altura fixa no container da tabela**. A página inteira rola verticalmente
  (confirmado: nenhuma regra de `overflow-y`/`height` fixa em `.conteudo`,
  `public/style.css:552`, nem em `#pedidosContainer`). Isso importa para a F2: "calcular
  quantas linhas cabem na altura disponível" (uma das duas direções que a auditoria
  sugere) não tem hoje um container com altura própria para medir — teria que ser contra
  `window.innerHeight` menos o que já está acima da tabela (filtros, resumo, cabeçalho),
  e recalculado no evento de resize.

## Erros conhecidos e tratamento

`carregarPedidos()` mostra "Carregando…" antes do fetch e, em erro, chama
`toast("Não foi possível carregar os pedidos. Verifique a conexão e tente de novo.",
"erro")` (`public/app.js:4893-4894`) — não há tratamento de erro específico para a
paginação em si, porque ela não faz requisição própria (opera sobre dado já carregado).

## Riscos para a nossa implementação

- **Qualquer mudança na paginação é 100% front-end** (nenhuma rota nova, nenhum contrato
  de API muda) — reduz bastante o raio de impacto em relação ao gate financeiro que a
  correção de design system mexeu.
- **Sem container de altura própria**: a direção "paginação adaptativa" (medir altura
  disponível) exige lidar com resize de janela, zoom do navegador e a diferença
  desktop/mobile (a tabela e os cards são elementos DIFERENTES, escondidos por CSS —
  qualquer cálculo de "quantas linhas cabem" precisa response a qual dos dois está
  visível). É mais estado para manter e mais caso de borda que a alternativa.
- **Existe precedente no próprio projeto para "carregar mais"**, mas do lado servidor
  (paginação por cursor de data no extrato de estoque, `public/app.js:899-905` e a rota
  correspondente) — não é reaproveitável direto aqui porque o Pedidos já baixa a lista
  inteira do período de uma vez; um "carregar mais" para Pedidos seria só **client-side**
  (aumentar quantas linhas de `listaPedidosAtual` são renderizadas), mais simples que
  medir altura de tela.
- **Nenhum teste automatizado cobre este código hoje** (busca confirmada: nenhuma
  ocorrência de `PEDIDOS_POR_PAGINA`, `renderListaPedidos`, `paginacaoHtml` ou
  `paginasVisiveis` em `test/*.js`). Ver `base/01-padrao-teste-funcao-pura-dual-mode.md`
  para o caminho já usado no projeto para tornar lógica de `public/app.js` testável de
  verdade (não só checagem estática de texto).
- Nenhum destes três arquivos (`public/app.js`, `public/admin.html`, `public/style.css`)
  está listado nas zonas de risco declaradas em `docs/legado/PERFIL.md` §7 — mas o modo
  legado está ativo no projeto (o arquivo existe), então a Camada 2 (raio de impacto)
  ainda se aplica antes da execução, como aconteceu na correção anterior de design
  system.

## Fonte

- `public/app.js:4866-4894` (carregarPedidos, pedidosCache, PEDIDOS_POR_PAGINA) — lido em 2026-09-06
- `public/app.js:5215-5385` (paginasVisiveis, paginacaoHtml, irParaPagina, renderListaPedidos) — lido em 2026-09-06
- `src/servidor.js:2226-2237` (rota `GET /api/pedidos`) — lido em 2026-09-06
- `src/pedidos.js:101-117` (`lerTodos`) — lido em 2026-09-06
- `public/style.css:552, 2045, 2129-2168, 3611` (`.conteudo`, `.pedidos-cards`, `.pedidos-tabela`, `.tabela-scroll`) — lido em 2026-09-06
- `docs/design-system/AUDIT.md:19-27` (Bloqueio #1 original) — lido em 2026-09-06
- `docs/legado/PERFIL.md` §7 (zonas de risco) — lido em 2026-09-06
