# Vendas e cancelamentos

## Contrato de entrada

- A venda grava os itens recalculados pelo servidor; o pedido recebe um snapshot JSONB dos itens.
  Fonte: `../../../src/pedidos.js:56-95`.
- PDV pago baixa estoque, cria pedido e movimentos de caixa na mesma transação. Fonte:
  `../../../src/caixa.js:217-289`.
- Pedidos web, comanda e mesa também chamam `baixarEstoqueTx`; os movimentos são amarrados ao pedido
  por seus IDs. Fontes: `../../../src/store.js:92-117` e
  `../../../src/store.js:255-267`.

## Contrato de saída

- Cancelamento de pedido ou item não recebido devolve estoque antes de marcar ou regravar o pedido,
  na mesma transação. Fonte: `../../../src/pedidos.js:251-337`.
- Cancelamento pago deduz o caixa, devolve estoque e marca o pedido cancelado na mesma transação.
  Fonte: `../../../src/caixa.js:362-449`.
- Cancelamentos de mesa devolvem cada pedido separadamente para preservar o vínculo da trilha. Fonte:
  `../../../src/mesas-db.js:335-405`.

## Limites e cotas

- Quantidade de itens por pedido: **NÃO DOCUMENTADO**.
- Pedido recebido só pode ser cancelado com reflexo financeiro se o recebimento estiver no caixa
  aberto. Fonte: `../../../src/caixa.js:369-397`.
- Cancelamento parcial de item de mesa é recusado se o total restante ficar abaixo do já recebido.
  Fonte: `../../../src/mesas-db.js:623-641`.

## Erros conhecidos e tratamento

- O contrato atual interpreta `devolver` ausente como verdadeiro; o cliente pode enviar falso.
  Fonte: `../../../src/servidor.js:2374-2408`.
- Falhas dentro dos fluxos transacionais executam rollback protegido para não mascarar o erro
  original. Fontes: `../../../src/pedidos.js:275-282` e `../../../src/caixa.js:442-449`.

## Riscos

- A decisão aprovada exige destino explícito por cancelamento, enquanto a API atual devolve por
  padrão; o contrato precisa mudar sem quebrar clientes ativos.
- A devolução futura por ficha deve usar o snapshot da venda, nunca a ficha vigente.
- Cancelar com “perda operacional” deverá registrar movimento próprio sem repor saldo e sem afetar
  a consistência financeira da transação.

## Fonte

- `../../../src/pedidos.js:56-95`
- `../../../src/pedidos.js:251-337`
- `../../../src/caixa.js:217-289`
- `../../../src/caixa.js:362-449`
- `../../../src/mesas-db.js:335-405`
- `../../../src/mesas-db.js:593-674`
