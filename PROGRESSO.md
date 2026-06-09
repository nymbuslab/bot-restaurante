# Progresso do Projeto

> Detalhes de arquitetura e stack ficam em `CLAUDE.md`. Aqui entram apenas etapas: fazendo, próximos passos e concluído.

## 🔄 Em Andamento

Redesign UI — cardápio (Passo 5) + Login/Cadastro implementados nesta sessão (2026-06-09), aguardando commit e validação visual.

Arquivos modificados sem commit:

- `public/app.js` — `renderCardapio()` reescrito para cards
- `public/style.css` — CSS de cards + auth block (novo layout split login/cadastro)
- `public/login.html` — redesign completo
- `public/cadastro.html` — redesign completo

Próxima tela do redesign (ainda não iniciada): Pedidos + detalhe → Configurações → Conexão → Simulador.

## 📋 Próximos Passos

- [ ] (P1) Botões de status do pedido no painel (preparando / entregue / cancelado)
- [ ] (P1) Taxa de entrega configurável por bairro/CEP
- [ ] (P1) Painel de super-admin para gerenciar todos os tenants
- [ ] (P2) Tornar pergunta de bebida e observação configuráveis no painel (features existem, falta toggle)
- [ ] (P2) HTTPS automático + guia de segurança para produção pública

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
