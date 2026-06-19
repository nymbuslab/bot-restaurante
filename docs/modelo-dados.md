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
taxa_entrega, itens (jsonb), total, observacao, criado_em (timestamptz), avisado_em
```
Colunas em snake_case no banco; `pedidos.js` mapeia para camelCase (`tipoEntrega`,
`criadoEm`, etc.) que o painel/bot esperam. `avisado_em` = timestamp do aviso
"pedido pronto" (null se não avisado). `observacao` = observação do **pedido** (informada
no checkout do cardápio web; é PII e é limpa na retenção).

**Tabela `empresas`** (Postgres/Supabase):

```text
id (uuid), user_id (uuid→auth.users), slug, nome, email, ativo, plano,
config (jsonb), cardapio (jsonb), criado_em (timestamptz)
```
A **senha não fica aqui** — vive no Supabase Auth (`auth.users`, bcrypt). `config` e
`cardapio` são os antigos `config.json`/`cardapio.json`. Colunas de billing
(`assinatura_status`, `trial_ate`, `proxima_cobranca`, `stripe_customer_id`,
`stripe_subscription_id`) — ver [assinatura-stripe.md](assinatura-stripe.md). **`plano`**
(`essencial|completo`, default essencial) é o plano comercial — gating de features por plano
(ver [planos-e-frete.md](planos-e-frete.md)).

**Frete (em `config.frete` jsonb):** `modo` (`fixo|raio`), `taxaFixa` (R$), e — no modo raio —
`raio: { coordEmpresa{lat,lon}, enderecoBase, faixas:[{ini,fim,valor}], foraDaArea }`. Compat: se
só houver `config.atendimento.taxaEntrega`, vale como frete fixo (normalizado por `frete.freteDeConfig`).

**Tabela `geo_cache`** (cache de geocodificação Geoapify): `endereco_norm` (PK), `lat`, `lon`,
`criado_em` — cache-first, igual à `ceps` (ViaCEP). Evita rechamar a Geoapify pro mesmo endereço.

**Linha do carrinho / pedido**:
```js
{ id, nome, preco, qtd, opcionais: [{nome, preco, qtd}], observacao }
```
Preço da linha = `(preco + soma de (opcional.preco × opcional.qtd)) * qtd`. O opcional tem
quantidade (ex.: 2 ovos) — escolhida no cardápio web.

## Bot (fluxo.js) — enxuto, baseado em link

O pedido **não é mais montado no chat** — vai para o cardápio web. Estados: **MENU** e **ATENDENTE**.

- Loja **aberta**: qualquer mensagem recebe boas-vindas + o **link** `PUBLIC_URL/c/:slug?p=<token>`
  (token HMAC assinado liga o pedido ao `chatId`, para a confirmação automática).
- **ATENDENTE**: digitar "atendente"/"humano" silencia o bot (humano conduz); "menu" reativa.
- Loja **fechada**: responde a mensagem de "fechado" com o horário; não envia o link.
- Chave de sessão: `{slug}:{chatId}` — isola clientes entre tenants.
- Todas as funções de `fluxo.js` recebem `tenantDir` como parâmetro explícito.

## Cardápio web (canal de pedido)

- `GET /api/c/:slug` (público, rate-limited): **projeção whitelist** do cardápio (só itens
  disponíveis e campos públicos) + restaurante/aberto/pagamentos/taxa. Nunca o jsonb cru.
- `POST /api/c/:slug/pedido` (público): valida, **recalcula** itens/total a partir do cardápio
  (fonte de verdade — ignora preço/nome do cliente; opcional desconhecido é descartado; item
  indisponível rejeita), salva via `salvarPedido` e dispara a confirmação pelo bot (`token` →
  `chatId`, com fallback no telefone). Helpers puros em `src/cardapio-web.js` (`projetarCardapio`,
  `recalcularItens`, `assinarToken`/`verificarToken`).
- Página vanilla `public/cardapio.{html,js,css}` (CSP-safe, reusa `dinheiro.js`/`endereco-cep.js`).
