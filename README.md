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

Pré-requisito: **Node.js 18+**.

```bash
npm install
npm start
```

Abra `http://localhost:3000` no navegador.

**Primeira execução:** se existir configuração anterior (`data/config.json`), o sistema
migra automaticamente e exibe no console:

```text
E-mail: admin@local  |  Senha: admin123
```

Use essas credenciais para o primeiro login e altere a senha no painel.

**Novo restaurante:** acesse `/cadastro.html` no painel e preencha o formulário de
cadastro. Após criar a conta, o login é feito automaticamente.

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

# 4. Criar o volume de dados (configs + pedidos + sessões WhatsApp de todos os tenants)
fly volumes create bot_dados --region gru --size 1

# 5. Deploy
fly deploy
# Build rápido (sem Chromium — Baileys não usa browser)

# 6. Abrir o painel
fly open
```

Na primeira execução na nuvem, o painel exibirá as credenciais no log:

```bash
fly logs
```

---

### Atualizar o projeto

Sempre que fizer mudanças no código:

```bash
fly deploy
```

Os dados e as sessões do WhatsApp são preservados no volume — não precisa re-escanear o QR.

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

O pedido é gravado em `data/tenants/{slug}/pedidos.db` e aparece no painel na aba **Pedidos**.

## 🗂️ Estrutura

```text
bot-restaurante/
├── index.js                  → sobe o painel (não conecta o bot sozinho)
├── package.json
├── testar-bot.js             → simulador de conversa no terminal
├── Dockerfile, fly.toml      → configuração para deploy no Fly.io
├── docker-entrypoint.sh      → inicializa dados padrão no volume na 1ª execução
├── README.md / DEPLOY.md / PRD.md / CLAUDE.md
├── data/
│   ├── config.json           → template de config para novos tenants
│   ├── cardapio.json         → template de cardápio para novos tenants
│   ├── empresas.db           → banco mestre de tenants (SQLite, criado automaticamente)
│   └── tenants/
│       └── {slug}/           → dados isolados por restaurante
│           ├── config.json
│           ├── cardapio.json
│           ├── pedidos.db    → pedidos em SQLite (criado automaticamente)
│           └── baileys-{slug}/ → sessão WhatsApp Baileys (não versionar)
├── public/                   → painel web
│   ├── login.html            → login por e-mail + senha
│   ├── cadastro.html         → onboarding de novos restaurantes
│   ├── admin.html, app.js, style.css
└── src/
    ├── servidor.js           → API REST multi-tenant (Express)
    ├── empresas.js           → CRUD de tenants (banco mestre SQLite)
    ├── multi-bot.js          → gerencia um socket WhatsApp (Baileys) por tenant
    ├── fluxo.js              → máquina de estados do atendimento
    ├── store.js              → lê/grava config e cardápio por tenant (cache mtime)
    ├── pedidos.js            → SQLite de pedidos por tenant
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
- **Segurança**: no **Fly.io o HTTPS é automático** (certificado gerenciado no domínio
  `.fly.dev` + `force_https` no `fly.toml`) — nada a configurar. Em **VPS/local**, o painel
  roda em HTTP: aí use um proxy com TLS (Nginx + Let's Encrypt). Em qualquer caso, troque a
  senha padrão.
- Não versionar `data/tenants/` (sessões WhatsApp e dados de clientes).
