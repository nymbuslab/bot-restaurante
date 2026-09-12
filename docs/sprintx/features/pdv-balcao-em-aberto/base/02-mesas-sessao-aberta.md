# Mesas — o padrão de "sessão aberta" que já existe no sistema

> Modo INTERNO. Fonte: código lido diretamente, sem suposição. Esta é a referência mais
> próxima do que a feature precisa construir para pedidos avulsos (fora de mesa).

## Contrato de entrada

- Schema (`supabase/migrations/20260628130000_mesas.sql`, lido por completo):
  ```sql
  create table public.mesas (
    id bigint generated always as identity primary key,
    empresa_id uuid not null references empresas(id) on delete cascade,
    nome varchar(20) not null,
    status varchar(20) not null default 'livre'
      check (status in ('livre','ocupada','pediu_conta','fechando')),
    taxa_servico numeric(5,2) default 0,
    total_consumido numeric(10,2) default 0,
    qr_code_token text,
    ordem integer default 0,
    aberta_em timestamptz,
    fechada_em timestamptz,
    criado_em timestamptz not null default now(),
    unique (empresa_id, nome)
  );
  ```
  A mesma migração acrescenta `pedidos.mesa_id` (bigint, nullable, `on delete set null`) e `caixa_movimentos.mesa_id`.
- **Abrir mesa** (UI, `public/app.js`): clicar no card → `mesaSelecionarCard(id)` (linha 7291) → `GET /api/mesas/:id` → abre o painel/drawer (`abrirMesaPainel`, 7307) na aba "Itens". Botão "Abrir Mesa" só quando `status === "livre"` (7462-7468) → `mesaAbrir()` (7497) → modal de nº de pessoas (`abrirModalPessoas`, 7518, com opção "Abrir sem informar") → `mesaConfirmarAbrir(pessoas)` (7503) → `POST /api/mesas/:id/abrir { pessoas }`. Mesa vira `ocupada`, `aberta_em = now()`.
- **Lançar itens numa mesa aberta**: a partir do painel, mudar para a aba "Lançar" (`mesaMudarAba("lancar")`, 7360) → `ativarMesaModoPdv()` (7737) troca a tela para a grade do PDV com um banner indicando a mesa. Usuário monta o carrinho normalmente; o mesmo botão `#pdvCobrar` (ver `01-pdv-fluxo-atual.md`) chama `mesaLancarDoPdv()` em vez de `abrirPdvPagar()` quando `mesaModoId` está setado.
- Entre "abrir mesa" e "lançar o primeiro item" são ~5-6 cliques e 3 telas/estados: card → drawer com botão → modal de pessoas → drawer aba "Lançar" → grade PDV → confirmação de lançamento.
- `mesaLancarDoPdv()` (`public/app.js:7789-` , lido até a chamada da API): monta `itens` a partir de `pdvCart` (mesmo shape do PDV: `id, qtd, composicao, opcionais, grupos, variacoes, observacao`) e faz `POST /api/mesas/:id/pedido { itens }`.

## Contrato de saída

- `POST /api/mesas/:id/pedido` (`src/servidor.js:2945-3001`, handler completo lido) — **a implementação de referência para "lançar mais itens num pedido já aberto"**:
  1. Guarda de status: rejeita com `400` se `mesa.status === "livre"` ("Abra a mesa antes de lançar pedidos") ou se `status` for `"pediu_conta"`/`"fechando"` ("A mesa está em fechamento. Reabra a mesa para lançar novos itens.").
  2. Recalcula no servidor (`pdv.recalcularVenda`) e valida estoque (`estoque.validarEstoque`, `409` se faltar) — sobre o payload da RODADA, não o pedido inteiro.
  3. Transação: `store.baixarEstoqueTx` (baixa atômica) → `mesasDb.lancarItens(dir, mesaId, { itens, total: subtotal, cliente: "Mesa " + nome, observacao }, client)` → `store.amarrarPedidoTx` (liga os movimentos de estoque ao pedido) → `COMMIT`.
  4. **Fora da transação, best-effort**: filtra os itens da rodada marcados `cozinha: true` (`itensDeCozinha`) e, se houver, enfileira uma via de cozinha SÓ com esses itens (`impressaoFila.enfileirar(dir, "mesa-cozinha", [Comanda.montarCozinha(pedCoz, cfg)])`, linha 2984-2990, comentário original: "Enfileira a via da cozinha da rodada").
  5. `res.json({ ok: true })`.

- **`mesasDb.lancarItens` (`src/mesas-db.js:533-589`, lido por completo) — MECANISMO EXATO, confirmado por leitura direta (corrige suposição anterior desta mesma base):**
  Ao contrário do que uma leitura superficial sugeriria, a mesa **NÃO** cria uma linha nova em `pedidos` a cada rodada. Ela **reusa a mesma linha** enquanto durar a sessão:
  1. Trava a mesa (`FOR UPDATE`) e reconfere `status === 'ocupada'` DENTRO da transação (comentário do código: entre a checagem da rota e o INSERT cabe um fechamento inteiro rolar por trás).
  2. Busca um pedido **já existente desta sessão**: `SELECT ... WHERE mesa_id = $2 AND status = 'novo' AND ${DA_SESSAO} ORDER BY id ASC LIMIT 1` — `DA_SESSAO` é a constante `"p.recebido_em IS NULL AND p.status <> 'cancelado' AND m.aberta_em IS NOT NULL AND p.criado_em >= m.aberta_em"` (`src/mesas-db.js:37`). Comentário do código: "Reusa o pedido aberto DESTA sessão. Sem o recorte, uma sobra de sessão antiga era escolhida aqui e a rodada nova ia parar dentro dela, herdando número e total."
  3. **Se existe** (`existing.rows[0]`): `UPDATE pedidos SET itens = $1::jsonb, total = $2 WHERE id = $3`, onde `itens` é `[...itensAntigos, ...itensNovos]` (append no array jsonb) e `total` é `totalAntigo + totalDaRodada` (soma simples, sem recalcular do zero).
  4. **Se não existe** (primeira rodada da sessão): `INSERT` normal, com `numero` sequencial (`MAX(numero)+1`), `status: 'novo'`, `tipo_entrega: 'Balcão'` (fixo), `origem: 'mesa'`.
  5. Em ambos os casos, recalcula `mesas.total_consumido` (soma de todos os pedidos da sessão) ao final.
  6. `pedidoId`/`numero` retornados são sempre os da MESMA linha reusada — é por isso que uma mesa mantém o mesmo `#numero` do início ao fim da sessão, e por isso que `Comanda.montarCozinha` (chamado pela rota, ver acima) usa `mesa.nome` em vez do pedido, já que o `numero` do pedido não muda entre rodadas mas a via de cozinha da rodada é o que importa mostrar.

- **Conceito de "sessão"** documentado em `docs/modelo-dados.md:291-323` (referenciado, não citado aqui por completo) e implementado literalmente pela constante `DA_SESSAO` acima: um pedido pertence à sessão da mesa aberta enquanto `recebido_em IS NULL`, `status <> 'cancelado'`, `aberta_em IS NOT NULL` e `criado_em >= aberta_em`. **A "mesa aberta" é UMA linha em `pedidos` que recebe UPDATE a cada rodada, não uma soma de várias linhas** — a leitura completa de `lancarItens` corrige a hipótese anterior desta base.

## Limites e cotas

NÃO DOCUMENTADO (sem limite de rodadas por mesa ou tempo máximo aberta no código lido).

## Erros conhecidos e tratamento

- `400`: pedido vazio, mesa não encontrada, mesa livre (precisa abrir antes), mesa em fechamento (`pediu_conta`/`fechando` — precisa reabrir para lançar).
- `404`: mesa não encontrada.
- `409`: estoque insuficiente.
- Falha ao enfileirar impressão é capturada e só loga no console (`console.error("enfileirar impressão mesa:", e.message)`) — **nunca derruba a resposta de sucesso da rodada**. Ou seja, o padrão do sistema já é: a venda/lançamento é a fonte de verdade; a impressão é best-effort e pode falhar silenciosamente (do ponto de vista do operador, que só vê "ok").

## Riscos para a nossa implementação

- Este é o **padrão a replicar** para pedidos avulsos "em aberto", agora com o mecanismo exato confirmado: recalcular → validar estoque → baixar estoque → **UPDATE na mesma linha do pedido** (append em `itens`, soma em `total`) se já existir um pedido aberto para chamar de volta, senão INSERT → amarrar movimento → COMMIT → enfileirar cozinha SÓ da rodada nova, best-effort.
- **A ambiguidade "1 linha vs. N linhas por rodada" está resolvida pela leitura de `lancarItens`**: mesa usa 1 linha por sessão, com UPDATE incremental — não N linhas amarradas por um campo comum. Isso é diretamente aplicável a um pedido avulso: não precisa de nenhum campo novo de agrupamento (nem algo equivalente a `mesa_id`), porque a própria linha do pedido já é a unidade — a rota nova faria `UPDATE pedidos SET itens = itens_antigos + itens_novos, total = total_antigo + total_rodada WHERE id = $1 AND recebido_em IS NULL AND status <> 'cancelado'`, mesma guarda que `cancelarPedido`/`cancelarItemPedido` já usam (ver `03-pedidos-modelo-e-rotas.md`). Não é mais um ponto que precisa de decisão do usuário na F2 — é um padrão de código já estabelecido.
- Diferença a notar: mesa reidentifica "o pedido desta sessão" por uma QUERY (`DA_SESSAO`, via `mesa_id` + janela de tempo desde a abertura) porque pode haver múltiplas sessões históricas na mesma mesa (abriu, fechou, abriu de novo). Um pedido avulso não tem esse problema — o `id`/`numero` já é o identificador direto e único, sem precisar de janela de tempo nem de reconstruir "qual é a sessão atual": a rota nova recebe o `id` do pedido diretamente (ex.: da URL `/api/pedidos/:id/itens`), sem precisar da lógica de busca por sessão que `DA_SESSAO` resolve para mesas.

## Fonte

`supabase/migrations/20260628130000_mesas.sql` (arquivo completo) — lido em 2026-09-07.
`public/app.js:7291-7397, 7462-7520, 7737-7810` (via relatório de exploração + leitura direta de trechos) — lido em 2026-09-07.
`src/servidor.js:2930-3001` — lido em 2026-09-07.
`src/mesas-db.js:34-37, 533-589` (lido por completo) — lido em 2026-09-07.
