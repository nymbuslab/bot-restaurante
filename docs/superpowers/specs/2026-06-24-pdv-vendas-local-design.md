# PDV — Vendas no local (Plano Completo) — Design

> Status: aprovado (brainstorming 2026-06-24). Abordagem A (endpoint único atômico + módulo puro).

## Objetivo

Permitir que o restaurante registre **vendas de balcão** direto no painel: o operador monta
o pedido a partir do cardápio, cobra na hora e a venda **já entra recebida no caixa** + dá
**baixa no estoque** + vira um **pedido** (tipo "Balcão"). Recurso do **Plano Completo**.

## Decisões (do brainstorming)

- **Pagamento/Caixa:** venda **sempre paga na hora** → **exige caixa aberto**. Ao finalizar,
  entra recebida no caixa + baixa estoque. Sem caixa aberto, o PDV pede para abrir.
- **Carrinho:** itens do cardápio com **opcionais**, **observação por item**, itens **"só no
  local"** e **por kg** (peso digitado). **Sem item avulso** (tudo vem do cardápio).
- **Cliente:** opcional, padrão **"Balcão"**; sem telefone/endereço.
- **Pagamento:** **troco** (dinheiro), **desconto** (R$ ou %), **imprimir ao finalizar**,
  **pagamento dividido** (split em várias formas).
- **Local:** **aba dedicada "PDV"**; Caixa segue separado.
- **Dispositivo:** ambos, **otimizado para toque**.

## Modelo de dados / integração

- A venda vira um `pedido` (via inserção transacional):
  - `tipoEntrega: "Balcão"` (novo valor, ao lado de Entrega/Retirada).
  - `cliente`: nome digitado ou `"Balcão"`; `telefone`/`endereco` vazios; `taxaEntrega: 0`.
  - `itens: [{ id, nome, preco, qtd, opcionais:[{nome,preco,qtd}], observacao }]` — `qtd` pode
    ser **decimal** (kg).
  - `recebido_em`: `now()` (nasce recebida → não bloqueia o fechamento do caixa).
  - `pagamento`: resumo legível (ex.: `"Dinheiro R$ 30,00 · Cartão R$ 15,00"`).
  - `total`: **líquido** (subtotal − desconto).
- **Migração:** nova coluna `pedidos.desconto numeric(10,2) default 0`.
- **Caixa:** na mesma transação, **1 `caixa_movimentos` (recebimento) por forma** de pagamento
  (forma, valor, `pedido_id`). Split cai no "Vendas por forma" sem mudar `caixa-calc`. Troco é
  só cálculo de tela.
- **Estoque:** `validarEstoque` antes; `aplicarBaixa` + `store.setCardapio` após o commit
  (best-effort, igual ao cardápio web).
- **Cardápio:** fonte dos produtos = `store.getCardapio` (inclui só-local e kg). Preço/opcionais
  **recalculados no servidor** (nunca confia no cliente).

## Backend (Abordagem A)

- `src/pdv.js` (**PURO**, testável — `test/pdv.test.js`):
  - `recalcularVenda(cardapio, itensPayload)` → `{ itens, subtotal }` (suporta **kg** e opcionais;
    aceita itens só-local; rejeita item indisponível/esgotado).
  - `aplicarDesconto(subtotal, desconto)` → `{ desconto, total }` (`desconto` = `{tipo:'valor'|'pct', valor}`),
    clampa em `[0, subtotal]`.
  - `validarPagamentos(total, pagamentos)` → erro se soma ≠ total (tolerância de centavos) ou forma vazia.
  - `calcularTroco(recebidoDinheiro, totalDinheiro)` → troco ≥ 0.
  - `resumoPagamento(pagamentos)` → string legível.
- `src/empresas.js`: `temPdv(emp) = acessoLiberado(emp) && planoDe(emp) === "completo"`.
- `src/servidor.js`: `exigePdv(req,res)` (403 fora do Completo) + `POST /api/pdv/vender`
  (`exigeAuth` + `exigePdv`): valida payload → `pdv.recalcularVenda` → `aplicarDesconto` →
  `validarPagamentos` → `caixa.venderLocal(...)` → `estoque.aplicarBaixa` (best-effort) →
  devolve o pedido salvo (para impressão).
- `src/caixa.js`: `venderLocal(dir, { cliente, itens, total, desconto, pagamentos, pagamentoResumo })`
  → transação: garante **caixa aberto** (senão `erro 409`), insere o pedido (Balcão, recebido),
  insere N movimentos, COMMIT, retorna o pedido.

## Tela do PDV (front)

- Nova aba **"PDV"** no menu lateral (entre Pedidos e Caixa). **Gate**: fora do Completo → cadeado
  → `abrirUpsell("pdv")`.
- **Sem caixa aberto** → banner "Abra o caixa para começar a vender" + botão para a aba Caixa.
- **Layout (toque):** grade de produtos à esquerda (chips de categoria + busca, reusa
  `busca.js`), **carrinho** à direita no desktop / **folha** no mobile.
  - Tap no item: se tem opcionais/observação ou é **kg** → mini-modal (opcionais, peso, observação,
    qtd); senão adiciona direto.
  - Carrinho: linhas com qtd ±, remover, observação; **desconto**; **total**; botão **Cobrar**.
- **Pagamento (Cobrar):** total, desconto (R$/%), formas (chips de `config.pagamentos`) com **split**
  (adiciona forma+valor, restante automático), **troco** no dinheiro, **Finalizar venda**.
  - Finalizar → `POST /api/pdv/vender` → sucesso → **imprime** (se `config.impressao` configurado,
    via `window.Impressao`) → limpa o carrinho → pronto pra próxima.
- A venda aparece na aba **Pedidos** como "Balcão" / Recebido e entra no **Caixa** (Vendas por forma).

## Plano Completo / landing / docs

- Gate `temPdv` (front + back, 403).
- `UPSELL_FEATURES.pdv` (card de assinatura/upsell do Completo) + cadeado na aba.
- Landing (`public/index.html`): card de feature + bullet no Plano Completo.
- Checkout (`public/checkout.html`): incluir na descrição do Completo.
- Docs: `CLAUDE.md` (árvore + planos), `docs/modelo-dados.md` (tipo Balcão, coluna desconto),
  `docs/planos-e-frete.md` (gating `temPdv` + PDV). `PROGRESSO.md`/`CHANGELOG.md` ao concluir.

## Testes / validação

- `test/pdv.test.js` (puro): recalcular (un/kg/opcionais), desconto (R$/%/clamp), validar split,
  troco, resumo.
- `npm run check` + `npm test`.
- Playwright (servidor local só-Express + mock/sessão): aba gated, banner sem caixa, montar venda
  (un/kg/opcionais), desconto, split, finalizar → pedido Balcão recebido + movimentos no caixa
  + baixa de estoque. Mobile + desktop.

## Fora de escopo (v1)

- Item avulso (fora do cardápio); mesa/comanda aberta (fiado); venda sem caixa; relatório próprio
  de PDV (as vendas já entram no caixa e em Pedidos).
