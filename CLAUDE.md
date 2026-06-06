# CLAUDE.md

Guia de contexto para assistentes de IA (Claude Code) e desenvolvedores que forem
trabalhar neste projeto. Leia antes de fazer alterações.

## Visão geral

Plataforma **SaaS multi-tenant** de atendimento de restaurantes no WhatsApp, com
**painel web administrativo** por empresa. Cada empresa cadastrada recebe seu próprio
ambiente isolado (cardápio, config, pedidos, sessão WhatsApp). O bot é a **porta de
entrada de pedidos**: recebe o pedido pelo WhatsApp, monta tudo (itens, opcionais,
observação, entrega, pagamento) e registra. O andamento do pedido é feito por um
sistema externo — este projeto **não** gerencia o ciclo do pedido (preparo/entrega).

Idioma do projeto: **português (Brasil)**. Mensagens, comentários e UI em pt-BR.

## Stack

- Node.js (CommonJS, `require`)
- `whatsapp-web.js` (biblioteca **não-oficial**, usa Puppeteer/Chromium)
- `express` (API do painel + arquivos estáticos)
- `better-sqlite3` (pedidos por tenant + banco mestre de empresas)
- `qrcode` / `qrcode-terminal` (QR de conexão)
- Front-end em HTML/CSS/JS puro (sem framework)

## Como rodar

```bash
npm install
npm start            # inicia o painel em http://localhost:3000
```

Na **primeira execução**, se existir `data/config.json` legado, o sistema cria
automaticamente um tenant a partir dele e imprime as credenciais no console:

```
E-mail: admin@local  |  Senha: admin123
```

Abra o painel, faça login e, na aba **Conexão**, clique em "Conectar ao WhatsApp".

Não há suíte de testes automatizada. Use o simulador de conversa para testar
o fluxo do bot sem WhatsApp (ver seção **Testando o bot** abaixo).

## Testando o bot

O arquivo `testar-bot.js` na raiz simula uma conversa completa no terminal,
sem precisar de WhatsApp, QR ou celular. Usa os dados do primeiro tenant.

```bash
node testar-bot.js
```

**Comandos especiais dentro do simulador:**

| Comando   | O que faz                                      |
|-----------|------------------------------------------------|
| `/reset`  | Reinicia a sessão (simula um novo cliente)     |
| `/status` | Exibe o estado interno da sessão em JSON       |
| `/quit`   | Encerra o simulador                            |

**Fluxo de pedido completo para testar:**

```
oi          → menu
1           → categorias
1           → itens da 1ª categoria
<id>        → escolhe item (ex: 10)
0           → sem opcionais (se houver)
0           → sem observação
1           → quantidade 1
2           → finalizar pedido
2           → não quero bebida (se aparecer)
João        → nome
1           → entrega
Rua X, 10  → endereço
1           → forma de pagamento
1           → confirmar
```

O pedido confirmado é gravado em `data/tenants/{slug}/pedidos.db` e aparece
no painel na aba **Pedidos**.

## Arquitetura

```
index.js              -> sobe o servidor (NÃO inicia o bot)
src/
  servidor.js         -> Express: API REST multi-tenant + serve /public
  empresas.js         -> banco mestre SQLite (data/empresas.db): CRUD de tenants
  multi-bot.js        -> gerencia um WhatsApp Client por tenant (Map slug→Client)
  fluxo.js            -> máquina de estados; todas as funções recebem tenantDir
  store.js            -> lê/grava config.json e cardapio.json por tenant (cache mtime)
  sessoes.js          -> estado da conversa por cliente (em memória, expira em 30min)
  pedidos.js          -> SQLite por tenant; pool de conexões keyed por dbPath
public/
  login.html          -> tela de login (e-mail + senha)
  cadastro.html       -> onboarding: cria nova empresa
  admin.html          -> painel administrativo
  app.js, style.css   -> lógica e estilos do painel
data/
  config.json         -> template/fallback para novos tenants (legado compatível)
  cardapio.json       -> template/fallback para novos tenants
  empresas.db         -> banco mestre de tenants (criado automaticamente)
  tenants/
    {slug}/
      config.json     -> configurações do restaurante
      cardapio.json   -> categorias e itens
      pedidos.db      -> SQLite de pedidos (criado automaticamente)
      session-{slug}/ -> sessão WhatsApp (LocalAuth, não versionar)
```

**Fluxo de dados:** painel edita `data/tenants/{slug}/*.json` via API →
`store.js` detecta a mudança (mtime) e `fluxo.js` lê os dados novos no
próximo atendimento, **sem reiniciar**.

## Multi-tenant

Cada empresa tem:

- **Slug** gerado do nome (ex: `sabor-d-casa`), único, usado como chave em tudo.
- **Diretório isolado** `data/tenants/{slug}/` com config, cardápio e pedidos.
- **Sessão WhatsApp** em `data/tenants/{slug}/session-{slug}/` (via `LocalAuth`).
- **Token de sessão** do painel em memória, mapeado para `{ slug, tenantDir }`.

Autenticação: `POST /api/login { email, senha }` → `{ token, slug, nome }`.
O token viaja em `Authorization: Bearer ...` em todas as chamadas protegidas.
O middleware `exigeAuth` resolve `req.slug` e `req.tenantDir` automaticamente.

## Horário de funcionamento

Estrutura em `config.json` (por tenant):
```json
"horarios": {
  "seg": { "abre": "11:00", "fecha": "22:00", "fechado": false },
  "dom": { "abre": "08:00", "fecha": "14:00", "fechado": true }
}
```

A função `estaAberto(tenantDir)` em `fluxo.js` verifica:

1. Se `config.atendimento.aberto` é `false` → sempre fechado (override manual).
2. Se `horarios` existe → compara dia/hora atual com o range do dia.
3. Se não existe → considera aberto.

Fora do horário, saudações recebem a mensagem `config.mensagens.fechado`.
O painel mostra a tabela de horários na aba **Configurações**.

## Modelo de dados

**Item do cardápio** (`cardapio.json` por tenant):
```json
{ "id": 10, "nome": "Marmitex P", "preco": 18.0, "desc": "...",
  "disponivel": true,
  "composicao": "Principal:\n* Arroz\n* Feijão",
  "opcionais": "Ovo frito | 2.00\nBacon | 3.50" }
```
`composicao` e `opcionais` são texto parseado em runtime.

**Tabela `pedidos`** (SQLite por tenant, `data/tenants/{slug}/pedidos.db`):

```text
id, numero, status, cliente, telefone, tipoEntrega, endereco,
pagamento, taxaEntrega, itens (JSON serializado), total, criadoEm
```

**Tabela `empresas`** (SQLite mestre, `data/empresas.db`):

```text
id, slug, nome, email, senha (sha256+salt), ativo, criadoEm
```

**Linha do carrinho / pedido**:
```js
{ id, nome, preco, qtd, opcionais: [{nome, preco}], observacao }
```
Preço da linha = `(preco + soma dos opcionais) * qtd`.

## Máquina de estados (fluxo.js)

Item: `PEDINDO → (OPCIONAIS se houver) → OBSERVACAO → QUANTIDADE → REVISAO`

Finalização: `REVISAO(finalizar) → PERGUNTA_BEBIDA → (BEBIDAS/BEBIDA_QTD) →
FIN_NOME → FIN_ENTREGA → [FIN_ENDERECO] → FIN_PAGAMENTO → CONFIRMACAO`

- Antes de listar itens, o cliente escolhe a **categoria** (estado `CATEGORIA`).
- A pergunta "deseja bebida?" aparece automaticamente se existir categoria com
  "bebida" no nome E o cliente ainda não adicionou bebidas.
- Saudações ("oi", "menu", etc.) sempre voltam ao menu. "cancelar"/"sair" zera a sessão.
- Chave de sessão: `{slug}:{chatId}` — isola clientes entre tenants.
- Todas as funções de `fluxo.js` recebem `tenantDir` como parâmetro explícito.

## Pontos de atenção (gotchas)

- **Disparo em massa**: ao conectar, o whatsapp-web.js reenvia mensagens não lidas.
  O bot SÓ responde a mensagens com `timestamp >= prontoEm` (por tenant, definido
  no evento `ready`). NÃO remover esse filtro em `multi-bot.js`.
- **Conexão manual**: `index.js` não chama `multiBot.iniciar()`. A conexão é disparada
  pelo painel (`POST /api/bot/conectar`). Watchdog de 90s por tenant em `multi-bot.js`.
- **Memória por tenant WhatsApp**: cada Client roda um Chromium (~200 MB). Máquina de
  1 GB suporta ~3–4 tenants simultâneos. Para mais, escalar a RAM no Fly.io (2 GB).
- **Sessão WhatsApp**: salva em `data/tenants/{slug}/session-{slug}/`. Apagar = novo QR.
- **Segurança**: login por e-mail + senha com hash SHA-256+salt. Tokens em memória
  (somem ao reiniciar). Sem HTTPS por padrão — em produção pública, usar Nginx + TLS.
- **Primeiro acesso (instalação legada)**: se não há tenants e existe `data/config.json`,
  a migração automática cria um tenant com `admin@local` / `admin123`. Alterar a
  senha no painel após o primeiro login.
- **Pool SQLite**: `pedidos.js` mantém conexões abertas (Map keyed por dbPath). É o
  comportamento esperado — `better-sqlite3` é síncrono e thread-safe para leitura.
- **Volume único no Fly.io**: toda a pasta `data/` (incluindo `tenants/`, `empresas.db`
  e sessões WhatsApp) está no único volume montado em `/app/data`.

## Convenções

- Comentários e textos ao usuário em português.
- Formatação WhatsApp: `*negrito*`, `_itálico_`.
- Evitar dependências novas sem necessidade; manter o front-end sem framework.
- Não expor senhas em respostas da API.
- Todo código novo passa `tenantDir` explicitamente — sem estado global de tenant.
- Ao adicionar nova rota à API, usar `exigeAuth` e referenciar `req.tenantDir`.
