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
Use Linux (Ubuntu) com pelo menos **2 GB de RAM** por tenant WhatsApp conectado.

### Passo a passo (Ubuntu)

```bash
# 1) Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2) Dependências do Chromium
sudo apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
  libpango-1.0-0 libcairo2 libasound2

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

- Coloque atrás de **HTTPS** (ex.: Nginx como proxy reverso + Let's Encrypt).
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

### 4. Primeiro deploy

```bash
fly deploy
```

O build leva 3–5 minutos na primeira vez (instala o Chromium e compila `better-sqlite3`).

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
rm -rf /app/data/tenants/{slug}/session-{slug}
exit
```

Depois reconecte pelo painel.

### ⚠️ Importante

- `auto_stop_machines = 'off'` no `fly.toml` mantém a máquina **sempre ligada**.
  Não altere — se a máquina parar, o bot desconecta e precisará de novo QR scan.
- O plano gratuito do Fly.io tem limite de horas. Para uso 24/7, ative o faturamento
  (Pay As You Go) — custa ~$5–7/mês para 1 GB RAM em São Paulo.
- Cada tenant WhatsApp conectado usa ~200 MB de RAM (Chromium). Para mais de 3–4
  restaurantes simultâneos, atualize para 2 GB em `fly.toml` (`memory = '2gb'`).
- Altere a senha padrão do painel em **Configurações** antes de deixar público.

---

## 🆘 Problemas comuns

- **QR travado em "iniciando"**: sessão antiga inválida. No painel, clique em
  **"Gerar novo QR (limpar sessão)"**. A 1ª conexão pode levar até ~30s (Chromium subindo).
- **`Cannot GET /`**: acesse a raiz — ela já redireciona para o login.
- **`Cannot find module`**: confirme que está na pasta correta e que rodou `npm install`.
- **Bot respondeu a vários contatos ao conectar**: não deve acontecer — o filtro de
  timestamp descarta mensagens anteriores à conexão. Verifique se `multi-bot.js` está
  inalterado.

---

## 💡 Resumo rápido

| Situação | Opção recomendada |
| --- | --- |
| Testar / restaurante pequeno com PC sempre ligado | PM2 local (Opção 1) |
| Uso comercial, sempre online, equipe técnica | VPS Ubuntu + PM2 (Opção 2) |
| Múltiplos restaurantes, sem servidor próprio | Fly.io (Opção 3) |
