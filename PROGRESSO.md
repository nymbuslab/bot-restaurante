# Progresso do Projeto

> Detalhes de arquitetura e stack ficam em `CLAUDE.md`. Aqui entram apenas etapas: fazendo, próximos passos e concluído.

## 🔄 Em Andamento

_(nada no momento)_

## 📋 Próximos Passos

- [ ] (P2) Tornar pergunta de bebida e observação configuráveis no painel (features existem, falta toggle)
- [ ] (P2) HTTPS automático + guia de segurança para produção pública
- [ ] (P2) **[operacional]** Limpar pastas órfãs `session-*/` no volume de produção (Fly) — lixo do whatsapp-web.js que incha o volume e os backups. Local já limpo; falta rodar no Fly: `fly ssh console` → `rm -rf /app/data/tenants/*/session-*` (preservar `baileys-*/`). Ver `DEPLOY.md`

## ✅ Concluído

- [x] Estrutura base do bot (whatsapp-web.js + Express)
- [x] Máquina de estados do atendimento (fluxo.js) — cardápio → opcionais → finalização
- [x] Painel web administrativo (login, cardápio, configurações, conexão, pedidos)
- [x] store.js com recarga ao vivo (mudanças no painel valem sem reiniciar o bot)
- [x] Documentação de deploy (README.md + DEPLOY.md com PM2, VPS e Fly.io)
- [x] Estabilidade do servidor: erros do Puppeteer/WhatsApp não derrubam o painel
- [x] Fluxo por categorias antes de listar itens (reduz tamanho da lista)
- [x] Simulador de conversa no terminal (`testar-bot.js`) e no painel (aba Simulador)
- [x] Taxa de entrega configurável no painel; exibida ao cliente no checkout
- [x] Bot silencioso no estado ATENDENTE (não interfere na conversa do humano)
- [x] Pergunta de bebida suprimida quando cliente já adicionou bebidas ao carrinho
- [x] Deploy no Fly.io com Docker + Chromium do sistema + volume único para dados e sessão
- [x] Migração de pedidos de JSON para SQLite (`better-sqlite3`) — migração automática do legado
- [x] **Horário de funcionamento por dia da semana** — bot responde "fechado" fora do horário; painel com tabela de 7 dias
- [x] **Arquitetura multi-tenant SaaS** — cada empresa tem diretório isolado, banco de pedidos próprio e sessão WhatsApp separada
- [x] Banco mestre de tenants em SQLite (`data/empresas.db`) com autenticação por e-mail + senha
- [x] `src/multi-bot.js` — gerencia um WhatsApp Client por tenant (substitui `bot.js` single-tenant)
- [x] Página de onboarding (`/cadastro.html`) com cadastro e login automático
- [x] Login atualizado para e-mail + senha; cabeçalho do painel exibe nome do restaurante
- [x] Migração automática de instalação legada (cria tenant a partir de `data/config.json`)
- [x] Documentação completa atualizada (CLAUDE.md, README.md, DEPLOY.md, PRD.md)
- [x] **Design system Nymbus Lab** — tokens de cor (`--accent`, `--secondary`, `--accent-fg`...), tipografia, componentes; protótipos em `design/prototipos/`; referência visual em `design/UI.md`
- [x] **Redesign Cardápio — editor modal** (Passos 1–4) — modal de edição de item com upload de foto (MIME-validado, path confinado por tenant), builders visuais de composição e opcionais serializando para o formato de texto atual; rota `POST /api/imagem` e `GET /imagens/:slug/:filename` em `src/servidor.js`
- [x] **Redesign Cardápio — lista em cards** (Passo 5) — `renderCardapio()` reescrito: grid 2 colunas desktop / 1 coluna mobile, foto do item, toggle de disponibilidade, botões editar/excluir com ícones SVG; CSS `.cards-grid`/`.item-card` em `style.css`
- [x] **Redesign Login/Cadastro** — layout split (painel de marca gradiente roxo→ciano + área de formulário); logo garfo-e-faca SVG; eye toggle para senha (e confirmação no cadastro); campo `#senha2` e validação de senhas mantidos; `#senha2` omitido do redesign foi corrigido antes da implementação
- [x] **Avisar cliente "pedido pronto"** — `POST /api/pedido/avisar`: envio manual (1 por clique, nunca em massa) de mensagem ao cliente pelo WhatsApp do tenant; templates editáveis em `config.json` (`mensagens.pedidoPronto.entrega`/`.retirada`, variáveis `{cliente}`/`{numero}`); coluna `avisadoEm` no pedido; campos editáveis na aba Configurações
- [x] **Fix `/api/status` sem token** — `atualizarStatus()` no painel chamava `fetch` cru (401) → QR nunca aparecia no front; passou a usar o helper `api()` com `Authorization`. Bug pré-existente que só aflorou quando o QR voltou a gerar (Baileys)
- [x] **Redesign do shell do painel** — sidebar (desktop) + bottom-nav (mobile); home passou de Conexão → Pedidos; um único handler de logout reaproveitado
- [x] **Redesign Pedidos** — métricas com comparativo real vs período anterior (em azul/`--secondary`), filtros com busca, detalhe do pedido em 2 colunas, paginação 10/página ("Mostrando X–Y de N" + `‹ 1 2 … ›`) e datas relativas ("Hoje/Ontem, HH:MM"); pills de tipo mantidas semânticas (Entrega azul / Retirada verde) por decisão de design
- [x] **Redesign Cardápio** — cabeçalho "Gestão de Itens" + botões Nova categoria/Adicionar item, faixa de 3 métricas (total/categorias/indisponíveis), cabeçalho de categoria com ícone + divisória, cards com descrição truncada e rótulo Disponível/Indisponível, card "+" tracejado por categoria
- [x] **Redesign Conexão** — layout 2 colunas (passos "Como conectar" + Dica e painel de QR com moldura gradiente roxo→ciano); 4 estados (desligado/iniciando/aguardando QR/conectado); estado conectado mostra o número do WhatsApp (`getEstado` passou a expor `numero`, capturado de `sock.user.id` no `connection:open`)
- [x] **Redesign Configurações** — card de status do atendimento em destaque, seções com ícone, mensagens em grid (todas preservadas), horários em tabela (desktop) / cards por dia (mobile), formas de pagamento como pills com "+ Adicionar Método", barra inferior com Descartar (recarrega do servidor) + Salvar
- [x] **Redesign Simulador** — "Console de Testes" com chat fiel (avatar + "Nymbus Bot" + horário), painel "Variáveis de Contexto" real (etapa, itens, total do carrinho); mocks sem backend (delay/logs/status da resposta) deliberadamente não construídos
- [x] **Fix bottom-nav mobile** — `.sidebar` no mobile tinha `top:0` herdado + `bottom:0` → barra esticava pra tela toda e cobria o conteúdo; corrigido com `top:auto`
- [x] **Relatórios de pedidos por período** (entregue no redesign de Pedidos) — seletor de período (Hoje / 7 dias / Personalizado) e métricas reais: total de pedidos, média diária, ticket médio e comparativo vs período anterior. Atende ao item de relatórios do ROADMAP (faltaria só export/CSV como item futuro menor)
- [x] **Super-admin — Passo 1/3: backend + autenticação master** (sem tela) — conta master fixa via env (`SUPERADMIN_EMAIL`/`SUPERADMIN_SENHA_HASH`, hash com a mesma `hashSenha` do projeto via `npm run gerar-hash-admin`; sem env → rotas `/api/admin/*` desativadas com 503, sem fallback). Auth isolada (`tokensAdmin` ≠ `tokens`, `exigeSuperAdmin`, `timingSafeEqual`). Rotas: listar/criar tenant, suspender/reativar, excluir. Suspensão com efeito real (login recusado + bot desconectado + tokens do tenant invalidados). Exclusão destrutiva na ordem segura (desconectar → `pedidos.fecharConexao` → `empresas.excluir` apaga linha + pasta) com trava `{ confirmacao: "<slug>" }`. `dotenv` + `.env.example`. Validado por smoke test (15 cenários via curl)
- [x] **Super-admin — Passo 2/3: tela `/admin-master`** — página separada (`public/admin-master.html` + `public/app-admin.js`), sem mistura com o painel de restaurante. Token master em `sessionStorage["tokenAdmin"]` (chave própria; expira ao fechar a aba por escolha de segurança). Login master fiel ao do restaurante (marca gradiente + logo), erros claros (401/503). Listagem em tabela (nome/email/slug/status/criado em) com pills Ativo (verde) / Suspenso (vermelho), estado vazio amigável e responsivo (tabela→cards no mobile). Ações: suspender (modal explicita o impacto: perde acesso + bot desconecta) / reativar / criar (modal nome+email+senha) / excluir (**confirmação forte estilo GitHub** — exige digitar o slug exato para habilitar o botão, envia `{ confirmacao }`). Logout limpa o token master. Validado por Playwright (13 cenários, golden path + mobile + checagem de isolamento dos tokens)
- [x] **Super-admin — Passo 3/3: métricas de uso** — rota `GET /api/admin/metrics` (sob `exigeSuperAdmin`): faixa de 4 cards no topo (total de restaurantes, ativos/suspensos, pedidos no mês somando todos, conectados agora no WhatsApp) + coluna "Pedidos no mês" por tenant na tabela e bolinha de conectado. Métricas **reais**: contagem on-demand no `pedidos.db` de cada tenant (`pedidos.contarNoMes`, reusa o pool, pula `.db` inexistente; nota de cache se crescer p/ centenas de tenants); "conectados" via `multiBot.getEstado`. **Corte do mês no fuso BR** (America/Sao_Paulo, UTC-3) convertido p/ UTC ISO — pedido na virada do mês cai no mês certo. Cards/coluna recarregam após criar/suspender/reativar/excluir. Validado por Playwright + seed de pedidos provando o filtro de fuso na borda do mês
- [x] **Backup manual de dados** — `npm run backup` (`scripts/backup.js`) gera um `backups/backup-AAAA-MM-DD-HHmm.tar.gz` com toda a `data/`. SQLite do app via Online Backup API (`db.backup`, consistente sem downtime); demais `.db` (caches Chromium em pastas órfãs) copiados crus. `backups/` no `.gitignore`; dep `tar` (JS puro). Runbook completo no `DEPLOY.md` (gerar / baixar do Fly / **testar restauração** / restaurar com servidor parado), alerta de FS efêmero no Fly e decisão snapshot+export (S3 fora por ora). Validado: backup gerado + restauração não-destrutiva provando que empresas (3) e pedidos (15) restaurados batem com o original
- [x] **Backup pelo painel super-admin** — aba **Configurações** no `/admin-master` (estrutura pronta p/ novas subseções) com subseção **Backup**: gerar (estado "Gerando…"), listar (arquivo/tamanho/data) e **baixar** pro PC (blob autenticado). Seção "Como restaurar" (somente leitura) com o passo a passo; deixa explícito que a restauração é manual e que o painel não executa. Rotas sob `exigeSuperAdmin` reusam `scripts/backup.js` (refatorado p/ expor `gerarBackup`/`listarBackups`; `npm run backup` intacto); download com **validação anti-path-traversal**. Validado por Playwright + curl (anti-traversal: 4 nomes maliciosos → 400, inexistente → 404, tudo 401 sem token)
- [x] **Fix tela de Backup** — (1) "Como restaurar" passou a ser **texto fixo** no painel (antes lia o `DEPLOY.md` em runtime + parseava markdown → falhava em produção, caía no fallback "não foi possível carregar"); removida a rota `restauracao-doc` e o renderizador de markdown — zero ponto de falha. (2) Listagem **blindada** contra resposta não-JSON: checa `content-type`/status e mostra aviso claro ("reinicie o servidor") em vez de quebrar com `Unexpected token '<'` (sintoma de servidor rodando código antigo, sem a rota). Estado vazio amigável quando não há backup. Validado no fluxo real (Playwright com `backups/` inexistente): lista vazia sem erro, gerar→aparece, runbook sempre visível
- [x] **Fix sessão não limpa (cancelar/sair/pós-pedido)** — no WhatsApp a sessão é guardada sob `${slug}:${jid}`, mas `fluxo.js` chamava `resetSessao(chatId)` com o `jid` cru → apagava chave inexistente e a sessão antiga sobrevivia (cancelar/sair não zeravam; pós-confirmação vazava carrinho e permitia pedido duplicado). Simulador não reproduzia (chave coincide lá). Fix: `limparSessao(sessao)` reseta o **objeto** in-place (independe da chave); `chatId` do canal preservado (avisar intacto). Validado por teste node no caminho real (`slug:jid`): cancelar, sair, pós-confirmação sem duplicar e `chatId` gravado certo
