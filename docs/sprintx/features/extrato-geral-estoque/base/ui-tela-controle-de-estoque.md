# UI e rotas — tela "Controle de estoque" (onde o extrato geral vai morar)

## Contrato de entrada

Rotas HTTP relevantes, todas `exigeAuth` + `exigePermissao(...)` + `exigePdv` (gate de Plano
Completo, `src/servidor.js:2901-2911`, devolve 403 `{ erro: "Recurso do Plano Completo." }`):

- `GET /api/estoque` — `exigePermissao("estoque.ver")`. Devolve `{ linhas, contadores }` a
  partir do CACHE do cardápio (sem ida ao banco). Fonte: `src/servidor.js:2310-2328`.
- `GET /api/estoque/movimentos` — `exigePermissao("estoque.ver")`. Exige `itemId` (400 sem
  ele). Só essa rota toca `estoque_movimentos`. Fonte: `src/servidor.js:2330-2345`.
- `POST /api/estoque/movimentos`, `/minimo`, `/controle` — `exigePermissao("estoque.movimentar")`,
  gravação (fora do escopo do extrato, que é só leitura).

Permissões (`estoque.ver`, `estoque.movimentar`) são as mesmas do sistema de Equipe/PIN —
NÃO DOCUMENTADO nesta ingestão onde exatamente a lista de permissões concedíveis é
definida/exibida no cadastro de funcionário (ver `00-LACUNAS.md` se a F2 precisar disso).

## Contrato de saída

Estrutura da tela hoje (`public/admin.html:1447-1501`, seção `#aba-estoque`):

1. Cabeçalho (`cardapio-topo`): título "Controle de estoque" + subtítulo.
2. Bloqueio de plano (`#estoqueLock`): cadeado + texto + botão "Ver planos", visível só
   quando `GET /api/estoque` volta 403.
3. Conteúdo (`#estoqueConteudo`):
   - 3 cards de métrica clicáveis (Esgotados / Abaixo do mínimo / Controlados) que também
     funcionam como filtro (`data-est-contador`, `aria-pressed`).
   - Busca (`#estBusca`) + chips de filtro (`Só controlados` default | `Todos` | `Esgotados` |
     `Baixo`) — mesmo componente visual de outras telas (`pedidos-filtros`, `filtro-chip`).
   - Lista de linhas (`#estoque-lista`), uma por saldo (produto ou variação recuada).
     Clicar na linha abre a **gaveta** do produto (`estAbrirGaveta`, `public/app.js:943+`).

**Gaveta de UM produto** (`public/app.js:1122-1196`, HTML em torno de
`public/admin.html:1559+`):
- Resumo dos últimos 30 dias por tipo (Entrou/Vendeu/Perdeu/Devolveu), via `resumo()`.
- Extrato paginado por cursor: botão "Carregar mais" (`#btnEstMais`), 20 por página,
  `antes`/`antesId` da última linha carregada — front NUNCA usa OFFSET.
- Cada linha mostra tipo, quando (`estQuando`), delta (+/-, cor por sinal), saldo depois,
  observação: e quando tem `numero` de pedido, um botão que navega para a aba Pedidos com a
  busca já preenchida (fecha a gaveta ao clicar).

## Limites e cotas

- `limite` da paginação: 20 no front (`estCarregarExtrato`), mas o servidor aceita até 100
  (`src/estoque-db.js:77`) — o front escolhe 20, não é limite da API.
- Nenhum limite de linhas documentado para o extrato GERAL (não existe ainda).

## Erros conhecidos e tratamento

- Estados já padronizados nesta tela, a replicar no extrato geral: **vazio** (cardápio vazio →
  CTA "Ir para o Cardápio"; filtro sem resultado → mensagem + "limpe a busca"), **erro** de
  rede (mensagem + botão "Tentar de novo"), **bloqueado por plano** (`#estoqueLock`),
  **carregando** (esqueleto `est-esqueleto`).

## Riscos para a nossa implementação

- Não existe hoje NENHUMA UI para "todos os produtos ao mesmo tempo" — o extrato geral é uma
  visão nova, não uma variação de uma existente. Decisão de ONDE ele entra na navegação
  (nova aba? botão dentro de Controle de estoque que troca o modo de exibição? modal
  separado?) é decisão de produto/UI, não técnica — cabe à F2, com protótipo Stitch antes do
  código (regra global do projeto para tela nova).
- O componente de filtro por tipo não existe ainda em lugar nenhum do front — os 6 `TIPOS` de
  `estoque-db.js` teriam que virar chips ou um `<select>`; nenhum precedente visual direto,
  mas os "chips" de `#estFiltros`/`.pedidos-filtros` são o padrão mais próximo do design
  system a reaproveitar.
- O filtro de período do extrato geral colide conceitualmente com o teto de 366 dias que
  acabou de ser criado para `GET /api/pedidos` (`src/pedidos.js:intervaloDentroDoLimite`,
  2026-09-16) — mesma preocupação (não devolver histórico inteiro de uma vez), mas aqui o
  volume por linha é potencialmente maior (toda venda gera N movimentos, um por item). Vale
  decidir na F2/F3 se o extrato geral usa paginação por cursor (como a gaveta já faz) em vez
  de um teto de dias — provavelmente cursor É suficiente sozinho, sem precisar do teto
  também, mas é decisão de plano, não desta ingestão.

## Fonte

`public/admin.html:1447-1501,1559+`, `public/app.js:778-883,943-1196`, `src/servidor.js:2305-2345` — lido em 2026-09-16.
