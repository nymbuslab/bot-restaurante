# Comanda avulsa criada no PDV

## Contrato de entrada

O front envia `POST /api/pdv/vender` com `itens` não vazio, `tipoEntrega: "Comanda"`, identificação opcional em `cliente`, desconto e demais campos do PDV. A identificação é aparada e limitada a 120 caracteres no servidor (`public/app.js:6983-7013`; `src/servidor.js:3228-3260`).

## Contrato de saída

Em sucesso, a rota devolve `{ ok: true, pedido }`. A Comanda nasce como uma linha em `pedidos`, com `origem: "pdv"`, `tipo_entrega: "Comanda"`, `recebido_em` nulo, `mesa_id` nulo, itens e total recalculados pelo servidor. O front limpa o carrinho e informa que o pedido ficou a receber em Pedidos (`src/servidor.js:3277-3342`; `public/app.js:7013-7031`).

## Limites e cotas

- A venda precisa ter ao menos 1 item (`src/servidor.js:3232`).
- A identificação tem teto de 120 caracteres (`src/servidor.js:3255`).
- A observação tem teto de 200 caracteres (`src/servidor.js:3274`).
- Não há limite documentado de tempo aberta, itens ou rodadas; as decisões D-09 e D-11 da feature anterior rejeitaram esses tetos (`docs/sprintx/features/pdv-balcao-em-aberto/00-DECISOES.md`).

## Erros conhecidos e tratamento

Venda vazia retorna 400; escolha inválida retorna 400; estoque insuficiente retorna 409; falhas de validação retornam 400 com mensagem. A baixa de estoque e o pedido ficam na mesma transação. Impressão é best-effort e não desfaz pedido já gravado (`src/servidor.js:3232-3344`).

## Riscos para a nossa implementação

A Comanda não é uma linha da tabela `mesas`. Tratar seu `pedido.id` como `mesa.id` faria o drawer chamar rotas erradas. A navegação pós-abertura atualmente encerra no PDV e não seleciona nenhum acompanhamento operacional.

## Fonte

`public/app.js:6983-7031`, `src/servidor.js:3228-3344`, `docs/sprintx/features/pdv-balcao-em-aberto/00-DECISOES.md` — acessado em 2026-11-11
