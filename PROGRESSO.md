# Progresso do Projeto

> Detalhes de arquitetura e stack ficam em `CLAUDE.md`. Aqui entram apenas etapas: fazendo, próximos passos e concluído.

## 🔄 Em Andamento

**Checkpoint salvo em 2026-06-06 19:00**

### Feito nesta sessão

- Backlog ajustado: P0 (notificação cozinha) removido; P2 atualizado com nota sobre features já existentes
- `CHANGELOG.md` e `ROADMAP.md` criados com histórico e direção do produto
- Commit `3958821` — arquitetura multi-tenant completa, `.gitignore` atualizado para dados de runtime
- Design System documentado no `CLAUDE.md` (tokens de cor, forma, sombra, componentes, tipografia)
- Placeholder do `cadastro.html` corrigido para texto genérico
- Limpeza do repositório: ~100 arquivos removidos (ExpxAgents, `src/bot.js`, `src/estado.js`, cache, artefato de migração)
- `README.md` atualizado (removida referência ao `estado.js` legado)

### Em meio de edição

- Alterações desta sessão (`CLAUDE.md`, `PROGRESSO.md`, `README.md`, `public/cadastro.html`, deleções) ainda não commitadas
- Pasta `design/` não rastreada (protótipos Stitch do redesign Nymbus Lab)

### Próximo passo

- Commitar as alterações da sessão e então iniciar o redesign de UI — começar pelo editor de item conforme ordem definida neste arquivo.

### Decisões pendentes

- Memória por tenant: máquina atual é 1 GB (suporta ~3–4 tenants). Definir quando escalar para 2 GB no Fly.io.
- Painel de super-admin (listar todos os tenants, suspender, ver métricas) está no roadmap P1 — decidir quando implementar.

### Redesign de UI — reskin Nymbus Lab

- **Princípio:** reskin visual, não novas features. A UI segue o que o sistema já faz;
  não inventar endpoint nem feature.
- **Identidade:** cores Nymbus Lab (roxo `#6344BC` primária, ciano `#73D2E6` secundária)
  sobre o tema escuro. Tokens já atualizados no `CLAUDE.md` (Design System); falta aplicar
  no `public/style.css` (incluindo os 3 pontos que passam para `--accent-fg`).
- **Protótipos (Stitch):** em `design/prototipos/` (desktop + mobile por tela); referência
  por tela em `design/UI.md`.
- **Decisões de escopo fechadas:** opcionais seguem simples (`Nome | preço`); aba Pedidos é
  histórico de consulta (sem dashboard de analytics); imagens de item ficam para depois (P3).
- **Ordem de execução:** editor de item → cardápio → pedidos + detalhe → configurações →
  conexão → simulador → login + cadastro.
- **Próximo passo do redesign:** implementar o editor de item (maior valor) seguindo `design/UI.md`.

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
