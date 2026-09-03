# Índice da base de conhecimento

- `01-flag-item-cozinha.md` — modelo de dados do campo `item.cozinha`: onde é gravado/editado no painel, e que **não** chega na projeção pública do cardápio web.
- `02-cardapio-web-modal-observacao.md` — achado central: o cardápio web (`/c/:slug`) **já** abre modal com campo de observação para todo item disponível vendido por unidade, com ou sem complementos. Não há gap aí.
- `03-pdv-mesas-tile-click.md` — achado central: PDV e Mesas (mesma grade/handlers) **pulam** o modal e empilham o item direto no carrinho, sem observação, quando o item não tem grupo/variação/kg. Este é o gap real da feature.
- `04-servidor-recalculo-e-persistencia.md` — os três backends de venda (cardápio web, PDV, mesas) já aceitam, truncam (200 car.) e persistem `observacao` por item, independente de grupos. Nenhuma mudança de servidor necessária.
- `05-impressao-comanda-cozinha.md` — a via da cozinha (`Comanda.montarCozinha`) já imprime `Obs: ...` por item quando preenchido; o cupom do cliente não imprime observação por item (comportamento já diferenciado, não é bug). Nenhuma mudança em `comanda.js` necessária.
- `06-padrao-de-teste-frontend.md` — como o projeto já testa trechos de `public/app.js` isolados com `node:test` + `vm`, sem Playwright, usando `test/caixa-reimpressao-front.test.js` como precedente direto.

## Leitura recomendada da F2

O escopo real desta feature é muito menor do que a descrição inicial sugere: cardápio web e todo o backend já fazem o que foi pedido. O trabalho concreto é mudar a condição de abertura do modal em `pdvTileClick` (`public/app.js:6047`) — e, a depender da resposta do dono, em `pdvVariacaoClick` (`public/app.js:6008`) — para também abrir quando `item.cozinha === true`, reaproveitando o modal já pronto (`abrirPdvItemModal`, que já lida bem com item sem grupo/variação nenhum).
