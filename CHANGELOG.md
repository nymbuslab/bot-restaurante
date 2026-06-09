# Changelog

Marcos entregues com efeito observável no sistema. Mais recente por último.

---

## [0.1.0] — Base do bot (single-tenant)

- Estrutura base: whatsapp-web.js + Express
- Máquina de estados do atendimento: cardápio → opcionais → finalização
- Painel web: login, cardápio, configurações, conexão, pedidos
- `store.js` com recarga ao vivo (mudanças no painel valem sem reiniciar)
- Documentação de deploy (README.md + DEPLOY.md com PM2, VPS e Fly.io)
- Estabilidade: erros do Puppeteer/WhatsApp não derrubam o painel
- Fluxo por categorias antes de listar itens
- Simulador de conversa no terminal (`testar-bot.js`) e no painel (aba Simulador)
- Taxa de entrega configurável no painel; exibida ao cliente no checkout
- Estado ATENDENTE: bot silencioso quando humano assume a conversa
- Pergunta de bebida suprimida quando cliente já tem bebidas no carrinho
- Deploy no Fly.io com Docker + Chromium + volume único para dados e sessão

## [0.2.0] — SQLite + horário de funcionamento

- Migração de pedidos de JSON para SQLite (`better-sqlite3`), com migração automática do legado
- Horário de funcionamento por dia da semana: bot responde "fechado" fora do horário
- Painel exibe tabela editável de horários (7 dias) na aba Configurações
- Campo `horarios` em `config.json` por tenant

## [0.3.0] — Arquitetura multi-tenant SaaS

- Banco mestre de tenants em SQLite (`data/empresas.db`) com autenticação e-mail + senha (SHA-256 + salt)
- `src/empresas.js`: CRUD de tenants
- `src/multi-bot.js`: um WhatsApp Client por tenant, watchdog de 90s
- `src/store.js` e `src/pedidos.js` parametrizados por `tenantDir`
- `src/fluxo.js`: todas as funções recebem `tenantDir` explicitamente
- `src/servidor.js`: API REST multi-tenant com middleware `exigeAuth`
- Página de onboarding (`/cadastro.html`): cadastro de nova empresa + login automático
- Login atualizado para e-mail + senha; cabeçalho do painel exibe nome do restaurante
- Migração automática de instalação legada (cria tenant a partir de `data/config.json`)
- Documentação completa atualizada (CLAUDE.md, README.md, DEPLOY.md, PRD.md)

## [0.3.1] — Design system e protótipos de UI

- Tokens de cor Nymbus Lab aplicados em `public/style.css`: `--accent` (#6344BC roxo), `--secondary` (#73D2E6 ciano), `--accent-fg` (#A589EA para texto/ícone roxo sobre fundo escuro), tema escuro fixo
- Protótipos de telas (desktop + mobile) em `design/prototipos/`
- Referência visual por tela em `design/UI.md` com o que manter e o que não construir

## [0.4.0] — Redesign UI — Cardápio, Login e Cadastro

- **Editor de item em modal**: substitui edição inline; campos nome, preço, descrição, disponibilidade, foto
- **Upload de foto por item**: `POST /api/imagem` com `multer` (memoryStorage), extensão derivada do MIME-type, path confinado a `data/tenants/{slug}/uploads/`; rota `GET /imagens/:slug/:filename` com validação de slug contra banco e confinamento de path
- **Builders visuais**: composição (`• item`) e opcionais (`Nome | preço`) — interface visual que serializa para o formato de texto que o bot já lê; bot e `fluxo.js` não precisaram de alteração
- **Lista do cardápio em cards**: grid 2 colunas desktop / 1 coluna mobile, foto do prato (104px), toggle de disponibilidade, botões editar/excluir com ícones SVG; CSS `.cards-grid` / `.item-card`
- **Login redesenhado**: layout split — painel de marca com gradiente roxo→ciano (com ponto intermediário e noise para evitar banding), logo SVG garfo-e-faca, eye toggle para senha
- **Cadastro redesenhado**: mesmo layout do login; campo "confirmar senha" mantido; eye toggle em senha e confirmação; etapa de sucesso com ícone SVG
