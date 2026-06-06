# Progresso do Projeto

> Detalhes de arquitetura e stack ficam em `CLAUDE.md`. Aqui entram apenas etapas: fazendo, próximos passos e concluído.

## 🔄 Em Andamento

**Checkpoint salvo em 2026-06-06 17:30**

### Feito nesta sessão

- Migração de pedidos de JSON para SQLite (`better-sqlite3`) com migração automática do legado
- Horário de funcionamento por dia da semana: `estaAberto(tenantDir)` em `fluxo.js`, tabela no painel (Configurações), campo `horarios` em `config.json`
- Arquitetura multi-tenant SaaS completa: `src/empresas.js` (banco mestre), `src/multi-bot.js` (um Client por tenant), `src/store.js` e `src/pedidos.js` parametrizados por `tenantDir`, `src/fluxo.js` com `tenantDir` em todas as funções, `src/servidor.js` reescrito com auth por e-mail+senha
- Onboarding: `public/cadastro.html` (novo), `public/login.html` atualizado para e-mail+senha
- Migração automática de instalação legada (cria tenant a partir de `data/config.json`)
- Documentação completa atualizada: CLAUDE.md, README.md, DEPLOY.md, PRD.md, PROGRESSO.md

### Em meio de edição

- Nenhum arquivo em edição incompleta. Todas as mudanças estão consistentes, mas nada foi comitado ainda.

### Próximo passo

- Testar o fluxo completo multi-tenant: cadastrar um segundo tenant, conectar WhatsApp em ambos e verificar isolamento de pedidos e sessões.

### Decisões pendentes

- Memória por tenant: máquina atual é 1 GB (suporta ~3–4 tenants). Definir quando escalar para 2 GB no Fly.io.
- Painel de super-admin (listar todos os tenants, suspender, ver métricas) está no roadmap P1 — decidir quando implementar.

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
