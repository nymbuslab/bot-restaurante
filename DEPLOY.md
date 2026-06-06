# 🚀 Como deixar o bot rodando de verdade (produção)

O terminal do VS Code serve só para teste. Para uso real, use uma das opções abaixo.

**Conexão do WhatsApp:** o bot não conecta sozinho. Depois de subir, abra o painel,
vá na aba **Conexão** e clique em **"Conectar ao WhatsApp"**. O QR só é lido uma vez;
depois a sessão fica salva em `.wwebjs_auth` e reconecta sozinho.

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
Abra **http://localhost:3000**, faça login e conecte o WhatsApp pela aba Conexão.

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
> Para um restaurante, o ideal é não usar o PC pessoal — veja a Opção 2.

---

## ✅ Opção 2 — VPS / servidor na nuvem (uso comercial)

Uma VPS fica ligada 24h. Provedores: Hostinger VPS, Contabo, Hetzner, DigitalOcean.
Use Linux (Ubuntu) com pelo menos **2 GB de RAM** (o Chromium pesa).

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

### Acessar o painel/QR na VPS
O painel roda na porta 3000. Acesse pelo navegador com o IP do servidor:
**http://SEU_IP_DA_VPS:3000** (libere a porta 3000 no firewall do provedor).
Conecte o WhatsApp pela aba Conexão. O QR também aparece em `pm2 logs bot-restaurante`.

### Segurança em produção pública
- Coloque atrás de **HTTPS** (ex.: Nginx como proxy reverso + Let's Encrypt).
- Troque a senha padrão do painel (`data/config.json` → `admin.senha`).
- Considere restringir o acesso ao painel por IP/VPN.

---

## 🆘 Problemas comuns

- **QR travado em "iniciando" / não gera o QR**: geralmente é uma sessão antiga
  inválida em `.wwebjs_auth`. No painel, clique em **"Gerar novo QR (limpar sessão)"**.
  Se não resolver, pare o bot e apague a pasta `.wwebjs_auth` manualmente, depois
  conecte de novo. A 1ª conexão pode levar até ~30s (o Chromium precisa subir).
- **`Cannot GET /`**: acesse `http://localhost:3000/` (a raiz já redireciona para o
  login). Se persistir, confirme que está rodando a versão atual do `src/servidor.js`.
- **`Cannot find module './src/...'`**: os arquivos precisam estar nas pastas certas
  (`src/`, `public/`, `data/`). Veja a estrutura no README.
- **Bot respondeu a vários contatos**: não deve mais acontecer — ele só responde a
  mensagens recebidas **após** a conexão. Para testar, peça uma mensagem nova depois
  do status ficar "Bot conectado".

---

## 💡 Resumo
- **Testar / restaurante pequeno com PC sempre ligado:** Opção 1 (PM2 local).
- **Uso comercial sério, sempre online:** Opção 2 (VPS).
