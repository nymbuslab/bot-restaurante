# Catálogo e identidade

## Contrato de entrada

- `PUT /api/cardapio` recebe o cardápio inteiro autenticado, valida e normaliza no servidor antes de
  persistir. Fonte: `../../../src/servidor.js:2035-2088`.
- Produto novo recebe ID numérico gerado no cliente; variação recebe ID textual aleatório e estável
  dentro do produto. Fontes: `../../../public/app.js:2461-2465` e
  `../../../public/app.js:2651-2655`.
- Campos atuais relevantes do produto incluem nome, preço, custo manual opcional, unidade, cozinha,
  disponibilidade, grupos, variações, saldo e mínimo. Fonte: `../../../public/app.js:2532-2679`.

## Contrato de saída

- `GET /api/cardapio` devolve o JSONB autenticado do tenant. Fonte:
  `../../../src/servidor.js:2026-2032`.
- O mapa usado nas vendas considera itens disponíveis e preserva o objeto do catálogo. Fonte:
  `../../../src/store.js:277-285`.

## Limites e cotas

- Produto por peso usa `kg`; os demais caem em `un`. Fonte:
  `../../../src/servidor.js:2044-2053`.
- Produto com variações perde saldo próprio e controla cada variação separadamente. Fonte:
  `../../../src/servidor.js:2054-2060`.
- Limite máximo de itens, variações, GTINs ou vínculos por fornecedor: **NÃO DOCUMENTADO**.

## Erros conhecidos e tratamento

- O salvamento integral poderia sobrescrever saldo alterado por venda concorrente; `setCardapio`
  trava a empresa, relê o JSONB fresco e preserva os saldos não editados. Fonte:
  `../../../src/store.js:56-89`.
- O editor recarrega o catálogo antes de editar um produto existente para não exibir saldo antigo ou
  abrir outro item por índice stale. Fonte: `../../../public/app.js:2466-2516`.

## Riscos

- IDs não são chaves relacionais globais; itens de compra não poderão depender somente de nome nem
  ter FK direta para o JSONB.
- `precoCusto` atual é manual no produto e não possui histórico ou vínculo com compras. Fonte:
  `../../../public/app.js:2535-2555`.
- Uma troca futura do ID no catálogo pode deixar vínculos externos órfãos se não houver validação e
  política explícita de arquivamento.

## Fonte

- `../../../src/servidor.js:2026-2088`
- `../../../src/store.js:56-117`
- `../../../public/app.js:2461-2690`
- `../../../supabase/migrations/20260612115133_init_schema.sql:13-20`
