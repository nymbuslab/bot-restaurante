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

# 2) git + ferramentas de build (libsignal do Baileys vem do GitHub; better-sqlite3 compila)
sudo apt-get install -y git python3 make g++

# 3) Enviar os arquivos (git, scp ou FileZilla)

# 4) Instalar e rodar
cd bot-restaurante
npm install
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

> Um único volume guarda tudo: `data/` com `empresas.db`, `config.json`,
> `cardapio.json` e `tenants/` (pedidos + sessões WhatsApp de cada restaurante).
>
> **Volume em uso:** o app monta **apenas o `bot_dados`** em `/app/data`. Havia um volume
> órfão `bot_sessao` (sobra de uma configuração antiga, **nunca montado**) — foi **removido**
> para não pagar/confundir. Confira com `fly volumes list`: deve aparecer só o `bot_dados`.
>
> **Nota de HA (futuro, não necessário agora):** o Fly **recomenda 2+ volumes** por app para
> redundância/alta disponibilidade (uma máquina por volume, em zonas diferentes). Hoje rodamos
> com **1 volume** de propósito — simples e barato; a proteção de dados atual é **snapshots
> automáticos (retenção 5 dias) + backup manual baixado pro PC** (ver seção de backup). Migrar
> para 2+ volumes/máquinas só **quando o volume de clientes justificar** o custo e a
> complexidade extra (réplica de SQLite por tenant não é trivial).

### 4. Primeiro deploy

```bash
fly deploy
```

O build é rápido (sem Chromium — Baileys não usa browser); compila apenas o `better-sqlite3`.

### 5. Verificar credenciais iniciais

```bash
fly logs
```

Na primeira execução, o sistema cria um tenant a partir de `data/config.json` e
imprime as credenciais:

```text
E-mail: admin@local  |  Senha: admin123
```

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

Toda a operação vive na pasta `data/` (config, cardápio, `pedidos.db` de cada tenant,
sessões WhatsApp e `empresas.db`). **No Fly.io tudo isso fica num único volume.** Sem
backup, corromper ou recriar o volume = **perda total dos dados de todos os restaurantes**.
Faça backup periódico **antes de ter clientes pagando**.

### Estratégia

Duas camadas complementares:

1. **Snapshots de volume do Fly** (automático, infra): cobre o desastre "volume sumiu".
   Neste projeto, o volume é o **`bot_dados`** e os snapshots automáticos estão **ATIVOS**,
   tirados **~diariamente**, com **retenção de 5 dias**.

   ```bash
   fly volumes list                      # veja o ID do volume bot_dados (ex: vol_xxx)
   fly volumes snapshots list <vol_id>   # lista os snapshots disponíveis (e seus IDs)
   ```

   > **⚠️ Implicação prática da retenção de 5 dias:** se um problema só for percebido
   > **depois de 5 dias** (ex.: um dado corrompido/apagado que ninguém notou na hora), o
   > snapshot daquele período **já expirou** — não dá mais para voltar a ele. Por isso o
   > **backup manual baixado pro PC (item 2) é a proteção de longo prazo**: não expira.
   > Para algo importante, baixe um export manual e guarde fora do Fly.

   **Restaurar a partir de um snapshot** (cria um volume novo a partir do snapshot; o app
   precisa ser apontado para ele / a máquina recriada nesse volume):

   ```bash
   fly volumes snapshots list <vol_id>                       # pegue o <snap_id> desejado
   fly volumes create bot_dados --snapshot-id <snap_id> \
     --region gru --size 1                                   # cria um novo volume a partir do snapshot
   # depois, recrie/realoque a máquina nesse volume novo (ver docs do Fly: fly machine ...)
   ```

2. **Export manual** (`npm run backup`, abaixo — ou pelo painel, em **Configurações → Backup**):
   um arquivo único que você **baixa para fora do Fly** (seu PC) e que **não expira**. É o que
   protege contra erro humano (exclusão acidental), contra perda da própria conta/região e
   contra o **limite de 5 dias** dos snapshots. **Recomendado antes de cada operação de risco**
   (migração, deploy grande, exclusão de tenant) e como guarda de longo prazo.

> **Decisão de arquitetura:** ficamos em **snapshot do Fly + export manual** por ora.
> Backup automático para storage externo (S3/R2) está **fora de escopo** até haver volume de
> clientes que justifique — adiciona custo e credenciais a gerir. Quando migrar, o export já
> gera o artefato pronto para subir a um bucket.

### Antes de fazer backup: limpar pastas órfãs (reduz o tamanho)

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

### Gerar um backup (`npm run backup` ou pelo painel)

Gera `backups/backup-AAAA-MM-DD-HHmm.tar.gz` com **toda** a `data/`. Os bancos SQLite
(`empresas.db` e os `pedidos.db`) entram via *Online Backup API* do SQLite — cópia
**consistente mesmo com o servidor no ar** (sem downtime). As sessões `baileys-*/` entram
como estão.

> **Pelo painel:** dá para **gerar e baixar** backups direto no super-admin, em
> **`/admin-master` → Configurações → Backup** (mesmo motor; gera o mesmo arquivo). O download
> pelo painel traz o `.tar.gz` direto para o seu PC, sem precisar do `fly ssh sftp`. A
> **restauração continua manual** (o painel só exibe o passo a passo abaixo, nunca executa).

```bash
# Localmente:
npm run backup

# No Fly.io:
fly ssh console
cd /app && npm run backup
exit
```

> ### ⚠️ ATENÇÃO no Fly.io — o backup NÃO sobrevive a um restart
>
> A pasta `backups/` fica no **filesystem efêmero do container** (em `/app/backups`), **fora
> do volume montado em `/app/data`**. Se o container reiniciar, **o arquivo de backup some**.
> **Gere e BAIXE o backup na MESMA sessão.** Não confie que ele continua lá depois.
>
> *Por que não gerar dentro do volume (`/app/data/backups`)?* Porque o backup é uma cópia da
> própria `data/` — guardá-lo dentro do volume **incha o volume que estamos justamente
> protegendo** (e o próximo backup passaria a copiar os backups antigos). O lugar do backup é
> **fora do Fly**: no seu PC.

### Baixar o arquivo do Fly para o seu PC

```bash
# Substitua pelo nome real impresso pelo comando de backup:
fly ssh sftp get /app/backups/backup-AAAA-MM-DD-HHmm.tar.gz ./
```

Guarde esse `.tar.gz` em local seguro (outro disco / nuvem pessoal).

### Testar se o backup realmente restaura (faça isso!)

Backup que nunca foi testado não é backup. Teste **sem tocar** na `data/` real — extraia numa
pasta separada e confira que os bancos abrem e têm as linhas certas:

```bash
mkdir -p /tmp/teste-restore
tar -xzf backup-AAAA-MM-DD-HHmm.tar.gz -C /tmp/teste-restore
ls /tmp/teste-restore                       # deve ter config.json, empresas.db, tenants/, ...

# Conferir um banco (conta empresas e pedidos de um tenant):
node -e "const D=require('better-sqlite3'); \
  const e=new D('/tmp/teste-restore/empresas.db',{readonly:true}); \
  console.log('empresas:', e.prepare('SELECT COUNT(*) n FROM empresas').get().n); \
  const p=new D('/tmp/teste-restore/tenants/<slug>/pedidos.db',{readonly:true}); \
  console.log('pedidos:', p.prepare('SELECT COUNT(*) n FROM pedidos').get().n);"
```

Os números devem bater com o sistema em produção. (Este projeto valida exatamente isso ao
entregar a feature: empresas e pedidos contados antes e depois do tar batem.)

### RESTAURAR um backup (com o servidor PARADO)

> Restauração **substitui** os dados atuais. Pare o app antes e mantenha um resguardo
> (`data.old`) até confirmar que deu certo.

**No Fly.io:**

```bash
# 1) Suba o arquivo do seu PC para o container
fly ssh sftp shell
  put backup-AAAA-MM-DD-HHmm.tar.gz /app/backups/
  exit

# 2) Pare o processo e restaure
fly ssh console
  cd /app
  # resguardo do estado atual (não apague ainda):
  mv data data.old
  mkdir data
  tar -xzf backups/backup-AAAA-MM-DD-HHmm.tar.gz -C data
  ls data data/tenants            # confira a estrutura
  exit

# 3) Reinicie a máquina para o servidor subir com os dados restaurados
fly machine restart <machine_id>

# 4) Valide login no painel + conexão do bot. Se tudo ok:
fly ssh console -C "rm -rf /app/data.old"
```

**Localmente (PM2 / VPS):**

```bash
pm2 stop bot-restaurante          # ou Ctrl+C no npm start
mv data data.old
mkdir data
tar -xzf backup-AAAA-MM-DD-HHmm.tar.gz -C data
pm2 start bot-restaurante         # ou npm start
# valide e depois: rm -rf data.old
```

> O tar guarda o **conteúdo** de `data/` na raiz do arquivo, então `tar -xzf ... -C data`
> recoloca tudo no lugar certo. As sessões `baileys-*/` voltam juntas — o bot reconecta sem
> novo QR (a menos que o WhatsApp tenha expirado a sessão nesse meio-tempo).

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
