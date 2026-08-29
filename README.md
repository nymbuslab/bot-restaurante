# 🍴 Nymbus Pedidos — Sistema de gestão para restaurantes

Plataforma **SaaS multi-tenant** da **Nymbus Lab**: o restaurante se cadastra, monta o cardápio e
passa a gerir a operação num lugar só (pedidos, PDV, caixa, mesas e cardápio), sem comissão por
pedido. O **WhatsApp é um canal de entrada**: o bot manda o link do cardápio e o cliente monta o
pedido na web. Cada empresa tem seu próprio ambiente isolado: cardápio, configurações, pedidos e
conexão WhatsApp separados.

**Modelo de negócio (pago):** cadastro grátis → **teste grátis de 7 dias com cartão** → dois planos
via **Stripe**: **Essencial R$ 79/mês** e **Completo R$ 99/mês** (o Completo adiciona **frete por
raio** por km). Sem pagar / em atraso, o painel trava na aba **Assinatura** e o bot
desconecta (o login segue funcionando para reativar). A gestão de todos os tenants é feita pelo
super-admin (`/admin-master`).

> Documentos do projeto: **PRD.md** (requisitos), **CLAUDE.md** (guia técnico),
> **DEPLOY.md** (produção) e **ROADMAP.md** (direção).

## ✨ O que ele faz

**Atendimento (bot):**

- Saúda o cliente e mostra um **menu enxuto**: *1 · Fazer pedido* · *2 · Falar com atendente*.
  Reconhece quem já pediu antes e cumprimenta pelo nome ("Bem-vindo de novo, Fulano").
- **Fazer pedido** → envia o **link do cardápio digital** (`/c/:slug`), onde o cliente monta o
  pedido (itens, opcionais, observação, entrega, endereço e pagamento) e finaliza na web; o
  pedido cai no painel e o bot **confirma** automaticamente pelo WhatsApp.
- Navegação simples: `menu`/`voltar` volta ao início, `atendente` chama um humano, `sair` encerra.
- Respeita **horário de funcionamento** configurável por dia da semana — responde
  automaticamente "fechado" fora do horário.
- **Só responde a mensagens recebidas após a conexão** (não dispara em massa).

**Painel do restaurante:**

- **Conexão**: conectar/desconectar o WhatsApp; gerar novo QR se travar.
- **Cardápio**: itens, preços, ativar/desativar, composição e opcionais — valem na hora.
- **Pedidos**: métricas por período + lista com itens, opcionais, observação, total, entrega e
  telefone; **exportar CSV** dos pedidos filtrados.
- **Configurações** (sub-abas **Empresa**, **Bot** e **Entrega**): dados do restaurante, **conta de
  acesso** (trocar e-mail/senha), mensagens, horário por dia, formas de pagamento, abrir/fechar
  manualmente; **Privacidade e dados** (exportar/excluir conta — LGPD). Em **Entrega**: **frete
  fixo** ou **frete por raio** (faixas por km — Plano Completo).
- **Assinatura**: status do plano (Essencial/Completo), dias de trial, próxima cobrança, faturas
  (Stripe), cartões e **upgrade/downgrade** de plano.
- **Prévia do atendimento**: vê a mensagem que o cliente recebe e testa o atalho de atendente
  direto no navegador, sem usar um número real.

**Painel master (super-admin):** dashboard com métricas de billing, gestão de tenants
(criar / suspender / reativar / excluir, cortesia) e **Configurações Master** (dados da plataforma).

## 📦 Como rodar

Pré-requisito: **Node.js 22+** (o `supabase-js` exige WebSocket nativo — no Node 20 o app **não
sobe**) e um projeto **Supabase** (Postgres + Auth).

Crie um `.env` a partir do **`.env.example`** (lista completa e comentada). O mínimo para subir é
o bloco do Supabase; o super-admin e a assinatura exigem os demais:

```bash
# Supabase (obrigatório)
DATABASE_URL=...                 # Settings → Database (prefira Session pooler, porta 5432)
SUPABASE_URL=...                 # Settings → API
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...    # secreto, só backend

# Super-admin (/admin-master): e-mail do master (allowlist). O master é um usuário do
# Supabase Auth — a senha vive lá. Sem esta env, /api/admin/* fica off (503).
SUPERADMIN_EMAIL=...

# Stripe (assinatura paga) — STRIPE_PRICE_ID = Essencial, STRIPE_PRICE_ID_COMPLETO = Completo
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_PRICE_ID=...
STRIPE_PRICE_ID_COMPLETO=...
STRIPE_WEBHOOK_SECRET=...

# Frete por raio (Plano Completo) — geocodificação Geoapify (free ~3.000/dia)
GEOAPIFY_API_KEY=...

# Plataforma (opcional)
SUPORTE_WHATSAPP=...             # WhatsApp de suporte (só dígitos, ex.: 5511999999999)
```

```bash
npm install
git config core.hooksPath .githooks   # liga o guarda de pre-push (uma vez por clone)
npx supabase db push     # aplica o schema (supabase/migrations/) no seu projeto
npm run setup-storage    # cria o bucket público de imagens (uma vez)
npm start
```

> O `core.hooksPath` faz o `git push` rodar a suíte antes de subir, na mesma condição do CI.
> O Git não versiona hooks, então **cada clone precisa desse comando uma vez**. Detalhe em
> [🧪 Testes e CI](#-testes-e-ci).

Abra o painel na porta configurada (`PORT` no `.env`, padrão 3000).

**Primeiro acesso:** acesse `/cadastro.html` e crie a primeira empresa (nome, e-mail e
senha). O tenant nasce limpo e o login é feito automaticamente. A conta é criada no
**Supabase Auth** (senha em bcrypt).

**Novo restaurante:** mesma página `/cadastro.html`, ou crie pelo super-admin em
`/admin-master`.

### Conectar ao WhatsApp

O bot **não conecta sozinho**. Após o login, vá na aba **Conexão** e clique em
**"Conectar ao WhatsApp"** para escanear o QR (WhatsApp → Aparelhos conectados →
Conectar um aparelho). Use um **número dedicado** do restaurante.

> Se o QR ficar travado, clique em **"Gerar novo QR (limpar sessão)"**.

## 🚀 Deploy no Fly.io (produção)

### Pré-requisitos (uma vez só)

1. Conta em [fly.io](https://fly.io)
2. `flyctl` instalado:

```powershell
# Windows
powershell -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://fly.io/install.ps1'))"
```

1. Adicionar ao PATH (se `fly` não for reconhecido):

```powershell
$env:PATH += ";$env:USERPROFILE\.fly\bin"
# Permanente:
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";$env:USERPROFILE\.fly\bin", "User")
```

---

### Primeiro deploy

```bash
# 1. Login
fly auth login

# 2. Criar o app (na pasta do projeto)
fly launch --no-deploy
# Nome do app, região: gru (São Paulo). Quando perguntar "Overwrite fly.toml?" → N

# 3. Editar fly.toml: troque app = "bot-restaurante" pelo nome escolhido

# 4. Configurar os secrets (os mesmos do .env: Supabase + super-admin + Stripe + Geoapify)
fly secrets set DATABASE_URL="..." SUPABASE_URL="..." SUPABASE_ANON_KEY="..." \
  SUPABASE_SERVICE_ROLE_KEY="..." SUPERADMIN_EMAIL="..." \
  STRIPE_SECRET_KEY="..." STRIPE_PUBLISHABLE_KEY="..." STRIPE_PRICE_ID="..." \
  STRIPE_PRICE_ID_COMPLETO="..." STRIPE_WEBHOOK_SECRET="..." GEOAPIFY_API_KEY="..."

# 5. Deploy (app stateless — NÃO precisa de volume persistente)
fly deploy
# Build rápido (sem Chromium e sem módulo nativo)

# 6. Abrir o painel
fly open
```

> **App stateless:** nada é gravado em disco (sessões no Postgres, imagens no Storage),
> então **não é preciso criar volume**. Pode rodar em múltiplas instâncias / hosts efêmeros.
> Se o `fly.toml` ainda tiver um `[[mounts]]`, é resíduo e pode ser removido.

Com o painel no ar, crie a primeira empresa em `/cadastro.html` (ou pelo super-admin em
`/admin-master`). Acompanhe os logs com:

```bash
fly logs
```

---

### Atualizar o projeto

Sempre que fizer mudanças no código:

```bash
fly deploy
```

Tudo (dados, sessões do WhatsApp e imagens) fica no Supabase — o deploy é stateless, então
o bot reconecta sem re-escanear o QR mesmo trocando de máquina.

---

### Comandos úteis

```bash
fly logs              # logs em tempo real
fly status            # status da máquina
fly open              # abrir o painel no navegador
fly ssh console       # terminal dentro do container
fly deploy            # publicar nova versão
```

---

### Se o QR travar ou a sessão invalidar

No painel → aba **Conexão** → **Gerar novo QR (limpar sessão)**. Isso apaga as linhas da
sessão do tenant na tabela `wa_auth` (Postgres) e gera um QR novo — não há nada em disco.

---

## 🧪 Testes e CI

**Testes automatizados** — runner nativo `node:test` (sem dependência nova), cobrindo a lógica
pura crítica (validação de payload, magic bytes do upload, sessão/segurança, slug, planos,
frete, estoque, pagamentos). Usam env dummy → rodam **sem segredos**, aqui e no CI:

```bash
npm test        # suíte de testes
npm run check   # varredura de sintaxe (node --check) em src/, scripts/, public/, test/ e index.js
npm run test:ci # a suíte na condição EXATA do runner do GitHub (ver abaixo)
npm run test:integracao # bateria contra banco REAL (exige .env.test — ver abaixo)
```

### Bateria de integração (banco de verdade)

O `npm test` cobre lógica pura e não toca banco. O `npm run test:integracao` faz o oposto: sobe
o servidor numa porta livre, cria empresas reais e conversa por HTTP contra um **Postgres de
verdade**. Hoje cobre o **isolamento entre empresas** (o token de um restaurante não alcança o
dado de outro), o **recálculo de preço do cardápio web** (o preço mandado pelo navegador é
ignorado), **Caixa**, **PDV**, **Mesas** e o cruzamento em que o caixa não fecha com mesa aberta.

Ela **nunca** roda contra produção. O banco vem de um projeto Supabase separado e descartável:

1. Crie um projeto novo no Supabase (plano grátis serve).
2. Copie o `.env.test.example` para `.env.test` e preencha com as credenciais dele.
3. Aplique o schema: `npx supabase db push --db-url <a DATABASE_URL do .env.test>`.

No GitHub Actions, a mesma bateria roda na `main` e também pode ser disparada manualmente em
**Actions → testes → Run workflow**. O runner não usa `.env.test`; ele recebe estes secrets do
repositório:

- `INTEGRACAO_DATABASE_URL` — string do Supabase de teste, de preferência Session pooler.
- `INTEGRACAO_SUPABASE_URL`
- `INTEGRACAO_SUPABASE_ANON_KEY`
- `INTEGRACAO_SUPABASE_SERVICE_ROLE_KEY`

Duas travas impedem o acidente, e as duas precisam passar: a marca `BANCO_DE_TESTE=1` no
`.env.test`, e a comparação com o `.env` — se for o mesmo projeto Supabase, a bateria aborta
antes do primeiro caso. Os testes criam e **apagam** empresas, então contra produção isso seria
perda de dado real, não erro de teste.

Projeto grátis do Supabase hiberna após ~7 dias sem uso: se a bateria falhar com erro de
conexão, restaure o projeto pelo painel antes de investigar o código.

### ⚠️ Em máquina nova, ligue o hook (uma vez só)

```bash
git config core.hooksPath .githooks
```

Sem esse comando o `git push` não tem guarda nenhuma, e a falha só aparece no GitHub. O Git não
versiona hooks, então **cada clone precisa rodar isso uma vez**. Para desligar:
`git config --unset core.hooksPath`.

**O que o hook faz:** antes de deixar o push subir, roda `npm run test:ci` e recusa se falhar.

**Por que `test:ci` existe, e não basta o `npm test`:** todo módulo que precisa de credencial
chama `require("dotenv").config()`, que lê o `.env` **da pasta atual**. Na sua máquina o `.env`
está lá e as chaves aparecem; no runner do GitHub não existe `.env`, e o módulo lança no
`require` — o arquivo de teste inteiro morre antes do primeiro caso. Resultado: **suíte verde no
notebook e vermelha no GitHub**. O `test:ci` roda a partir de uma pasta vazia, então o `dotenv`
não acha nada para repor e o resultado é o mesmo de lá.

Isso não é hipótese: entre 21 e 25/08/2026 o CI ficou vermelho por 32 execuções seguidas
exatamente assim, com testes de revogação de sessão fora do ar sem ninguém notar.

**Teste novo que importa módulo com credencial** (`src/empresas`, `src/supabase`) precisa do
preâmbulo de env dummy no topo do arquivo. Modelo pronto: as primeiras linhas de
`test/seguranca.test.js`.

### Quando o CI quebra

Além do e-mail do GitHub, o workflow **abre uma issue** no repositório com o commit, a mensagem
e o link da execução, e **fecha sozinho** quando a `main` volta ao verde. Uma issue só, marcada
com o rótulo `ci-vermelho`: quebras em sequência viram comentário nela, em vez de encher o
repositório. Só vale para a `main`; PR e outros branches não abrem issue.

Ao investigar, rode `npm run test:ci` antes de qualquer coisa — é o comando que reproduz a falha
localmente, enquanto o `npm test` normal pode dizer que está tudo bem.

**Simulador de conversa** — testa o fluxo completo do bot no terminal, sem WhatsApp:

```bash
node testar-bot.js
```

**Comandos especiais:**

| Comando   | O que faz                                  |
|-----------|--------------------------------------------|
| `/reset`  | Reinicia a sessão (simula novo cliente)    |
| `/status` | Exibe o estado interno da sessão em JSON   |
| `/quit`   | Encerra o simulador                        |

**Fluxo de teste:**

```text
oi          → saudação + menu (1 · Fazer pedido  ·  2 · Falar com atendente)
1           → envia o link do cardápio digital (/c/:slug)
voltar      → volta ao menu (também: menu, 0)
2           → fala com atendente (o bot silencia)
menu        → volta ao atendimento automático
sair        → despedida e encerra a sessão (o próximo "oi" recomeça)
```

> O pedido em si é montado e finalizado no **cardápio web** (`/c/:slug`), não na conversa — lá
> ele é gravado na tabela `pedidos` (Supabase), aparece na aba **Pedidos** e o bot confirma.

## 🗂️ Estrutura

```text
bot-restaurante/
├── index.js                  → sobe o painel + jobs (higiene de sessão, retenção LGPD)
├── package.json              → scripts: start, test, check, setup-storage
├── testar-bot.js             → simulador de conversa no terminal
├── Dockerfile, fly.toml      → deploy no Fly.io (Node 22, stateless, sem volume)
├── .github/workflows/        → CI: test.yml (check + testes a cada push; abre issue se a main quebrar)
├── .githooks/                → pre-push: roda test:ci antes de deixar subir (git config core.hooksPath .githooks)
├── test/                     → testes (node:test): validacao + seguranca
├── supabase/
│   ├── config.toml
│   └── migrations/           → schema do banco (npx supabase db push)
├── scripts/
│   ├── setup-storage.js      → cria o bucket de imagens (npm run setup-storage)
│   ├── check-syntax.js       → varredura de sintaxe (npm run check)
│   └── test-ci.js            → a suite na condicao do runner, sem .env (npm run test:ci)
├── public/                   → painel web (HTML/CSS/JS puro, sem framework)
│   ├── index.html            → landing pública (apresentação + preço)
│   ├── login.html / cadastro.html → login e wizard de onboarding (4 etapas)
│   ├── checkout.html         → checkout próprio (Stripe Elements) do trial
│   ├── admin.html / app.js   → painel do restaurante (inclui aba Assinatura)
│   ├── admin-master.html / app-admin.js → painel super-admin
│   ├── termos.html / privacidade.html   → páginas legais (LGPD)
│   └── footer.js, style.css, dinheiro.js, endereco-cep.js (+ js por página)
└── src/
    ├── db.js                 → pool Postgres (pg)
    ├── supabase.js           → clients do Supabase (Auth + Storage)
    ├── servidor.js           → API REST multi-tenant (Express) + helmet/CSP + rate limit
    ├── empresas.js           → tenants na tabela `empresas` + Supabase Auth
    ├── plataforma.js         → dados globais da plataforma + credenciais master
    ├── stripe.js             → assinatura (Stripe): checkout, webhook, faturas, cartões
    ├── validacao.js          → validações puras (payload jsonb, magic bytes) — testável
    ├── wa-auth.js            → sessão Baileys no Postgres (stateless)
    ├── multi-bot.js          → gerencia um socket WhatsApp (Baileys) por tenant
    ├── fluxo.js              → máquina de estados do atendimento
    ├── store.js              → config/cardápio (jsonb) com cache em memória
    ├── pedidos.js            → tabela `pedidos` no Postgres, por empresa_id
    └── sessoes.js            → estado de conversa por cliente (memória, 30min)

App stateless: nada é gravado em disco (sessões no Postgres, imagens no Storage).
```

## ✏️ Como configurar o cardápio

Na aba **Cardápio**, os itens aparecem em **cards** (com foto, preço e disponibilidade).
Clique em **Editar** (ou **+ Adicionar item**) para abrir o **editor**, onde você define:

- **Nome, preço, categoria, descrição** e uma **foto** (upload no painel).
- **Composição** — construtor visual: subgrupos (ex.: "Principal") com ingredientes em
  forma de chips (adicionar/remover sem digitar formato).
- **Opcionais** — linhas com Nome + Preço (ex.: Bacon + R$ 3,50), adicionar/remover.
- **Variações** — opções com **preço e estoque próprios** (ex.: "Refrigerantes 350ml" com vários
  sabores). O cliente escolhe uma ou várias, o preço **soma** e o card mostra **"a partir de R$ X"**;
  cada variação dá **baixa no próprio estoque**. Com variações, o preço base do item pode ser 0.
- Botão **on/off** de disponibilidade por item: desative quando algo acaba no dia.

> Internamente, composição e opcionais são salvos em texto (`Sub:\n* item` e `Nome | preço`)
> — o construtor visual só facilita a edição. Esses campos alimentam o **cardápio web**
> (`/c/:slug`), onde o cliente monta o pedido (itens, opcionais, observação).

## ⚠️ Avisos

- Biblioteca **não-oficial** (Baileys, conexão via WebSocket): leve e estável para começar.
  Para produção séria / alto volume, considere a **API Oficial (WhatsApp Cloud API)** —
  ver `ROADMAP.md`.
- Sem Chromium: cada tenant é só uma conexão WebSocket, consumo de RAM baixo (a produção roda
  numa máquina de **512 MB** no Fly.io e ainda sobra; a versão antiga com Chromium mal segurava
  ~3–4 tenants).
- **Segurança**: login via **Supabase Auth** (senha em bcrypt, sessão JWT); painel com **CSP +
  cabeçalhos (helmet)** e **rate limit** nas rotas de login/cadastro. HTTPS depende do host — no
  Fly **é automático** (`.fly.dev` + `force_https`); em **VPS/local** use um proxy com TLS (Nginx +
  Let's Encrypt). O `SUPABASE_SERVICE_ROLE_KEY` é admin total do banco: só backend, nunca no front
  ou no git.
- App **stateless**: nada relevante em disco (sessões no Postgres, imagens no Storage). Não
  versionar o `.env` (já está no `.gitignore`).
