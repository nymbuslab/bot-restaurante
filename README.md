# 🍴 Nymbus Pedidos — Bot de Pedidos no WhatsApp + Painel

Plataforma **SaaS multi-tenant** da **Nymbus Lab**: qualquer restaurante se cadastra, configura
o cardápio e começa a receber pedidos pelo WhatsApp de forma automatizada. Cada empresa tem seu
próprio ambiente isolado — cardápio, configurações, pedidos e conexão WhatsApp separados.

**Modelo de negócio (pago):** cadastro grátis → **teste grátis de 7 dias com cartão** →
**R$ 79/mês** via **Stripe**. Sem pagar / em atraso, o painel trava na aba **Assinatura** e o bot
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
- **Configurações** (sub-abas **Empresa** e **Bot**): dados do restaurante, **conta de acesso**
  (trocar e-mail/senha), mensagens, horário por dia, taxa de entrega, formas de pagamento,
  abrir/fechar manualmente; **Privacidade e dados** (exportar/excluir conta — LGPD).
- **Assinatura**: status do plano, dias de trial, próxima cobrança, faturas (Stripe) e cartões.
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

# Super-admin (/admin-master) — sem isto as rotas /api/admin/* ficam off (503)
SUPERADMIN_EMAIL=...
SUPERADMIN_SENHA_HASH=...        # gere com: npm run gerar-hash-admin -- "suaSenha"  (bcrypt)

# Stripe (assinatura paga)
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_PRICE_ID=...
STRIPE_WEBHOOK_SECRET=...

# Plataforma (opcional)
SUPORTE_WHATSAPP=...             # WhatsApp de suporte (só dígitos, ex.: 5511999999999)
```

```bash
npm install
npx supabase db push     # aplica o schema (supabase/migrations/) no seu projeto
npm run setup-storage    # cria o bucket público de imagens (uma vez)
npm start
```

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

# 4. Configurar os secrets (os mesmos do .env: Supabase + super-admin + Stripe)
fly secrets set DATABASE_URL="..." SUPABASE_URL="..." SUPABASE_ANON_KEY="..." \
  SUPABASE_SERVICE_ROLE_KEY="..." SUPERADMIN_EMAIL="..." SUPERADMIN_SENHA_HASH="..." \
  STRIPE_SECRET_KEY="..." STRIPE_PUBLISHABLE_KEY="..." STRIPE_PRICE_ID="..." STRIPE_WEBHOOK_SECRET="..."

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

## 🧪 Testes

**Testes automatizados** — runner nativo `node:test` (sem dependência nova), cobrindo a lógica
pura crítica (validação de payload, magic bytes do upload, hash master bcrypt + legado, slug).
Usam env dummy → rodam **sem segredos** (e no CI a cada push, via `.github/workflows/test.yml`):

```bash
npm test        # suíte de testes
npm run check   # varredura de sintaxe (node --check) em src/, scripts/ e index.js
```

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
├── package.json              → scripts: start, test, check, setup-storage, gerar-hash-admin
├── testar-bot.js             → simulador de conversa no terminal
├── Dockerfile, fly.toml      → deploy no Fly.io (Node 22, stateless, sem volume)
├── .github/workflows/        → CI: test.yml (npm run check + npm test a cada push)
├── test/                     → testes (node:test): validacao + seguranca
├── supabase/
│   ├── config.toml
│   └── migrations/           → schema do banco (npx supabase db push)
├── scripts/
│   ├── setup-storage.js      → cria o bucket de imagens (npm run setup-storage)
│   ├── gerar-hash.js         → gera o hash bcrypt da senha master
│   └── check-syntax.js       → varredura de sintaxe (npm run check)
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
