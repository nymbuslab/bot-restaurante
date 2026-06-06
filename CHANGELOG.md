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
