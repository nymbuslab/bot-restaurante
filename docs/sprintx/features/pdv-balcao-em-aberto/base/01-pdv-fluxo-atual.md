# Fluxo atual do PDV — grade, carrinho e "Cobrar"

> Modo INTERNO. Fonte: código lido diretamente, sem suposição.

## Contrato de entrada

- Tela PDV (`public/app.js`): usuário monta `pdvCart` (array de linhas: `id`, `qtd`, `composicao`, `opcionais`, `grupos`, `variacoes`, `observacao`) clicando na grade de produtos.
- Botão `#pdvCobrar` (`public/app.js:6832`): `if (mesaModoId) mesaLancarDoPdv(); else abrirPdvPagar();` — o mesmo botão bifurca para o fluxo de mesa OU o overlay de pagamento do PDV avulso, conforme o operador estar ou não em "modo mesa".
- `abrirPdvPagar()` (`public/app.js:6438-6447`): reseta `pdvPagamentos=[]`, `pdvTipoEntrega="Balcão"` (default), `pdvEntrega=null`, chama `renderPdvPagar()` e abre o overlay `#pdvPagarOverlay`.
- `renderPdvPagar()` (`public/app.js:6451-6553`): monta o modal único de cobrança. Bloco "Tipo de venda" com 3 botões `data-tve` — `["Balcão", "Entrega", "Retirada"]` (linha 6472). Ao clicar em um `data-tve`, re-renderiza o modal (linha 6511-6515). Só quando `pdvTipoEntrega === "Balcão"` (`ehBalcao`, linha 6455) aparece o bloco de forma de pagamento; para Entrega/Retirada aparece a nota "Sem cobrança agora... vai para a aba Pedidos como a receber" (linha 6487) e o botão final vira "Enviar para Pedidos" em vez de "Confirmar pagamento" (linha 6506).
- Confirmação chama `finalizarVendaPdv()` (`public/app.js:6761-6789`, lido por completo) → `POST /api/pdv/vender` com o corpo exato:
  ```js
  {
    cliente, // texto livre, trim
    itens: pdvCart.map(l => ({ id, qtd, composicao, opcionais: [{nome,qtd}], grupos, variacoes: [{id,qtd}], observacao })),
    desconto: pdvDesconto,
    pagamentos: registrados, // só preenchido se Balcão (montarPagamentosRegistrados)
    observacao, // só Balcão: "CPF na nota: ..." se informado
    tipoEntrega, // "Balcão" | "Entrega" | "Retirada"
    endereco, enderecoCampos, // só Entrega
    telefone, // Retirada (campo do bloco) ou Entrega (overlay)
    taxaEntrega: pdvFreteValor(),
  }
  ```

## Contrato de saída

- `POST /api/pdv/vender` (`src/servidor.js:2703-2818`, handler completo lido):
  1. Recalcula itens/subtotal no servidor (`pdv.recalcularVenda`, nunca confia no preço do cliente) e valida estoque (`estoque.validarEstoque`) — `409` se faltar estoque.
  2. Normaliza `tipoEntrega` para um dos três valores fixos; default `"Balcão"` se não vier `"Entrega"`/`"Retirada"` (linha 2730).
  3. **Balcão**: `caixa.venderLocal(...)` — pedido nasce **recebido** (paga na hora), gera movimento de caixa, exige caixa aberto (gate `exigeCaixa`/`exigePdv` upstream).
  4. **Entrega/Retirada**: transação própria — `store.baixarEstoqueTx` → `pedidos.salvarPedido(..., { origem: "pdv" })` → `store.amarrarPedidoTx`. Pedido nasce com `status: "novo"` e `recebido_em: null` (não mexe no caixa).
  5. Impressão (fora da transação, best-effort, linhas 2804-2811): via de cozinha só se houver `cozItens.length`; cupom (`Comanda.montarCupom`) só quando `tipoEntrega !== "Retirada"`; enfileira com `impressaoFila.enfileirar(dir, "pdv", vias)` — **o "tipo" da fila para PDV é literalmente a string `"pdv"`** (mesmo tipo para Balcão/Entrega/Retirada; não distingue por tipo de venda).
  6. Resposta: `res.json({ ok: true, pedido })` (linha 2813).
- Front pós-venda (`finalizarVendaPdv`, `public/app.js:6790-6810`): toast de sucesso ("Venda registrada..." ou "Pedido enviado..."), limpa `pdvCart`/`pdvDesconto`/`pdvPagamentos`, reseta `pdvTipoEntrega = "Balcão"`, fecha o overlay, recarrega o cardápio (para refletir baixa de estoque) e re-renderiza a grade.

## Limites e cotas

NÃO DOCUMENTADO (nenhum limite de tamanho de carrinho, nº de itens ou rate limit específico do PDV encontrado no trecho lido).

## Erros conhecidos e tratamento

- `400` — venda vazia (`!Array.isArray(b.itens) || !b.itens.length`), endereço de entrega curto (`< 4` caracteres), item "só local" pedido para Entrega, frete incompleto (falta CEP/número), forma de pagamento inválida.
- `409` — estoque insuficiente (`estCheck.ok === false`) ou erro `ESTOQUE` lançado dentro da transação de Entrega/Retirada.
- `500` — implícito (não tratado explicitamente no trecho lido além do try/catch externo da rota, que devolve `400` para praticamente tudo — mensagem "Falha ao..." genérica não confirmada linha a linha para este endpoint específico).

## Riscos para a nossa implementação

- O botão `#pdvCobrar` já bifurca por `mesaModoId`. Se a feature "Balcão em aberto" for implementada como um 3º modo (além de venda direta e modo-mesa), esse mesmo ponto de decisão (`app.js:6832`) provavelmente precisa de um terceiro ramo — ou o tipo de venda "Balcão em aberto" reaproveita o caminho de Entrega/Retirada (pedido nasce "a receber", sem caixa) e a diferença fica só em permitir reabertura depois.
- `pdvTipoEntrega` é uma variável global de estado do módulo (`"Balcão" | "Entrega" | "Retirada"`), não um enum validado num só lugar — introduzir um 4º valor nesse array (linha 6472) tem efeito imediato na tela, mas qualquer lugar que faça `pdvTipoEntrega === "Balcão"` como proxy de "paga agora" (ex.: linha 6455 `ehBalcao`) precisa ser revisto para não tratar o novo tipo como pagamento imediato por engano.
- `finalizarVendaPdv()` não foi lido por completo — o corpo exato enviado ao POST precisa ser confirmado antes de decidir se o novo tipo de venda cabe no mesmo payload ou exige campo novo.

## Fonte

`public/app.js:6438-6553`, `public/app.js:6790-6832` — lido em 2026-09-07.
`src/servidor.js:2694-2820` — lido em 2026-09-07.
