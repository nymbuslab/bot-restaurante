# Squad Memory — Bot Restaurante Upgrade

## Contexto do Projeto
- Stack: Node.js CommonJS, whatsapp-web.js, Express, HTML/CSS/JS vanilla
- Dados em arquivos JSON (sem banco)
- Bot de pedidos para restaurante via WhatsApp
- Painel admin em HTML/CSS/JS puro

## Decisões de Design
- Estilo: dark & moderno (SaaS premium)
- Sem frameworks de CSS ou JS
- Paleta com acento laranja quente (#F97316) para remeter a restaurante
- Font: Plus Jakarta Sans (já estava no projeto — mantida)

## Run v1 — 05/06/2026

### Arquivos modificados
- `public/style.css` — redesign completo dark
- `public/admin.html` — badge de status, modal, toast container
- `public/app.js` — toast, modal async, badge atendimento, auto-refresh 15s, sem onclick inline
- `src/fluxo.js` — 11 mensagens melhoradas, duplicação eliminada (MSG_PEDIR_NOME)

### Principais aprendizados
- O projeto não tem `window.confirm()` customizado — foi necessário implementar modal do zero
- Os IDs de HTML são todos referenciados no app.js — nenhum pode ser renomeado sem grep
- A constante `MSG_PEDIR_NOME` eliminou 3 duplicações críticas
- `perguntaObservacao()` precisou receber `nomeItem` como parâmetro — alterar assinatura de função exigiu 2 call sites
- Auto-refresh de pedidos a cada 15s é suficiente para operação de restaurante

### Pendências identificadas (próxima run)
- Sugestão de boasVindas com {horario} — operador precisa atualizar manualmente no painel
- Badge de contagem no nav de pedidos (requer nova chamada de API)
- Paginação da tabela de pedidos (necessário com volume maior)
- Sessão de 30min sem aviso ao cliente quando expira
