# Pedidos — schema, `src/pedidos.js` e rotas de modificação existentes

> Modo INTERNO. Fonte: código lido diretamente, sem suposição.

## Contrato de entrada

- Schema base (`supabase/migrations/20260612115133_init_schema.sql:24-42`, lido por completo):
  ```sql
  create table public.pedidos (
    id bigint generated always as identity primary key,
    empresa_id uuid not null references empresas(id) on delete cascade,
    numero integer not null,
    status text,
    cliente text,
    telefone text,
    tipo_entrega text,
    endereco text,
    pagamento text,
    taxa_entrega numeric(10,2) default 0,
    itens jsonb not null default '[]'::jsonb,
    total numeric(10,2) not null default 0,
    criado_em timestamptz not null default now(),
    avisado_em timestamptz
  );
  create unique index pedidos_empresa_numero_idx on public.pedidos (empresa_id, numero);
  ```
  Colunas acrescentadas por migrações posteriores (confirmadas via `mapRow` em `src/pedidos.js:27-54`, não via leitura de cada migração): `chat_id`, `pagamento_resumo`, `observacao`, `recebido_em`, `impresso_em`, `mesa_id` (mesas.sql), `origem` (`pedido_origem.sql`), `desconto`, `troco_para` (`pedido_troco.sql`), `reservado_em`/`reservado_por` (inferido do uso em `pendentes()`, não lido na migração).
  - `status` é **texto livre**, sem enum/check no schema. Valores observados no código: `"novo"` (default em todo INSERT, inclusive vendas já pagas — `caixa.js:265`) e `"cancelado"` (`pedidos.js:272`, `caixa.js:413`). **Não existe status "recebido"** — se o pedido foi pago é determinado por `recebido_em IS NOT NULL`, não por `status`.
  - `numero` é **sequencial por `empresa_id`**, atribuído no INSERT via `(SELECT COALESCE(MAX(numero),0)+1 FROM pedidos WHERE empresa_id = $1)` (`src/pedidos.js:66`). É o número que aparece como `#123` na UI (`public/app.js:1841`, fallback pros últimos 8 caracteres do `id` só quando `numero` está ausente) e sai impresso na comanda (`Comanda.montarCozinha`, "Pedido #" + numero).

- `src/pedidos.js` (módulo inteiro lido, 458 linhas) expõe hoje:
  `salvarPedido`, `lerTodos`, `ultimo`, `lerPorId`, `avisarPedido`, `pendentes`, `marcarImpresso`, `contarNoMes`, `anonimizarAntigos`, `fecharConexao`, `esquecer`, `contarVendasDoItem`, `cancelarPedido`, `cancelarItemPedido`, `dashboardRaw`.
  **Não existe nenhuma função de "adicionar item a um pedido existente"** — só cancelar (pedido inteiro ou item) e ler.

- Rotas HTTP para um pedido já criado, fora do fluxo de mesa (`src/servidor.js`, handlers completos lidos):
  - `POST /api/pedidos/:id/cancelar` (2374-2396): se `recebidoEm` truthy, passa por `caixa.cancelarRecebido` (exige caixa aberto, gate `exigeCaixa`) e enfileira comprovante; senão, `pedidos.cancelarPedido` (devolve estoque, marca `status='cancelado'`).
  - `POST /api/pedidos/:id/cancelar-item` (2398-2410): `pedidos.cancelarItemPedido(dir, id, itemIdx, { devolver })`, devolve o pedido atualizado.
  - `POST /api/pedidos/:id/reimprimir` (2414-2431): monta `Comanda.montarComanda(pedido, cfg, {...})` e reenfileira `cozinha`/`cupom`/`ambas` (parâmetro `via`).
  - **Não existe `POST /api/pedidos/:id/itens` nem equivalente.** Confirmado por leitura completa da seção de rotas de pedidos em `servidor.js` — só as três acima existem para um pedido isolado (fora de mesa).

## Contrato de saída

- `pedidos.cancelarPedido(dir, pedidoId, { devolver })` (`src/pedidos.js:255-284`): só age se `recebido_em IS NULL AND status <> 'cancelado'` (lock `FOR UPDATE`); devolve estoque na mesma transação; lança erro se já recebido/cancelado/inexistente.
- `pedidos.cancelarItemPedido(dir, pedidoId, itemIdx, { devolver })` (`src/pedidos.js:289-339`): mesma guarda (`recebido_em IS NULL`); remove o item do array `itens` (jsonb), devolve estoque só daquele item, **recalcula o total** a partir dos itens restantes (mantendo `taxa_entrega`, abatendo `desconto`); se ficar sem itens, cancela o pedido inteiro.
- **Descoberta relevante para o fluxo de reabertura**: o modal de detalhe do pedido no painel (`abrirModalPedido(p)`, `public/app.js:5402-5449`, lido) JÁ calcula `const podeModificar = !p.recebidoEm && p.status !== "cancelado"` (linha 5425) e, quando `podeModificar` é true, já renderiza um botão de cancelar por item (`ped-item-del`, linha 5437-5439) dentro da lista de itens do pedido. **Ou seja, um pedido de Retirada/Entrega "a receber" (não recebido) já abre hoje num modal que se comporta como parcialmente editável** — falta exatamente a metade "adicionar item", que não existe em lugar nenhum (nem UI nem rota).

## Limites e cotas

NÃO DOCUMENTADO.

## Erros conhecidos e tratamento

- `cancelarPedido`/`cancelarItemPedido` lançam `Error` com mensagem amigável ("Pedido não encontrado, já recebido ou já cancelado.") quando a guarda `recebido_em IS NULL AND status <> 'cancelado'` falha — a rota captura e devolve `400` com `e.message`.
- Padrão de transação idêntico em toda escrita: `BEGIN` → `FOR UPDATE` na leitura → mutação → `COMMIT`; `catch` faz `ROLLBACK` protegido (`.catch(() => {})`, comentário explica: evita `unhandledRejection` se a conexão já caiu) e relança.

## Adendo (F3) — fechamento de pedido a receber já é genérico, sem precisar de código novo

Descoberto ao planejar (rule 11 da F3), não fazia parte da ingestão original:

- `POST /api/caixa/receber/:pedidoId` (`src/servidor.js:2472-2486`) → `caixa.receberPedido(dir, pedidoId, opts)` (`src/caixa.js:138-`, lido até a validação de soma): exige caixa aberto, trava o pedido (`FOR UPDATE`), rejeita se `origem === 'mesa'` ("Pedido de mesa é recebido na aba Mesas") ou se já `recebido_em`, exige que a soma dos pagamentos bata EXATO com `total` (tolerância 0.01). Grava um `caixa_movimentos` por forma de pagamento.
- Front: `abrirPedReceber(p, callback)` (`public/app.js:5041-5139`) é um modal PRÓPRIO — "Receber pagamento" — com forma de pagamento, split, troco, já plugado dentro do MESMO fluxo de `abrirModalPedido`/lista de pedidos.
- O botão "Receber pagamento (R$ X)" que abre esse modal **já aparece automaticamente** para qualquer pedido com `status !== 'cancelado'`, `!p.recebidoEm` e `p.origem !== 'mesa'` (`public/app.js:5606-5627`) — não há nenhuma condição adicional amarrada a `tipoEntrega`.
- **Consequência direta**: um pedido do tipo "Comanda" (D-06), nascido com `origem: 'pdv'` pelo mesmo caminho de Entrega/Retirada em `/api/pdv/vender`, satisfaz essas condições automaticamente assim que existir. **Fechar/cobrar a Comanda não exige nenhuma rota nem tela nova** — é o mesmo botão e o mesmo modal que Entrega/Retirada já usam. Isso revisou D-10 (ver `00-DECISOES.md`).

## Riscos para a nossa implementação

- Qualquer rota nova de "adicionar item" precisa da MESMA guarda `recebido_em IS NULL AND status <> 'cancelado'` que as duas funções de cancelamento já usam — é o critério de "ainda editável" no sistema hoje, e a feature deveria reusá-lo, não inventar um critério novo.
- `cancelarItemPedido` recalcula o total inteiro a partir do array de itens a cada chamada (soma preço + opcionais + variações, menos desconto, mais taxa de entrega). Uma função de "adicionar item" simétrica precisaria da mesma fórmula (ou de uma função de total compartilhada, se existir — não localizada neste levantamento).
- O modal `abrirModalPedido` já é o lugar natural (por já ter `podeModificar` e já reagir a mudança de itens via `pedidoModalAtual = novoPedido`, linha 5562, após cancelar item) para acrescentar um botão "Adicionar item" ao lado do "Cancelar item" já existente — evita criar uma tela nova, alinhado com a decisão D-03 já tomada com o dono (reaproveitar a lista/modal de Pedidos).
- `numero` é sequencial **por empresa**, não por dia — não há reset diário observado no código lido (`MAX(numero)+1` sobre toda a tabela do tenant). Relevante se a F2 perguntar sobre "número reinicia todo dia" (comportamento comum em outros PDVs) — hoje não é assim.

## Fonte

`supabase/migrations/20260612115133_init_schema.sql:1-49` — lido em 2026-09-07.
`src/pedidos.js` (arquivo completo, 458 linhas) — lido em 2026-09-07.
`src/servidor.js:2374-2431` — lido em 2026-09-07.
`public/app.js:5402-5449, 5545-5562, 1841` — lido em 2026-09-07 (parcial, ver lacuna sobre o restante de `abrirModalPedido`).
