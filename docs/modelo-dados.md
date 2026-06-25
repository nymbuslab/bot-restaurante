# Modelo de dados e máquina de estados

## Modelo de dados

**Item do cardápio** (dentro do `cardapio` jsonb da `empresas`):
```jsonc
{ "id": 10, "nome": "Marmitex P", "preco": 18.0, "desc": "...",
  "disponivel": true,
  // composicao = subgrupos SELECIONÁVEIS pelo cliente (array estruturado)
  "composicao": [
    { "nome": "Proteínas", "obrigatorio": true, "min": 1, "max": 1, "itens": ["Frango", "Carne"] }
  ],
  // opcionais permanece TEXTO `Nome | preço` (acréscimos pagos) — inalterado
  "opcionais": "Ovo frito | 2.00\nBacon | 3.50" }
```
`composicao` é um **array de subgrupos** `[{ nome, obrigatorio, min, max, itens:[string] }]`
que o cliente seleciona ao montar o pedido. Regras:

- `max = 1` → **escolha única** (radio); `max > 1` → **múltipla** (checkbox, trava no máximo);
- `obrigatorio: true` ⇒ exige `min ≥ 1` (ao menos uma escolha no subgrupo);
- a **composição é grátis** — escolher itens **não soma preço** ao item;
- helpers puros em `public/grupos.js` (`normalizarGrupos`, `avaliarComposicao`); o **servidor valida**
  por aqui (cardápio web + PDV), descartando itens fora do subgrupo e aplicando mín/máx/obrigatório.

`opcionais` segue como **texto** `Nome | preço` (um por linha), parseado em runtime — são os
acréscimos **pagos** (steppers) e é o que soma no preço da linha. **Sem migração de schema**: ambos
moram no mesmo `cardapio` jsonb.

**Tabela `pedidos`** (Postgres/Supabase, uma só, isolada por `empresa_id`):

```text
id (bigint), empresa_id (uuid→empresas), numero (sequencial por empresa; índice
único parcial `pedidos_empresa_numero_unico` em (empresa_id, numero) — rede de
segurança contra duplicata sob corrida, além do lock FOR UPDATE em runtime),
status, cliente, telefone, chat_id, tipo_entrega, endereco, pagamento,
taxa_entrega, itens (jsonb), total, observacao, criado_em (timestamptz),
avisado_em, recebido_em (timestamptz; null = a receber — usado pelo Caixa),
desconto (numeric; abatido na venda — usado pelo PDV; web fica 0)
```
`tipo_entrega` = `Entrega` | `Retirada` | **`Balcão`** (venda do PDV — nasce já
`recebido_em`, sem telefone/endereço). No PDV o `total` é o líquido (subtotal − `desconto`).
Colunas em snake_case no banco; `pedidos.js` mapeia para camelCase (`tipoEntrega`,
`criadoEm`, etc.) que o painel/bot esperam. `avisado_em` = timestamp do aviso
"pedido pronto" (null se não avisado). `observacao` = observação do **pedido** (informada
no checkout do cardápio web; é PII e é limpa na retenção).

**Tabela `empresas`** (Postgres/Supabase):

```text
id (uuid), user_id (uuid→auth.users), slug, nome, email, ativo, plano,
config (jsonb), cardapio (jsonb), criado_em (timestamptz),
termos_aceitos_em (timestamptz), termos_versao (text)
```
A **senha não fica aqui** — vive no Supabase Auth (`auth.users`, bcrypt). `config` e
`cardapio` são os antigos `config.json`/`cardapio.json`. Colunas de billing
(`assinatura_status`, `trial_ate`, `proxima_cobranca`, `stripe_customer_id`,
`stripe_subscription_id`) — ver [assinatura-stripe.md](assinatura-stripe.md). **`plano`**
(`essencial|completo`, default essencial) é o plano comercial — gating de features por plano
(ver [planos-e-frete.md](planos-e-frete.md)). **`termos_aceitos_em`/`termos_versao`** registram o
aceite de Termos/Privacidade no cadastro (prova de consentimento — ver [lgpd/](lgpd/README.md)).

**Tabela `auditoria`** (trilha LGPD Art. 37): `id (bigserial), evento (text), slug (text),
detalhe (jsonb), criado_em (timestamptz)`. Registra eventos sensíveis (`conta_criada`,
`dados_exportados`, `conta_excluida`); o `slug` é **texto sem FK** → o registro **sobrevive à
exclusão** da conta. Sem PII no `detalhe`. Escrita best-effort em `src/auditoria.js`.

**Frete (em `config.frete` jsonb):** `modo` (`fixo|raio`), `taxaFixa` (R$), e — no modo raio —
`raio: { coordEmpresa{lat,lon}, enderecoBase, faixas:[{ini,fim,valor}], foraDaArea }`. Compat: se
só houver `config.atendimento.taxaEntrega`, vale como frete fixo (normalizado por `frete.freteDeConfig`).

**Tabela `geo_cache`** (cache de geocodificação Geoapify): `endereco_norm` (PK), `lat`, `lon`,
`criado_em` — cache-first, igual à `ceps` (ViaCEP). Evita rechamar a Geoapify pro mesmo endereço.

**Linha do carrinho / pedido**:
```js
{ id, nome, preco, qtd, opcionais: [{nome, preco, qtd}],
  composicao: [{ grupo, itens:[nome] }], observacao }
```
Preço da linha = `(preco + soma de (opcional.preco × opcional.qtd)) * qtd`. O opcional tem
quantidade (ex.: 2 ovos) — escolhida no cardápio web. **A composição não entra no preço** (é grátis):
`composicao` guarda apenas as escolhas do cliente por subgrupo (`{ grupo, itens:[nome] }`), validadas
no servidor por `public/grupos.js` (`avaliarComposicao`). A comanda da cozinha lista essas escolhas
agrupadas por subgrupo.

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
  O objeto `restaurante` traz `nome/telefone/endereco/horario` + **`logo`/`capa`** (identidade
  visual — URLs de imagens no Storage, definidas no painel em Configurações → Empresa); o header
  do cardápio mostra a **capa full-width** no topo + **logo circular** centralizada (fallback:
  gradiente da marca + inicial quando faltam).
- `POST /api/c/:slug/pedido` (público): valida, **recalcula** itens/total a partir do cardápio
  (fonte de verdade — ignora preço/nome do cliente; opcional desconhecido é descartado; item
  indisponível rejeita), salva via `salvarPedido` e dispara a confirmação pelo bot (`token` →
  `chatId`, com fallback no telefone). Helpers puros em `src/cardapio-web.js` (`projetarCardapio`,
  `recalcularItens`, `assinarToken`/`verificarToken`).
- Página vanilla `public/cardapio.{html,js,css}` (CSP-safe, reusa `dinheiro.js`/`endereco-cep.js`).

## PDV — vendas no local (Plano Completo)

- `POST /api/pdv/vender` (`exigeAuth` + `exigePdv`): registra uma **venda de balcão**. Fluxo
  atômico — **recalcula** a venda pelo cardápio (`src/pdv.js`: `recalcularVenda` com kg+opcionais),
  aplica desconto (`aplicarDesconto`), valida o split (`validarPagamentos`) e chama
  `caixa.venderLocal` (transação: **baixa de estoque ATÔMICA** `store.baixarEstoqueTx` — trava o
  tenant com `FOR UPDATE`, revalida e decrementa; falta de estoque desfaz a venda — + insere `pedidos`
  já `recebido_em` + **1 `caixa_movimentos` por forma** de pagamento, tudo num só commit). Exige
  **caixa aberto e não vencido** (senão erro). Devolve o pedido (p/ impressão).
- Helpers PUROS em `src/pdv.js` (testados em `test/pdv.test.js`); tela em `public/app.js`
  (`carregarPdv`/`renderPdv*`), aba **PDV** no painel. Gate `temPdv` (front + back).

## Caixa do dia (Plano Completo)

**Tabela `caixas`** (isolada por `empresa_id`):

```text
id (bigint), empresa_id (uuid→empresas), aberto_em, fechado_em,
fundo_troco (numeric), operador (text), obs_abertura (text),
status ('aberto'|'fechado'), contado_dinheiro, contado_eletronico,
diferenca (GLOBAL: contado total − total em caixa),
detalhe_fechamento (jsonb: cédulas contadas, lançamentos eletrônicos,
  esperado, contado e o texto do relatório 80mm), observacao
```

Índice único parcial `caixas_um_aberto_por_empresa` (empresa_id WHERE status='aberto') →
**no máximo 1 caixa aberto por empresa**.

**Tabela `caixa_movimentos`**:

```text
id, caixa_id (→caixas), empresa_id, tipo ('recebimento'|'sangria'|'suprimento'),
forma_pagamento (só recebimento), valor (numeric), pedido_id (→pedidos, null),
descricao (motivo de sangria/suprimento), criado_em
```

- **Recebimento por pedido:** marcar *Receber* cria um movimento `recebimento` (com `pedido_id`) e
  seta `pedidos.recebido_em = now()`; estornar apaga o movimento e zera `recebido_em` (só antes do
  fechamento). Pedido "a receber" = `recebido_em IS NULL`.
- **Fechamento (conferência):** o operador conta a gaveta no **contador de cédulas** (dinheiro) e
  informa **cartão/Pix** por forma. `total_em_caixa = fundo + suprimentos + vendas (todas as formas) −
  sangrias`; `diferenca = (contado_dinheiro + contado_eletronico) − total_em_caixa` (GLOBAL). O
  **relatório 80mm é montado no servidor** (`public/relatorio-caixa.js`) e guardado em
  `detalhe_fechamento.relatorio` p/ reimpressão. **Não fecha** se houver pedidos do turno (criados desde
  a abertura) ainda a receber.
- Cálculos puros em `src/caixa-calc.js` e `public/relatorio-caixa.js`; orquestração em `src/caixa.js`.
  Migrations `20260620120000_caixa.sql`, `20260620130000` (operador/obs_abertura),
  `20260620140000` (contado_eletronico/detalhe_fechamento). RLS no padrão (revoke anon/authenticated).
