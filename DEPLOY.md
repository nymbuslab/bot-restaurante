# 🚀 Como deixar o bot rodando de verdade (produção)

O terminal do VS Code serve só para teste. Para uso real, use uma das opções abaixo.

**Conexão do WhatsApp:** o bot não conecta sozinho. Depois de subir, abra o painel,
faça login, vá na aba **Conexão** e clique em **"Conectar ao WhatsApp"**. O QR só
é lido uma vez; depois a sessão fica salva e reconecta sozinho.

---

## ✅ Opção 1 — PM2 (recomendado para começar)

O PM2 mantém o processo rodando o tempo todo, mesmo se você fechar o VS Code, e
reinicia sozinho se cair ou o computador reiniciar.

### Instalar o PM2 (uma vez só)

```bash
npm install -g pm2
```

### Iniciar

```bash
npm install
pm2 start ecosystem.config.js
```

Abra `http://localhost:3000`, faça login e conecte o WhatsApp pela aba Conexão.

### Comandos úteis

```bash
pm2 logs bot-restaurante     # ver logs em tempo real
pm2 status                   # ver se está rodando
pm2 restart bot-restaurante  # reiniciar
pm2 stop bot-restaurante     # parar
```

### Iniciar automaticamente quando o PC ligar

```bash
pm2 save
pm2 startup   # siga a instrução que ele imprimir na tela
```

> ⚠️ O computador/servidor precisa ficar **ligado e com internet**.
> Para um restaurante, o ideal é não usar o PC pessoal — veja a Opção 2 ou 3.

---

## ✅ Opção 2 — VPS / servidor na nuvem

Uma VPS fica ligada 24h. Provedores: Hostinger VPS, Contabo, Hetzner, DigitalOcean.
Use Linux (Ubuntu). Com Baileys (WebSocket, sem Chromium) o consumo de RAM por tenant
é baixo — **1 GB** já atende vários restaurantes; escale conforme o volume.

### Passo a passo (Ubuntu)

```bash
# 1) Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2) git (libsignal do Baileys vem do GitHub)
sudo apt-get install -y git

# 3) Enviar os arquivos (git, scp ou FileZilla)

# 4) Configurar o .env com as credenciais do Supabase (ver .env.example)

# 5) Instalar e rodar
cd bot-restaurante
npm install
npx supabase db push   # aplica o schema no seu projeto Supabase (uma vez)
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

### Acessar o painel na VPS

O painel roda na porta 3000. Acesse com o IP do servidor: `http://SEU_IP:3000`
(libere a porta 3000 no firewall do provedor).

### Segurança em produção pública

- **HTTPS (só na VPS):** coloque atrás de um proxy com TLS (ex.: Nginx + Let's Encrypt). Isso
  vale **apenas para a VPS/local** — no Fly.io o HTTPS já é automático (ver Opção 3).
- Altere a senha padrão pelo painel → Configurações.
- Considere restringir o acesso ao painel por IP/VPN.

---

## ✅ Opção 3 — Fly.io (recomendado para produção na nuvem)

O Fly.io roda o bot em um container Docker na região de São Paulo, com **volume
persistente** para todos os dados (config, cardápio, pedidos e sessões WhatsApp
de todos os tenants). Plano gratuito cobre o uso básico; para garantir uptime
24h use o plano **Pay As You Go** (~$5–10/mês).

### Pré-requisitos

- Conta em [fly.io](https://fly.io) (gratuita)
- `flyctl` instalado:

```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
powershell -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://fly.io/install.ps1'))"
```

### 1. Login

```bash
fly auth login
```

### 2. Criar o app (primeira vez)

Na raiz do projeto:

```bash
fly launch --no-deploy
```

Quando perguntar:

- **App name:** escolha um nome (ex: `sabordacasa-bot`)
- **Region:** selecione `gru` (São Paulo)
- **Overwrite fly.toml?** → `N` (já existe o arquivo configurado)

Depois edite o `fly.toml` e troque `app = "bot-restaurante"` pelo nome escolhido.

### 3. Secrets do Supabase (sem volume — app stateless)

O app **não grava nada em disco** (dados, sessões e imagens estão no Supabase), então
**não precisa de volume persistente**. Se houver um `[[mounts]]` no `fly.toml`, é resíduo
e pode ser removido. Configure os secrets (sem eles o app não sobe):

```bash
fly secrets set DATABASE_URL="..." SUPABASE_URL="..." \
  SUPABASE_ANON_KEY="..." SUPABASE_SERVICE_ROLE_KEY="..."
```

> Stateless = pode rodar em **múltiplas instâncias / hosts efêmeros** sem perder sessão.
> A proteção dos dados é do próprio Supabase (point-in-time recovery gerenciado).

### 4. Primeiro deploy

```bash
fly deploy
```

O build é rápido (sem Chromium e sem módulo nativo — Baileys é WebSocket, `pg` é JS puro).

### 5. Criar a primeira empresa

Abra o painel e crie a primeira empresa pelo onboarding público em `/cadastro.html`
(nome, e-mail e senha) — ou pelo super-admin em `/admin-master`. O tenant nasce limpo.
Não há mais migração automática de instalação legada. Acompanhe os logs com `fly logs`.

### 6. Conectar o WhatsApp

```bash
fly open
```

Faça login → aba **Conexão** → **Conectar ao WhatsApp**. A sessão fica salva no
volume — próximos deploys reconectam automaticamente.

### Atualizar depois de mudanças no código

```bash
fly deploy
```

Os dados e sessões são preservados no volume — não precisa re-escanear o QR.

### Deploy automático pelo GitHub (CI) — opcional

Por padrão o deploy é **manual** (`fly deploy` acima). Se quiser que **todo push para a
branch `main` publique sozinho** (sem rodar `fly deploy` na mão), faça os 3 passos abaixo.

> ⚠️ **Trade-off:** *qualquer* push para `main` vira um deploy — inclusive commits só de
> documentação. Se preferir controlar quando publica, fique no deploy manual.

**1) Gerar um token de deploy do Fly** (na sua máquina, já logado no Fly):

```bash
fly tokens create deploy
```

Copie a saída inteira (começa com `FlyV1 ...`). É um **segredo** — não comite em lugar nenhum.

**2) Salvar o token no GitHub** como segredo do repositório:

- No GitHub: **Settings → Secrets and variables → Actions → New repository secret**
- **Name:** `FLY_API_TOKEN`
- **Secret:** cole o token do passo 1 → **Add secret**

**3) Criar o workflow** `.github/workflows/fly-deploy.yml` com este conteúdo:

```yaml
name: Fly Deploy
on:
  push:
    branches:
      - main
jobs:
  deploy:
    name: Deploy app
    runs-on: ubuntu-latest
    concurrency: deploy-group
    steps:
      - uses: actions/checkout@v5
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

Pronto: o próximo push para `main` deploya sozinho. Acompanhe em **Actions** no GitHub (o job
"Deploy app" fica verde quando publica). **Sem o segredo do passo 2 ele falha** — foi por isso
que esse workflow foi removido antes (o `FLY_API_TOKEN` nunca tinha sido configurado).

**Para desligar de novo:** apague o arquivo `.github/workflows/fly-deploy.yml` (e, se quiser,
remova o segredo `FLY_API_TOKEN` no GitHub).

### Comandos úteis do dia a dia

```bash
fly logs                   # logs em tempo real
fly status                 # status da máquina
fly ssh console            # terminal dentro do container
fly deploy                 # novo deploy após alterações
fly volumes list           # listar volumes
```

### Limpar sessão WhatsApp de um tenant (se travar)

No painel → aba **Conexão** → **Gerar novo QR (limpar sessão)**. Isso apaga as linhas da
sessão do tenant na tabela `wa_auth` (Postgres) e gera um QR novo — não há nada em disco.

### ⚠️ Importante

- **HTTPS é automático no Fly.io.** O domínio `*.fly.dev` já vem com **certificado TLS
  gerenciado** + **`force_https = true`** no `fly.toml`. Nada a fazer. (Nginx + Let's Encrypt
  só na Opção 2 — VPS.)
- O app é **stateless**: se a máquina reiniciar, **a sessão NÃO se perde** (está no Postgres) —
  o bot reconecta sem novo QR. Manter a máquina ligada (`auto_stop_machines = 'off'`) é só pra
  o bot não ficar offline enquanto está parada.
- O plano gratuito do Fly.io tem limite de horas. Para uso 24/7, ative o faturamento
  (~$5–7/mês para 1 GB RAM em São Paulo).
- Cada tenant WhatsApp é uma conexão WebSocket (Baileys, sem Chromium) — RAM baixa.
- Login é via Supabase Auth (não há senha padrão a trocar).

---

## 🌐 Domínio próprio (custom domain)

Por padrão o app abre em `https://bot-restaurante.fly.dev`. Para usar um domínio seu
(ex.: `pedidos.nymbuslab.com.br`), **não precisa mexer em código** — as URLs de retorno do
Stripe (`success_url`/`return_url`) são derivadas do host da requisição
([`src/servidor.js`](../src/servidor.js) → `baseUrlDe`), então se adaptam sozinhas ao endereço
que o cliente acessar. O `.fly.dev` continua funcionando em paralelo.

Passo a passo (feito em 2026-06-16 para `pedidos.nymbuslab.com.br`):

1. **Pedir o certificado no Fly** (na raiz do projeto):

   ```bash
   fly certs add pedidos.nymbuslab.com.br
   ```

   O Fly imprime os registros DNS recomendados (A/AAAA com IPs **ou** a alternativa por CNAME).

2. **Criar o registro DNS no provedor** (Hostinger → *Gerenciar registros DNS*, **não** a seção
   "Subdomínios"). Para subdomínio, o **CNAME** é o mais simples e resiliente (acompanha o Fly se
   o IP mudar):

   | Tipo | Nome | Valor | TTL |
   | --- | --- | --- | --- |
   | `CNAME` | `pedidos` | `bot-restaurante.fly.dev` | padrão |

   > ⚠️ Não dá pra ter um CNAME e um A/AAAA no **mesmo nome** (conflito de DNS). Escolha um. Se
   > já houver um registro automático para `pedidos`, apague antes.

3. **Esperar a propagação e validar** (alguns minutos a horas):

   ```bash
   fly certs check pedidos.nymbuslab.com.br
   ```

   Quando o `Status = Issued` + `Certificate is verified and active`, o domínio serve HTTPS
   automático (Let's Encrypt gerenciado pelo Fly). Não precisa renomear o app no Fly nem mexer
   no `fly.toml`.

4. **Stripe:** atualizar a URL do **webhook** para o domínio novo — ver o checklist em
   [`docs/assinatura-stripe.md`](../docs/assinatura-stripe.md) (seção *Go-live*). Como hoje o app
   roda em **Área restrita (teste)** e o webhook ainda não foi cadastrado, isso entra no checklist
   de lançamento, não bloqueia a troca de domínio.

---

## 💾 Backup dos dados

**App stateless — tudo está no Supabase.** O backup é **gerenciado pelo Supabase**:
point-in-time recovery do Postgres (dashboard → **Database → Backups**, no plano Pro) ou um
export pontual com `pg_dump` usando a `DATABASE_URL`. As imagens ficam no **Storage** e as
sessões do WhatsApp na tabela `wa_auth` (também no Supabase).

Não há nada relevante em disco, então não há backup do lado do app. O antigo `npm run backup`
(e a aba Backup do super-admin), da era SQLite, foi **removido na v0.18.0** por ter ficado
obsoleto com o app stateless.

---

## 🆘 Problemas comuns

- **QR travado em "iniciando"**: sessão antiga inválida. No painel, clique em
  **"Gerar novo QR (limpar sessão)"**. Com Baileys (WebSocket) a conexão é rápida.
- **`Cannot GET /`**: acesse a raiz — ela já redireciona para o login.
- **`Cannot find module`**: confirme que está na pasta correta e que rodou `npm install`.
- **Bot respondeu a vários contatos ao conectar**: não deve acontecer — o bot só
  processa mensagens em tempo real (`messages.upsert type 'notify'`), ignorando o
  histórico/sync (`'append'`). Verifique se `multi-bot.js` está inalterado.

---

## 💡 Resumo rápido

| Situação | Opção recomendada |
| --- | --- |
| Testar / restaurante pequeno com PC sempre ligado | PM2 local (Opção 1) |
| Uso comercial, sempre online, equipe técnica | VPS Ubuntu + PM2 (Opção 2) |
| Múltiplos restaurantes, sem servidor próprio | Fly.io (Opção 3) |
