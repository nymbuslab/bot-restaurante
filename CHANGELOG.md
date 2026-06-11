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

## [0.11.0] — Backup pelo painel super-admin

- **Aba "Configurações" no `/admin-master`** (estrutura pronta para novas subseções) com a subseção **Backup**: botão "Gerar backup agora" (estado "Gerando…"), lista dos backups (arquivo, tamanho, data) com **Baixar** por linha (download direto pro PC via blob autenticado), e aviso em destaque de que `backups/` é efêmero no Fly
- **Seção "Como restaurar"** (somente leitura) renderizada a partir do **DEPLOY.md** (fonte única, via marcadores `RESTAURACAO:START/END`), com renderizador de markdown que escapa HTML; deixa explícito que a restauração é **manual**, com o servidor parado, e que o painel **não executa** restauração
- **Rotas sob `exigeSuperAdmin`** (reusam `scripts/backup.js`, sem reescrever a lógica): `POST /api/admin/backup/gerar`, `GET /api/admin/backup/listar`, `GET /api/admin/backup/baixar/:arquivo` (validação **anti-path-traversal**: só aceita `backup-AAAA-MM-DD-HHmm.tar.gz` confinado em `backups/`), `GET /api/admin/backup/restauracao-doc` (com fallback gracioso se o DEPLOY.md sumir)
- `scripts/backup.js` refatorado para expor `gerarBackup()`/`listarBackups()` — o `npm run backup` continua igual; restauração permanece 100% manual

## [0.11.1] — Fixes na tela de Backup

- **"Como restaurar" virou texto fixo no painel** — antes uma rota lia o `DEPLOY.md` em runtime e renderizava markdown; em produção isso falhava (queda no fallback) e exigia parsing frágil. Agora o passo a passo é HTML estático no `admin-master.html` (zero leitura de arquivo, zero ponto de falha). Removidas a rota `GET /api/admin/backup/restauracao-doc` e o renderizador de markdown do front. O mesmo conteúdo segue no `DEPLOY.md`, escrito normalmente
- **Listagem de backups blindada** — `GET /api/admin/backup/listar` já retornava JSON `[]` quando não há backups; o front passou a checar `content-type`/status e exibir um aviso claro ("reinicie o servidor") em vez de quebrar com `Unexpected token '<'` caso receba HTML (ex.: servidor desatualizado sem a rota registrada)

## [0.11.2] — Fix: sessão não era limpa (cancelar / sair / pós-pedido)

- **Bug de chave de sessão corrigido.** No WhatsApp real, a sessão é guardada sob `${slug}:${jid}`, mas `fluxo.js` chamava `resetSessao(chatId)` com o `jid` cru → apagava uma chave inexistente e a sessão antiga **continuava viva**. Sintomas: `"cancelar"`/`"sair"` respondiam "cancelado" mas **não zeravam** o carrinho/estado; após confirmar um pedido a sessão **não reiniciava** (carrinho vazava para o próximo atendimento e um novo `"1"` podia **duplicar** o pedido). O simulador não exibia o bug porque ali a chave coincide
- **Correção:** novo `limparSessao(sessao)` em `sessoes.js` que reseta o **próprio objeto** da sessão (in-place), independente da chave; `fluxo.js` passou a usá-lo no cancelar/sair e no pós-confirmação. O `chatId` do canal (usado pelo "avisar cliente") permanece intacto — por isso não se passou a chave de armazenamento como `chatId`. Validado por teste no caminho real (`slug:jid`): cancelar, sair, pós-confirmação sem duplicar, e `chatId` do pedido gravado corretamente

## [0.11.3] — Exibição de preço com opcional no resumo do pedido

- **Só exibição (cálculo inalterado).** Na revisão e na confirmação, itens **com opcionais** passam a mostrar o **preço base** do item, os opcionais e o **subtotal** (em itálico) — em vez de só o valor já somado, que parecia o preço do item. Ex.: `2x Pastel — R$ 15,00` + `Queijo (R$ 2,50)` + `subtotal: R$ 35,00`. Itens **sem opcional** continuam numa linha só
- Helper único `linhasItemPedido()` usado pela revisão e pela confirmação (mesmo formato nos dois). `precoLinha`/`totalCarrinho` **não mudaram** — total final idêntico (validado: pedido misto com qtd>1 e opcionais soma exatamente o mesmo, centavo a centavo)

## [0.12.0] — Pergunta de bebida e observação configuráveis no painel

- **Dois toggles** na aba Configurações → "Comportamento do bot": *"Perguntar se deseja bebida ao finalizar"* e *"Perguntar observação em cada item"*. Salvam em `config.atendimento.perguntarBebida` / `perguntarObservacao` pela rota existente (`PUT /api/config`)
- **Default LIGADO** (retrocompatível): tenant sem o campo se comporta como antes — só desliga quem desligar explicitamente (lido como `!== false`)
- **Bot respeita os flags** (`fluxo.js`): bebida OFF pula `PERGUNTA_BEBIDA` (vai direto ao nome) — o flag é condição **a mais** sobre a regra atual (só perguntaria se houvesse categoria de bebida e o cliente não tivesse adicionado uma); observação OFF pula a etapa por item (vai direto à quantidade, observação vazia). Estados intactos — apenas deixam de ser alcançados
- Validado: teste nos 5 casos (ON/ON, **bebida OFF com categoria de bebida presente**, obs OFF, ambos OFF, legado sem campos) + painel real (liga/desliga → salvar → reload persiste → `config.json` em disco) + simulador ao vivo (OFF pula as duas; ON volta a perguntar)

## [0.12.1] — Saudação com carrinho aberto: continuar ou recomeçar

- Quando o cliente manda uma **saudação** (oi, olá, menu, bom dia…) **com itens no carrinho**, o bot não volta mais ao menu silenciosamente mantendo o pedido antigo: pergunta **continuar** (mantém o carrinho) ou **recomeçar** (esvazia via `limparSessao`). Novo estado `CONFIRMA_REINICIO` em `fluxo.js`
- **Só dispara com carrinho não-vazio**; carrinho vazio segue direto ao menu (comportamento atual). Detecção por **match exato** da mensagem (mesma lista de saudações de hoje) — endereço/nome com substring (ex.: "Rua Bom Dia, 100") **não** dispara. `cancelar`/`sair` continuam zerando direto, sem a nova pergunta. Resposta inválida no estado re-pergunta (não trava)
- Validado: 7 casos (node, mesmo `processarMensagem` do bot) + simulador ao vivo (pergunta → "1" mantém carrinho / "2" zera; vazio vai ao menu; inválida re-pergunta; "oi" no meio do checkout dispara sem quebrar)

## [0.12.2] — Fix GRAVE de isolamento: novo tenant nascia com dados de outro

- **Bug:** ao cadastrar uma empresa nova, ela nascia com os **dados de outro tenant** (telefone, endereço, horário e cardápio do "Sabor D'Casa"). Causa: `inicializarDiretorio` usava os arquivos `data/config.json`/`data/cardapio.json` da **raiz** como template — e esses arquivos continham **dados reais** (resquício da era single-tenant) e estavam **commitados** no git, indo para dev e deploy. Pior: a cópia do config preservava endereço/telefone/horário (só trocava o nome) e o cardápio era copiado inteiro
- **Correção:** novo tenant nasce de um **`configInicial()` limpo inline** (identidade — nome do cadastro, telefone/endereço/horário **vazios**; `atendimento`/`mensagens`/`pagamentos` genéricos) e **cardápio vazio** (`{ categorias: [] }`) — sem depender de nenhum template com dados reais. Os arquivos da raiz foram **descontaminados** (placeholders genéricos), usados agora só pela migração legada (`migrarLegado`, que só roda quando não há nenhum tenant)
- Não havia vazamento em runtime — `store.js`/painel sempre gravam no diretório do tenant. O login usa a senha do cadastro (tabela `empresas`); `config.admin.senha` é vestigial e não autentica
- Validado: 2 cadastros novos nascem com identidade e cardápio vazios, zero dado do Sabor; tenant legítimo intacto. Tenants de teste afetados serão removidos manualmente (sem rotina de correção)
