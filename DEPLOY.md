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

### 3. Criar o volume persistente

```bash
fly volumes create bot_dados --region gru --size 1
```

> **O banco está no Supabase** (Postgres gerenciado: empresas, pedidos, config, cardápio).
> O volume guarda só o que ainda mora em disco: `data/tenants/{slug}/` com a **sessão
> WhatsApp** (`baileys-*/`) e as **imagens** do cardápio (`uploads/`).
>
> **Secrets do Supabase** (necessários no Fly): `fly secrets set DATABASE_URL=... SUPABASE_URL=...
> SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=...` — sem eles o app não sobe.
>
> **HA (futuro):** a proteção dos dados do banco agora é do **Supabase** (point-in-time
> recovery gerenciado). O volume só tem sessões/imagens (recriáveis: re-escanear QR / re-upload).

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

### Comandos úteis do dia a dia

```bash
fly logs                   # logs em tempo real
fly status                 # status da máquina
fly ssh console            # terminal dentro do container
fly deploy                 # novo deploy após alterações
fly volumes list           # listar volumes
```

### Limpar sessão WhatsApp de um tenant (se travar)

No painel → aba **Conexão** → **Gerar novo QR (limpar sessão)**.

Ou via terminal:

```bash
fly ssh console
rm -rf /app/data/tenants/{slug}/baileys-{slug}
exit
```

Depois reconecte pelo painel.

### ⚠️ Importante

- **HTTPS é automático no Fly.io.** O domínio `*.fly.dev` (ex.: `bot-restaurante.fly.dev`) já
  vem com **certificado TLS gerenciado pela plataforma** — sem Nginx, sem Let's Encrypt, sem
  configuração manual. O `fly.toml` tem **`force_https = true`**, então todo acesso `http://` é
  redirecionado para `https://`. Nada a fazer aqui. (O esquema "Nginx + Let's Encrypt" só vale
  para a Opção 2 — VPS.)
- `auto_stop_machines = 'off'` no `fly.toml` mantém a máquina **sempre ligada**.
  Não altere — se a máquina parar, o bot desconecta e precisará de novo QR scan.
- O plano gratuito do Fly.io tem limite de horas. Para uso 24/7, ative o faturamento
  (Pay As You Go) — custa ~$5–7/mês para 1 GB RAM em São Paulo.
- Cada tenant WhatsApp conectado é só uma conexão WebSocket (Baileys, sem Chromium) —
  consumo de RAM baixo. 1 GB atende vários restaurantes; aumente `memory` no `fly.toml`
  só se o volume justificar.
- Altere a senha padrão do painel em **Configurações** antes de deixar público.

---

## 💾 Backup e restauração dos dados

Desde a migração para o **Supabase**, os dados que importam (empresas, pedidos, config,
cardápio, contas/senhas) vivem no **Postgres gerenciado** — **o backup deles é do Supabase**
(point-in-time recovery automático no plano Pro). Não há mais bancos SQLite no disco.

Em disco sobra só o que é **recriável**: as **sessões do WhatsApp** (`baileys-*/`, perdê-las
= re-escanear o QR) e as **imagens** do cardápio (`uploads/`). Ou seja, perder o volume hoje
**não perde dado de cliente** — só obriga a reconectar e re-subir fotos.

### Backup do banco → Supabase (gerenciado)

Nada manual: o Supabase faz backups automáticos do Postgres. Para restaurar a um ponto no
tempo, use o **dashboard do Supabase → Database → Backups** (PITR no plano Pro). Para um
export pontual, dá para rodar `pg_dump` com a `DATABASE_URL`.

### Backup de sessões/imagens (`npm run backup`)

Opcional (recriável), mas evita re-escanear QR e re-subir fotos. Gera
`backups/backup-AAAA-MM-DD-HHmm.tar.gz` com a `data/` (sessões `baileys-*/` + `uploads/`).
Também dá para gerar/baixar pelo super-admin em **`/admin-master` → Configurações → Backup**.

```bash
# Localmente:
npm run backup

# No Fly.io:
fly ssh console
cd /app && npm run backup
exit
```

> **⚠️ No Fly.io o backup é EFÊMERO:** `backups/` fica no filesystem do container (fora do
> volume). Se o container reiniciar, o arquivo some. **Gere e BAIXE na mesma sessão:**
> `fly ssh sftp get /app/backups/backup-AAAA-MM-DD-HHmm.tar.gz ./`

**Restaurar sessões/imagens:** com o app parado, extraia o tar de volta em `data/`
(`tar -xzf backup-....tar.gz -C data`) e suba o app. As sessões `baileys-*/` voltam e o bot
reconecta sem novo QR (a menos que o WhatsApp já tenha expirado a sessão).

### Limpar pastas órfãs (reduz o tamanho do volume)

Instalações que já rodaram o antigo `whatsapp-web.js` deixaram pastas órfãs
`data/tenants/{slug}/session-*/` (caches do Chromium) que **não são usadas pelo Baileys** e
incham o volume e os backups (podem ser dezenas de MB). É seguro removê-las — **preserve as
`baileys-*/`**, que são as sessões ativas:

```bash
# No Fly.io:
fly ssh console
rm -rf /app/data/tenants/*/session-*
ls -d /app/data/tenants/*/baileys-*    # confirme que as sessões do Baileys continuam
exit
```

(Localmente é o mesmo comando sem o `/app`: `rm -rf data/tenants/*/session-*`.)

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
