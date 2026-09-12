# Impressão — fila genérica, flag `cozinha` por item e vias por tipo de venda

> Modo INTERNO. Fonte: código lido diretamente, sem suposição.

## Contrato de entrada

- `itensDeCozinha(cardapio, itens)` (`src/servidor.js:2696-2701`, lido): filtra, dentre os itens JÁ RECALCULADOS de uma venda/rodada, só os cujo item de cardápio tem `it.cozinha === true` (varre `cardapio.categorias[].itens[]` procurando o id). Só esses entram na via da cozinha — os demais (ex.: bebida sem preparo) ficam de fora.
- `Comanda.montarCozinha(pedido, config)` (`public/comanda.js:74-104`, lido por completo): monta o texto da via de cozinha (80mm) a partir de `{ numero, criadoEm, tipoEntrega, itens, observacao }` — usa só `pedido.numero`, `pedido.criadoEm`, `pedido.tipoEntrega`, `pedido.itens` e `pedido.observacao`; **não precisa do pedido inteiro**, só desse shape mínimo. Cada item imprime `qtd + nome`, composição, variações, opcionais e observação (com `quebrar()` para largura de 80mm).
- `impressaoFila.enfileirar(dir, tipo, [via1, via2, ...])` — chamado em pelo menos 3 lugares com tipos diferentes: `"mesa-cozinha"` (rodada de mesa, `servidor.js:2990`), tipo inferido para PDV avulso em `/api/pdv/vender` (não capturado o nome literal do tipo neste levantamento — ver lacuna), `"reimpressao"` (`servidor.js:2426`).

## Contrato de saída

- Impressão é sempre **best-effort e fora da transação de gravação do pedido/rodada**: em `/api/mesas/:id/pedido`, o enfileiramento está num `try/catch` separado que só faz `console.error` em falha (linha 2992) — a resposta de sucesso ao operador (`res.json({ ok: true })`) já foi decidida antes, pela gravação em si.
- Roteamento por tipo de venda em `/api/pdv/vender` (`servidor.js:2801-2809`, lido): sempre monta a via de cozinha se houver `cozItens.length`; monta o CUPOM (`Comanda.montarCupom`) só quando `tipoEntrega !== "Retirada"` — ou seja, hoje: Balcão e Entrega imprimem cupom + cozinha (se houver item de cozinha); Retirada imprime SÓ cozinha.
- Reimpressão manual (`POST /api/pedidos/:id/reimprimir`) reconstrói a comanda inteira do zero a partir do pedido salvo (`Comanda.montarComanda`, que gera `{ cozinha, cupom }` das duas vias) — é diferente do padrão "só a rodada nova" que mesas usam para lançamentos incrementais.

## Limites e cotas

NÃO DOCUMENTADO.

## Erros conhecidos e tratamento

- Falha ao montar/enfileirar a via de cozinha nunca derruba a venda já gravada — é sempre `try { ... } catch (e) { console.error(...) }` envolvendo só a parte de impressão, depois do `COMMIT`.

- Confirmado do lado do consumidor: `agente-impressora/main/poller.js:74` usa `item.tipo` só para compor uma linha de log ("Impressao #123 (pdv) concluida.") — nenhuma lógica de roteamento por tipo (ex.: impressora diferente) foi encontrada no agente. `tipo` é rótulo do início ao fim da cadeia.

## Riscos para a nossa implementação

- Para "acréscimo depois de já impresso" (decisão D-04 já tomada com o dono: reimprimir só os itens novos, igual mesa), a implementação é **copiar exatamente o padrão de mesa**: `itensDeCozinha(cardapio, itensDaRodada)` → se houver, `Comanda.montarCozinha({ numero, criadoEm: now, tipoEntrega, itens: cozItens }, cfg)` → `impressaoFila.enfileirar(dir, "pdv", [via])` — reaproveitando o mesmo tipo `"pdv"` que `/api/pdv/vender` já usa (confirmado em `01-pdv-fluxo-atual.md`; `src/impressao-fila.js:36-43` trata `tipo` como rótulo livre, sem lógica de roteamento no servidor). Não é necessário um tipo novo.
- `Comanda.montarCozinha` só precisa de `numero`, então a via de acréscimo pode reusar o mesmo `numero` do pedido original — reforça a decisão já tomada de usar `numero` como identificador único da "sessão aberta", sem precisar marcar "2ª via" ou algo do tipo no texto (mesa também não marca; a via só lista os itens daquela rodada, sem indicar "rodada 2 de 3").
- Regra do CUPOM por tipo (`tipoEntrega !== "Retirada"`) precisa de decisão explícita se um novo tipo de venda for criado (ex.: "Balcão em aberto"): decidir se o cupom sai só no fechamento final (razoável, já que "Balcão em aberto" tende a se comportar como Balcão hoje: paga ao fechar) ou a cada rodada (mesa nunca emite cupom por rodada, só a via de cozinha) — **ponto para a F2**.

## Fonte

`src/servidor.js:2696-2701, 2801-2809, 2984-2992, 2412-2431` — lido em 2026-09-07.
`public/comanda.js:74-104` — lido em 2026-09-07.
