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
  "opcionais": "Ovo frito | 2.00\nBacon | 3.50",
  // variacoes = opções com PREÇO e ESTOQUE próprios (ex.: sabores de refrigerante)
  "variacoes": [
    { "id": "v_ab12", "nome": "Coca-Cola", "preco": 6.0, "estoque": 12, "estoqueMinimo": 2 }
  ] }
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

`variacoes` (opcional) é um **array** `[{ id, nome, preco, estoque?, estoqueMinimo? }]` — opções com
**preço e estoque próprios** (ex.: "Refrigerantes 350ml" com vários sabores). O cliente escolhe
**várias com quantidade** (somam no preço; o card mostra **"a partir de R$ X"** = menor preço entre as
disponíveis); item com variações pode ter **preço base 0** e exige **≥1 escolha**. Cada variação **dá
baixa no próprio estoque** (chave `item.id::variacao.id`), atômica via `store.baixarEstoqueTx` (o
`FOR UPDATE` no tenant já cobre, pois moram no mesmo jsonb). Helpers puros em `public/variacoes.js`
(`normalizarVariacoes`/`precoAPartir`/`avaliarVariacoes`/`todasEsgotadas`) + baixa por opção em
`public/estoque.js`; o **servidor valida/recalcula** (cardápio web + PDV). A projeção pública expõe
`{ id, nome, preco, esgotado }` + `precoAPartir` (**não vaza a contagem**). Sem migração (mesmo jsonb).
`estoque` vazio = ilimitado; `0` = esgotado; variação é sempre "un" (não suporta kg).

**Tabela `pedidos`** (Postgres/Supabase, uma só, isolada por `empresa_id`):

```text
id (bigint), empresa_id (uuid→empresas), numero (sequencial por empresa; índice
único parcial `pedidos_empresa_numero_unico` em (empresa_id, numero) — rede de
segurança contra duplicata sob corrida, além do lock FOR UPDATE em runtime),
status, cliente, telefone, chat_id, tipo_entrega, endereco, pagamento,
taxa_entrega, itens (jsonb), total, observacao, criado_em (timestamptz),
avisado_em, recebido_em (timestamptz; null = a receber — usado pelo Caixa),
desconto (numeric; abatido na venda — usado pelo PDV; web fica 0),
impresso_em (timestamptz; null = ainda não impresso pelo agente de impressão desktop),
reservado_em / reservado_por (timestamptz / text; CLAIM do agente — o poll reserva os
  pendentes atomicamente [FOR UPDATE SKIP LOCKED] por id de sessão do agente; reserva
  expira em 30s. Evita 2 agentes do mesmo tenant imprimirem a mesma comanda. Mesma dupla
  de colunas em `impressao_fila`),
origem (text 'web' | 'pdv' | 'mesa'; de onde o pedido entrou — escopa o alerta de
  "novo pedido" e a impressão do agente ao 'web', e dá o "Canal" na lista de Pedidos)
```
`tipo_entrega` = `Entrega` | `Retirada` | **`Balcão`**. No **PDV** (`origem='pdv'`):
**Balcão** nasce `recebido_em` (paga na hora, cai no caixa); **Entrega/Retirada** nascem
**a receber** (`recebido_em` nulo — recebimento feito depois em Pedidos). No PDV o `total`
é o líquido (subtotal − `desconto`).
Colunas em snake_case no banco; `pedidos.js` mapeia para camelCase (`tipoEntrega`,
`criadoEm`, etc.) que o painel/bot esperam. `avisado_em` = timestamp do aviso
"pedido pronto" (null se não avisado). `observacao` = observação do **pedido** (informada
no checkout do cardápio web; é PII e é limpa na retenção).

**Tabela `itens_venda`** (projeção RELACIONAL dos itens vendidos — Fase 1 da normalização):

```text
id (bigint), empresa_id (uuid→empresas), pedido_id (bigint→pedidos ON DELETE CASCADE),
numero (nº do pedido, conveniência), origem, item_id (referência SOLTA ao cardápio, SEM FK),
descricao (nome COMO VENDIDO — snapshot), unidade ('un'|'kg'), qtd (numeric, decimal p/ kg),
preco_unit (base), adicionais (opcionais+variações por unidade), subtotal ((preco_unit+adicionais)×qtd),
opcionais/variacoes/composicao (jsonb — extras de display), observacao, criado_em (= do pedido)
```

Cada item vendido em **colunas** (indexável/agregável: `GROUP BY descricao`, etc.) para
**relatório/BI**, sem desaninhar o `pedidos.itens` jsonb. **Não é fonte da verdade nem dual-write:**
é uma **projeção** de `pedidos.itens` mantida por **trigger** `trg_sync_itens_venda`
(`AFTER INSERT OR UPDATE OF itens ON pedidos` → função `sync_itens_venda()` apaga+reinsere as linhas
do pedido). Cobre todos os caminhos (PDV/web/mesa/cancelamento de item) sem tocar no código do app;
o jsonb segue como snapshot operacional (impressão/recálculo). `descricao`/`preco_unit` são snapshot;
`item_id` não tem FK (o cardápio é jsonb em `empresas.cardapio`, editável/arquivável). Migração
`20260704120000_itens_venda.sql` (tabela + função + trigger + backfill). Reporte de vendas líquidas
filtra cancelados por join em `pedidos.status`.

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
  composicao: [{ grupo, itens:[nome] }], variacoes: [{id, nome, preco, qtd}], observacao }
```
Preço da linha = `(preco + Σ(opcional.preco × qtd) + Σ(variacao.preco × qtd)) * qtd`. O opcional e a
variação têm quantidade (ex.: 2 ovos / 2 Cocas) — escolhidas no cardápio web/PDV. **A composição não
entra no preço** (é grátis):
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
id, caixa_id (→caixas), empresa_id, tipo ('recebimento'|'cancelamento'|'estorno'|'sangria'|'suprimento'),
forma_pagamento (só recebimento), valor (numeric; LÍQUIDO que entra na gaveta),
pedido_id (→pedidos, null), mesa_id (→mesas, null), descricao (motivo de sangria/suprimento),
valor_pago (numeric, null; quanto o cliente ENTREGOU), troco (numeric, null; troco devolvido),
criado_em
```

- **`valor_pago`/`troco`** (rastreio a partir da Fase 2; anuláveis — `null` em movimentos
  antigos e nos que não são recebimento). Invariante garantida por **CHECK** no banco:
  `caixa_mov_pago_coerente` = `valor_pago IS NULL OR valor_pago = valor + COALESCE(troco,0)` e
  `caixa_mov_troco_nonneg` = `troco IS NULL OR troco >= 0`. Rede de segurança: o banco **rejeita**
  gravar um entregue incoerente com o que entrou (a origem do bug do troco na Mesa). A regra que
  monta `valor`/`valor_pago`/`troco` por forma é única no front (`montarPagamentosRegistrados`,
  usada por PDV/Receber-Pedidos/Mesa) — só o dinheiro gera troco; pagamento parcial não gera.

- **Recebimento por pedido:** marcar *Receber* cria um movimento `recebimento` (com `pedido_id`) e
  seta `pedidos.recebido_em = now()`; **estornar** insere um movimento `estorno` (que deduz, deixando
  rastro) e zera `recebido_em` — restrito a recebimento de pedido a-receber (web/PDV-Entrega/Retirada),
  **não** em Mesa/Balcão. Pedido "a receber" = `recebido_em IS NULL`.
- **Fechamento (conferência):** o operador conta a gaveta no **contador de cédulas** (dinheiro) e
  informa **cartão/Pix** por forma. `total_em_caixa = fundo + suprimentos + vendas (todas as formas) −
  sangrias`; `diferenca = (contado_dinheiro + contado_eletronico) − total_em_caixa` (GLOBAL). O
  **relatório 80mm é montado no servidor** (`public/relatorio-caixa.js`) e guardado em
  `detalhe_fechamento.relatorio` p/ reimpressão. **Não fecha** com consumo em aberto: **mesas abertas**
  (bloqueio à parte, atalho pra Mesas) ou **pedidos de delivery/local a receber** (`mesa_id` nulo,
  criados desde a abertura). Pedido **cancelado não conta** (`_contarAReceber` exclui `status='cancelado'`).
- Cálculos puros em `src/caixa-calc.js` e `public/relatorio-caixa.js`; orquestração em `src/caixa.js`.
  Migrations `20260620120000_caixa.sql`, `20260620130000` (operador/obs_abertura),
  `20260620140000` (contado_eletronico/detalhe_fechamento). RLS no padrão (revoke anon/authenticated).

## Contas a Receber (fiado)

Sem gate de plano (Essencial **e** Completo). Uma **conta a receber = o próprio `pedido`**
(reuso máximo: já tem número, itens, total, impressão). Colunas em `pedidos` (migration
`20260710140000_pedido_fiado.sql`):

```text
cliente_id (→clientes, on delete set null), a_prazo (bool default false),
vencimento (date; calculado na venda pelo Convênio do cliente — foto), valor_recebido (numeric default 0)
```

- **Nasce** com `a_prazo=true`, `cliente_id` preenchido, `recebido_em=NULL` e **sem**
  `caixa_movimentos` (a venda a prazo não entra no caixa na hora). Origem PDV Balcão
  (`venderAPrazo`) ou Mesa (`fecharMesaAPrazo`). `Valor gasto`/`Saldo` do cliente são
  **derivados** (soma de `total - valor_recebido` das vendas a prazo em aberto).

### Convênios de vencimento

O vencimento não é mais um "dia fixo" no cliente; vem de um **Convênio** (regra nomeada,
por restaurante) que o cliente referencia. Estrutura em `config.convenios` (jsonb) e coluna
`clientes.convenio_id` (migration `20260711120000_cliente_convenio.sql`). O `dia_vencimento`
antigo fica como legado (migrado por `scripts/migrar-convenios.js`).

```text
config.convenios[]: { id, nome, faixas: [ { de, ate, tipo:"fixo"|"dias", valor, meses } ] }
```

- Faixas por **dia da compra** (cobrem 1–31, validado ao salvar). `tipo "fixo"` (=): vence no
  dia `valor` do mês, deslocado por `meses` (clamp em mês curto). `tipo "dias"` (+): vence
  `valor` dias após a compra (`meses` ignorado). Sem convênio / dia sem faixa = **sem
  vencimento** (null; nunca em atraso).
- Cálculo puro em `public/convenios.js` (`calcularVencimentoConvenio`), aplicado na venda por
  `src/fiado.js`. O `pedidos.vencimento` é **foto** — mudar o convênio depois não altera
  contas já lançadas. Editor na aba Pagamentos → seção Convênios. Ver o design em
  `docs/superpowers/specs/2026-07-11-convenios-vencimento-fiado-design.md`.
- **Baixa (recebimento, Fase 4 — `fiado.baixar`):** integral ou parcial, em lote. Acumula em
  `valor_recebido`; quando cobre o `total`, seta `recebido_em` (vai p/ "Recebidas"). A baixa
  entra no caixa do dia **só no Completo** (`comCaixa` resolvido no servidor por
  `empresas.temCaixa`): insere `caixa_movimentos` `recebimento` por venda; no Essencial só quita.
- **Fiado não trava o fechamento do caixa:** `_contarAReceber` exclui `a_prazo=true` (o fiado é
  recebido depois, não precisa fechar o dia).

**Tabela `fiado_baixas`** (log de cada baixa, migration `20260710160000_fiado_baixas.sql`):

```text
id, empresa_id, pedido_id (→pedidos), cliente_id (→clientes, set null),
valor (numeric), forma_pagamento (canônica, nunca "A Prazo"),
restante (numeric; quanto faltava DEPOIS desta baixa),
caixa_movimento_id (→caixa_movimentos, set null; NULL no Essencial), criado_em
```

Alimenta o histórico do modal ("Baixado R$ 5,00 · dia/hora · restante R$ X"). RLS no padrão
(revoke anon/authenticated). Rotas: `GET /api/fiado/receber|recebidas`,
`GET /api/fiado/cliente/:id/vendas`, `POST /api/fiado/baixar`. Front em `public/app.js`
(sub-abas Receber/Recebidas + modal + cards) reusando o design system `.cli-*`/`.fiado-*`.
