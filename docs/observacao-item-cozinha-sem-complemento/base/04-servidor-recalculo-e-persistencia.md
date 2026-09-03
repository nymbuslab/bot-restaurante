# Servidor — recálculo e persistência de `observacao` por item (já pronto nos 3 canais)

## Contrato de entrada

Os três caminhos de venda recalculam os itens no servidor a partir do payload do cliente (nunca confiam em preço/observação bruta sem revalidar tipo):

- Cardápio web: `recalcularItens(cardapio, itensPayload)` — `src/cardapio-web.js:61-106`, usado por `POST /api/c/:slug/pedido`.
- PDV: função equivalente em `src/pdv.js:76-79` (mesmo padrão, não lida em detalhe nesta ingestão — comentário do próprio código aponta paridade entre os dois).
- Mesas: `lancarItens(dir, mesaId, { itens, total, cliente, observacao }, client)` — `src/mesas-db.js:533-582` grava o jsonb `itens` (que já contém a `observacao` por linha, resolvida antes de chegar aqui) direto na coluna `pedidos.itens`.

Em todos os três, cada item do payload aceita um campo `observacao` de texto livre.

## Contrato de saída

`src/cardapio-web.js:100`: `observacao: String((p && p.observacao) || "").slice(0, 200)` — preservada por item, cortada em 200 caracteres, **independente de o item ter ou não grupos/variações resolvidos**. Mesmo padrão em `src/pdv.js:78`.

## Limites e cotas

200 caracteres por observação de item (`slice(0, 200)`), consistente com o `maxlength="200"` dos dois textareas de frontend (cardápio web e PDV).

## Erros conhecidos e tratamento

`recalcularItens` lança `Error` para item inexistente/indisponível, escolha de composição inválida ou variação inválida (`src/cardapio-web.js:79,87,92`) — decisão já registrada em `PROGRESSO.md` (409 na rota do cardápio web). Não há erro específico relacionado a `observacao` — o campo nunca é rejeitado, só truncado.

## Riscos para a nossa implementação

- **Nenhuma mudança de backend é necessária.** Os três consumidores já aceitam, validam (truncam) e persistem `observacao` por item, com ou sem grupos configurados. O gap inteiro desta feature é client-side (frontend do PDV/Mesas não oferece a UI para preencher o campo em certos itens — ver `03-pdv-mesas-tile-click.md`).

## Fonte

`src/cardapio-web.js:61-106`, `src/pdv.js:76-79`, `src/mesas-db.js:533-582` — acessado em 2026-09-03
