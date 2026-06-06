# CLAUDE.md

Guia de contexto para assistentes de IA (Claude Code) e desenvolvedores que forem
trabalhar neste projeto. Leia antes de fazer alterações.

## Visão geral

Bot de atendimento de **restaurante** no WhatsApp, com **painel web administrativo**.
O bot funciona como **porta de entrada de pedidos**: recebe o pedido do cliente pelo
WhatsApp, monta tudo (itens, opcionais, observação, entrega, pagamento) e registra.
O andamento do pedido é feito por um sistema externo da empresa — este projeto
**não** gerencia o ciclo do pedido (preparo/entrega).

Idioma do projeto: **português (Brasil)**. Mensagens, comentários e UI em pt-BR.

## Stack

- Node.js (CommonJS, `require`)
- `whatsapp-web.js` (biblioteca **não-oficial**, usa Puppeteer/Chromium)
- `express` (API do painel + arquivos estáticos)
- `qrcode` / `qrcode-terminal` (QR de conexão)
- Dados em **arquivos JSON** (sem banco). Front-end em HTML/CSS/JS puro (sem framework).

## Como rodar

```bash
npm install
npm start            # inicia o painel em http://localhost:3000
```

O bot do WhatsApp **não conecta sozinho**. Abra o painel, faça login
(senha em `data/config.json` → `admin.senha`, padrão `admin123`), e na aba
**Conexão** clique em "Conectar ao WhatsApp" para escanear o QR.

Não há suíte de testes automatizada. Use o simulador de conversa para testar
o fluxo do bot sem WhatsApp (ver seção **Testando o bot** abaixo).

## Testando o bot

O arquivo `testar-bot.js` na raiz simula uma conversa completa no terminal,
sem precisar de WhatsApp, QR ou celular. Lê os dados reais de `data/`.

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

O pedido confirmado é gravado em `data/pedidos.json` e aparece no painel
na aba **Pedidos** — útil para validar o fluxo de ponta a ponta sem WhatsApp.

## Arquitetura

```
index.js            -> sobe o servidor (NÃO inicia o bot)
src/
  servidor.js       -> Express: API REST + serve /public + endpoints do bot
  bot.js            -> whatsapp-web.js; conectar/desconectar/resetar; filtro de msgs
  fluxo.js          -> máquina de estados do atendimento (núcleo do bot)
  store.js          -> lê/grava data/*.json com cache por mtime (recarrega ao vivo)
  sessoes.js        -> estado da conversa por cliente (em memória, expira em 30min)
  pedidos.js        -> salva/lê data/pedidos.json
  estado.js         -> estado compartilhado do bot (status, qrDataUrl, prontoEm)
public/
  login.html, admin.html, app.js, style.css   -> painel
data/
  config.json       -> nome, mensagens, pagamentos, senha admin, atendimento aberto/fechado
  cardapio.json     -> categorias e itens
  pedidos.json      -> criado no 1º pedido (ignorado no git)
```

Fluxo de dados: o painel edita `data/*.json` via API → `store.js` detecta a mudança
(mtime) e o `fluxo.js` lê os dados novos no próximo atendimento, **sem reiniciar**.

## Modelo de dados

**Item do cardápio** (`data/cardapio.json`):
```json
{ "id": 10, "nome": "Marmitex P", "preco": 18.0, "desc": "...",
  "disponivel": true,
  "composicao": "Principal:\n* Arroz\n* Feijão",      // texto; ":" = subcategoria
  "opcionais": "Ovo frito | 2.00\nBacon | 3.50" }      // texto; "Nome | preço" por linha
```
`composicao` e `opcionais` são guardados como **texto** e parseados em runtime
(`formatarComposicao` e `parseOpcionais` em `fluxo.js`).

**Linha do carrinho / pedido**:
```js
{ id, nome, preco, qtd, opcionais: [{nome, preco}], observacao }
```
Preço da linha = `(preco + soma dos opcionais) * qtd`.

## Máquina de estados (fluxo.js)

Item: `PEDINDO → (OPCIONAIS se houver) → OBSERVACAO → QUANTIDADE → REVISAO`
Finalização: `REVISAO(finalizar) → PERGUNTA_BEBIDA → (BEBIDAS/BEBIDA_QTD) →
FIN_NOME → FIN_ENTREGA → [FIN_ENDERECO] → FIN_PAGAMENTO → CONFIRMACAO`

- A pergunta "deseja bebida?" aparece automaticamente se existir uma categoria
  cujo nome contém "bebida". Não é configurável pelo painel (está no código).
- A pergunta de observação é sempre feita por item (pulável com `0`). Não é
  configurável pelo painel.
- Saudações ("oi", "menu", etc.) sempre voltam ao menu. "cancelar"/"sair" zera a sessão.

## Pontos de atenção (gotchas)

- **Disparo em massa**: ao conectar, o whatsapp-web.js reenvia mensagens não lidas.
  O bot SÓ responde a mensagens com `timestamp >= estado.prontoEm` (definido no
  evento `ready`). NÃO remover esse filtro em `bot.js` — evita responder a vários
  contatos sem motivo.
- **Conexão manual**: `index.js` não chama `bot.iniciar()`. A conexão é disparada
  pelo painel (`POST /api/bot/conectar`). Há watchdog de 90s e endpoint
  `POST /api/bot/resetar` que limpa `.wwebjs_auth` quando a sessão antiga trava.
- **Sessão do WhatsApp**: pasta `.wwebjs_auth` (não versionar). Apagar = novo QR.
- **Segurança**: login por senha simples + token em memória (some ao reiniciar).
  Sem HTTPS por padrão. Em produção pública, colocar atrás de Nginx + TLS.
- **Escala/banco**: para volume maior, migrar `store.js` e `pedidos.js` para MySQL
  mantendo as mesmas funções (`getCardapio`, `getConfig`, `salvarPedido`, `lerTodos`).

## Convenções

- Comentários e textos ao usuário em português.
- Formatação WhatsApp: `*negrito*`, `_itálico_`.
- Evitar dependências novas sem necessidade; manter o front-end sem framework.
- Não expor a senha do admin em respostas da API (ver `/api/config`).
