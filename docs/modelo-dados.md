# Modelo de dados e máquina de estados

## Modelo de dados

**Categoria** (no `cardapio.categorias` jsonb): `{ id, nome, itens[], ativo }`. `ativo:false`
esconde a categoria (e seus itens) do cardápio web e do PDV **sem excluir** (filtro em
`projetarCardapio`/`recalcularItens` e `pdvCategorias`); `ativo` ausente = ativa. Gerida na tela
**Cadastros → Produtos → Categorias** (criar/renomear/ativar-desativar; excluir só sem itens).

**Item do cardápio** (dentro do `cardapio` jsonb da `empresas`):
```jsonc
{ "id": 10, "nome": "Marmitex P", "preco": 18.0, "desc": "...",
  "disponivel": true,
  // grupos = VÍNCULO com a biblioteca (as opções moram em cardapio.grupos).
  // É a ÚNICA fonte de opção do item; a regra aqui sobrescreve a padrão do grupo.
  "grupos": [{ "id": "g_ab12", "obrigatorio": true, "min": 1, "max": 1 }],
  // variacoes = opções com PREÇO e ESTOQUE próprios (ex.: sabores de refrigerante)
  "variacoes": [
    { "id": "v_ab12", "nome": "Coca-Cola", "preco": 6.0, "estoque": 12, "estoqueMinimo": 2 }
  ] }
```
**Item sem vínculo não tem opção nenhuma.** Os campos do formato antigo (`composicao` estruturada e
`opcionais` em texto) ainda podem estar no jsonb de produtos nunca reeditados, mas **ninguém mais os
lê**: nem a projeção pública, nem o recálculo do pedido, nem o PDV, nem o modal do cardápio web.
**Salvar o cardápio apaga os dois campos** (`PUT /api/cardapio`), então o resto some conforme o dono
usa o sistema. A regra vale em toda a stack para o dono não vender o que acha que apagou.

### Biblioteca de complementos (`cardapio.grupos` + `item.grupos`)

Formato **atual**: as opções são cadastradas **uma vez por empresa** e reaproveitadas em vários
produtos. A biblioteca mora em `cardapio.grupos`; o produto guarda só o **vínculo**.

```jsonc
// cardapio.grupos — biblioteca do tenant
[{ "id": "grp_m1a2", "nome": "Guarnição",
   "padrao": { "obrigatorio": true, "min": 2, "max": 2 },
   "opcoes": [ { "id": "op_a1", "nome": "Arroz", "preco": 0 },
               { "id": "op_b2", "nome": "Bacon", "preco": 3.5 } ] }]

// item.grupos — vínculo do produto (regra opcional, sobrescreve o padrão do grupo)
[{ "id": "grp_m1a2", "obrigatorio": true, "min": 1, "max": 1 }]
```

- **`tipo` separa duas coisas diferentes**, e é ele (não o preço da opção) que decide a regra:
  - **`composicao`** — o que vai DENTRO do prato. O cliente **escolhe** entre as opções (rádio se
    `max === 1`, caixa de seleção nos demais). **Sem preço** (normalizar zera) e **sem quantidade**;
    `min`/`max` contam **escolhas**. Sai no pedido em `composicao`.
  - **`complemento`** — o extra que ele **acrescenta**. Tem preço e **quantidade livre** (stepper);
    `max` conta **unidades** (0 = sem limite) e `obrigatorio`/`min` não se aplicam. Sai em `opcionais`
    com `qtd`. É como o formato antigo sempre funcionou; o tipo devolve isso ao modelo novo.
  - Grupo sem `tipo` (dado antigo) é inferido pelo preço, na leitura e na avaliação, então opção paga
    nunca cai na composição e sai de graça.
  - A escolha do cliente aceita `opcoes: ["op_a1"]` (composição) ou `opcoes: [{ id, qtd }]` (complemento).
- **As opções moram no grupo; a regra efetiva mora no vínculo.** Sem regra no vínculo vale o
  `padrao` do grupo. É isso que deixa Marmitex P/M/G usarem a mesma lista escolhendo 1, 2 e 3.
- **`id` de grupo e de opção é estável**: renomear não gera id novo. É a âncora da futura ficha
  técnica de Insumos, e por isso o painel preserva ids ao salvar (só opção nova ganha um).
- **Regra de leitura: só a biblioteca vale.** Item sem vínculo resolvido **não tem opção nenhuma**,
  nem na projeção pública nem no recálculo (web e PDV). Os campos antigos `composicao`/`opcionais`
  continuam gravados em itens não editados, mas **ninguém os lê**. Havia um fallback para eles, e ele
  foi removido: apagar um grupo da biblioteca fazia o produto voltar a mostrar a opção antiga, então
  o dono achava que tinha apagado e o cliente seguia comprando. Salvar o produto no painel descarta
  os campos antigos.
- **A saída do pedido não mudou.** Opção com preço 0 vira `composicao: [{ grupo, itens:[nome] }]`;
  opção com preço vira `opcionais: [{ nome, preco, qtd }]`. Comanda, `itens_venda`, relatórios e
  pedidos antigos não sabem que a biblioteca existe.
- **O cliente envia ids**, não nomes: `grupos: [{ grupo: "grp_m1a2", opcoes: ["op_a1"] }]` no pedido
  do cardápio web, na venda do PDV e no lançamento para mesa. O servidor recalcula por eles.
- Helpers puros em `public/grupos.js`: `normalizarBiblioteca`, `resolverGrupos` (expande o vínculo
  aplicando a regra efetiva), `avaliarEscolhas` (valida e devolve `composicao`/`opcionais`/`addUnit`)
  e `converterCardapio` (usado pela migração).
- **Conversão:** `npm run converter-complementos` simula e `-- --aplicar` grava. Monta a biblioteca a
  partir de `composicao`/`opcionais` de cada item, deduplicando grupos iguais e marcando o `tipo` pela
  origem. Tenant que já tem biblioteca é pulado (idempotente). O script não apaga os campos antigos,
  mas **isso não é mais um plano B**: como nada os lê, desfazer a conversão exigiria reescrever código.
  Aplicada em produção em 2026-08-10 (2 tenants, 7 grupos, 4 produtos).
- Telas: **Cadastros → Produtos → Complementos** (biblioteca) e a aba **Complementos** do editor do
  produto (vínculos, ordem e regra por produto).

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
status, cliente, telefone, chat_id, tipo_entrega, endereco,
pagamento (a FORMA: Dinheiro/PIX/Cartão de Crédito/Cartão de Débito. Vazio quando a
  venda foi dividida entre formas — escolher uma seria inventar informação num
  registro financeiro. Linhas antigas podem trazer grafia fora do vocabulário atual),
pagamento_resumo (text; como foi pago DE FATO, com valor por forma:
  "PIX R$ 20,00 · Dinheiro R$ 5,00". NULL enquanto o pedido não foi recebido.
  Escrito por receberPedido, venderLocal e fecharMesa, sempre via
  `pdv.resumoPagamento`. É o que o cupom e o card do pedido mostram; a forma pura
  é o que o painel usa para pré-selecionar o recebimento. Até 2026-08-24 as duas
  informações dividiam a coluna `pagamento`, e o `indexOf` que pré-seleciona a
  forma nunca casava com um resumo, caindo calado na primeira forma da lista),
taxa_entrega, itens (jsonb), total, observacao, criado_em (timestamptz),
avisado_em, recebido_em (timestamptz; null = a receber — usado pelo Caixa),
desconto (numeric; abatido na venda — usado pelo PDV; web fica 0),
impresso_em (timestamptz; null = ainda não impresso pelo agente de impressão desktop),
reservado_em / reservado_por (timestamptz / text; CLAIM do agente — o poll reserva os
  pendentes atomicamente [FOR UPDATE SKIP LOCKED] por id de sessão do agente; reserva
  expira em 30s. Evita 2 agentes do mesmo tenant imprimirem a mesma comanda. Mesma dupla
  de colunas em `impressao_fila`),
troco_para (numeric; só no cardápio web e só em dinheiro: quanto o cliente vai
  entregar em mãos. NULL = não pediu troco. Guarda o que ele dá, não o que volta —
  o troco a devolver é `troco_para - total`, calculado na hora de mostrar, para não
  congelar uma conta que o pedido ainda pode mudar por cancelamento de item),
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
`composicao` guarda apenas as escolhas do cliente por grupo (`{ grupo, itens:[nome] }`), validadas
no servidor por `public/grupos.js` (`avaliarEscolhas`). A comanda da cozinha lista essas escolhas
agrupadas por grupo.

## Controle de estoque — saldo no jsonb, trilha em tabela (Plano Completo)

**O saldo não mudou de lugar.** Continua em `empresas.cardapio` (jsonb): `item.estoque` /
`item.estoqueMinimo`, e o mesmo par dentro de cada `item.variacoes[]`. Campo ausente, `null` ou
`""` = **ilimitado** (produto sem controle). Cardápio web, PDV, Mesas e a baixa atômica seguem
lendo de onde sempre leram.

A tabela **`estoque_movimentos`** é **trilha, não fonte de verdade**: registra toda mudança de
saldo, sempre na **mesma transação** que muda o saldo e pela mesma função, então nunca diverge do
número. Reconstruir saldo somando o histórico trocaria o caminho crítico de venda (hoje atômico e
testado) por soma de linhas; não compensa.

```sql
estoque_movimentos (
  id, empresa_id, item_id text, variacao_id text,   -- referência SOLTA ao jsonb, sem FK
  tipo text,            -- venda | devolucao | entrada | perda | contagem | ajuste
  quantidade numeric,   -- ASSINADA: +20 entrada, -3 perda, ±N contagem
  saldo_depois numeric, -- saldo após aplicar o movimento
  descricao text,       -- nome do produto COMO ESTAVA (snapshot: renomear/excluir não apaga o rastro)
  unidade text, pedido_id bigint, numero integer, obs text, criado_em timestamptz )
```

### Os seis tipos, e quem gera cada um

| Tipo | Nasce de | Efeito no saldo |
| --- | --- | --- |
| `venda` | baixa da venda (cardápio web, PDV, balcão, mesa), carimbada com o pedido | subtrai |
| `devolucao` | cancelamento com a caixinha "devolver ao estoque" marcada | soma |
| `entrada` | tela de estoque, botão Entrada | **SOMA** ao que existe |
| `perda` | tela de estoque, botão Perda | **SUBTRAI** do que existe (trava em zero) |
| `contagem` | tela de estoque, botão Contagem | **SUBSTITUI** o saldo pelo contado; a `quantidade` gravada é a diferença (`contado − saldo`) |
| `ajuste` | editar o estoque no editor do produto (`PUT /api/cardapio` roda `diffEstoque`) | o que o dono digitou lá |

> **A distinção entrada × contagem é a dúvida clássica do dono** e está na interface: Entrada pede
> *"quantidade que chegou"* e soma; Contagem pede *"quantidade que você contou"* e troca o saldo.
> Os três lançamentos mostram o resultado **antes** de gravar ("Você tem 4. Vai ficar com 14.").
> Contagem igual ao saldo **não gera movimento** (delta zero), mas **liga o controle** se ele
> estava desligado. Perda maior que o saldo trava em zero e registra o que foi **de fato aplicado**.

### Identidade de reconciliação

```text
saldo_atual = saldo_no_início + entradas + devoluções - vendas - perdas ± contagens ± ajustes
```

Vale linha a linha, porque cada movimento carrega o `saldo_depois` do momento em que foi aplicado.
É o que faz a conta fechar na vertical no extrato da gaveta.

### Por que a venda não é derivada de `itens_venda`

`itens_venda` já é a projeção relacional dos itens vendidos, mantida por trigger, e o primeiro
desenho lia as vendas de lá. **A devolução derrubou isso:** ao cancelar **um item** do pedido, o
`itens` muda, o trigger reprojeta e a linha **desaparece** de `itens_venda`. Se a venda sumisse de
uma fonte e a devolução existisse na outra, o mesmo estoque seria contado duas vezes.

Não é escrita dupla do mesmo fato: `itens_venda` conta **faturamento** (inclui item sem controle de
estoque) e `estoque_movimentos` conta **prateleira**.

### Regras que valem em toda a stack

- Produto **sem controle não gera movimento nenhum**: venda, devolução e cancelamento passam por
  ele sem registrar, porque nada mudou de saldo.
- **Devolução só alcança produto controlado agora.** Item vendido quando era ilimitado e controlado
  depois não ganha estoque de volta, senão a devolução inventaria quantidade.
- **Quilo com três casas** (`Math.round(n * 1000) / 1000`), igual à baixa da venda.
- **Concorrência:** tudo passa pela mesma trava de linha (`SELECT ... FOR UPDATE` na `empresas`)
  que já serializa as vendas; o movimento entra na mesma transação.
- **Retenção de 12 meses**, faxina diária no `index.js`. Seguro porque o saldo não é a soma das
  linhas: apagar histórico velho não altera número nenhum.
- **Essencial também gera movimento** pelo editor do produto, mesmo sem ver a tela. Ao subir de
  plano, o histórico já está lá.

## Bot (fluxo.js) — enxuto, baseado em link

O pedido **não é mais montado no chat** — vai para o cardápio web. Estados: **MENU** e **ATENDENTE**.

- Loja **aberta**: qualquer mensagem recebe boas-vindas + o **link limpo** `PUBLIC_URL/c/:slug`.
  A confirmação automática usa o telefone informado no checkout; links antigos com `?p=` ainda são
  aceitos e podem usar o `chatId` legado.
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
  indisponível rejeita), salva via `salvarPedido` e dispara a confirmação pelo bot usando o telefone
  do checkout. Se o pedido veio de um link legado com token válido, o backend ainda pode confirmar
  pelo `chatId`. Helpers puros em `src/cardapio-web.js` (`projetarCardapio`, `recalcularItens`,
  `assinarToken`/`verificarToken` para compatibilidade).
- Página vanilla `public/cardapio.{html,js,css}` (CSP-safe, reusa `dinheiro.js`/`endereco-cep.js`).

## Mesas — a fronteira de sessão (`aberta_em`)

Uma mesa é reusada por clientes diferentes o dia inteiro, e **`mesas.aberta_em` é o que
separa uma sessão da seguinte**. Abrir grava `now()`; fechar ou cancelar zera. Mesa livre
tem `aberta_em` nulo.

**A regra:** pedido só pertence à mesa se `recebido_em IS NULL`, `status <> 'cancelado'`,
`aberta_em IS NOT NULL` e `criado_em >= aberta_em`. Vive numa constante única
(`DA_SESSAO`, em `src/mesas-db.js`) usada na leitura da conta, na busca do pedido a
reusar, no alerta de mesa parada, nos recálculos de `total_consumido` e nas escritas de
fechar e cancelar.

**Por que existe.** Metade dessa conta já cortava por `aberta_em` (o dinheiro recebido, em
`recebidoDaMesa`) e a outra metade não. Com critérios divergentes, um pedido que ficasse
sem receber numa sessão antiga — fechamento interrompido, falha no meio da transação —
seguia grudado na mesa para sempre: aparecia na conta do próximo cliente, entrava no total
consumido e, pior, o `lancarItens` **acumulava a rodada nova dentro dele**, herdando número
e valor. O pedido do cliente novo nascia com o consumo de outra pessoa.

**Pedido órfão não some do sistema:** ele deixa de pertencer à mesa e continua na aba
Pedidos como "a receber", que é onde o dono recebe ou cancela.

**A exceção é a transferência.** Mover a comanda para outra mesa leva pedidos com
`criado_em` antigo. Por isso `transferir` **recua o `aberta_em` do destino** até o pedido
mais antigo movido — sem isso a conta inteira cairia fora da janela e sumiria. O recuo vale
mesmo com o destino já ocupado (mesa aberta há pouco que ainda não pediu nada não é
"livre"), e acontece só no MOVE: no MERGE os pedidos movidos são apagados e os itens entram
na comanda do destino, que já nasceu dentro da sessão dele.

**Corridas.** `lancarItens` trava a mesa (`FOR UPDATE`) e reconfere o status dentro da
transação: entre a checagem da rota e o INSERT cabe um `finalizarFechamento` inteiro, e a
rodada nasceria presa a uma mesa já livre — invisível no painel, fora de qualquer conta e
nunca recebida.

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
detalhe_fechamento (jsonb: contadoPorForma, esperadoPorForma,
  diferencaPorForma e o texto do relatório 80mm), observacao
```

Índice único parcial `caixas_um_aberto_por_empresa` (empresa_id WHERE status='aberto') →
**no máximo 1 caixa aberto por empresa**.

**Tabela `caixa_movimentos`**:

```text
id, caixa_id (→caixas), empresa_id, tipo ('recebimento'|'cancelamento'|'estorno'|'sangria'|'suprimento'),
forma_pagamento (recebimento/cancelamento/estorno; null em sangria/suprimento),
valor (numeric; valor do movimento em reais; recebimento soma, cancelamento/estorno/sangria deduzem conforme o tipo),
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
- **Recebimento por mesa:** entra no caixa com `mesa_id` e pode deixar `pedido_id = null`; isso entra
  normalmente no fechamento, mas não reconcilia por número de pedido sem olhar a mesa/comanda. Para
  não criar sobra no caixa, mesa com pagamento registrado não pode ser cancelada inteira, e cancelar
  item é recusado quando o total restante ficaria menor que o valor já recebido na sessão.
- **Fechamento (conferência):** o operador informa o valor **em mãos por forma de pagamento**
  (Dinheiro, PIX, Crédito, Débito etc.). O servidor calcula o esperado líquido por forma, a diferença
  por forma e a diferença global. O **dinheiro esperado na gaveta** é `fundo + suprimentos +
  recebimentos em dinheiro − cancelamentos/estornos em dinheiro − sangrias`; os eletrônicos esperados
  são os recebimentos líquidos por forma. O **total para conferência** soma dinheiro físico +
  eletrônico líquido (`fundo + suprimentos + vendas líquidas − sangrias`). O **relatório 80mm é montado
  no servidor** (`public/relatorio-caixa.js`) e guardado em `detalhe_fechamento.relatorio` p/
  reimpressão, com linhas separadas de **Dinheiro em Caixa** e **Total Conferência**. O backend ainda
  aceita o payload legado `{ contagem, eletronico }` para front em cache. **Não
  fecha** com consumo em aberto: **mesas abertas** (bloqueio à parte, atalho pra Mesas) ou **pedidos
  de delivery/local a receber** (`mesa_id` nulo, criados desde a abertura). Pedido **cancelado não
  conta** (`_contarAReceber` exclui `status='cancelado'`).
- Cálculos puros em `src/caixa-calc.js` e `public/relatorio-caixa.js`; orquestração em `src/caixa.js`.
  Migrations `20260620120000_caixa.sql`, `20260620130000` (operador/obs_abertura),
  `20260620140000` (contado_eletronico/detalhe_fechamento). RLS no padrão (revoke anon/authenticated).
