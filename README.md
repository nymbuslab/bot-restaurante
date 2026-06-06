# 🍴 Bot de Pedidos para Restaurante (WhatsApp) + Painel

Recebe pedidos pelo WhatsApp de forma automatizada e tem um **painel web** onde o
dono do restaurante edita tudo sozinho — sem mexer em código. O bot é a **porta de
entrada do pedido**; o andamento (preparo/entrega) é feito pelo sistema da empresa.

> Documentos do projeto: **PRD.md** (requisitos do produto) e **CLAUDE.md**
> (guia técnico para devs/IA). Para colocar em produção, veja **DEPLOY.md**.

## ✨ O que ele faz

**Atendimento (bot):**
- Mostra o cardápio e monta o pedido pelo WhatsApp.
- Por item: composição (o que vem), **opcionais** com preço, **observação** e quantidade.
- No fim, pergunta **"deseja adicionar bebida?"** e mostra a lista de bebidas.
- Coleta nome, entrega/retirada, endereço e forma de pagamento; confirma e registra.
- **Só responde a mensagens recebidas depois de conectado** (não dispara em massa).

**Painel:**
- **Conexão**: conectar/desconectar do WhatsApp; gerar novo QR se travar.
- **Cardápio**: itens, preços, ativar/desativar, composição e opcionais — valem na hora.
- **Configurações**: dados do restaurante, mensagens, abrir/fechar, pagamentos.
- **Pedidos**: lista com itens, opcionais, observação, total, entrega e telefone.

## 📦 Como rodar

Pré-requisito: **Node.js 18+**.
```bash
npm install
npm start
```
Abra **http://localhost:3000** e faça login.
- Senha inicial do painel: **admin123** (troque em `data/config.json` → `admin.senha`).

### Conectar ao WhatsApp (quando você quiser)
O bot **não conecta sozinho**. Configure tudo primeiro; depois, na aba **Conexão**,
clique em **"Conectar ao WhatsApp"** e escaneie o QR
(WhatsApp → Aparelhos conectados → Conectar um aparelho). Use um **número
dedicado** do restaurante, não o seu pessoal.

> Se o QR ficar travado em "iniciando", clique em **"Gerar novo QR (limpar sessão)"**
> — isso apaga uma sessão antiga inválida e força um QR novo.

## 🚀 Deploy no Fly.io (produção)

### Pré-requisitos (uma vez só)

1. Conta criada em [fly.io](https://fly.io)
2. `flyctl` instalado:

```powershell
# Windows
powershell -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://fly.io/install.ps1'))"
```

3. Adicionar ao PATH (se `fly` não for reconhecido):

```powershell
$env:PATH += ";$env:USERPROFILE\.fly\bin"
# Para fixar permanentemente:
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";$env:USERPROFILE\.fly\bin", "User")
```

---

### Primeiro deploy

```bash
# 1. Login
fly auth login

# 2. Criar o app (na pasta do projeto)
fly launch --no-deploy
# Escolha um nome (ex: sabordacasa-bot), região: gru (São Paulo)
# Quando perguntar "Overwrite fly.toml?" → N

# 3. Editar fly.toml: troque app = "bot-restaurante" pelo nome escolhido

# 4. Criar o volume de dados (cardápio + config + sessão do WhatsApp)
fly volumes create bot_dados --region gru --size 1

# 5. Fazer o deploy
fly deploy
# O build leva 3–5 min na primeira vez (instala o Chromium)

# 6. Abrir o painel
fly open
```

No painel, faça login → aba **Conexão** → **Conectar ao WhatsApp** → escaneie o QR.
A sessão fica salva no volume — próximos deploys reconectam sozinhos.

---

### Atualizar o projeto (deploy de novas versões)

Sempre que fizer mudanças no código:

```bash
fly deploy
```

Só isso. Os dados e a sessão do WhatsApp são preservados no volume — não precisa re-escanear o QR.

---

### Comandos úteis do dia a dia

```bash
fly logs              # ver logs em tempo real
fly status            # checar se a máquina está rodando
fly open              # abrir o painel no navegador
fly ssh console       # terminal dentro do container (para debug)
fly deploy            # publicar nova versão
```

---

### Se o QR travar ou a sessão invalidar

No painel → aba **Conexão** → **Gerar novo QR (limpar sessão)**.
Ou pelo terminal:

```bash
fly ssh console
rm -rf /app/data/session-bot-restaurante
exit
# Depois reconecte pelo painel
```

---

## 🧪 Testando o bot sem WhatsApp

Use o simulador de conversa para testar o fluxo completo no terminal — sem celular, sem QR, sem conectar nada:

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
```
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

O pedido confirmado é gravado em `data/pedidos.json` e aparece no painel na aba **Pedidos**.

## 🗂️ Estrutura

```
bot-restaurante/
├── index.js              → sobe o painel (NÃO conecta o bot sozinho)
├── package.json
├── ecosystem.config.js   → config do PM2 (rodar 24h)
├── README.md / DEPLOY.md / PRD.md / CLAUDE.md
├── data/                 → DADOS editáveis pelo painel
│   ├── config.json       → nome, mensagens, senha, pagamentos...
│   ├── cardapio.json     → categorias e itens (composição e opcionais)
│   └── pedidos.json      → criado quando chega o 1º pedido
├── public/               → o PAINEL (front-end)
│   ├── login.html, admin.html, app.js, style.css
└── src/
    ├── bot.js            → conexão com o WhatsApp (conectar/desconectar/resetar)
    ├── servidor.js       → API do painel (Express)
    ├── fluxo.js          → lógica do atendimento (lê do store)
    ├── store.js          → lê/grava os dados (recarrega ao vivo)
    ├── sessoes.js        → estado da conversa de cada cliente
    ├── pedidos.js        → salva/lê pedidos
    └── estado.js         → status do bot compartilhado
```

## ✏️ Como configurar o cardápio

Na aba **Cardápio**, cada item tem:
- **Composição** (o que vem): subcategoria terminando com `:` e itens em lista.
  Use **Alt+Enter** para adicionar um item da lista rapidamente.
  ```
  Principal:
  * Arroz
  * Feijão
  ```
- **Opcionais**: um por linha, no formato `Nome | preço`. **Alt+Enter** = nova linha.
  ```
  Ovo frito | 2.00
  Bacon | 3.50
  ```
- Botão **on/off** por item: desative quando algo acaba no dia.

> A pergunta "deseja bebida?" aparece automaticamente quando existe uma categoria
> com **"Bebida"** no nome. Mantenha esse nome para a função operar.

## ⚠️ Avisos

- Biblioteca **não-oficial** (whatsapp-web.js): ótima para começar; para alto
  volume comercial, considere a API Oficial (Cloud API) no futuro.
- Dados em arquivos JSON. Para volume maior, dá para migrar `store.js`/`pedidos.js`
  para **MySQL** sem mudar o resto.
- **Segurança**: painel em HTTP com senha simples. Em VPS pública, use HTTPS
  (Nginx + Let's Encrypt) e troque a senha padrão.
- Não compartilhe a pasta `.wwebjs_auth` (é a sessão do WhatsApp).
