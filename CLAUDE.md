# CLAUDE.md

Guia de contexto para assistentes de IA (Claude Code) e desenvolvedores. Leia antes de
alterar. **Este arquivo é o índice/essencial** — o detalhe de cada assunto fica em `docs/`
(ver a seção final) e é consultado sob demanda. Mantenha-o enxuto (~200 linhas).

## Visão geral

Plataforma **SaaS multi-tenant** de atendimento de restaurantes no WhatsApp, com
**painel web administrativo** por empresa. Cada empresa cadastrada recebe seu próprio
ambiente isolado (cardápio, config, pedidos, sessão WhatsApp). O bot é a **porta de
entrada de pedidos**: na conversa do WhatsApp ele envia o **link do cardápio web**
(`/c/:slug`), onde o cliente monta o pedido (itens, opcionais, observação, entrega,
pagamento) e finaliza; o pedido cai no backend (recalculado lá) e o bot **confirma**
automaticamente. O andamento do pedido é feito por um sistema externo — este projeto
**não** gerencia o ciclo do pedido (preparo/entrega).

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
- `stripe` (assinatura — ver [docs/assinatura-stripe.md](docs/assinatura-stripe.md))
- Front-end em HTML/CSS/JS puro (sem framework)

> **App stateless — NADA é gravado em disco.** Tudo no Supabase: dados em Postgres (`empresas`,
> `pedidos`, `config`/`cardapio` jsonb), contas no Auth, **sessões do WhatsApp** na tabela
> `wa_auth` (adapter `src/wa-auth.js`, no lugar do `useMultiFileAuthState`) e **imagens** no
> Storage. Sem volume persistente; habilita múltiplas instâncias / hosts efêmeros.

> **Histórico:** o projeto usava `whatsapp-web.js` (Puppeteer/Chromium), trocado por Baileys
> por instabilidade (QR parava de gerar; erros `detached Frame`). Baileys é WebSocket, mais
> leve e estável. **Ambos são não-oficiais** — o caminho de produção séria é a WhatsApp Cloud
> API (ver `ROADMAP.md`).

## Como rodar

```bash
npm install
npm start            # inicia o painel (porta de PORT no .env, ex.: 3001)
```

**Requer `.env`** (ver `.env.example`) com as credenciais do Supabase — sem elas o app não sobe:

```
DATABASE_URL=...                 # Postgres (Settings → Database; prefira Session pooler 5432)
SUPABASE_URL=...                 # Settings → API
SUPABASE_ANON_KEY=...            # anon public
SUPABASE_SERVICE_ROLE_KEY=...    # service_role (secreto, só backend)
```

Para o **cardápio web** (canal de pedido): `PUBLIC_URL` (URL pública base p/ o bot montar o
link, ex.: `https://pedidos.seudominio.com`) e `CARDAPIO_LINK_SECRET` (assina o token que liga
o pedido ao cliente). **Opcionais** — sem eles o app sobe, mas o bot manda um aviso no lugar do link.

Para **planos e frete por raio**: `STRIPE_PRICE_ID_COMPLETO` (preço do **Plano Completo**, além do
`STRIPE_PRICE_ID` do Essencial) e `GEOAPIFY_API_KEY` (geocodificação do frete por raio). Detalhe em
[docs/planos-e-frete.md](docs/planos-e-frete.md).

Schema: `npx supabase db push` aplica as migrações de `supabase/migrations/`.

No **primeiro acesso**, crie a primeira empresa pelo onboarding público em `/cadastro.html`
(nome, e-mail e senha). O tenant nasce limpo (cardápio vazio, identidade só com o nome).
Depois faça login e, na aba **Conexão**, clique em "Conectar ao WhatsApp".

**Testes:** `npm test` (runner nativo `node:test`, sem dep — testa a lógica pura crítica em
`test/`: validação de payload, magic bytes, hash master bcrypt/legado, slug) e `npm run check`
(varredura de sintaxe). Os testes usam **env dummy** → rodam sem segredos (e no CI, ver
`.github/workflows/test.yml`). Para integração/fluxo do bot, use o **simulador** (`node testar-bot.js`
ou a aba Simulador). Ver [docs/testar-bot.md](docs/testar-bot.md).

## Arquitetura

```
index.js              -> sobe o servidor (NÃO inicia o bot) + jobs (higiene de sessões, retenção)
src/
  db.js               -> pool Postgres (pg), lê DATABASE_URL do .env
  supabase.js         -> clients do Supabase (Auth admin/anon + Storage)
  stripe.js           -> assinatura (Stripe): SetupIntent/checkout próprio, webhook, portal, faturas, trocaPlano (upgrade/downgrade)
  planos.js           -> mapa PURO de planos (Essencial/Completo): PLANO_INFO + planoDoPrice (price→plano)
  plataforma.js       -> dados globais da plataforma (singleton plataforma_config) + creds master
  servidor.js         -> Express: API REST multi-tenant + serve /public + cardápio web (GET /c/:slug, GET/POST /api/c/:slug, POST /api/c/:slug/frete)
  empresas.js         -> CRUD de tenants na tabela `empresas` + Supabase Auth (cadastro/login)
  wa-auth.js          -> sessão Baileys persistida no Postgres (tabela wa_auth) — stateless
  multi-bot.js        -> gerencia um socket WhatsApp (Baileys) por tenant (Map slug→socket)
  fluxo.js            -> bot: saudação envia o LINK do cardápio web (/c/:slug?p=token); estados MENU/ATENDENTE
  cardapio-web.js     -> helpers PUROS do cardápio web (projeção whitelist, recálculo do pedido, token HMAC do link)
  frete.js            -> frete por raio (Plano Completo): Haversine + faixas (puros) + geocodificar() Geoapify c/ cache (tabela geo_cache)
  cep.js              -> busca de CEP (ViaCEP) com cache no banco (tabela ceps)
  store.js            -> config/cardápio (jsonb) com cache em memória; ensure() async
  sessoes.js          -> estado da conversa por cliente (em memória, expira em 30min)
  pedidos.js          -> tabela `pedidos` no Postgres, isolada por empresa_id (async)
public/
  index.html          -> landing (apresentação + preço + CTAs) · footer institucional (footer.js)
  login.html          -> login (e-mail + senha; roteia restaurante x master)
  cadastro.html       -> wizard de onboarding (4 etapas): cria empresa + configura
  checkout.html       -> checkout próprio (Stripe Elements) p/ ativar o trial com cartão
  admin.html          -> painel administrativo (inclui aba Assinatura + gate)
  admin-master.html   -> painel super-admin (gestão de tenants + assinatura + Config Master)
  termos.html / privacidade.html -> páginas legais (LGPD); identidade injetada de /api/plataforma/publico
  app.js, app-admin.js, footer.js, style.css -> lógica dos painéis, footer e estilos
  endereco-cep.js     -> util: máscara/busca de CEP (ViaCEP) + composição de endereço
  dinheiro.js         -> util: máscara monetária (centavos primeiro) + formatação BR
  cardapio.html/.js/.css -> cardápio web público (/c/:slug): monta o pedido (carrinho/checkout) e envia ao backend
supabase/migrations/  -> schema versionado (npx supabase db push)
scripts/setup-storage.js -> cria o bucket público de imagens (npm run setup-storage)
```

**Fluxo de dados:** painel edita config/cardápio via API → `store.setConfig/setCardapio` grava
no Postgres e atualiza o cache em memória (processo único) → `fluxo.js` lê do cache no próximo
atendimento, **sem reiniciar**. Cache por processo → múltiplas instâncias exigiriam invalidação/
pub-sub (hoje é instância única). O `tenantDir(slug)` segue como **chave** do tenant (basename é
o slug); nenhum arquivo é lido/gravado nesse caminho.

**Fluxo do pedido (cardápio web):** bot manda `/c/:slug?p=<token>` → a página busca `GET /api/c/:slug`
(projeção whitelist do cardápio) → o cliente monta o carrinho e faz `POST /api/c/:slug/pedido` → o
servidor **recalcula** preço/total a partir do cardápio (nunca confia no cliente), salva via
`pedidos.salvarPedido` e o bot **confirma** pelo WhatsApp (o `token` liga ao `chatId`; fallback no
telefone). Detalhe em [docs/modelo-dados.md](docs/modelo-dados.md).

## Multi-tenant

Cada empresa tem **slug** único gerado do nome (chave em tudo: linha `empresas`, `empresa_id`
dos pedidos, `wa_auth` da sessão, pasta de imagens no Storage), **linha em `empresas`** (Postgres,
`config`/`cardapio` jsonb, ligada ao usuário do Auth por `user_id`), **sessão WhatsApp** em
`wa_auth` e **imagens** no Storage (`cardapio/{slug}/`). Nada em disco.

Autenticação: `POST /api/login { email, senha }` → `{ token, slug, nome }`, onde `token` é o
**JWT do Supabase Auth** (viaja em `Authorization: Bearer ...`). O middleware `exigeAuth` (async)
valida o JWT **localmente** (`empresas.resolverPorToken` → `jose.jwtVerify` com o JWKS público;
fallback para `getUser` em erro), checa `ativo` a cada request (suspensão é imediata) e resolve
`req.slug` / `req.tenantDir`. JWT é stateless → logout é só descartar o token no cliente.

- **Conta de acesso, Privacidade/LGPD (exportar/excluir, retenção, Termos/Privacidade):** ver
  [docs/lgpd-e-conta.md](docs/lgpd-e-conta.md).
- **Super-admin (painel master, métricas, suspender/excluir, Config Master):** ver
  [docs/super-admin.md](docs/super-admin.md).
- **Assinatura (Stripe):** ver [docs/assinatura-stripe.md](docs/assinatura-stripe.md).

## Convenções

- Comentários e textos ao usuário em português.
- Formatação WhatsApp: `*negrito*`, `_itálico_`.
- Evitar dependências novas sem necessidade; manter o front-end sem framework.
- Não expor senhas em respostas da API.
- Todo código novo passa `tenantDir` explicitamente — sem estado global de tenant.
- Ao adicionar nova rota à API, usar `exigeAuth` e referenciar `req.tenantDir`.
- **Campo de dinheiro** sempre via `dinheiro.js` (centavos primeiro); **endereço** via `endereco-cep.js`.
- **CSP estrita (helmet):** todo JS do front é **externo** — **nunca** adicionar `<script>` inline nem
  handler inline (`onclick=`, `onsubmit=`) no HTML (a CSP bloqueia; usar `addEventListener` em `.js`).
  Origem externa nova (CDN/API) exige liberar a diretiva correspondente no `helmet` de `src/servidor.js`.
  Rotas de autenticação/cadastro têm **rate limit** (`express-rate-limit`); `trust proxy` ligado (Fly).

## Documentação detalhada (`docs/`)

O detalhe profundo de cada assunto vive em `docs/` (não carregado por padrão — leia o arquivo
relevante ao mexer na área):

- [docs/super-admin.md](docs/super-admin.md) — painel master: auth isolada, rotas, métricas, suspender/excluir (reflexo no Stripe), Configurações Master, footer da landing.
- [docs/assinatura-stripe.md](docs/assinatura-stripe.md) — monetização: **dois planos** (Essencial/Completo), eixos de acesso, checkout próprio, webhook, gate, upgrade/downgrade (proration), faturas, gestão de cartões.
- [docs/planos-e-frete.md](docs/planos-e-frete.md) — **planos (Essencial × Completo) + frete por raio**: gating por plano (`temFreteRaio`), aba Entrega, Geoapify/Haversine/faixas, escolha no checkout + upgrade na Assinatura + troca no master.
- [docs/lgpd-e-conta.md](docs/lgpd-e-conta.md) — conta de acesso (trocar e-mail/senha) + LGPD (exportar/excluir conta, retenção, páginas Termos/Privacidade, aceite no cadastro).
- [docs/modelo-dados.md](docs/modelo-dados.md) — schema (`empresas` + coluna `plano`, `pedidos`, item do cardápio, `config.frete`, `geo_cache`) + **cardápio web** (API pública, recálculo no servidor, frete por raio, token de link) + estados enxutos do bot (`fluxo.js`).
- [docs/features.md](docs/features.md) — onboarding (wizard 4 etapas), utils de formulário (`endereco-cep.js`/`dinheiro.js`) e horário de funcionamento.
- [docs/gotchas.md](docs/gotchas.md) — pontos de atenção: anti-massa, conexão manual, sessão `wa_auth`, avisar cliente, segurança, backup, pooler.
- [docs/testar-bot.md](docs/testar-bot.md) — simulador de conversa (terminal + painel).
- [docs/design-system.md](docs/design-system.md) — tokens de cor/forma, componentes, tipografia, padrões de layout. (Referência visual por tela: `design/UI.md`.)
