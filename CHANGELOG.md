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
