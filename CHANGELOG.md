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

## [0.5.0] — Avisar cliente "pedido pronto"

- `POST /api/pedido/avisar`: envio **manual** (1 cliente por clique, nunca automático/massa) de mensagem de "pedido pronto" pelo WhatsApp do tenant
- Templates editáveis em `config.json` → `mensagens.pedidoPronto.entrega` / `.retirada`, com variáveis `{cliente}` e `{numero}`; campos editáveis na aba Configurações
- Coluna `avisadoEm` na tabela `pedidos` (migração automática `ALTER TABLE`); gravada no sucesso do envio
- Normalização do telefone do cliente; erro claro "WhatsApp não conectado" se o socket não estiver pronto

## [0.6.0] — Migração de whatsapp-web.js para Baileys

- Troca da biblioteca de WhatsApp: `whatsapp-web.js` (Puppeteer/Chromium) → `@whiskeysockets/baileys` (WebSocket, sem browser), motivada por falha determinística de init (`Execution context was destroyed` — QR parava de gerar quando o WhatsApp Web mudava)
- `src/multi-bot.js` reescrito: socket por tenant, `import()` dinâmico (Baileys é ESM-only), sessão em `data/tenants/{slug}/baileys-{slug}/` (`useMultiFileAuthState`)
- Proteção anti-massa agora via `messages.upsert type === 'notify'` (ignora histórico `'append'`), no lugar do filtro de timestamp
- Reconexão controlada por `connection.update` (restartRequired reconecta; loggedOut para; teto de tentativas)
- `Dockerfile` enxuto: removidos Chromium e libs X11; adicionado `git` (dependência `libsignal` do Baileys); mantidos `python3/make/g++` (better-sqlite3)
- Fix de front-end: `/api/status` no painel passou a enviar o token (bug pré-existente que escondia o QR)

## [0.7.0] — Redesign do painel: shell, Pedidos e Cardápio

- **Shell redesenhado**: sidebar fixa no desktop + bottom-nav no mobile; aba inicial passou de Conexão para **Pedidos**; um único handler de logout reaproveitado
- **Pedidos**: faixa de métricas com **comparativo real vs período anterior** (em azul/`--secondary`), filtros com campo de busca, detalhe do pedido em **2 colunas**, **paginação** (10 por página, "Mostrando X–Y de N" + controles `‹ 1 2 … ›`) e **datas relativas** ("Hoje/Ontem, HH:MM")
- Tags de tipo mantidas semânticas (Entrega azul / Retirada verde) — divergência consciente do laranja do protótipo, conforme design system
- **Cardápio**: cabeçalho "Gestão de Itens" com botões Nova categoria / Adicionar item, faixa de **3 métricas** (total de itens, categorias, indisponíveis), cabeçalho de categoria com ícone + divisória, cards com **descrição truncada** e rótulo Disponível/Indisponível, card "+" tracejado ao fim de cada categoria

## [0.8.0] — Redesign do painel: Conexão, Configurações e Simulador

- **Conexão**: layout em 2 colunas — card "Como conectar" (passos numerados + Dica) e painel de QR com **moldura gradiente roxo→ciano**; 4 estados dinâmicos (desligado / iniciando / aguardando QR / conectado); o estado **conectado mostra o número do WhatsApp** — `src/multi-bot.js` captura `sock.user.id` no `connection:open` e `getEstado` passou a expor `numero` (sem nova rota)
- **Configurações**: card de **Status do Atendimento** em destaque, seções com ícone (Dados, Mensagens, Horário, Entrega e Pagamento), mensagens automáticas em grid (todos os campos preservados), horários em **tabela no desktop / cards por dia no mobile**, formas de pagamento como **pills** com "+ Adicionar Método" (input inline), barra inferior com **Descartar** (recarrega do servidor) + Salvar
- **Simulador**: "Console de Testes" com chat fiel ao protótipo (avatar + "Nymbus Bot" + horário nas mensagens), painel **"Variáveis de Contexto" real** (etapa atual, itens no carrinho, total); controles sem backend do mockup (Delay Humano, Logs, Status da Resposta, Conectar API, Anexo/Localização) deliberadamente **não** construídos
- **Fix bottom-nav mobile**: a `.sidebar` herdava `top:0` do desktop e, com `bottom:0` no mobile, esticava pela tela inteira e cobria o conteúdo; corrigido com `top:auto`

## [0.9.0] — Painel de super-admin (gestão de tenants)

- **Backend + autenticação master** (sem tela): conta master fixa via env (`SUPERADMIN_EMAIL` / `SUPERADMIN_SENHA_HASH`), hash com a mesma `hashSenha` do projeto (`npm run gerar-hash-admin`); sem env configurada, as rotas `/api/admin/*` respondem **503** (nenhuma credencial default). Autenticação **isolada** do painel de restaurante (Map `tokensAdmin` separado, middleware `exigeSuperAdmin`, comparação com `crypto.timingSafeEqual`). Carregamento de `.env` via `dotenv` (`.env.example` adicionado)
- **Rotas** (sob `exigeSuperAdmin`): listar / criar / suspender / reativar / excluir tenant. **Suspensão com efeito real**: login do restaurante recusado + bot desconectado + tokens de painel ativos invalidados. **Exclusão destrutiva** em ordem segura (desconectar → fechar conexão SQLite → apagar registro + pasta), com trava `{ confirmacao: "<slug>" }`
- **Tela `/admin-master`** (separada do painel de restaurante): login master fiel ao do restaurante; token guardado em `sessionStorage["tokenAdmin"]` (expira ao fechar a aba, por segurança); listagem em tabela responsiva (cards no mobile) com status Ativo/Suspenso; ações com toast; **exclusão com confirmação forte estilo GitHub** (digitar o slug habilita o botão); criação por modal
- **Métricas de uso** (`GET /api/admin/metrics`): faixa de 4 cards (total de restaurantes, ativos/suspensos, **pedidos no mês** somando todos os tenants, **conectados agora** no WhatsApp) + coluna "Pedidos no mês" por restaurante. Contagem real e on-demand no `pedidos.db` de cada tenant; corte do mês no **fuso BR** (UTC-3) convertido para UTC

## [0.10.0] — Backup manual de dados

- **`npm run backup`** (`scripts/backup.js`): gera um `backups/backup-AAAA-MM-DD-HHmm.tar.gz` com **toda** a pasta `data/` (config, cardápio, sessões `baileys-*/`, `empresas.db` e os `pedidos.db` de cada tenant)
- **Consistência do SQLite**: os bancos do app entram via *Online Backup API* do `better-sqlite3` (`db.backup`) — cópia consistente **mesmo com o servidor no ar** (sem downtime). Demais `.db` (caches do Chromium em pastas órfãs `session-*/`) são copiados crus, sem `db.backup`
- `backups/` no `.gitignore` (dados de cliente nunca versionados); dep `tar` (JS puro, cross-platform)
- **DEPLOY.md**: runbook completo — gerar, **baixar do Fly** (`fly ssh sftp get`), **testar a restauração** sem tocar nos dados reais, e **restaurar** com o servidor parado. Inclui o alerta de que `backups/` é efêmero no Fly (baixar na mesma sessão) e a decisão de arquitetura (snapshot do Fly + export manual; S3 fora de escopo por ora)
