# 🍴 Bot de Pedidos para Restaurante (WhatsApp) + Painel

Plataforma **SaaS multi-tenant**: qualquer restaurante se cadastra, configura o cardápio
e começa a receber pedidos pelo WhatsApp de forma automatizada. Cada empresa tem seu
próprio ambiente isolado — cardápio, configurações, pedidos e conexão WhatsApp separados.

> Documentos do projeto: **PRD.md** (requisitos), **CLAUDE.md** (guia técnico),
> **DEPLOY.md** (como colocar em produção).

## ✨ O que ele faz

**Atendimento (bot):**

- Mostra categorias e itens do cardápio; monta o pedido pelo WhatsApp.
- Por item: composição, **opcionais** com preço, **observação** e quantidade.
- Pergunta **"deseja adicionar bebida?"** automaticamente (se houver categoria de bebidas).
- Coleta nome, entrega/retirada, endereço e forma de pagamento; confirma e registra.
- Respeita **horário de funcionamento** configurável por dia da semana — responde
  automaticamente "fechado" fora do horário.
- **Só responde a mensagens recebidas após a conexão** (não dispara em massa).

**Painel:**

- **Conexão**: conectar/desconectar o WhatsApp; gerar novo QR se travar.
- **Cardápio**: itens, preços, ativar/desativar, composição e opcionais — valem na hora.
- **Configurações**: dados do restaurante, mensagens, horário por dia, taxa de entrega,
  formas de pagamento, abrir/fechar manualmente.
- **Pedidos**: lista com itens, opcionais, observação, total, entrega e telefone.
- **Simulador**: testa o fluxo completo do bot direto no navegador, sem WhatsApp.

## 📦 Como rodar

Pré-requisito: **Node.js 20+** e um projeto **Supabase** (Postgres + Auth).

Crie um `.env` (ver `.env.example`) com as credenciais do Supabase:

```
DATABASE_URL=...                 # Settings → Database (prefira Session pooler, porta 5432)
SUPABASE_URL=...                 # Settings → API
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...    # secreto, só backend
```

```bash
npm install
npx supabase db push   # aplica o schema (supabase/migrations/) no seu projeto
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

# 4. Criar o volume (só sessões WhatsApp baileys-*/ e imagens; o banco fica no Supabase)
fly volumes create bot_dados --region gru --size 1

# 5. Configurar os secrets do Supabase (banco + auth)
fly secrets set DATABASE_URL="..." SUPABASE_URL="..." SUPABASE_ANON_KEY="..." SUPABASE_SERVICE_ROLE_KEY="..."

# 6. Deploy
fly deploy
# Build rápido (sem Chromium — Baileys não usa browser)

# 7. Abrir o painel
fly open
```

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

As sessões do WhatsApp e imagens ficam no volume — não precisa re-escanear o QR. Os dados
(empresas, pedidos, config, cardápio) ficam no Supabase, independentes do deploy.

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

No painel → aba **Conexão** → **Gerar novo QR (limpar sessão)**.
Ou pelo terminal:

```bash
fly ssh console
rm -rf /app/data/tenants/{slug}/baileys-{slug}
exit
# Depois reconecte pelo painel
```

---

## 🧪 Testando o bot sem WhatsApp

```bash
node testar-bot.js
```

**Comandos especiais:**

| Comando   | O que faz                                  |
|-----------|--------------------------------------------|
| `/reset`  | Reinicia a sessão (simula novo cliente)    |
| `/status` | Exibe o estado interno da sessão em JSON   |
| `/quit`   | Encerra o simulador                        |

**Fluxo completo de teste:**

```text
oi              → exibe o menu
1               → categorias do cardápio
1               → itens da 1ª categoria
<número>        → escolhe o item (ex: 10)
0               → sem opcionais
0               → sem observação
1               → quantidade 1
2               → finalizar pedido
2               → não quero bebida
João            → nome do cliente
1               → delivery
Rua X, 10       → endereço
1               → forma de pagamento
1               → confirmar pedido
```

O pedido é gravado na tabela `pedidos` (Supabase) e aparece no painel na aba **Pedidos**.

## 🗂️ Estrutura

```text
bot-restaurante/
├── index.js                  → sobe o painel (não conecta o bot sozinho)
├── package.json
├── testar-bot.js             → simulador de conversa no terminal
├── Dockerfile, fly.toml      → configuração para deploy no Fly.io
├── supabase/
│   ├── config.toml
│   └── migrations/           → schema do banco (npx supabase db push)
├── data/                     → SÓ em disco: sessões e imagens
│   └── tenants/
│       └── {slug}/
│           ├── uploads/      → imagens dos itens do cardápio
│           └── baileys-{slug}/ → sessão WhatsApp Baileys (não versionar)
├── public/                   → painel web
│   ├── login.html            → login por e-mail + senha (Supabase Auth)
│   ├── cadastro.html         → wizard de onboarding (4 etapas)
│   ├── admin.html, app.js, style.css
└── src/
    ├── db.js                 → pool Postgres (pg)
    ├── supabase.js           → clients do Supabase Auth
    ├── servidor.js           → API REST multi-tenant (Express)
    ├── empresas.js           → tenants na tabela `empresas` + Supabase Auth
    ├── multi-bot.js          → gerencia um socket WhatsApp (Baileys) por tenant
    ├── fluxo.js              → máquina de estados do atendimento
    ├── store.js              → config/cardápio (jsonb) com cache em memória
    ├── pedidos.js            → tabela `pedidos` no Postgres, por empresa_id
    └── sessoes.js            → estado de conversa por cliente (memória, 30min)
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
> — o construtor visual só facilita a edição. A pergunta "deseja bebida?" aparece
> automaticamente quando existe uma categoria com **"Bebida"** no nome.

## ⚠️ Avisos

- Biblioteca **não-oficial** (Baileys, conexão via WebSocket): leve e estável para começar.
  Para produção séria / alto volume, considere a **API Oficial (WhatsApp Cloud API)** —
  ver `ROADMAP.md`.
- Sem Chromium: cada tenant é só uma conexão WebSocket, consumo de RAM baixo (a máquina de
  1 GB no Fly.io suporta bem mais que os ~3–4 tenants da versão antiga com Chromium).
- **Segurança**: login via **Supabase Auth** (senha em bcrypt, sessão JWT). HTTPS depende do
  host — no Fly era automático (`.fly.dev` + `force_https`); em **VPS/local** use um proxy com
  TLS (Nginx + Let's Encrypt). O `SUPABASE_SERVICE_ROLE_KEY` é admin total do banco: só backend,
  nunca no front ou no git.
- Não versionar `data/tenants/` (sessões WhatsApp e imagens) nem o `.env`.
