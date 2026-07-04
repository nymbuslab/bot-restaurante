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

- Tokens de cor Nymbus Pedidos aplicados em `public/style.css`: `--accent` (#6344BC roxo), `--secondary` (#73D2E6 ciano), `--accent-fg` (#A589EA para texto/ícone roxo sobre fundo escuro), tema escuro fixo
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

## [0.13.0] — Limpeza de legado

- **Removida a migração single-tenant** (`migrarLegado` em `empresas.js`) e os arquivos-semente da raiz `data/config.json`, `data/cardapio.json` e `data/pedidos.db` — só serviam a essa migração. O app é 100% multi-tenant: a primeira empresa é criada via `/cadastro.html` (onboarding) ou pelo super-admin. **Não há mais auto-criação de `admin@local`/`admin123`** num deploy novo
- **`.gitignore` enxuto:** removidas entradas obsoletas (`.wwebjs_auth/`, `.wwebjs_cache/`, `pedidos.json`, `data/*.migrado`, bloco `squads/*`) — resquícios do whatsapp-web.js e de outra ferramenta
- **Textos legados corrigidos:** mensagem do painel que mandava "apagar `.wwebjs_auth`" (não existe mais; é `baileys-{slug}/`) e comentário sobre "Puppeteer/whatsapp-web.js" no `index.js`
- Pastas vazias `.agents/`/`.claude/` removidas; docs (CLAUDE/README/DEPLOY) atualizados (árvore de `data/`, primeiro acesso via cadastro)
- Sem mudança de comportamento do bot/painel; todas as 9 dependências seguem em uso. Validado: cadastro + login + tenant nasce limpo, sem os arquivos da raiz

## [0.14.0] — Assistente de onboarding (barra-guia do 1º acesso)

- **Barra-guia no topo do painel**, só no primeiro acesso, conduzindo o dono por 3 passos — **Dados** (telefone/endereço) → **Horário** → **Entrega** (taxa + pagamento). Cada passo leva à **seção correspondente que já existe** na aba Configurações (ativa a aba + rola até a seção com destaque temporário); **não cria tela nova**. Cardápio e Conexão ficam de fora (o dono faz pelo painel)
- **Controle por flag no servidor** (`config.onboardingConcluido`): tenant **novo** nasce com `false` (`empresas.configInicial`) → barra aparece. Tenant **antigo** não tem o campo (`undefined`) → barra **não** aparece (quem já usa nunca vê). A barra só renderiza quando o flag é explicitamente `false` — **o servidor manda**; o passo atual fica em `localStorage` por tenant, só como conveniência de UX
- **Avançar passo:** salvar a config avança o passo atual (+1), e **"Pular este passo"** também avança (sem exigir preenchimento — o campo segue editável nas Configurações normais). Ao concluir os 3 ou clicar **"Dispensar assistente"** → `POST /api/onboarding/concluir` grava `onboardingConcluido=true` e a barra **nunca mais aparece** (nem após relogar)
- Nova rota mínima `POST /api/onboarding/concluir` (sob `exigeAuth`): lê o config, seta o flag e salva — evita reenviar a config inteira e o race com edições não salvas do formulário
- Validado: 12 checks no painel real (Playwright) — tenant novo vê a barra (Passo 1/3, chip atual), "Ir para Dados" ativa a aba e rola à seção, salvar avança a Passo 2, pular avança a 3, concluir esconde a barra e **persiste após reload**; tenant antigo (sem flag) **não** vê a barra; `localStorage` do passo limpo ao finalizar

## [0.14.1] — Reversão: barra de onboarding no painel → wizard no cadastro

- **Decisão de produto:** o onboarding deixa de ser uma **barra-guia no topo do painel** (v0.14.0) e passará a ser um **wizard no fluxo de cadastro**. A barra no painel foi revertida
- **Removido:** a barra `#onbBarra` (`admin.html`), o módulo de onboarding no `app.js` (render, navegação até a seção, "Pular"/"Dispensar" e a chamada a `POST /api/onboarding/concluir`), os estilos `.onb-*` (`style.css`) e os `id` `cfg-sec-*` que tinham sido adicionados às seções de Configurações. O painel volta ao estado anterior à v0.14.0
- **Limpeza:** o `app.js` agora remove no carregamento qualquer chave residual `onbPasso:*` do `localStorage` (estado do passo guardado pela barra antiga)
- **Mantidos por ora** (a decidir no passo do wizard): a rota `POST /api/onboarding/concluir` e o campo `config.onboardingConcluido` (o `configInicial` ainda nasce com `false`). Como o wizard de cadastro vai configurar tudo no momento do signup, o flag tende a ficar **sem uso** — provável remoção no Passo B
- Validado: painel abre normal em tenant novo e antigo, sem a barra (8/8 checks Playwright, **zero erro de console**); abas navegam; salvar config funciona

## [0.15.0] — Wizard de cadastro (4 etapas)

- **Cadastro de tela única → wizard de 4 etapas** em `cadastro.html`, com barra de progresso "Etapa X de 4": **Conta → Dados → Horário → Entrega →** entra no painel. O painel de marca (gradiente roxo→ciano, logo garfo-e-faca, identidade Nymbus) é **preservado** nas 4 etapas
- **Etapa 1 — Conta:** reusa **sem reescrever** o fluxo atual (`POST /api/cadastro` → `POST /api/login`), incluindo validação de senha/confirmação e tratamento de e-mail duplicado. Conta criada **já loga** (token no `sessionStorage`). E-mail duplicado mostra o erro **na Etapa 1** (não avança)
- **Etapas 2–4 salvam pela MESMA rota do painel** (`PUT /api/config`, sem rota nova): logo após logar, o wizard faz `GET /api/config` e guarda o objeto; cada etapa **muta** e dá `PUT` (persistência incremental). **Etapa 2 (Dados: telefone+endereço) é obrigatória** (não avança vazia); **Horário** e **Entrega** (taxa + formas de pagamento) são **puláveis**. Ao concluir ou pular o que é pulável → vai ao painel já logado. "Voltar" simples entre as etapas pós-conta
- **Reuso sem duplicar config:** as etapas 3 e 4 reaproveitam as classes de UI do painel (`.tabela-horarios`, `.hor-*`, `.switch`, `.pag-*`) e a **estrutura exata** da config (`restaurante.telefone/endereco`, `horarios` dos 7 dias, `atendimento.taxaEntrega`, `pagamentos`); o render é inline no wizard (cadastro não carrega `app.js`), mas a **persistência é 100% a rota existente**
- **Layout proporcional ao login (responsivo):** o card do wizard cabe na viewport — a **página nunca cria barra de rolagem**; o lado do formulário rola internamente só como fallback em telas baixas. Tabela de horários **compacta** (cabe as 4 colunas sem scroll lateral nem corte do dia). Campo de taxa em **padrão monetário pt-BR** (prefixo `R$`, vírgula decimal via `fmtBR`/`parseBR`, reformata ao sair do campo)
- **Abandono:** a conta existe desde a Etapa 1; cada etapa salva já persistiu. Quem fecha no meio, no próximo login cai **direto no painel** (o login nunca dependeu de flag de wizard) e completa o resto nas Configurações normais — o wizard **não** guarda "em que etapa parou"
- **Removido código morto** (após a reversão da barra): o campo `config.onboardingConcluido` do `configInicial` (`empresas.js`) e a rota `POST /api/onboarding/concluir` (`servidor.js`). Confirmado por `grep` que **nada mais** os referenciava (login e `fluxo.js` nunca liam o flag)
- Validado (Playwright, painel real): fluxo completo preenchendo tudo → painel logado com telefone/endereço/horário(domingo fechado)/taxa(7,50)/pagamento extra **gravados certos** na config do tenant; fluxo pulando horário+entrega → cai no painel com Dados salvos e resto default/editável; e-mail duplicado barra na Etapa 1; abandono → relogin vai direto ao painel; isolamento (conta nova nasce limpa, só com o que foi digitado); "Voltar" preserva valores; zero erro de console no fluxo feliz

## [0.15.1] — Texto de horário gerado a partir da tabela

- **Botão "Gerar automaticamente"** sob o campo *Horário (texto exibido ao cliente)* (aba Configurações). Monta o texto em pt-BR a partir da **tabela de horários ao vivo** (reusa `lerHorariosDoDOM()`): agrupa dias seguidos com o mesmo horário e pula os fechados. Ex.: `Nosso atendimento é de *Segunda* a *Sexta* das *11:00* às *22:00*; *Sábado* das *11:00* às *23:00*`
- **Não-destrutivo:** só preenche ao clicar (não sobrescreve sozinho); o texto continua **editável à mão**. Esse texto alimenta a variável `{horario}` da mensagem de "fechado". Só front-end (`resumirHorarios()` em `app.js`); sem rota nova — persiste pela rota de salvar config existente
- Validado: 5 casos da lógica (semana toda igual, fim de semana diferente, dia único, todos fechados → vazio, dia fechado no meio quebrando o grupo) + painel real (gera, edita manual, salva e persiste)

## [0.16.0] — Migração do banco: SQLite → Supabase (Postgres + Auth)

- **Dados saíram do disco para o Postgres gerenciado (Supabase).** Antes: `better-sqlite3` (um banco por tenant + banco mestre, em arquivo). Agora: tabela `empresas` (perfil) e tabela única `pedidos` isolada por `empresa_id`; `config`/`cardápio` viraram colunas `jsonb` na `empresas`. Schema versionado em `supabase/migrations/` (Supabase CLI)
- **Login agora é Supabase Auth** (senha em **bcrypt**, sessão **JWT**): resolve de uma vez duas dívidas de segurança — hash forte e sessão que **não cai a cada deploy/reinício**. O cadastro cria o usuário no Auth + a linha de perfil; o middleware valida o JWT e checa `ativo` a cada request (suspensão imediata). O **super-admin** segue env-based (conta única isolada), inalterado
- **O que continua em disco:** só as **sessões do WhatsApp** (`baileys-*/`) e as **imagens** do cardápio. O backup local (`npm run backup`) passou a cobrir só isso; o backup do banco é do Supabase (point-in-time recovery). `better-sqlite3` foi **removido** das dependências
- **Sem mudança visível para o usuário:** wizard de cadastro, login, painel e bot funcionam igual. A camada de dados ficou assíncrona internamente (Postgres é rede); `store.js` mantém um cache em memória por tenant para o fluxo do bot seguir rápido (instância única)
- **Isolamento por tenant** preservado (queries por `empresa_id`; RLS ligado como defesa em profundidade). Slug segue como chave do tenant (linha, pedidos, pasta em disco, sessão)
- Validado ponta-a-ponta: 20 checks da camada de dados/auth + 14 checks HTTP + pedido completo pelo simulador gravado no Postgres + wizard de cadastro→painel→relogin no navegador (Playwright), zero erro de console

## [0.17.0] — App stateless + JWT local + Docker corrigido

- **Sessões do WhatsApp saíram do disco para o Postgres.** Novo adapter `src/wa-auth.js` (`usePostgresAuthState`) substitui o `useMultiFileAuthState` do Baileys: creds e chaves de signal ficam na tabela `wa_auth` (serializadas com `BufferJSON`). Reset de sessão = apagar as linhas do tenant. O bot reconecta lendo a sessão do banco — sem arquivo `baileys-*/`
- **Imagens do cardápio → Supabase Storage** (bucket público `cardapio`). O upload (`POST /api/imagem`) manda o arquivo pro Storage e o item guarda a **URL pública**; a antiga rota `/imagens/:slug/:filename` e a escrita em disco foram removidas. `npm run setup-storage` cria o bucket num projeto novo
- **Resultado: app totalmente stateless** — nada é gravado em disco. Não precisa mais de volume persistente (sessões no Postgres, imagens no Storage, dados no Postgres). Pré-requisito para rodar em múltiplas instâncias / hosts efêmeros
- **`exigeAuth` valida o JWT localmente** (via JWKS público do Supabase, tokens ES256) — **sem ida à rede por request** (antes chamava `getUser`). Mede ~144 ms morno vs ~700 ms frio; fallback automático para `getUser` em erro/rotação de chave. Usa `jose`
- **Docker corrigido (bug de deploy):** o `docker-entrypoint.sh` tentava semear `config.json`/`cardapio.json` (que não existem mais) com `set -e` → **o container crashava no boot**. Removido o seed e os build-deps nativos (`python3/make/g++`) do `Dockerfile` (não há mais módulo nativo). `excluir` de tenant agora também limpa `wa_auth` + imagens no Storage
- Validado: adapter de sessão (round-trip de serialização com Buffers, 8 checks) + bot real chegando ao **QR** + upload→Storage→URL pública acessível + JWT local (warm ~144 ms, token forjado → 401) + exclusão limpando banco/sessão/Storage. **Confirmado em produção:** sincronizar o WhatsApp popula `wa_auth` e **desconectar→reconectar funciona sem novo QR** (a sessão é lida do Postgres)

## [0.17.1] — Higiene de sessões antigas

- **Limpeza automática** das linhas de sessão (`session:*`) inativas há mais de **90 dias**, em todos os tenants (`limparSessoesAntigas` em `src/wa-auth.js`). Roda 1x no boot e a cada 24h (`index.js`). É **seguro** — o Baileys recria a sessão do cliente no próximo contato; **não toca** em creds/pre-keys/app-state (essas não envelhecem)
- Nova coluna `wa_auth.atualizado_em` (carimbada a cada escrita) habilita o corte por inatividade. Não-bloqueante e barato; só importa quando um restaurante acumula milhares de clientes
- Validado: sessão recente preservada, sessão de 100 dias removida, `creds`/`pre-key` antigos intocados

## [0.18.0] — Remoção do backup manual (obsoleto pós-stateless)

- **Backup do lado do app removido.** Na era SQLite, `npm run backup` (`scripts/backup.js`) empacotava a pasta `data/` (sessões `baileys-*/` + imagens) num `.tar.gz`, com tela de gerar/listar/baixar na aba **Configurações** do `/admin-master`. Com o app **stateless** (v0.17.0), tudo migrou para o Supabase — dados em Postgres, sessões em `wa_auth`, imagens no Storage — e a pasta `data/` ficou vazia: o backup empacotava **nada** e dava uma falsa sensação de segurança
- **O que foi removido:** `scripts/backup.js`, as 3 rotas `/api/admin/backup/{gerar,listar,baixar}` (`servidor.js`), a aba **Configurações** inteira do `/admin-master` (HTML + JS + CSS — era exclusiva do backup), o script `npm run backup` e a dependência `tar` do `package.json`. A gestão de tenants (aba **Restaurantes**) e as métricas seguem intactas
- **Backup agora é 100% gerenciado pelo Supabase** (point-in-time recovery do Postgres + Storage). Docs atualizadas (CLAUDE.md, ROADMAP.md, DEPLOY.md, PRD.md, `.gitignore`)
- O `/admin-master` abre direto em **Restaurantes**, sem barra de abas

## [0.19.0] — Monetização: assinatura paga (Stripe)

- **Plano único pago (R$ 79/mês) com 7 dias grátis exigindo cartão** no início, via Stripe (pacote `stripe`, lógica em `src/stripe.js`). Sem `STRIPE_SECRET_KEY`+`STRIPE_PRICE_ID`, as rotas `/api/assinatura/*` respondem 503
- **Checkout próprio com a identidade Nymbus** (Stripe Elements / Payment Element, tema escuro) — coleta o cartão via **SetupIntent** ANTES de criar a assinatura (`/api/assinatura/setup-intent` → `/api/assinatura/confirmar`, idempotente, `trial_period_days: 7`). Não usa a tela hospedada do Stripe
- **Webhook** (`/api/stripe/webhook`, raw body + verificação de assinatura) sincroniza o estado e liga/desliga o bot; **Customer Portal** para cancelar; **gestão de cartões no painel** (listar / adicionar / tornar padrão / remover, com travas no padrão e no último)
- **Dois eixos de acesso:** `ativo` (suspensão manual do admin) + `assinatura_status` (`nenhuma | trialing | active | cortesia | past_due | canceled`). `exigeAssinatura` (402) protege o bot; **gate** trava o painel sem acesso; aba **Assinatura** com **faturas reais** do Stripe (download de PDF)
- **Painel master:** liberar/revogar **cortesia**, cancelar no Stripe e **métricas de billing** (em teste / pagantes / cortesia / em atraso / cancelados)

## [0.20.0] — Identidade da plataforma + páginas institucionais

- **Aba "Configurações Master"** (tabela singleton `plataforma_config`, `src/plataforma.js`): razão social, nome fantasia, CNPJ, endereço, telefone, Facebook, Instagram + **credenciais do master editáveis** (migraram pro banco; a env `SUPERADMIN_*` vira só bootstrap). Alimenta o footer e as páginas legais via `GET /api/plataforma/publico`
- **Footer institucional vertical** na landing (colunas Plataforma · Conta · Legal · Contato; colunas dinâmicas somem se vazias), centralizado em `public/footer.js`
- **Páginas `termos.html` e `privacidade.html`** (Termos de Uso + Política de Privacidade) adaptadas à realidade Nymbus, com a identidade da empresa injetada dinamicamente; destaque para o **risco de banimento do WhatsApp** (conexão não-oficial via Baileys)

## [0.21.0] — LGPD: direitos do titular, retenção e aceite

- **Exportar meus dados** (`GET /api/conta/exportar` → JSON com empresa + config + cardápio + todos os pedidos) e **excluir a própria conta** (`DELETE /api/conta`, exige senha atual + digitar "EXCLUIR") na sub-aba **Empresa → "Privacidade e dados"** (zona de perigo)
- **Retenção:** `pedidos.anonimizarAntigos(12)` (job no `index.js`, boot + 24h) anonimiza a PII de pedidos com mais de 12 meses, mantendo número/itens/total/datas
- **Aceite** dos Termos + Política de Privacidade no cadastro (checkbox que trava a criação). Os documentos abrem em **modal (iframe em modo `?embed`)** sobre o cadastro, sem tirar o usuário da página (fonte única de verdade, acessível, tela cheia no mobile)

## [0.21.1] — Cancelar/pausar a assinatura no Stripe ao excluir/suspender

- **Excluir** (autoatendimento e master) **cancela** a assinatura no Stripe **antes** de apagar; se falhar, **aborta (502)** e orienta a contatar o suporte — evita assinatura órfã cobrando o cartão
- **Suspender** (master) **pausa** a cobrança (`pause_collection`, reversível) e **Reativar** **retoma**; se o Stripe falhar, o bloqueio de acesso acontece e o admin é avisado (toast) a verificar/contatar o suporte
- `cancelarAssinatura` ficou **idempotente** + novos `pausarAssinatura`/`retomarAssinatura`; alerta de "assinatura ativa será cancelada" ao abrir Excluir conta. Validado contra o **Stripe de teste real** (pausar→void, retomar→null, cancelar→canceled, idempotência; E2E self e master)

## [0.22.0] — Segurança: blindagem de borda (Onda 1 da auditoria)

- **Cabeçalhos de segurança (helmet) + CSP estrita** em `src/servidor.js`: `script-src` sem `'unsafe-inline'` (libera só `js.stripe.com`), `frame-src` só Stripe, `frame-ancestors 'self'` + `X-Frame-Options: SAMEORIGIN` (anti-clickjacking), HSTS, `nosniff`, `Referrer-Policy`. Origem do Supabase lida de `SUPABASE_URL` (sem hardcode)
- **Pré-requisito da CSP:** todo JS do front virou **arquivo externo** — extraídos os 9 blocos `<script>` inline (novos `login.js`, `checkout.js`, `cadastro.js`, `landing.js`, `legal-embed.js`, `termos.js`, `privacidade.js`) e convertidos os 9 handlers inline (`onclick`/`onsubmit`) para `addEventListener`. **Não adicionar `<script>` inline nem `on*=` no HTML** (quebraria a CSP)
- **Rate limiting** (`express-rate-limit`) + `trust proxy` (Fly): login master **5/15min**, login restaurante 10/15min, cadastro 5/h, setup-intent/checkout 20/15min — mitiga brute force (em especial a conta master) e criação em massa de tenants
- **Dependência vulnerável corrigida:** `form-data` (GHSA alta, via Baileys→axios) atualizado por `npm audit fix` (`npm audit` zerado)
- Validado no navegador (Playwright): CSP sem violações no console, toggles de senha, modal de Termos e iframe `?embed` funcionando

## [0.22.1] — Segurança: Onda 2 (dados e respostas de erro)

- **Anonimização cobre a observação do pedido (M4):** `pedidos.anonimizarAntigos` passa a limpar também a `observacao` dentro do jsonb `itens` (texto livre do cliente, podia conter PII e escapava da retenção). Idempotente, com guard de tipo array. Validado contra o banco (transform limpa onde havia PII, preserva item sem observação)
- **Respostas de erro 500 genéricas (M5):** 3 rotas que devolviam `e.message` cru no erro 500 (`confirmar assinatura`, `bot/resetar`, `pedido/avisar`) passam a responder texto fixo e logar o detalhe só no servidor — sem vazar mensagem interna/driver ao cliente. Os erros 400 controlados (amigáveis) seguem iguais
- **Validação de payload jsonb (M1):** `PUT /api/config` e `PUT /api/cardapio` rejeitam (400) payload não-objeto ou exagerado (config >256 KB, cardápio >512 KB, >200 categorias, >500 itens/categoria) — evita inflar a linha ou quebrar o bot/painel. Sem schema rígido (o jsonb segue flexível)
- **Falhas de exclusão logadas (M6):** na exclusão de conta, as etapas best-effort (apagar usuário no Auth, limpar imagens no Storage) deixam de falhar em silêncio — agora logam para reconciliação manual de órfãos
- **Histórico do git purgado (A3):** `git filter-repo` removeu `data/config.json`/`data/cardapio.json` de todo o histórico (93 commits) — eliminando a senha morta `admin123` (não autenticava) e a PII de teste que persistiam em commits antigos. Force-push aplicado. (GitHub pode reter SHAs antigos em cache até GC.)

## [0.22.2] — Segurança: Onda 3 (hardening do super-admin + refinos)

- **Hash da senha master → bcrypt (M3):** `empresas.hashSenha` passou de SHA-256+salt para **bcrypt** (`bcryptjs`, JS puro — sem dep nativa). Novo `verificarSenhaMaster` detecta o formato → **migração graciosa**: o hash SHA-256 legado (env/DB) segue válido até a senha master ser trocada pelo painel, quando vira bcrypt. `gerar-hash.js` emite bcrypt. Resistente a brute force offline caso o hash vaze
- **Token master mais forte:** `gerarToken` passou de `Math.random` para **`crypto.randomBytes`** (CSPRNG, 256 bits) e o `Map` ganhou **TTL de 12h** (`exigeSuperAdmin` rejeita e descarta token expirado)
- **Upload valida magic bytes:** `POST /api/imagem` confere a **assinatura real dos bytes** (JPEG/PNG/WebP) e usa o tipo detectado como fonte de verdade para extensão/contentType — o MIME do header (falsificável) deixa de ser confiável
- **Refinos:** `escapar()` do `app.js` passou a cobrir a **aspa simples** (alinhado ao `app-admin.js`); `unhandledRejection` loga só `reason.message` (não despeja payload no log); `.gitignore` cobre `.env.*` e `baileys-*/`
- **Documentados como risco aceito** (não exigem código): **M2** enumeração de conta no cadastro — sem fluxo de verificação por e-mail, uma resposta genérica só pioraria a UX, e a enumeração em massa já está contida pelo rate limit de cadastro; **RLS sem policies** — o backend acessa pela conexão privilegiada (ignora RLS) e a anon key não chega ao navegador, então policies teriam valor prático ~zero. **Jurídico:** textos legais seguem pendentes de revisão de advogado

## [0.22.3] — Suíte de testes automatizada + CI

- **`npm test`** com o runner nativo `node:test` (**zero dependência nova**): cobre a lógica pura crítica — validação de payload (config/cardápio), magic bytes do upload, hash master bcrypt + migração do SHA-256 legado, e geração de slug. Os testes usam env dummy → **rodam sem segredos**
- **`npm run check`** — varredura de sintaxe (`node --check`) em todo `src/`, `scripts/` e `index.js` (o "build" honesto de um app CommonJS)
- **CI no GitHub Actions** (`.github/workflows/test.yml`): roda `npm run check` + `npm test` a cada push/PR
- Refactor de apoio: validadores e detecção de magic bytes extraídos do `servidor.js` para `src/validacao.js` (puro e testável; sem mudança de comportamento)

## [0.22.4] — Export CSV de pedidos

- **Botão "Exportar"** na aba **Pedidos** (painel do restaurante) baixa um **CSV** dos pedidos atualmente filtrados (período + tipo + busca): número, data, cliente, telefone, tipo, endereço, pagamento, itens (com observação), total e se o cliente já foi avisado. Formato Excel-BR (separador `;` + BOM UTF-8); arquivo `pedidos-AAAA-MM-DD.csv`

## [0.22.5] — Segurança: anti-enumeração no cadastro (M2) + RLS hardening

- **M2 — cadastro não revela mais se um e-mail existe:** o cadastro público responde uma mensagem **genérica e uniforme** em qualquer falha (fecha o oráculo de enumeração) — a dica "se já tiver conta, faça login" aparece sempre, então não vaza existência de conta; o detalhe vai só pro log. A criação de tenant pelo super-admin segue informando "já cadastrado" (sem risco). Soma-se ao rate limit de cadastro (Onda 1)
- **RLS hardening (defesa em profundidade):** migration que reafirma o RLS habilitado e **revoga explicitamente qualquer acesso de `anon`/`authenticated`** às tabelas `empresas`, `pedidos`, `wa_auth` e `plataforma_config` (que só o backend privilegiado acessa) — protege ainda mais a sessão do WhatsApp e o hash da senha master. Decisão consciente de **não criar policies** (abririam um caminho de leitura hoje fechado); o reforço vai na direção de *mais* trancado

## [0.23.0] — Horário no fuso certo, link do cardápio limpo e sessão que não cai

- **Horário no fuso do Brasil:** o bot calcula "aberto/fechado" em horário de Brasília (antes usava a hora do servidor, 3h adiantada em produção — errava sobretudo de madrugada) e agora entende horários que viram a noite (ex.: sexta das 08:00 às 02:00).
- **Variável `{proximaAbertura}`** na mensagem de fechado (ex.: "Abrimos amanhã (sexta) às 08:00") — dá pra escrever um aviso curto em vez de listar a semana inteira.
- **Link do cardápio mais limpo** no WhatsApp: agora é só `…/c/seu-restaurante`, sem o código comprido no fim. A confirmação do pedido usa o telefone informado no checkout.
- **Painel não desloga mais sozinho:** a sessão é renovada automaticamente — o usuário deixa de cair na tela de login a cada ~1h.

## [0.24.0] — Higiene de memória das conversas do bot

- **Limpeza ativa de sessões abandonadas:** o bot passou a varrer periodicamente (a cada 10min) as conversas em memória e descartar as inativas há mais de 30min. Antes, uma conversa que o cliente abandonava ficava ocupando memória indefinidamente. Sem efeito visível pro usuário — só deixa o servidor mais leve e estável ao longo do tempo.

## [0.25.0] — Aviso de pedido novo no painel

- **Notificação de pedido novo:** quando chega um pedido, o painel **toca um som**, mostra um **contador** no menu "Pedidos" e — se você estiver em outra tela — abre um **aviso completo** com o cliente, o número do pedido, os itens e o total, com o botão **Visualizar Pedido**. Já estando na tela de Pedidos, o pedido novo aparece destacado com uma etiqueta **"NOVO"**. Tem um botão **🔔/🔕** no topo pra ligar/desligar o som. (Verifica a cada ~15s.)

## [0.26.0] — "Manter conectado" no login (sessão segura)

- **Manter conectado:** o login ganhou a opção **"Manter conectado neste dispositivo"**. Marcada, você fecha e reabre o navegador e **cai direto no painel**, sem digitar e-mail e senha de novo (vale por 30 dias). Desmarcada, a sessão encerra ao fechar o navegador — como antes.
- **Sessão mais segura:** a credencial de sessão passou a ficar num **cookie protegido que o JavaScript não consegue ler** (bem mais resistente a ataques), em vez de no armazenamento do navegador.

## [0.27.0] — Dois planos (Essencial × Completo) + frete por raio

- **Plano Completo (R$ 99/mês):** novo plano além do **Essencial (R$ 79/mês)**. O Completo inclui tudo do Essencial **+ frete por raio** — o valor da entrega é calculado pela **distância (km)** do cliente até o restaurante.
- **Frete por raio:** o restaurante define **faixas** (ex.: até 2 km R$ 5, até 4 km R$ 8…) na nova aba **Entrega** das Configurações. No cardápio, o cliente informa **CEP + número** e o sistema calcula o frete na hora; fora da área, oferece **retirada**. (O Essencial segue com **frete fixo**, agora também na aba Entrega.)
- **Escolher o plano:** no **checkout** dá pra escolher Essencial ou Completo ao ativar o teste; quem já assina pode **mudar de plano** (upgrade/downgrade) na aba **Assinatura**, com ajuste proporcional. A landing passou a mostrar os **dois planos**.
- **Correção:** o checkout não abria após o cadastro (ficava "piscando") — corrigido (a sessão agora é lida do cookie seguro).

> Requer os secrets `STRIPE_PRICE_ID_COMPLETO` e `GEOAPIFY_API_KEY` no servidor (geocodificação via Geoapify, com cache).

## [0.28.0] — "Esqueci a senha" + e-mails (Resend) e login do master pelo Supabase

- **"Esqueci minha senha"** na tela de login: você informa o e-mail e recebe um **link** para definir uma nova senha (expira em 1 hora). Vale para o restaurante **e** para o administrador.
- **E-mails automáticos** (via Resend): **boas-vindas** no cadastro, **confirmação de assinatura**, **aviso ao trocar senha ou e-mail**, **cancelamento** e **exclusão de conta**.
- **Login do administrador (master) modernizado:** agora usa a mesma base de login segura do sistema (Supabase) — por isso também ganhou o "esqueci a senha". Nada muda no dia a dia: mesmo e-mail e senha.

> Requer os secrets `RESEND_API_KEY` (+ `EMAIL_FROM` do domínio verificado) e `SUPERADMIN_EMAIL` (e-mail do administrador) no servidor.

## [0.29.0] — Impressão de pedido na térmica (Plano Completo)

- **Imprimir comanda:** ao abrir um pedido no painel (ou quando chega um pedido novo), aparece o botão **🖨️ Imprimir comanda**, que imprime numa **impressora térmica 80mm** (ex.: Elgin i7/i8, Epson T20x — qualquer uma com driver instalado). Saem **2 vias**: a da **cozinha** (itens, opcionais e observações, **sem preços**) e o **cupom do pedido** (cliente, endereço, pagamento e total).
- **Exclusivo do Plano Completo:** no Plano Essencial o botão não aparece e a aba mostra o aviso de upgrade.
- **Cortar entre as vias:** em **Configurações → Impressora** dá para imprimir as duas vias **juntas** (padrão, separadas por um tracejado para destacar à mão) ou em **2 cupons separados** (a guilhotina corta entre eles).
- Impressão pelo próprio navegador (sem instalar nada). Para sair automático/sem caixa de diálogo, dá para rodar o Chrome em modo *kiosk-printing* (passo a passo em `docs/planos-e-frete.md`).

## [0.30.0] — Caixa do dia (Plano Completo)

- **Caixa / fechamento:** nova aba **Caixa** no painel para controlar o dinheiro do dia. Você **abre o caixa** informando o fundo de troco, **recebe** cada pedido conforme o dinheiro entra (a forma e o valor já vêm preenchidos do pedido) e, no fim, **fecha conferindo a gaveta**.
- **Recebimento por pedido:** o pedido do WhatsApp nasce "a receber" e só entra no caixa quando você marca **Receber** (na aba Caixa ou no próprio pedido). Dá para **estornar** antes de fechar. Pix e cartão entram no resumo; **só o dinheiro** conta na conferência física.
- **Sangria e suprimento:** registre retiradas e reforços de dinheiro na gaveta durante o dia.
- **Fechamento com conferência:** o sistema calcula o **esperado em dinheiro** (fundo + recebido em dinheiro + suprimentos − sangrias), você conta a gaveta e informa o valor, e ele mostra a **diferença** (sobra ou falta). Fica um **histórico** dos caixas fechados.
- **Exclusivo do Plano Completo:** no Essencial a aba mostra o aviso de upgrade.

## [0.31.0] — Pré-visualização de impressão + ícones

- **Impressão com pré-visualização:** **Imprimir comanda** agora abre uma **janela com a prévia das duas vias** (cozinha e cupom) e botões **Imprimir cozinha** e **Imprimir cupom**. Você vê o que vai sair e imprime cada via separada — **sem risco de fechar uma sem querer**. (Saiu o antigo ajuste "cortar entre as vias": como cada via é uma impressão, a impressora já corta no fim de cada uma.)
- **Ícones no lugar de emojis:** botões e marcações do painel (som, cadeado, tipo de entrega/retirada, retirada no cardápio) passaram a usar **ícones** em vez de emojis, deixando a interface mais profissional.
- **Caixa mais amigável:** sangria, suprimento e fechamento deixaram de usar a caixinha de texto do navegador e agora abrem um **modal próprio** — no fechamento, a **diferença (sobra/falta) aparece em tempo real** enquanto você digita o valor contado.

## [0.32.0] — Recebimento no Pedido, Caixa mais organizado

- **Receber pagamento agora é no pedido:** você abre o pedido e clica em **Receber pagamento**. A aba **Pedidos** ganhou um **selo** "A receber"/"Recebido" e um **filtro** por pagamento, pra achar rapidinho o que falta receber.
- **Caixa focado na função dele:** abrir, sangria/suprimento, fechar e conferir o dinheiro. Ele mostra os **"Recebimentos deste caixa"** com a opção de **Estornar** (corrigir um recebimento errado) — sem mais a lista de "a receber" duplicada lá dentro.
- **Pré-visualização de impressão mais fiel:** a prévia na tela agora mostra as linhas **exatamente como saem no papel** (não quebra linha onde a impressora não quebra).

## [0.33.0] — Caixa do dia: contagem de cédulas, relatório e tela estilo PDV

- **Fechamento com contagem de cédulas:** ao fechar o caixa, você conta a gaveta **nota por nota** (de R$ 200 a R$ 0,05) e confere os recebimentos em **cartão/Pix** no mesmo lugar; o sistema mostra a **diferença** (sobra/falta) de cada lado.
- **Relatório de fechamento impresso (80mm):** ao fechar, sai um **relatório** com as vendas por forma, os movimentos do dia (saldo inicial, suprimentos, sangrias), o **Total em Caixa** e o **Faturamento**, mais a diferença. Fica salvo para **reimprimir** depois.
- **Não fecha com pagamento a receber:** se ainda houver pedidos do dia sem receber, o caixa **avisa e bloqueia** o fechamento, com um **atalho** para a lista de "a receber".
- **Tela do caixa repaginada:** **Total em Caixa** em destaque no topo, cartões de **Vendas por forma** (todas as formas, zeradas quando não houve venda) e **Movimentação do caixa**, e um **extrato** do turno (hora, nº, cliente, valor, forma) com botão **Estornar**.
- **Caixas anteriores:** mostra os **3 últimos** fechamentos com um resumo direto na linha (operador, Total em Caixa, Fechado, diferença) e **abre o relatório** ao tocar.
- **Abertura repaginada:** ao abrir o caixa você informa **operador**, **saldo inicial** e **observações**.
- **Lançamento mais rápido na conferência:** em cartão/Pix, digite o valor e aperte **Enter** — ele lança e o foco fica no campo para o próximo, sem precisar clicar.

## [0.34.0] — Cardápio em lista com busca

- **Tela de itens em lista:** a Gestão de Itens deixou de ser uma grade de cards e virou uma **lista** — cada item numa linha (foto, nome, preço, disponível, editar e excluir), agrupada por categoria. Mais fácil de varrer quando o cardápio é grande.
- **Busca por nome:** uma barra no topo filtra os itens conforme você digita, **ignorando acento** (procurar "cafe" acha "Café"). Categoria sem resultado some, `Esc` limpa a busca e, quando nada bate, aparece um aviso de "nenhum item encontrado".

## [0.35.0] — Item vendido só no local

- **Só no local:** marque um item como "só no local" — ele aparece no cardápio com o aviso e **não pode ser pedido para entrega** (só retirada). No checkout, se houver um item assim no carrinho, a entrega fica indisponível e o pedido vai como retirada.

## [0.36.0] — Controle de estoque

- **Estoque por item:** defina **estoque** e **estoque mínimo** no cadastro do item. A lista avisa "Baixo" e "Esgotado".
- **Cardápio respeita o estoque:** item esgotado aparece como "Esgotado" e não pode ser pedido; cada pedido **baixa o estoque** automaticamente, e o sistema barra quem tentar pedir mais do que tem.

## [0.37.0] — Cardápio em tabela + exclusão segura

- **Tabela de produtos:** a tela de itens virou uma tabela com colunas de **Estoque** e **Mínimo**, mais fácil de ler e gerenciar.
- **Exclusão segura:** excluir um item que já teve vendas pede confirmação e **recomenda arquivar** — ele some do cardápio, mas o histórico e o estoque são preservados. Itens arquivados aparecem em "Mostrar arquivados" e podem ser **restaurados**.

## [0.38.0] — Itens vendidos por quilo

- Marque um item como vendido por **kg**: ele mostra "R$ X/kg" no cardápio, com aviso de "pesado no balcão", e não entra em pedido online (é vendido no local). O estoque de itens por kg aceita casas decimais.

## [0.39.0] — Produto em destaque

- Marque produtos como **destaque**: eles aparecem numa seção "Destaques" no topo do cardápio digital, com um selo de estrela, para o cliente ver logo de cara.

## [0.40.0] — Impressão por porta serial (COM)

- Impressão da comanda direto numa impressora térmica de porta serial (COM), sem a janela do navegador (Plano Completo)
- Configurações → Impressora: método (Navegador/USB ou Serial), baud rate, "sem acento" e tipo de corte do papel (Parcial/Total/Não cortar)
- Corte parcial (picote) como padrão — corrige impressoras que não cortavam o papel
- A impressão por USB (navegador) segue funcionando como antes

## [0.41.0] — Central de Ajuda no painel

- Novo botão "Ajuda" abrindo uma página de Perguntas Frequentes (FAQ)
- Primeira seção com o manual completo da impressora: USB × serial, corte do papel, conectar a serial e imprimir direto pelo USB sem a janela do navegador

## [0.42.0] — Upgrade para o Completo mais claro

- Ao tocar numa função do Plano Completo (imprimir comanda, caixa, frete por raio) no Essencial, aparece um card explicando os benefícios e levando ao upgrade.
- O botão "Imprimir comanda" agora aparece bloqueado (em vez de sumir) no Essencial.
- Conta cortesia no Essencial pode assinar o Plano Completo direto pela aba Assinatura.
- Correções: o checkout não falha mais quando o cadastro de pagamento estava desatualizado; ajuste no layout do cadastro de produto; e o fim de uma piscada do modal ao marcar opções.

## [0.43.0] — Cupom mais bonito e corte na Daruma

- Corte automático do papel agora funciona em impressoras Daruma (DR700/DR800) e avança o papel para o cupom sair inteiro, sem precisar puxar à mão.
- O cupom do cliente ganhou cabeçalho com nome, endereço e telefone do restaurante e rodapé com mensagem de "volte sempre" + link do cardápio digital.
- Nova "Mensagem no rodapé do cupom" em Configurações → Impressora (em branco usa a padrão).
- CEP e telefone na mesma linha do cabeçalho e data no formato dd/mm/aaaa - HH:MM.

## [0.44.0] — Cardápio digital com visual premium

- Os cards do cardápio ficaram maiores e mais bonitos: imagem grande no topo, selos (Destaque, Esgotado, Só no local), preço com ícone de etiqueta e botão Adicionar. 4 por linha no computador e 2 no celular.
- A seção Destaques virou um carrossel: no computador navega pelas setas, no celular arrastando o dedo, com pontinhos indicando que há mais itens.
- No celular o preço não quebra mais em duas linhas e fica centralizado.

## [0.45.0] — Privacidade e conformidade (LGPD)

- O cardápio digital passa a mostrar um aviso de privacidade ao finalizar o pedido, com link para a Política de Privacidade.
- A Política ganhou o contato do Encarregado de dados (atendimento@nymbuslab.com.br), prazo de resposta de 15 dias, a lista completa de parceiros que recebem dados (envio de e-mails e cálculo de entrega) e o aviso de que o banco de dados fica nos EUA.
- Ao criar a conta, passa a ficar registrado quando e qual versão dos termos foi aceita.
- O cardápio digital agora tem um rodapé fixo com links para a Política de Privacidade e os Termos de Uso.

## [0.46.0] — Identidade visual do cardápio (capa + logo)

- Nova seção "Identidade visual" no painel (Configurações → Empresa): envie a **capa** (banner) e a **logo** do restaurante, com uma prévia de como vai ficar.
- O cardápio digital agora abre com um **header personalizado**: capa no topo e logo circular — a página fica com a cara da sua marca. Sem capa/logo, usa um visual padrão elegante (não fica quebrado).
- Ajustes no cardápio: a barra de categorias agora gruda corretamente no topo ao rolar (sem sobrepor o conteúdo) e os ícones de fechar e de remover item ficaram mais modernos.

## [0.47.0] — PDV: vendas no balcão (Plano Completo)

- Nova aba **PDV** no painel para vender no balcão: monte o pedido tocando nos produtos do cardápio (com adicionais, observação e itens por kg), com busca e categorias.
- Na hora de cobrar: **desconto** (em R$ ou %), **pagamento dividido** em várias formas, cálculo de **troco** e impressão da comanda ao finalizar.
- A venda entra automaticamente no **caixa do dia** (precisa estar aberto) e dá **baixa no estoque** — e aparece na lista de Pedidos como "Balcão".
- Funciona no computador e no celular/tablet (carrinho vira uma folha na parte de baixo). Recurso do **Plano Completo**.

## [0.48.0] — PDV repaginado (layout estilo balcão)

- O PDV ganhou um visual novo, mais próximo de um caixa de verdade: **categorias numa barra lateral** com ícones, **cards de produto com foto** e o **carrinho à direita** mostrando o preço unitário de cada item, com Subtotal, Desconto e Total.
- **Desconto** agora é aplicado no próprio carrinho (em R$ ou %).
- A **tela de finalizar venda** foi redesenhada: escolha a forma de pagamento em botões grandes (Dinheiro, Cartão, Pix…), divida o pagamento em várias formas, veja **Pago / Falta / Troco** num resumo do pedido, informe o **CPF na nota** (opcional) e escolha imprimir a comanda da cozinha e/ou o comprovante do cliente.
- No celular as categorias viram atalhos no topo e o pagamento se ajusta à tela.

## [0.49.0] — PDV: venda silenciosa, desconto na finalização e entrega

- Ao finalizar a venda no PDV, **não abre mais o pop-up de impressão**: o pedido entra direto no caixa e na aba **Pedidos**, onde fica para conferência e reimpressão (botão "Imprimir comanda").
- O **desconto** passou a ser aplicado na própria tela de **Finalizar venda** (ao lado do total), com os campos de valor no padrão da plataforma ("R$ 0,00").
- **Entrega no balcão:** ao finalizar, escolha **Balcão, Entrega ou Retirada**. Na Entrega, informe nome, telefone e o endereço (o **CEP preenche** rua/bairro/cidade) e o **frete é calculado** automaticamente (taxa fixa ou por distância), com um ícone de **lixeira para não cobrar** (cortesia). O frete entra no total e a venda fica registrada como Entrega, com endereço e taxa — e dá pra **avisar o cliente** em Pedidos.
- O **desconto** virou um botão ao lado do recebimento que abre um modal (R$ ou %).
- **Caixa do dia obrigatório:** se o caixa ficou aberto de um dia anterior, o **PDV é bloqueado** até fechá-lo (a tela do Caixa avisa). Não dá pra vender sem caixa aberto nem com caixa de outro dia.
- **Estoque confiável em vendas simultâneas:** a baixa de estoque agora é feita de forma **atômica** (na mesma transação da venda). Dois pedidos ao mesmo tempo (cardápio + PDV) não "perdem" mais a baixa um do outro, e uma venda sem estoque é desfeita por inteiro — a contagem física passa a bater.

## [0.49.1] — Correções de confiabilidade e segurança (pré-produção)

- **Bot mais estável ao reconectar:** desligar e religar o WhatsApp pelo painel não deixa mais o bot "offline sem avisar" na próxima queda de rede, nem dispara uma reconexão fantasma — ele volta sozinho de quedas transitórias como esperado.
- **Link de "esqueci a senha" mais seguro:** o link enviado por e-mail passou a usar sempre o endereço oficial da plataforma, fechando uma brecha em que o endereço do link poderia ser forjado.
- **Caixa à prova de corrida:** não é mais possível registrar uma venda no PDV num caixa que acabou de ser fechado — a venda é validada e travada no banco no instante do registro.

## [0.49.2] — Ajustes pós-lançamento (P2)

- **PDV — entrega fora da área não vira mais frete grátis em silêncio:** ao tentar uma entrega para um endereço fora da área de cobertura, o sistema **avisa e bloqueia** (em vez de cobrar R$ 0 sem avisar), para o operador escolher Retirada/Balcão ou ajustar o endereço. A lixeira de cortesia continua valendo para endereços **dentro** da área.
- **Lista de Pedidos mais robusta:** se a tela de Pedidos falhar ao carregar (queda de conexão), agora aparece um aviso claro em vez de a tela ficar "muda".
- **Acessibilidade no PDV:** os modais (item, pagamento, entrega, desconto) passaram a receber o **foco no primeiro campo** ao abrir e foram marcados como diálogo para leitores de tela.
- **Robustez interna:** conexão com o banco com **SSL sempre ligado**, **número do pedido** com garantia de unicidade no banco (sem duplicata sob acesso simultâneo) e versão mínima do Node fixada no projeto.

## [0.50.0] — Composição selecionável (monte seu prato)

- **Cadastro de item:** a **Composição** agora tem **subgrupos com regras** — em cada subgrupo (ex.: "Proteína", "Guarnição") você marca se a escolha é **obrigatória** e define **quantas** opções o cliente pode escolher (mínimo e máximo). Os **Opcionais** (extras pagos) continuam como antes.
- **No cardápio digital e no PDV:** o cliente (e o operador no balcão) **monta o prato** escolhendo dentro de cada subgrupo — escolha **única** (bolinha) quando o máximo é 1, ou **múltipla** (caixinha) quando é mais; só dá pra adicionar quando os subgrupos obrigatórios estão completos. As escolhas da composição **não alteram o preço**.
- **Na comanda da cozinha:** as escolhas saem **agrupadas** por subgrupo (ex.: "Proteína: Frango").
- **Item "Só no local":** no cardápio digital agora é **só para visualização** — o cliente abre e vê o item, mas não consegue pedir (é vendido só no balcão).
- **Correções:** o cardápio digital não sai mais do ar quando faltava uma configuração de horário; o **modal do item no celular** ficou mais compacto, com o botão "Adicionar" sempre visível.

## [0.51.0] — Nomes do cardápio padronizados

- **Cadastro de itens:** o nome de um **produto, categoria ou opcional** é ajustado automaticamente para um padrão consistente — tanto **ao digitar** (ao sair do campo) quanto **ao salvar o cardápio** (ex.: "pastel de queijo" → "Pastel de Queijo", "PASTEL DE CARNE" → "Pastel de Carne"). Conectivos como "de"/"com" ficam minúsculos e medidas/marcas são preservadas (ex.: "Coca-Cola 1,5L"), então os nomes ficam sempre alinhados.

## [0.52.0] — Cardápio: barra de categorias rolável no celular

- **Cardápio digital (celular):** ao tocar numa categoria, a barra de categorias **rola sozinha** para mostrar a categoria escolhida (para a direita ou para a esquerda), em vez de ficar presa no início e esconder a seleção. Você também pode arrastar a barra livremente.

## [0.53.0] — Cardápio: variações com preço e estoque ("a partir de")

- **Cadastro de itens:** nova seção **Variações** — opções com **preço e estoque próprios** (ex.: "Refrigerantes 350ml" com vários sabores, cada um com seu preço e estoque). Com variações, o item pode não ter preço fixo.
- **No cardápio digital e no PDV:** o item aparece como **"a partir de R$ X"**; ao abrir, escolhe-se **uma ou várias** opções com quantidade, e o preço **soma**. Opção sem estoque aparece **esgotada**.
- **Estoque por opção:** cada variação **dá baixa no próprio estoque** ao vender (no cardápio digital e no PDV) — diferente dos opcionais, que não controlam estoque. A comanda lista as opções escolhidas.

## [0.54.0] — Dashboard + reorg do painel

- **Nova aba Dashboard** como tela inicial: saudação, status WhatsApp, 3 métricas (Pedidos Hoje/Faturamento/Ticket Médio) com **comparativo vs ontem** (setas ↑↓), tabela de últimos pedidos, ações rápidas e atividade recente.
- **Sidebar reformulada:** Dashboard em 1º, Cardápio renomeado para **Produtos**, Conexão removida da sidebar.
- **Conexão movida** para sub-aba dentro de **Configurações**.
- **Novas sub-abas Horários e Pagamentos** (extraídas do Bot) em Configurações.
- **Editor de item em 4 abas:** Principal / Composições / Opcionais / Variações, com campo opcional **preço de custo**.
- **Google Stitch MCP** configurado para gerar layouts de tela via IA.

## [0.55.0] — Cardápio web: cards de produto horizontais

- **Cards de produto redesenhados** para o formato **horizontal** (imagem à esquerda, nome e preço à direita), no lugar dos cards verticais com imagem no topo — visual de lista, estilo app de delivery. O título de cada categoria ganhou um filete de destaque.
- **Correção de quebra de layout:** em telas estreitas (celulares pequenos e a faixa de ~700–1000px no desktop, em 2 colunas), o preço longo "a partir de R$ X" empurrava o botão "+ Adicionar" para fora da borda do card. Agora o botão desce inteiro para a linha de baixo e o preço encurta com reticências, sem cortar nada.

## [0.56.0] — Cardápio: reordenar variações

- **Cadastro de itens:** cada variação ganhou setas ▲/▼ para **subir ou descer** sua posição na lista, definindo a ordem em que as opções aparecem no cardápio digital e no PDV.

## [0.57.0] — Mesas e Comandas (Plano Completo)

- **Nova aba Mesas** no painel administrativo (Plano Completo, exige caixa aberto): controle de mesas e comandas por turno, integrado ao caixa do dia.
- **Grade de mesas automática:** informe a quantidade e o sistema monta a grade em linhas e colunas. Cada mesa é um card retangular com o número no centro e cor por status — cinza (livre), verde (ocupada), âmbar (pediu a conta), roxo (em fechamento). Controle de tamanho via slider e toggle para exibir total consumido + duração.
- **Abertura e lançamento de rodadas:** ao clicar na mesa, abre um painel lateral com as abas Itens (histórico de rodadas) e Lançar (grade de produtos do cardápio, carrinho inline, observação). O preço é sempre recalculado no servidor com baixa de estoque atômica.
- **Recebimento parcial e fechamento de conta:** modal de pagamento aceita qualquer forma (Dinheiro, Pix, Cartão…); pode receber parcialmente (vários clientes pagando o seu) ou fechar a conta de uma vez. Totais exibem subtotal + taxa de serviço + total, com barra de recebido/falta atualizada a cada pagamento.
- **Taxa de serviço configurável** por estabelecimento (% salva em config, capturada na abertura da mesa e incluída no total e na pré-conta).
- **Configurar mesas:** modal para adicionar mesas em lote (número → cria Mesa 01, Mesa 02…; ou nomes livres separados por vírgula) e remover mesas livres.
- **Pré-conta** impressa via `Comanda.montarPreConta` (não fiscal): lista de itens agregados de todas as rodadas, subtotal, taxa de serviço, total, recebido/falta.

## [0.57.1] — Mesas: comanda acumulada e correções

- **Comanda acumulada:** adicionar itens a uma mesa agora **acumula** tudo num único pedido da sessão (igual ao modelo de mercado), em vez de criar um pedido novo a cada rodada — o histórico fica coeso e o relatório de pedidos limpo.
- **Cancelar lançamento:** fechar a tela de adicionar itens numa mesa agora volta para a mesa (em vez de ficar na tela do PDV).

## [0.58.0] — Cancelar pedido e item individual

- **Cancelar pedido:** botão "Cancelar pedido" no modal de detalhes para pedidos ainda não recebidos (PDV, cardápio web e mesas). A ação exige confirmação.
- **Cancelar item:** ícone de lixeira em cada linha do pedido para remover um item; o total é recalculado automaticamente. Cancelar o último item cancela o pedido inteiro.
- **Badge "Cancelado":** pedidos cancelados aparecem com etiqueta vermelha na lista (todos os planos) e somem do filtro "A receber".
- **Painel retém a última aba:** ao recarregar o painel, o sistema volta para a aba que estava aberta (PDV, Mesas, Pedidos…) em vez de sempre abrir o Dashboard.

## [0.59.0] — Agente de impressão imprime PDV, mesas e caixa

- **Impressão automática ampliada:** o aplicativo **Nymbus Impressora** passa a imprimir sozinho não só os pedidos do delivery, mas também as **vendas do PDV**, as **comandas de mesa** e o **relatório de fechamento do caixa** — sem abrir nada no navegador.
- **Reimprimir comanda:** botão para reenviar a comanda (cozinha + cupom) de um pedido para a impressora, útil quando o papel acaba ou a impressão falha.
- **Nova tela Configurações → Impressora:** virou uma página de **download do agente** com passo a passo ("Como usar"). A configuração da impressora (porta, corte) agora fica no próprio aplicativo. O botão baixa o instalador para Windows.

## [0.60.0] — Cancelamento de pedido pago com registro no caixa

- **Cancelar pedido pago:** agora é possível cancelar um pedido **já recebido**. O valor é **deduzido do caixa** e o cancelamento fica **registrado** (a venda e o cancelamento aparecem no extrato) — controle anti-fraude, em vez de o pedido simplesmente sumir. Exige caixa aberto.
- **Relatório de fechamento** passa a listar os **cancelamentos** do turno e descontá-los do total.
- **Saldo inicial** (valor de abertura do caixa) agora aparece como uma linha no extrato de movimentações.
- **Filtro "Cancelados"** na aba Pedidos para auditar o que foi cancelado.

## [0.61.0] — Dashboard: Visão de Vendas

- **Nova seção "Visão de Vendas"** no Dashboard com quatro cards de faturamento: **Vendas Hoje, Vendas Ontem, Últimos 7 dias e Venda Mês**. Pedidos cancelados não entram na conta.

## [0.62.0] — Impressão 100% pelo agente (fim da impressão pelo navegador)

- **A impressão pelo navegador foi removida:** toda impressão (delivery, PDV, mesas e caixa) agora passa **exclusivamente pelo aplicativo Nymbus Impressora**. Some o passo de confirmar a janela de impressão e a configuração de porta serial no painel — tudo fica no app.
- **"Reimprimir comanda"** no pedido reenvia a comanda para a impressora; na mesa, **"Imprimir Conta"** reenvia a pré-conta.
- O **relatório de fechamento** do caixa abre apenas para conferência na tela (a impressão sai pelo agente).
- A **Central de Ajuda** foi atualizada para o novo fluxo (instalar o agente).

## [0.63.0] — Dashboard mais enxuto, com análises

- **Saudação no topo:** "Olá, [restaurante]" + status (Aberto/Fechado) + data/hora ficam no cabeçalho; o card de saudação saiu do Dashboard.
- **Nova seção de análises** no Dashboard: gráficos de **Evolução diária (30 dias)** e **Evolução mensal (12 meses)**, **10 mais vendidos**, **Ranking de grupos** e **Visão geral** (Pedidos, Entregas, Itens lançados, Ticket médio) — tudo do mês atual, sem contar cancelados.
- Dashboard ficou focado em métricas: saíram "Últimos Pedidos", "WhatsApp", "Ações rápidas" e "Atividade recente" do painel inicial (o status do WhatsApp continua em Configurações → Conexão).

## [0.64.0] — PDV imprime sozinho (cupom + cozinha), sem pop-up

- **Ao finalizar uma venda no PDV**, a impressão sai **automaticamente** pelo agente: o **cupom da venda** imprime **sempre** e a **via da cozinha** quando a venda tem itens marcados "Imprime na cozinha". Antes só a via da cozinha era enviada.
- **Sem aviso de "novo pedido":** a venda de balcão **não abre mais** o pop-up de novo pedido (nem toca o som) — é venda direta. Pedidos recebidos pelo WhatsApp continuam avisando normalmente.

## [0.65.0] — Tela de Pedidos: resumo, canal e ações rápidas

- **Resumo do período** no topo da lista: **Nº de pedidos, Faturamento, Ticket médio e Cancelados** — recalculado conforme os filtros (período/tipo/canal/busca).
- **Pedido cancelado em destaque** na lista (esmaecido + total riscado), para auditar de relance.
- **Prévia dos itens** na linha/card (ex.: "2x X-Burger · 1x Coca 2L") — dá pra ver o pedido sem abrir.
- **Canal de origem:** nova coluna e filtro **WhatsApp / Balcão / Mesa**.
- **Ações rápidas no hover** (desktop): **Reimprimir comanda** e **Receber pagamento** direto na linha, sem abrir o pedido (Receber pede confirmação).
- **Correções:** cancelar um item de pedido com entrega não desconta mais a taxa por engano; "Reimprimir" deixa de aparecer em pedido cancelado.

## [0.66.0] — Formato de dinheiro unificado (com separador de milhar)

- **Valores em R$ no mesmo padrão em todo o sistema:** `R$ 1.234,56` (com ponto de milhar). Antes a tela de **Caixa** mostrava sem o ponto (`R$ 1500,00`).
- O campo de **valor no pagamento de Mesa** passou a usar a mesma máscara dos demais campos de dinheiro.
- **Cupons e relatório impressos** também ganharam o separador de milhar.

## [0.67.0] — PDV por tipo de venda + aviso de novo pedido só do cardápio web

- **Venda no PDV não abre mais o aviso de "novo pedido"** (Balcão, Entrega ou Retirada). Esse alerta agora é exclusivo dos pedidos que chegam pelo **cardápio web** — que são os que você precisa ser avisado.
- **Cada tipo de venda no PDV segue seu fluxo:**
  - **Balcão:** paga na hora, entra no caixa e imprime a comanda da cozinha (quando há item de cozinha) + o cupom.
  - **Entrega:** **sem cobrança na hora** — o pedido vai para a aba **Pedidos como "a receber"** (o recebimento é feito depois) e imprime cozinha + cupom (com os dados da entrega).
  - **Retirada:** **sem cobrança na hora** — vai para **Pedidos como "a receber"** e imprime **só a comanda da cozinha**.
- Na tela **Finalizar venda**, Entrega e Retirada não pedem forma de pagamento — o botão vira **"Enviar para Pedidos"**.
- A coluna **"Canal"** na lista de Pedidos ficou 100% confiável (WhatsApp / Balcão / Mesa), inclusive para vendas de PDV com entrega.

## [0.68.0] — Mesas: transferir/juntar, resumo do salão, alerta de mesa parada e nº de pessoas

- **Transferir / juntar comanda:** botão **Transferir** escolhe a mesa de destino. Destino **livre** → a comanda é **transferida** (a mesa antiga libera). Destino **ocupado** → o sistema confirma **"Juntar contas"** (as duas viram uma conta só); para pagar separado, mantenha as mesas abertas.
- **Resumo do salão no topo:** contagem de mesas **Livres / Ocupadas / Pediu conta** e o **total em aberto**, com legenda das cores.
- **Alerta de mesa parada:** a mesa ocupada que fica muito tempo **sem lançar um novo pedido** ganha um sinal vermelho (com o tempo parado); o limite é configurável em **Configurar Mesas** (padrão 30 min; 0 desliga).
- **Nº de pessoas na mesa:** ao **abrir a mesa**, o sistema pergunta quantas pessoas (opcional). Com 2 ou mais, aparece o **valor por pessoa** no painel, na **conta impressa** e no **fechamento**. Dá para ajustar depois pelo lápis ao lado de "Pessoas".

## [0.69.0] — Receber pagamento por forma na tela de Pedidos

- Ao **receber um pedido** na tela de Pedidos, o sistema agora **pergunta/confirma a forma de pagamento** (já pré-selecionando a que o cliente informou) — antes recebia direto, sem escolher. Assim o dono sabe exatamente **como** cada pedido foi pago.
- Pedidos de **mesa** deixam de ser recebidos por aqui: são pagos na aba **Mesas** (Fechar Conta / Receber Parcial), onde se escolhe a forma e aplica a taxa de serviço.

## [0.70.0] — Módulo Mesas na página de planos e no upgrade

- A **página inicial** passa a mostrar o módulo **Mesas e comandas** como parte do **Plano Completo** — nos cards de preço (agora com a mesma lista lado a lado, marcando o que cada plano tem) e na lista de recursos.
- No painel, quem está no **Essencial** e clica em **Mesas** vê um convite claro para o Plano Completo (com o que ganha), no mesmo padrão do PDV e do Caixa.

## [0.71.0] — Painel inicial: cards alinhados e Visão geral mais útil

- Os três cards de análise do painel (10 mais vendidos, Ranking de grupos, Visão geral) ficam do **mesmo tamanho**, mesmo sem dados.
- O card **Visão geral** troca números pouco acionáveis por métricas que ajudam a decidir: **ticket médio**, **taxa de cancelamento**, **canais** (de onde vem o faturamento) e **forma de pagamento mais usada**.

## [0.72.0] — Caixa: estorno com rastro e fechamento mais confiável

- **Estornar** um recebimento agora **deixa registro** no extrato (em vez de sumir) e só aparece onde faz sentido — pedidos a receber (WhatsApp / PDV Entrega / Retirada). Mesa e balcão não têm estorno (mesa acerta na mesa; balcão, cancelando).
- O **fechamento do caixa** não trava mais por causa de **pedido cancelado**.
- **Mesa aberta** ao fechar o caixa é avisada à parte, com atalho para a aba **Mesas** (antes vinha misturada como "pedido a receber").
- No **fechamento**, o botão de ação fica **fixo no rodapé** — não some mais atrás da barra de tarefas em telas menores.

## [0.73.0] — Impressora: conexão USB e instalação pelo painel

- O agente **Nymbus Impressora** passa a imprimir por **USB** (além de Rede/Wi-Fi e Serial). Versão **0.2.0**.
- O download e a atualização do agente ficam **no próprio painel** (Configurações → Impressora): botão de baixar, **versão mais recente** exibida e um **guia** caso o Windows mostre um aviso na instalação. O usuário não precisa sair para lugar nenhum.

## [0.73.1] — Ajustes de interface

- Ao **atualizar a página**, o painel abre **direto na última aba** usada, sem piscar o Dashboard.
- No **PDV**, adicionar um produto não mostra mais um aviso a cada clique — o item já aparece no carrinho.

## [0.73.2] — Agente de impressão: mais confiável e login novo

- **Bandeja:** fechar a janela agora **minimiza para a bandeja do relógio** (com ícone da marca; Abrir/Sair no menu). Antes o app sumia sem ícone e você não sabia se estava rodando.
- **Reconexão:** reabrir o agente já logado **reconecta sozinho** — acabou o "Sem conexão com o servidor" ao fechar e abrir.
- **Impressora mantida:** a impressora configurada volta **já selecionada** ao reabrir; não precisa Detectar de novo.
- **Tela de login mais limpa:** marca central + card enxuto, **sem o campo técnico de servidor**. A janela nasce maior (765×670) e pode ir até tela cheia.

## [0.73.3] — Agente de impressão: tela principal em cards + correções

- A tela do agente **após o login** foi reorganizada em **cards** arredondados e centralizados (visual Nymbus): Restaurante, Impressora e Registros.
- Corrigido: a tela de **login e a de configuração apareciam juntas** (com barra de rolagem) quando já logado — agora só a tela certa aparece.
- Removida a **barra de menu** padrão do Windows na janela do app.

## [0.73.4] — Correção: produtos com variação apareciam zerados

- **Pedidos e Mesas** agora mostram o **valor certo** de itens com variação (ex.: "Refrigerante 200ml" → Coca-Cola) — antes a linha e o subtotal saíam **R$ 0,00**, porque só o produto-pai (agrupamento) era exibido.
- A **variação escolhida** passa a aparecer como detalhe sob o nome do produto (igual ao PDV), no pedido e na mesa.
- Corrigido também: **cancelar um item** de um pedido com variação recalculava o total **sem** o preço da variação (gravava um total menor). O impresso (cupom/cozinha) já saía correto.

## [0.73.5] — Caixa: extrato mostra a mesa

- No **extrato do caixa**, o recebimento de uma **mesa** agora aparece identificado como **"Mesa 3"** na coluna Cliente (antes ficava "—", sem referência). Vale também para os recebimentos de mesa já registrados.

## [0.73.6] — Mesas: mesa livre não mostra mais itens da conta anterior

- Corrigido: uma mesa **fechada (livre)** ainda exibia os **itens da conta já paga** e "Aberta às …". Agora, ao fechar a conta, a comanda anterior deixa de aparecer — a mesa livre nasce limpa.
- Efeitos relacionados corrigidos: **lançar** numa mesa reaberta não acumula mais no pedido já pago; o **total da mesa** não soma sessões anteriores; **transferir/juntar** só considera a conta atual.

## [0.73.7] — Receber pagamento (Pedidos): split + correção de sobreposição

- O modal **Receber pagamento** (aba Pedidos) agora aceita **mais de uma forma de pagamento** (split), como no PDV e nas Mesas — com Pago/Falta/Troco e validação de que a soma bate com o total. O caso simples (uma forma) segue em dois cliques.
- Corrigido: o modal de recebimento **aparecia atrás** do modal de detalhe do pedido — agora abre por cima.

## [0.73.8] — Pedidos: tipo "Local" para mesa e balcão

- Pedidos de **mesa** (e de **balcão** do PDV) apareciam como **"Retirada"** na lista/detalhe — incorreto. Agora mostram o tipo **"Local"** (consumo no local), com etiqueta e ícone próprios. "Retirada" fica só para retirada de verdade e "Entrega" para delivery.
- No detalhe, o bloco de entrega mostra **"Consumo no local"** nesses casos (antes "Retirada no local").
- O filtro **Tipo** ganhou a opção **Local**.

## [0.73.9] — Mesas: comprovante de pagamento (parcial e fechamento)

- Ao **Receber Parcial** e ao **Fechar Conta** de uma mesa, agora sai automaticamente um **comprovante de pagamento** pela impressora (antes só a "Imprimir Conta" gerava impressão).
- **Parcial:** mostra o que foi recebido agora, o total já recebido e a falta. **Final:** total da conta, formas de pagamento, pago, troco e o carimbo **PAGO**.

## [0.74.0] — Reimprimir: escolher a via (cozinha / cupom / ambas)

- O botão **Reimprimir** (aba Pedidos) antes reimprimia sempre as **duas vias** (cozinha + cupom). Agora abre uma pergunta rápida: **Comanda (cozinha)**, **Cupom (cliente)** ou **Ambas** — reimprime só o que você escolher, sem gastar papel à toa.

## [0.74.1] — Correção: setas de reordenar variações não apareciam

- No editor de **variações** do produto, os botões de **subir/descer** apareciam vazios (as setas ▲/▼ sumiam). Corrigido — os ícones voltaram.

## [0.74.2] — Correção: mesa reaberta mostrava pagamento da conta anterior

- Uma mesa fechada e **reaberta** exibia o **valor já recebido da sessão anterior** (ex.: R$ 60 de uma conta de ontem apareciam na abertura de hoje). O total dos itens já estava certo (v0.73.6); faltava recortar a soma dos **pagamentos** à sessão atual. Agora só contam os recebimentos feitos **após a reabertura** da mesa — o histórico do caixa permanece intacto.

## [0.74.3] — PDV: busca encontra o sabor (variação) e adiciona em 1 clique

- No **PDV**, buscar por um sabor (ex.: "coca-cola") não encontrava nada quando ele era uma **variação** de um produto (ex.: "Refrigerante 200ml") — era preciso achar o produto-pai e abrir o modal. Agora a busca mostra o **sabor direto** como resultado ("Coca-Cola 200ml · R$ 3,00") e um clique já adiciona ao carrinho. Buscar pelo nome do produto (ex.: "refri") lista todos os sabores. Cada resultado respeita o **estoque do próprio sabor**.

## [0.74.4] — Correção: filtro do PDV vazava para o lançamento da mesa

- Uma busca feita no **PDV** (ex.: "coca-cola") continuava aplicada ao abrir o **Lançar** de uma mesa (e vice-versa), já que os dois usam a mesma grade. Agora o filtro (busca + categoria) é **zerado ao entrar e sair** do lançamento da mesa — cada contexto começa limpo.

## [0.75.0] — Monitoramento: saúde do sistema no painel master

- Nova aba **Monitoramento** no painel master (`/admin-master`): mostra, ao vivo, se o **Banco de Dados** responde (com a latência e o pool de conexões), o **uptime**/versão/memória da **Aplicação**, quantos **Bots WhatsApp** estão conectados agora e quantos trabalhos há na **Fila de Impressão**. Um banner no topo resume tudo em "Todos os sistemas operacionais" (verde) ou "Instabilidade detectada" (vermelho). Botão **Atualizar** + atualização automática a cada 20s enquanto a aba está aberta.
- Os erros **"Falha ao validar a sessão" (500)** de autenticação agora **deixam rastro no log** do servidor (antes a causa sumia) — foi o ponto cego que motivou esta tela.
- Só leitura, sem migration. Nova rota `GET /api/admin/diagnostico` (restrita ao super-admin).

## [0.76.0] — Responsividade: painel adapta ao notebook e modais se ajustam à tela

- **Modais agora se ajustam à altura da tela** e rolam dentro de si — antes, um modal mais alto que a tela (ex.: em notebooks de altura menor) ficava **cortado em cima/embaixo sem como rolar**. Vale para todos os modais.
- **Configurações — fim da barra de rolagem horizontal**: a barra de sub-abas (Empresa/Cardápio/Horários/Pagamentos/Conexão/Bot/Entrega/Impressora) agora **quebra em várias linhas** em telas mais estreitas, em vez de vazar para fora e cortar o último item.
- **Notebook/janela estreita (~640–1100px)**: novo ajuste que dá mais espaço ao conteúdo (sidebar e margens menores) — antes o layout pulava direto de "desktop largo" para "celular", então nessa faixa o painel apertava e gerava rolagem. Disparado por reclamação de cliente em notebook 1300×732 (efetivo ~1040px com escala do Windows). Só CSS; validado no navegador a 1300, 1040 e 760px.

## [0.76.1] — Pedidos: tabela sem quebra de linha e sem barra horizontal + fechamento mais compacto

- **Tabela de Pedidos**: com muitos pedidos e nomes longos, a tabela **vazava para fora da tela** (barra de rolagem horizontal na página inteira) e o **nome do cliente quebrava em 2 linhas**. Agora a tabela usa **largura fixa por coluna**: cada coluna ocupa exatamente o espaço disponível e o texto que não cabe é **cortado com reticências ("…")** — **nada quebra linha** e a página **nunca mais rola para o lado**. Nº do pedido, Telefone e Total sempre aparecem por inteiro (nunca cortam); no notebook a coluna **Telefone é ocultada** (o número segue no detalhe do pedido) para dar espaço ao nome. Validado a 1300 e 1040px.
- **Fechamento de caixa**: a tela de contagem ficou **mais compacta** (linhas de cédula e cartões menores), reduzindo a rolagem em telas de altura menor. O rodapé com o botão "Fechar caixa" segue sempre visível.

## [0.76.2] — Fechamento de caixa: contagem em duas colunas (Cédulas · Moedas)

- A contagem do dinheiro no **fechamento de caixa** passou de uma lista única (12 linhas) para **duas colunas lado a lado**: **Cédulas** (R$ 200 a R$ 2) e **Moedas** (R$ 1 a R$ 0,05). Com isso a tela **cabe inteira** em notebooks (1300×732) **sem rolagem** — antes era preciso rolar para ver todas as denominações e o botão de fechar. Os totais e a conferência continuam idênticos.

## [0.77.0] — Cardápio web: modal de item repaginado (estilo iFood)

- O **modal de escolha do prato** no cardápio web (`/c/:slug`) ganhou um visual no estilo **iFood**, mantendo a **identidade Nymbus** (tema escuro + roxo): **imagem grande no topo**, nome/descrição/preço em destaque, cada grupo de escolha vira uma **faixa com título e subtítulo** (`Escolha 1 opção` / `Escolha até 2 opções`) com **selo "Obrigatório"** e **check verde** quando preenchido, **escolha única em botão-rádio** e adicionais/sabores com **＋/−**, campo **"Alguma observação?"** com contador de caracteres e uma **barra fixa** embaixo (quantidade + **Adicionar R$ X**).
- **Somente apresentação** — a lógica de seleção, validação (obrigatório/mín/máx), estoque/esgotado, cálculo de preço e adição ao carrinho é exatamente a mesma. Validado no navegador (mobile) com o cardápio real.

## [0.77.1] — Cardápio web: busca acha o sabor (variação) e adiciona em 1 clique

- No **cardápio web**, buscar por um sabor (ex.: "coca") não encontrava nada quando ele era uma **variação** de um produto (ex.: "Refrigerante 350ML"). Agora a busca mostra o **sabor direto** como resultado ("Coca-Cola · Refrigerante 350ML · R$ 6,00") e um clique **já adiciona ao carrinho** (se o produto tiver outras escolhas obrigatórias/adicionais, abre o modal). Buscar pelo nome do produto (ex.: "refri") lista todos os sabores; cada resultado respeita o **estoque do próprio sabor**. Mesmo comportamento já existente no PDV.

## [0.77.2] — Cardápio web: modal rola sozinho para a próxima seção

- No modal de escolha do prato, ao **completar um grupo** (todas as escolhas feitas — ex.: as opções de "Principais"), o modal **rola suave sozinho até a próxima seção** (ex.: "Guarnição"), agilizando o preenchimento. Só rola na conclusão do grupo (não fica pulando se o cliente troca de opção) e respeita "reduzir movimento" do sistema.

## [0.78.0] — PDV/Mesa: modal de produto no mesmo layout do cardápio web

- O **modal de produto do PDV** (que a **Mesa** reusa no "Lançar") ganhou o **mesmo visual novo** do cardápio web (estilo iFood, identidade Nymbus): grupos em **faixa** com título/subtítulo, **selo Obrigatório/Opcional**, **check verde** quando o grupo é preenchido, **escolha única em botão-rádio**, adicionais/opções com **＋/−**, **observação** em faixa com contador e uma **barra fixa** embaixo (quantidade/peso + **Adicionar/Salvar R$ X**). Também rola sozinho para a próxima seção ao completar um grupo. **Design consistente** entre cardápio web e painel.
- **Somente apresentação** — toda a lógica do PDV (item por **kg/peso**, grupos, adicionais, variações, editar item, adicionar ao carrinho) permanece igual.

## [0.79.0] — Monitoramento: histórico de incidentes no painel master

- A aba **Monitoramento** (painel do super-admin) ganhou uma seção **"Histórico de incidentes"** que lista os episódios de instabilidade registrados. Hoje o gatilho é a **falha ao validar a sessão** (quando o app não consegue resolver o login por um soluço de conexão ao banco) — a mesma causa que a Fase 1 passou a registrar no log. Agora ela fica **consultável** no painel, com **última vez**, **quantas vezes repetiu** e a **mensagem do erro**.
- **Rajadas são agrupadas:** repetições do mesmo erro numa janela de 5 minutos viram **um único episódio com contador** (ex.: "14×"), em vez de encher a lista. Quando não há nada, mostra "**Nenhum incidente registrado — tudo tranquilo.**".
- O histórico é guardado por **90 dias** (limpeza automática diária) e é buscado só ao abrir a aba e no botão **Atualizar** (não pesa no monitoramento ao vivo que roda a cada 20s).

## [0.79.1] — Caixa: corrige troco na Mesa e clareza dos cancelamentos no fechamento

- **Troco no pagamento de Mesa (erro de dinheiro):** ao fechar/receber uma mesa em dinheiro, o sistema gravava no caixa o valor **entregue** pelo cliente (com o troco embutido) em vez do valor da **venda** — inflava o "esperado" na gaveta e gerava diferença negativa no fechamento (ex.: cliente paga R$ 28 com uma nota de R$ 50 → o caixa contava R$ 50 e "faltava" R$ 22). Agora o pagamento de Mesa **desconta o troco** e registra só a parte da venda, igual ao PDV e ao "Receber" da aba Pedidos. *(Os caixas já fechados não mudam; a correção vale para os próximos.)*
- **Cancelamento não infla mais a forma de pagamento:** quando uma venda era cancelada (ex.: Pix de R$ 17 cancelado e refeito por R$ 12), o **relatório de fechamento** mostrava o Pix somado bruto (R$ 29) — o total do caixa já descontava certo, mas a linha por forma confundia. Agora cada forma aparece **líquida** (Pix R$ 12), com os cancelamentos listados à parte para auditoria. A **tela de fechamento** também passou a descontar o cancelamento no "esperado" de cartão/Pix (antes mostrava uma diferença fantasma no eletrônico).
