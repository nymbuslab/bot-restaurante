# Modelo de dados e máquina de estados

## Modelo de dados

**Item do cardápio** (dentro do `cardapio` jsonb da `empresas`):
```json
{ "id": 10, "nome": "Marmitex P", "preco": 18.0, "desc": "...",
  "disponivel": true,
  "composicao": "Principal:\n* Arroz\n* Feijão",
  "opcionais": "Ovo frito | 2.00\nBacon | 3.50" }
```
`composicao` e `opcionais` são texto parseado em runtime.

**Tabela `pedidos`** (Postgres/Supabase, uma só, isolada por `empresa_id`):

```text
id (bigint), empresa_id (uuid→empresas), numero (sequencial por empresa),
status, cliente, telefone, chat_id, tipo_entrega, endereco, pagamento,
taxa_entrega, itens (jsonb), total, criado_em (timestamptz), avisado_em
```
Colunas em snake_case no banco; `pedidos.js` mapeia para camelCase (`tipoEntrega`,
`criadoEm`, etc.) que o painel/bot esperam. `avisado_em` = timestamp do aviso
"pedido pronto" (null se não avisado).

**Tabela `empresas`** (Postgres/Supabase):

```text
id (uuid), user_id (uuid→auth.users), slug, nome, email, ativo,
config (jsonb), cardapio (jsonb), criado_em (timestamptz)
```
A **senha não fica aqui** — vive no Supabase Auth (`auth.users`, bcrypt). `config` e
`cardapio` são os antigos `config.json`/`cardapio.json`. Colunas de billing
(`assinatura_status`, `trial_ate`, `proxima_cobranca`, `stripe_customer_id`,
`stripe_subscription_id`) — ver [assinatura-stripe.md](assinatura-stripe.md).

**Linha do carrinho / pedido**:
```js
{ id, nome, preco, qtd, opcionais: [{nome, preco}], observacao }
```
Preço da linha = `(preco + soma dos opcionais) * qtd`.

## Máquina de estados (fluxo.js)

Item: `PEDINDO → (OPCIONAIS se houver) → OBSERVACAO → QUANTIDADE → REVISAO`

Finalização: `REVISAO(finalizar) → PERGUNTA_BEBIDA → (BEBIDAS/BEBIDA_QTD) →
FIN_NOME → FIN_ENTREGA → [FIN_ENDERECO] → FIN_PAGAMENTO → CONFIRMACAO`

- Antes de listar itens, o cliente escolhe a **categoria** (estado `CATEGORIA`).
- A pergunta "deseja bebida?" aparece automaticamente se existir categoria com
  "bebida" no nome E o cliente ainda não adicionou bebidas.
- Saudações ("oi", "menu", etc.) sempre voltam ao menu. "cancelar"/"sair" zera a sessão.
- Chave de sessão: `{slug}:{chatId}` — isola clientes entre tenants.
- Todas as funções de `fluxo.js` recebem `tenantDir` como parâmetro explícito.
