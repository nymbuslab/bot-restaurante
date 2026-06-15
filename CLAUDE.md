# CLAUDE.md

Guia de contexto para assistentes de IA (Claude Code) e desenvolvedores que forem
trabalhar neste projeto. Leia antes de fazer alterações.

## Visão geral

Plataforma **SaaS multi-tenant** de atendimento de restaurantes no WhatsApp, com
**painel web administrativo** por empresa. Cada empresa cadastrada recebe seu próprio
ambiente isolado (cardápio, config, pedidos, sessão WhatsApp). O bot é a **porta de
entrada de pedidos**: recebe o pedido pelo WhatsApp, monta tudo (itens, opcionais,
observação, entrega, pagamento) e registra. O andamento do pedido é feito por um
sistema externo — este projeto **não** gerencia o ciclo do pedido (preparo/entrega).

Idioma do projeto: **português (Brasil)**. Mensagens, comentários e UI em pt-BR.

## Stack

- Node.js (CommonJS, `require`). O **Baileys é ESM-only** → carregado via `import()`
  dinâmico (cacheado após o 1º load); não dá pra `require()` direto.
- `@whiskeysockets/baileys` (biblioteca **não-oficial** de WhatsApp via **WebSocket**,
  **sem browser/Chromium**) + `pino` (logger)
- `express` (API do painel + arquivos estáticos)
- **`pg` (PostgreSQL gerenciado no Supabase)** — empresas, pedidos, config e cardápio.
  Acesso async via pool (`src/db.js`). Migrações versionadas em `supabase/migrations/`
  (Supabase CLI: `npx supabase db push`).
- **`@supabase/supabase-js` — Auth (bcrypt + JWT) + Storage (imagens)**. Login em
  `src/supabase.js`; o token é o JWT do Supabase. Imagens do cardápio no bucket `cardapio`.
- **`jose`** — validação LOCAL do JWT (JWKS), sem ida à rede por request (`exigeAuth`).
- `qrcode` / `qrcode-terminal` (QR de conexão — data URL no painel + impressão no terminal)
- Front-end em HTML/CSS/JS puro (sem framework)

> **App stateless — NADA é gravado em disco.** Histórico: usava `better-sqlite3` (bancos em
> disco). Hoje **tudo no Supabase**: dados em Postgres (`empresas`, `pedidos`, `config`/
> `cardapio` jsonb), contas no Auth, **sessões do WhatsApp** na tabela `wa_auth` (adapter
> `src/wa-auth.js`, no lugar do `useMultiFileAuthState`) e **imagens** no Storage. Sem volume
> persistente; habilita múltiplas instâncias / hosts efêmeros.

> **Histórico:** o projeto usava `whatsapp-web.js` (Puppeteer/Chromium), trocado por
> Baileys por instabilidade (QR parava de gerar quando o WhatsApp Web mudava o HTML;
> erros `detached Frame`). Baileys é WebSocket, mais leve e estável. **Ambos são
> não-oficiais** — o caminho de produção séria é a WhatsApp Cloud API (ver `ROADMAP.md`).

## Como rodar

```bash
npm install
npm start            # inicia o painel (porta de PORT no .env, ex.: 3001)
```

**Requer `.env`** (ver `.env.example`) com as credenciais do Supabase — sem elas o app
não sobe:

```
DATABASE_URL=...                 # Postgres (Settings → Database; prefira Session pooler 5432)
SUPABASE_URL=...                 # Settings → API
SUPABASE_ANON_KEY=...            # anon public
SUPABASE_SERVICE_ROLE_KEY=...    # service_role (secreto, só backend)
```

Schema: `npx supabase db push` aplica as migrações de `supabase/migrations/`.

No **primeiro acesso**, crie a primeira empresa pelo onboarding público em
`/cadastro.html` (nome, e-mail e senha). O tenant nasce limpo (cardápio vazio,
identidade só com o nome). Depois faça login e, na aba **Conexão**, clique em
"Conectar ao WhatsApp".

Não há suíte de testes automatizada. Use o simulador de conversa para testar
o fluxo do bot sem WhatsApp (ver seção **Testando o bot** abaixo).

## Testando o bot

O arquivo `testar-bot.js` na raiz simula uma conversa completa no terminal,
sem precisar de WhatsApp, QR ou celular. Usa os dados do primeiro tenant.

```bash
node testar-bot.js
```

**Comandos especiais dentro do simulador:**

| Comando   | O que faz                                      |
|-----------|------------------------------------------------|
| `/reset`  | Reinicia a sessão (simula um novo cliente)     |
| `/status` | Exibe o estado interno da sessão em JSON       |
| `/quit`   | Encerra o simulador                            |

**Fluxo de pedido completo para testar:**

```
oi          → menu
1           → categorias
1           → itens da 1ª categoria
<id>        → escolhe item (ex: 10)
0           → sem opcionais (se houver)
0           → sem observação
1           → quantidade 1
2           → finalizar pedido
2           → não quero bebida (se aparecer)
João        → nome
1           → entrega
Rua X, 10  → endereço
1           → forma de pagamento
1           → confirmar
```

O pedido confirmado é gravado na tabela `pedidos` (Postgres/Supabase) e aparece
no painel na aba **Pedidos**.

## Arquitetura

```
index.js              -> sobe o servidor (NÃO inicia o bot)
src/
  db.js               -> pool Postgres (pg), lê DATABASE_URL do .env
  supabase.js         -> clients do Supabase (Auth admin/anon + Storage)
  stripe.js           -> assinatura (Stripe): SetupIntent/checkout próprio, webhook, portal, faturas
  servidor.js         -> Express: API REST multi-tenant + serve /public
  empresas.js         -> CRUD de tenants na tabela `empresas` + Supabase Auth (cadastro/login)
  wa-auth.js          -> sessão Baileys persistida no Postgres (tabela wa_auth) — stateless
  multi-bot.js        -> gerencia um socket WhatsApp (Baileys) por tenant (Map slug→socket)
  fluxo.js            -> máquina de estados; processarMensagem é async (await store.ensure)
  store.js            -> config/cardápio (jsonb) com cache em memória; ensure() async
  sessoes.js          -> estado da conversa por cliente (em memória, expira em 30min)
  pedidos.js          -> tabela `pedidos` no Postgres, isolada por empresa_id (async)
public/
  index.html          -> landing page pública (apresentação + preço + CTAs)
  login.html          -> tela de login (e-mail + senha; roteia restaurante x master)
  cadastro.html       -> wizard de onboarding (4 etapas): cria empresa + configura
  checkout.html       -> checkout próprio (Stripe Elements) p/ ativar o trial com cartão
  admin.html          -> painel administrativo (inclui aba Assinatura + gate)
  admin-master.html   -> painel super-admin (sidebar; gestão de tenants + assinatura)
  app.js, app-admin.js, style.css -> lógica dos painéis e estilos
  endereco-cep.js     -> util compartilhado: máscara/busca de CEP (ViaCEP) + composição de endereço
  dinheiro.js         -> util compartilhado: máscara monetária (centavos primeiro) + formatação BR
supabase/
  migrations/         -> schema versionado (npx supabase db push)
scripts/
  setup-storage.js    -> cria o bucket público de imagens (npm run setup-storage)
```

**App stateless:** não há mais pasta `data/` em uso — sessões do WhatsApp ficam na tabela
`wa_auth` (Postgres) e imagens no Storage. O `tenantDir(slug)` ainda existe no código só
como CHAVE do tenant (o basename é o slug); nenhum arquivo é lido/gravado nesse caminho.

**Fluxo de dados:** painel edita config/cardápio via API → `store.setConfig/setCardapio`
grava no Postgres e atualiza o cache em memória (processo único) → `fluxo.js` lê do cache
no próximo atendimento, **sem reiniciar**. Como o cache é por processo, múltiplas instâncias
exigiriam invalidação/pub-sub (hoje é instância única).

## Multi-tenant

Cada empresa tem:

- **Slug** gerado do nome (ex: `sabor-d-casa`), único, usado como chave em tudo
  (linha `empresas`, `empresa_id` dos pedidos, `wa_auth` da sessão, pasta de imagens no Storage).
- **Linha em `empresas`** (Postgres) com `config`/`cardapio` (jsonb), ligada ao usuário
  do Supabase Auth por `user_id`.
- **Sessão WhatsApp** na tabela `wa_auth` (por slug); **imagens** no Storage (`cardapio/{slug}/`).
  Nada em disco.
- O `tenantDir(slug)` segue sendo a "alça" do tenant no código; o `basename` é o slug, usado
  como chave no banco. O caminho físico não existe/não é usado.

Autenticação: `POST /api/login { email, senha }` → `{ token, slug, nome }`, onde `token`
é o **JWT do Supabase Auth**. Viaja em `Authorization: Bearer ...`. O middleware `exigeAuth`
(async) valida o JWT **localmente** (`empresas.resolverPorToken` → `jose.jwtVerify` com o JWKS
público; fallback para `getUser` em erro), checa
`ativo` a cada request (suspensão é imediata) e resolve `req.slug` / `req.tenantDir`.
Não há mais mapa de tokens em memória para restaurante (JWT é stateless); logout é só
descartar o token no cliente.

**Conta de acesso (trocar e-mail/senha):** e-mail e senha vivem no Supabase Auth, não no
`config`. Rotas próprias (sob `exigeAuth`): `GET /api/conta` → `{ email, nome }` (exibe o
e-mail de login); `PATCH /api/conta/senha { senhaAtual, novaSenha }`; `PATCH /api/conta/email
{ senhaAtual, novoEmail }`. **Toda troca exige a senha atual** — `empresas.trocarSenha`/
`trocarEmail` validam via `signInWithPassword` e só então aplicam com `admin.updateUserById`
(service_role). Ao trocar o e-mail, a coluna `empresas.email` é sincronizada com o Auth
(`email_confirm: true`, sem etapa de confirmação). No painel ficam na sub-aba **Empresa** das
Configurações (seção "Conta de acesso").

## Super-admin (conta master)

Área de gestão de **todos** os tenants, separada do painel de restaurante. **Backend
apenas** (a tela vem em passo posterior).

- **Conta master fixa**, via variáveis de ambiente (nunca hardcoded/commitada):
  `SUPERADMIN_EMAIL` e `SUPERADMIN_SENHA_HASH`. O hash usa a **mesma** `hashSenha`
  (`sha256(senha + SALT)`) do `empresas.js` — gere com `npm run gerar-hash-admin -- "senha"`
  (script `scripts/gerar-hash.js` importa a função real, então o salt nunca diverge).
  Sem as duas envs, as rotas `/api/admin/*` ficam desativadas (login responde **503**;
  nunca há credencial default). Carregamento de `.env` via `dotenv` (ver `.env.example`).
  Em produção (Fly.io): `fly secrets set SUPERADMIN_EMAIL=... SUPERADMIN_SENHA_HASH=...`.
- **Isolamento total de auth:** o super-admin usa um Map `tokensAdmin` próprio (token opaco
  em memória, SHA-256+salt) — **separado e diferente** do JWT do Supabase usado pelo
  restaurante. `exigeSuperAdmin` valida só o token master; `exigeAuth` só o JWT de restaurante.
  Um token nunca cruza para o outro lado. Login master: `POST /api/admin/login { email, senha }`
  → `{ token }`. Comparação de hash com `crypto.timingSafeEqual`. (O super-admin **não** migrou
  para o Supabase Auth — segue env-based, por ser conta única e isolada.)
- **Rotas** (todas sob `exigeSuperAdmin`):
  `GET /api/admin/tenants` (lista) · `POST /api/admin/tenants` (cria, reusa `empresas.cadastrar`) ·
  `PATCH /api/admin/tenants/:slug/suspender` · `PATCH .../reativar` ·
  `DELETE /api/admin/tenants/:slug` (destrutivo) · `GET /api/admin/metrics` (métricas).
- **Métricas (`GET /api/admin/metrics`):** retorna `{ totais: { restaurantes, ativos,
  suspensos, conectados, pedidosMes }, porTenant: { <slug>: { pedidosMes, conectado } } }`.
  Contagem de pedidos do mês é **real e on-demand**: `pedidos.contarNoMes(tenantDir, inicioISO)`
  faz `COUNT(*) WHERE empresa_id = ? AND criado_em >= ?` no Postgres. "Conectados" vem de
  `multiBot.getEstado(slug).status`. O
  **corte do mês usa o fuso BR** (America/Sao_Paulo, UTC-3, sem DST) convertido para UTC ISO —
  `inicioDoMesBR()` em `servidor.js` — para o número bater com a intuição do admin brasileiro
  sem misturar fusos. Se o nº de tenants crescer para centenas, cachear (TTL curto).
- **Suspensão (efeito real):** `setAtivo(slug,0)` → login do restaurante já é recusado
  (`autenticar` filtra `ativo`) + `exigeAuth` checa `ativo` a cada request (a sessão aberta
  cai no próximo request, mesmo com JWT válido) + `multiBot.desconectar(slug)` (bot para).
- **Exclusão (destrutiva, ordem importa):** `multiBot.desconectar` (libera sessão Baileys)
  → `empresas.excluir(slug)`, que apaga a linha em `empresas` (**cascateia** os `pedidos`),
  remove o **usuário do Supabase Auth** (`auth.admin.deleteUser`) e apaga `data/tenants/{slug}/`
  (sessões/imagens). **Trava de segurança:** o corpo deve trazer `{ confirmacao: "<slug>" }`
  igual ao slug da URL, senão responde 400 sem apagar nada.
- **Tela (`public/admin-master.html` + `public/app-admin.js`):** página **separada** do
  painel de restaurante (não usar `admin.html`/`app.js`). Login master + dashboard de tenants
  na mesma página (gate por token). Token guardado em `sessionStorage["tokenAdmin"]` — chave
  **própria** (≠ `"token"` do restaurante) e **`sessionStorage` por escolha de segurança**: a
  sessão master expira ao fechar a aba, exigindo novo login a cada sessão do navegador.
  **Acesso pelo login único:** o formulário de `login.html` tenta primeiro o login de restaurante
  (`/api/login`); se falhar, tenta o master (`/api/admin/login`) com as mesmas credenciais e,
  dando certo, grava `tokenAdmin` e redireciona para `/admin-master.html`. Não há **link visível**
  para a área master (o redirecionamento só ocorre com a senha master correta — sem vazar que a
  área existe). Os dois fluxos de auth seguem **isolados** (endpoints/tokens/middlewares
  separados); só a tela de login decide o destino. CSS reusa a identidade Nymbus (classes `.am-*`
  em `style.css`); exclusão usa confirmação forte (digitar o slug habilita o botão).
- **Menu (3 abas):** **Dashboard · Clientes · Configurações Master** (reusa o shell do painel do
  cliente — sidebar/indicador/entrada em cascata se aplicam). **Dashboard:** header + **Exportar**
  (CSV dos clientes, client-side), **4 cards hero** (Clientes ativos/Em teste/Assinantes/Cancelados
  de `totais`), faixa secundária (Cortesia/Em atraso/Pedidos no mês/Conectados) e **"Últimos
  Clientes Cadastrados"** (top 5 por `criadoEm`, avatar de iniciais, badge de status, olho →
  Gerenciar). Sem setas de tendência (não há histórico → seria decorativo) e **avatar neutro**
  (sem foto). **Clientes:** a tabela completa de tenants com filtro + Gerenciar (o que já existia).
- **Configurações Master ("aba Nymbus"):** edita os dados globais da plataforma na tabela
  **singleton `plataforma_config`** (módulo `src/plataforma.js`: `obter`/`salvar` empresa +
  `obterMaster`/`salvarMaster` credenciais). Campos: **dados da empresa** (Razão Social, Nome
  Fantasia, CNPJ opcional, Endereço, Telefone) + **contato/redes** (WhatsApp de suporte, Facebook,
  Instagram) + **dados de acesso do master** (e-mail/senha). Rotas: `GET/PUT /api/admin/plataforma`
  (dados empresa) · `PATCH /api/admin/conta` (troca e-mail/senha do master, **exige senha atual**) ·
  `GET /api/plataforma` (cliente — suporte WhatsApp, DB→env) · **público** `GET /api/plataforma/publico`
  (footer da landing, sem auth, nada sensível). `telefone`/`suporteWhatsapp` guardam só dígitos.
- **Credenciais do master migraram pro banco (editáveis):** o login master agora lê
  `master_email`/`master_senha_hash` de `plataforma_config` (`credenciaisMaster()` em `servidor.js`),
  caindo na env `SUPERADMIN_EMAIL`/`SUPERADMIN_SENHA_HASH` só como **bootstrap** (a env ainda é o
  gate que habilita `/api/admin/*`). Senha em hash (mesma `hashSenha` sha256+salt); troca exige a
  senha atual. `exigeSuperAdmin` (token opaco) inalterado.
- **Footer da landing** (`index.html`) consome `GET /api/plataforma/publico` e exibe Nome Fantasia,
  Razão Social, CNPJ, Endereço, Telefone e ícones Facebook/Instagram **quando preenchidos** (vazio =
  footer padrão, sem placeholder falso).

## Assinatura (Stripe)

Monetização via **assinatura mensal** (1 plano, **R$ 79/mês**, **7 dias grátis com cartão**).
Pacote `stripe`; lógica em `src/stripe.js`. Sem chave/preço (`STRIPE_SECRET_KEY` +
`STRIPE_PRICE_ID`), as rotas `/api/assinatura/*` respondem **503** (igual ao super-admin).

- **Dois eixos de acesso (independentes), em `empresas.js`:**
  - `ativo` (boolean) = suspensão **manual** do admin (hard block, bloqueia até o login).
  - `assinatura_status` (coluna) = estado de billing: `nenhuma | trialing | active |
    cortesia | past_due | canceled`. (`cortesia` = acesso liberado **manualmente** pelo
    super-admin, sem Stripe.)
  - `podeLogar(emp)` = só `ativo` (o inadimplente entra para pagar). `acessoLiberado(emp)` =
    `ativo` **e** status em `["trialing","active","cortesia"]` → controla **bot ligado** e
    features. Middleware `exigeAssinatura` (depois de `exigeAuth`) responde **402** sem acesso;
    aplicado em `POST /api/bot/conectar`. Colunas de billing: ver migration
    `supabase/migrations/*_assinatura_billing.sql` (`trial_ate`, `proxima_cobranca`,
    `stripe_customer_id`, `stripe_subscription_id`).

- **Checkout PRÓPRIO (Stripe Elements, identidade Nymbus)** — `public/checkout.html`:
  o fluxo padrão **não** usa a tela hospedada do Stripe. Como o requisito é **cartão no início
  do trial**, coletamos o cartão ANTES de criar a assinatura (senão a assinatura nasceria
  `trialing` sem cartão):
  1. `POST /api/assinatura/setup-intent` → cria Customer (se preciso) + **SetupIntent**
     (`usage: off_session`, só cartão); devolve `{ clientSecret, publishableKey }`.
  2. O front monta o **Payment Element** (iframe do Stripe, PCI baixo/SAQ A) com a
     **Appearance API** (tema escuro Nymbus) e faz `confirmSetup({ redirect: "if_required" })`.
  3. `POST /api/assinatura/confirmar { setupIntentId }` → valida o SetupIntent (succeeded +
     pertence ao Customer), define o cartão como **padrão** do Customer e cria a **subscription**
     (`trial_period_days: 7`, `default_payment_method`). **Idempotente** (não duplica se já houver
     assinatura viva). Volta pro painel (`admin.html?assinatura=ok`).
  - `STRIPE_PUBLISHABLE_KEY` (pública) vai pro front via a resposta do setup-intent + carrega
    `https://js.stripe.com/v3`. A rota antiga `/api/assinatura/checkout` (Checkout hospedado)
    **fica como fallback**, não é usada pelo front.

- **Webhook** `POST /api/stripe/webhook`: **raw body + verificação de assinatura**, registrado
  ANTES do `express.json` global. Trata `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed` →
  `aplicarSubscription()` grava o estado e **liga/desliga o bot** (`past_due`/`canceled` →
  `multiBot.desconectar`). Não toca `ativo`.

- **Gerenciar** (cliente): aba **Assinatura** no painel + **gate** que trava o painel sem acesso.
  Página de billing com **card largo do plano** (plano `Plano Nymbus Lab` · `R$ 79,00/mês` ·
  próximo vencimento · badge de status), duas colunas (Pagamento + "Precisa de ajuda?" à esquerda,
  **Histórico de Faturas** à direita) e, no mobile, tudo empilhado (faturas viram cards via
  `data-label`). "Gerenciar assinatura" abre o **Customer Portal** hospedado
  (`/api/assinatura/portal` — cancelamento). Reativar = passar pelo checkout próprio de novo.
  - **Histórico de faturas (real):** `GET /api/assinatura` devolve `faturas` (via
    `stripe.listarFaturas` quando há `stripeCustomerId`): data, valor, status (Pago/Em aberto/…) e
    **link de PDF**. Sem Customer (cortesia/sem assinatura) → lista vazia → estado vazio honesto.
  - **"Falar com Suporte" → WhatsApp:** `GET /api/plataforma` devolve `{ suporteWhatsapp }` lido da
    env `SUPORTE_WHATSAPP` (só dígitos, formato `wa.me`). O card "Precisa de ajuda?" só aparece com
    número configurado (nunca botão quebrado). **Futuro:** a aba "Nymbus" do painel master vai
    gerenciar este e outros dados da plataforma, substituindo a env.

- **Gestão de cartões NO PAINEL** (sem o portal hospedado) — seção "Forma de pagamento" na aba
  Assinatura. `admin.html` carrega `js.stripe.com/v3` e reusa o **Payment Element** (mesma
  Appearance API escura do checkout) num modal pra adicionar cartão. Rotas (sob `exigeAuth`):
  `GET /api/assinatura/cartoes` (lista bandeira/últimos4/validade + qual é o padrão) ·
  `POST .../cartoes/setup-intent` (SetupIntent avulso, só anexa cartão ao Customer, não cria
  assinatura) · `PATCH .../cartoes/:id/padrao` (`stripe.definirCartaoPadrao` → atualiza
  `invoice_settings.default_payment_method` do Customer **e** a subscription) · `DELETE
  .../cartoes/:id` (detach). **Travas** em `removerCartao`: não remove o cartão **padrão** nem
  o **último** (tenant nunca fica sem forma de cobrança). A seção só aparece com Customer no
  Stripe — em **cortesia**/sem assinatura fica oculta (lista vazia). Funções em `src/stripe.js`.

- **Gerenciar (super-admin):** no painel master, o botão **Gerenciar** de cada restaurante abre
  um modal com status + ações + **histórico de faturas** (`GET .../assinatura`): liberar/revogar
  **cortesia** (`PATCH .../assinatura/cortesia|revogar`), **cancelar no Stripe**
  (`PATCH .../assinatura/cancelar`), suspender/reativar (eixo `ativo`) e excluir.
  Métricas de billing (trial/pagantes/cortesia/atraso/cancelados) em `GET /api/admin/metrics`.

## Onboarding (wizard) e retomada

Cadastro público em `/cadastro.html` é um **wizard de 4 etapas**: Conta → Dados (telefone +
endereço) → Horário → Entrega → checkout. Só a **Etapa 1** (conta) e a **Etapa 2** (dados)
são obrigatórias; Horário/Entrega são puláveis.

- **Progresso rastreado** em `config.onboarding = { concluido, etapa }`. O wizard salva a
  `etapa` ao avançar e marca `concluido: true` ao finalizar/pular a Entrega.
- **Retomada:** `autenticar`/`POST /api/login` retornam `onboardingConcluido`/`onboardingEtapa`.
  `login.html` manda pro wizard se incompleto (retoma na etapa salva, com a Etapa 2 preenchida);
  senão, painel. O re-cadastro com e-mail existente **loga com a senha digitada e retoma** (ou vai
  ao painel). `cadastro.html` também retoma sozinho no boot se já houver sessão.
- **Auto-reparo de conta órfã:** se o usuário existe no Supabase Auth **sem** linha em `empresas`
  (cadastro interrompido), `empresas.cadastrar` loga com a senha para obter o `user_id` e **recria
  a linha** — corrige o caso "diz que já existe mas o login não valida". Senha errada → bloqueia.
- **Retrocompatível:** contas antigas (config sem `onboarding`) são tratadas como **concluídas**.

## Formulários — utils compartilhados (`public/`)

Para padronização entre onboarding e painel, dois utils carregados por `<script>` antes do
`app.js`/script inline (em `cadastro.html` e `admin.html`):

- **`endereco-cep.js`** (`window.EnderecoCep`): endereço **estruturado** (CEP, logradouro, número,
  bairro, complemento, cidade, UF) com **autofill via ViaCEP** (`viacep.com.br`, direto do
  navegador). `comporEndereco(...)` monta a string única `config.restaurante.endereco` que
  painel/pedido/bot já consomem; os campos estruturados também ficam em `config.restaurante`.
  No painel, endereço legado (só string) é preservado e mostrado como dica até preencher o CEP.
- **`dinheiro.js`** (`window.Dinheiro`): **padrão monetário único** da plataforma. Máscara
  **"centavos primeiro"** (`mascarar(campo)`): digita-se da direita pra esquerda — `1`→`0,01`,
  `1000`→`10,00`, `123456`→`1.234,56`. `valor(campo)` lê o número, `setValor(campo, reais)` grava,
  `formatar(reais)`/`comPrefixo(reais)` exibem em BR (vírgula + ponto de milhar). **Todo campo de
  dinheiro usa isto** (taxa de entrega, preço de item, opcionais) — `type=text inputmode=numeric`,
  nunca `type=number` nem `parseFloat` direto.

## Horário de funcionamento

Estrutura em `config.json` (por tenant):
```json
"horarios": {
  "seg": { "abre": "11:00", "fecha": "22:00", "fechado": false },
  "dom": { "abre": "08:00", "fecha": "14:00", "fechado": true }
}
```

A função `estaAberto(tenantDir)` em `fluxo.js` verifica:

1. Se `config.atendimento.aberto` é `false` → sempre fechado (override manual).
2. Se `horarios` existe → compara dia/hora atual com o range do dia.
3. Se não existe → considera aberto.

Fora do horário, saudações e o "1" (fazer pedido) recebem `config.mensagens.fechado`.

- **Simulador ignora o horário:** `processarMensagem(..., opts)` aceita `{ ignorarHorario: true }`
  (passado pela rota `/api/simulador/mensagem`). O console de testes sempre atende, para testar o
  fluxo a qualquer hora; o **bot real no WhatsApp** (multi-bot, sem `opts`) continua respeitando.
- **Texto `{horario}` automático:** a variável `{horario}` das mensagens é **gerada da tabela**
  por `textoHorario(config)` em `fluxo.js` (mesmo formato do painel), garantindo que o cliente
  receba o horário correto/atualizado. No painel, o campo "Horário (texto exibido ao cliente)" é
  **read-only** e atualiza ao vivo conforme a tabela (sem botão "gerar").
- **Badge do header segue o horário real:** `lojaAbertaAgora(config)` (em `app.js`, espelha o
  `estaAberto`) — fica "Fechado" mesmo com o toggle ligado se estiver fora do horário. O toggle
  "Status do Atendimento" continua sendo só o override manual.

O painel mostra a tabela de horários na aba **Configurações**.

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
`cardapio` são os antigos `config.json`/`cardapio.json`.

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

## Pontos de atenção (gotchas)

- **Mensagens em tempo real (anti-massa)**: ao conectar, o Baileys entrega o histórico/sync.
  O bot SÓ processa mensagens com `type === 'notify'` (recebidas ao vivo), ignorando
  `'append'` (histórico). NÃO remover esse filtro em `multi-bot.js` — é o que evita responder
  a conversas antigas em massa (equivale ao antigo filtro de timestamp do whatsapp-web.js).
- **Conexão manual**: `index.js` não chama `multiBot.iniciar()`. A conexão é disparada
  pelo painel (`POST /api/bot/conectar`). Reconexão controlada via `connection.update`:
  `restartRequired` (normal pós-QR) reconecta; `loggedOut` (401) para e marca desligado;
  teto de tentativas para não martelar o WhatsApp. No `connection: open`, o número conectado
  (`sock.user.id` → `jidDecode`) é guardado e exposto por `getEstado` como `numero`; o painel
  o exibe no estado "conectado" da aba Conexão.
- **Memória por tenant**: sem Chromium — cada tenant é só uma conexão WebSocket (Baileys),
  consumo de RAM baixíssimo. A máquina de 1 GB no Fly.io suporta muito mais tenants do que
  os ~3–4 da era Chromium/Puppeteer.
- **Sessão WhatsApp**: persistida na tabela `wa_auth` (Postgres), por slug — adapter
  `usePostgresAuthState` em `src/wa-auth.js` (substitui o `useMultiFileAuthState`). Reset =
  `multiBot.resetarSessao` → apaga as linhas do tenant (novo QR). Creds/chaves serializadas
  com `BufferJSON`. NÃO há mais pasta `baileys-*/` em disco.
  - **Escala/volume:** uma conexão gera ~50 linhas minúsculas (≈20 KB): `pre-key` (~30,
    **bounded** — repostas conforme consumidas), `app-state-sync-key`, `creds`, e 1 `session:`
    por cliente atendido. PK `(slug, chave)` + **UPSERT** (`ON CONFLICT DO UPDATE`): **reconectar
    NÃO duplica** — o nº de linhas depende do conteúdo da sessão, não de quantas vezes conecta.
    O único crescimento é ~1 `session:` por cliente novo (≈1 KB cada); trivial pro Postgres.
    **Higiene automática:** `limparSessoesAntigas` (em `wa-auth.js`, agendada no `index.js` —
    1x no boot + a cada 24h) apaga `session:*` inativas há +90 dias (coluna `atualizado_em`);
    seguro, pois o Baileys recria a sessão no próximo contato. NÃO toca creds/pre-keys.
  - **Sensível:** essas linhas SÃO a sessão do WhatsApp (quem lê pode sequestrar a conexão).
    Protegidas por RLS + conexão privilegiada do backend; `SERVICE_ROLE_KEY` nunca no front/git.
- **Imagens do cardápio**: no Supabase Storage (bucket público `cardapio`, pasta `{slug}/`).
  O upload (`POST /api/imagem`) sobe pro Storage e o item guarda a URL pública; não há mais
  rota `/imagens` nem arquivos em disco. Bucket criado por `npm run setup-storage`.
- **Avisar cliente**: `POST /api/pedido/avisar` envia, pelo socket do tenant
  (`enviarMensagem(slug, jid, texto)`), uma mensagem de "pedido pronto". Templates editáveis
  em `config.json` → `mensagens.pedidoPronto.entrega`/`.retirada` (variáveis `{cliente}` e
  `{numero}`). Envio **MANUAL**, 1 cliente por clique — nunca automático/massa. Exige WhatsApp
  conectado; normaliza o telefone para `<digitos>@s.whatsapp.net`; grava `avisadoEm` no sucesso.
- **Segurança**: login de restaurante via **Supabase Auth** (senha em bcrypt; sessão é JWT
  stateless, sobrevive a reinício do app). Super-admin segue SHA-256+salt env-based (conta
  única e isolada). HTTPS é responsabilidade do host (no Fly era automático; em VPS depende
  de Nginx + TLS).
- **Primeiro acesso**: a primeira empresa é criada pelo wizard público (`/cadastro.html`) ou
  pelo super-admin (`/admin-master`). Tenant novo nasce limpo (ver `empresas.configInicial`,
  gravado no `config` jsonb).
- **Cache do store (1 instância)**: `store.js` mantém config/cardápio em memória por tenant;
  `setConfig/setCardapio` gravam no Postgres e atualizam o cache. Como é processo único, fica
  coerente; várias instâncias exigiriam invalidação/pub-sub.
- **Pooler do Supabase**: para app sempre-ligado, prefira o **Session pooler (5432)** ao
  Transaction pooler (6543) — `db.js` avisa no boot se detectar 6543.
- **Backup**: **gerenciado 100% pelo Supabase** (point-in-time recovery). Com o app stateless,
  TUDO mora no Supabase — dados em Postgres (`empresas`/`pedidos`/`config`/`cardapio`), sessões
  do WhatsApp em `wa_auth` e imagens no Storage. Não há mais backup do lado do app: o antigo
  `npm run backup`/`scripts/backup.js` (empacotava a `data/` em `.tar.gz`) foi **removido na
  v0.18.0** por ficar obsoleto — não havia mais nada em disco para empacotar.

## Convenções

- Comentários e textos ao usuário em português.
- Formatação WhatsApp: `*negrito*`, `_itálico_`.
- Evitar dependências novas sem necessidade; manter o front-end sem framework.
- Não expor senhas em respostas da API.
- Todo código novo passa `tenantDir` explicitamente — sem estado global de tenant.
- Ao adicionar nova rota à API, usar `exigeAuth` e referenciar `req.tenantDir`.

## Design System (`public/style.css`)

Marca: **Nymbus Lab**. Tema escuro fixo. Fonte: **Plus Jakarta Sans** (Google Fonts), fallback `-apple-system`.
Base: 14px / line-height 1.5.

### Tokens de cor (variáveis CSS)

| Token | Valor | Uso |
| --- | --- | --- |
| `--bg-primary` | `#0F1117` | fundo da página |
| `--bg-surface` | `#1A1D27` | cards, header, nav |
| `--bg-elevated` | `#222533` | inputs, cabeçalho de categoria, hover de linha |
| `--bg-overlay` | `#2A2E3F` | modal, input do simulador |
| `--border` | `#2E3247` | bordas padrão |
| `--border-subtle` | `#242738` | divisórias internas |
| `--text-primary` | `#F0F2FA` | texto principal |
| `--text-secondary` | `#8B92B3` | labels, subtítulos |
| `--text-disabled` | `#4A5068` | placeholders, desabilitado |
| `--accent` | `#6344BC` | roxo — PREENCHIMENTO: botão primário, aba ativa, foco (texto branco em cima) |
| `--accent-hover` | `#7150D0` | hover do botão primário |
| `--accent-fg` | `#A589EA` | roxo CLARO — TEXTO/ÍCONE roxo sobre fundo escuro (preserva contraste) |
| `--accent-subtle` | `rgba(99,68,188,0.16)` | fundo de destaque suave |
| `--secondary` | `#73D2E6` | ciano — acento secundário, links, gradiente de marca |
| `--secondary-hover` | `#5BC2D8` | hover do ciano (texto escuro em cima) |
| `--secondary-subtle` | `rgba(115,210,230,0.14)` | fundo ciano suave |
| `--success` | `#22C55E` | verde — status aberto, tag retirada |
| `--error` | `#EF4444` | vermelho — status fechado, erros |
| `--warning` | `#EAB308` | amarelo — observação no pedido |
| `--info` | `#3B82F6` | azul — tag entrega |

Cada cor semântica tem variante `*-subtle` com `rgba(..., 0.12)` para fundos.

> **Contraste:** `--accent` (#6344BC) só como **preenchimento** (texto branco). Como
> **texto/ícone sobre fundo escuro**, usar sempre `--accent-fg` (#A589EA) — o roxo cheio
> perde contraste no escuro. No `style.css`, os 3 pontos que usam `--accent` como cor de
> texto passam a `--accent-fg`: `nav button.ativo`, `.btn-ver-pedido` e a pill do simulador.
>
> **Tags de status são semânticas, nunca de marca:** Entrega = `--info` (azul),
> Retirada = `--success` (verde). Sem laranja em lugar nenhum.
>
> Referência completa de UI por tela (o que manter e o que NÃO construir): **`design/UI.md`**.

### Tokens de forma e sombra

| Token | Valor |
| --- | --- |
| `--radius-sm` | `6px` |
| `--radius` | `10px` |
| `--radius-lg` | `14px` |
| `--radius-xl` | `18px` |
| `--shadow-sm` | sombra discreta (cards) |
| `--shadow-md` | sombra média (login card, toast) |
| `--shadow-lg` | sombra forte (modal) |

### Componentes

| Classe | Descrição |
| --- | --- |
| `button` | botão primário roxo (padrão) |
| `button.secundario` | botão outline neutro |
| `button.perigo` | botão destructivo (vermelho, sem fundo) |
| `button.mini` | botão menor (padding reduzido) |
| `card` | container surface com borda e sombra |
| `campo` | wrapper de campo de formulário com label uppercase |
| `linha` | flex row para campos lado a lado |
| `barra-salvar` | barra sticky inferior para ações de salvar |
| `tag` | pill de status inline (`tag-entrega` = azul/info · `tag-retirada` = verde/success) |
| `badge-atendimento` | pill do header (`.aberto` verde / `.fechado` vermelho) |
| `nav-badge` | contador roxo na aba do nav |
| `bolinha` | dot de status (`.on` verde / `.off` vermelho / `.wait` amarelo) |
| `estado-vazio` | bloco centralizado para listas sem itens |
| `toast` | notificação flutuante (`.sucesso` / `.erro`) |
| `.aviso` / `.erro` | texto de feedback inline (verde / vermelho) |
| `modal-overlay` + `modal-caixa` | modal de confirmação com animação |
| `sim-wrapper` | container do simulador de chat |
| `sim-bubble-bot` / `sim-bubble-user` | balões do chat (bot esquerda / usuário direita roxo) |

### Tipografia

- `h1` — 15 px, 700, tracking -0.3px (header do painel)
- `h2` — 15 px, 700 (títulos de seção)
- `h3` — 11 px, 700, uppercase, tracking 0.5px, cor secondary (rótulos de seção)
- `.sub` — 13 px, cor secondary (subtítulos)
- Labels de campo — 11 px, 700, uppercase, tracking 0.5px

### Regras ao criar nova UI

- Sempre usar as variáveis CSS — nunca valores hexadecimais fixos no HTML/JS inline.
- Inputs sempre com classe implícita (seletor `input, textarea, select` já estilizado).
- Novos modais seguem o padrão `modal-overlay > modal-caixa` com animação já definida.
- Placeholders usam texto genérico descritivo — sem nomes reais de restaurantes ou pessoas.
- Roxo cheio (`--accent`) só em preenchimento; texto/ícone roxo sobre escuro usa `--accent-fg`.
- Sem laranja: a marca é roxo (`--accent`) + ciano (`--secondary`); status em cores semânticas.
- Antes de redesenhar uma tela, consultar `design/UI.md` (referência visual + o que NÃO construir).

### Padrões de layout reutilizáveis (redesign Nymbus Lab)

Padrões consolidados no redesign do painel. Reaproveitar nas próximas telas — não reinventar.

#### Cabeçalhos

- **Título de tela:** 20px / 700 / tracking -0.3px (`.cardapio-titulo`, `.cfg-titulo`, `.sim-titulo`, `.conexao-titulo`). Seguido de `.sub` (subtítulo).
- **Cabeçalho de seção:** ícone `--accent-fg` (18–20px) + `h3` 16px/700 (`.cfg-secao-cabeca`). Diferente do `h3` legado (11px uppercase) — usar este nas telas redesenhadas.
- **Cabeçalho de ação:** título à esquerda + botões à direita, `flex-wrap`, empilha no mobile (`.cardapio-topo`, `.sim-topo`).

#### Componentes do redesign

- **Faixa de métricas:** `.metrica-card` (label + ícone no topo, número grande embaixo). Grids: cardápio `repeat(3,1fr)`, pedidos `1.6fr 1fr 1fr` (1º card domina).
- **Switch (toggle):** `.switch > input[type=checkbox]` — 40×22px, roxo quando on. Para status/flags (atendimento, fechado por dia). Não confundir com `.toggle .itDisp` (toggle do cardápio).
- **Pills removíveis:** `.pag-pill` (texto + ×) + botão tracejado `.pag-add` "Adicionar" com input inline. Para listas editáveis (formas de pagamento).
- **Moldura gradiente:** `padding:4px; background: linear-gradient(135deg, var(--accent), var(--secondary))` envolvendo conteúdo (QR da Conexão).
- **Painel lateral de leitura:** card com título uppercase + linhas label/valor (`.sim-ctx-*`) — para dados de contexto reais.

#### Grid responsivo de cards

- **3 col > 1024px · 2 col ≤ 1024px · 1 col ≤ 640px** (cardápio). No mobile, esconder a foto e empilhar.

#### Espaçamentos

- Entre seções: **22–26px** de `margin-bottom`. Gap de grid: **16px**. Padding de card: **16–24px**. Gap interno de form: o do `.campo`.
- Barra de salvar sticky: `.barra-salvar` (pode levar "Descartar" + "Salvar" e um aviso, ver `.cfg-barra`).

#### Breakpoints oficiais

- **1024px** (tablet — cards caem para 2 col) e **640px** (mobile — sidebar vira bottom-nav, grids 1 col, tabelas viram cards por linha com `data-label`).
- No mobile, a `.sidebar` é `position:fixed; bottom:0; top:auto` (o `top:auto` é obrigatório — sem ele a barra estica pela tela toda).
