# Roadmap

Direção do produto. O que está planejado, por prioridade.

## Visão

Plataforma SaaS multi-tenant para restaurantes receberem pedidos via WhatsApp.
O bot é a **porta de entrada** — coleta o pedido completo (itens, opcionais, entrega, pagamento)
e registra. O ciclo do pedido (preparo, status, entrega) é gerenciado pelo sistema do restaurante.

## Fora de escopo

- Notificação de pedidos para cozinha via bot — o restaurante usa seu próprio sistema
- Gestão de ciclo do pedido (preparando, saiu para entrega, entregue) pelo bot
- Integração com sistemas de pagamento online (por ora, apenas informa forma de pagamento)
- **Botões de status do pedido no painel** (preparando / entregue / cancelado) — **decidido fora de
  escopo**. O valor real (comunicar o cliente) já é entregue pelo botão **"Avisar cliente"**
  (pedido pronto — entrega/retirada). Gerenciar o ciclo do pedido contradiz a premissa do
  produto: o bot é **porta de entrada**, o andamento fica no sistema próprio do restaurante.
- **Taxa de entrega por bairro/CEP** — **fora de escopo (por ora)**. Opções avaliadas e
  descartadas: (a) **por bairro cadastrado** — manutenção infinita por tenant; (b) **por
  raio/km via geocoding** — API paga e lida mal com endereço solto digitado no WhatsApp; (c)
  **geolocalização por IP** — inviável, não há IP do cliente numa conversa de WhatsApp.
  Conclusão: a **taxa única por tenant** atende; reavaliar só se um cliente pagante pedir.

---

## P1 — Próximas funcionalidades prioritárias

- [x] **Painel de super-admin** — ✅ **concluído** (3 passos): backend + auth master isolada por env; tela `/admin-master` (listar/criar/suspender/reativar/excluir tenants com confirmação forte); métricas reais (total, ativos/suspensos, pedidos do mês, conectados). Ver `CHANGELOG.md` e `PROGRESSO.md`

Sem itens P1 abertos no momento — os dois que estavam aqui (botões de status do pedido e taxa por bairro/CEP) foram decididos como **fora de escopo**; ver a seção acima.

## P2 — Melhorias de produto

- [x] **Pergunta de bebida configurável** — ✅ **concluído**: toggle no painel (Configurações → Comportamento do bot); `config.atendimento.perguntarBebida`, default ligado. Ver `CHANGELOG.md` v0.12.0.
- [x] **Observação configurável** — ✅ **concluído**: toggle no painel; `config.atendimento.perguntarObservacao`, default ligado. Ver `CHANGELOG.md` v0.12.0.
- [x] **HTTPS em produção** — ✅ **resolvido no Fly.io**: certificado TLS gerenciado pela
  plataforma no domínio `.fly.dev` + `force_https = true` no `fly.toml` (redirect http→https).
  Sem config manual. Ressalva: em **VPS/local** o HTTPS depende do operador (Nginx + TLS).
- [x] **Backup do volume de dados (Fly.io)** — ✅ **concluído**: `npm run backup` gera um
  `.tar.gz` consistente de toda a `data/` (SQLite via Online Backup API, sem downtime), com
  runbook de download e restauração no `DEPLOY.md`. Estratégia: snapshot do Fly + export
  manual. Backup automático para storage externo (S3/R2) fica para quando houver tração — ver
  `CHANGELOG.md` v0.10.0
- [x] **Exibição de preço com opcional (bot)** — ✅ **concluído**: no resumo/confirmação, item com opcionais mostra preço base + opcionais + `subtotal` (itálico); sem opcional fica em 1 linha. Só texto (`fluxo.js`, helper `linhasItemPedido`); cálculo e total finais inalterados. Ver `CHANGELOG.md` v0.11.3.
- [x] **Saudação com carrinho aberto (bot)** — ✅ **concluído**: saudação com carrinho não-vazio pergunta *continuar* (mantém) ou *recomeçar* (zera), em vez de retomar o carrinho silenciosamente. Estado `CONFIRMA_REINICIO` em `fluxo.js`. Ver `CHANGELOG.md` v0.12.1.
- [x] **Onboarding via wizard de cadastro** — ✅ **concluído**: cadastro em 4 etapas (Conta → Dados → Horário → Entrega → painel), reusando `POST /api/cadastro`+`/api/login` (etapa 1) e `PUT /api/config` (etapas 2–4, persistência incremental). Dados obrigatório; horário/entrega puláveis; abandono cai direto no painel no próximo login. Trajeto anterior: a barra-guia no painel (v0.14.0) foi revertida (v0.14.1) e o flag `config.onboardingConcluido`/rota `POST /api/onboarding/concluir` (código morto) foram removidos. Ver `CHANGELOG.md` v0.15.0.

## P3 — Ideias futuras (sem compromisso)

- **WhatsApp: biblioteca não-oficial → API Oficial (Cloud API)** — hoje roda via **Baileys**
  (não-oficial, WebSocket; substituiu o `whatsapp-web.js`/Chromium por instabilidade — QR
  parava de gerar quando o WhatsApp Web mudava). Baileys é mais leve e estável, **mas continua
  não-oficial** (pode quebrar quando o WhatsApp muda; risco de bloqueio do número). A **Cloud
  API** da Meta é o caminho de produção séria: estável e sem banimento, porém tem **custo por
  conversa**, exige **Meta Business + templates aprovados** e muda o onboarding (cada número
  habilitado na API). **Migrar quando houver tração** (clientes pagando) — é reescrita +
  burocracia, prematuro antes disso.
- Relatórios de pedidos por período no painel — ✅ **concluído** (no redesign de Pedidos): seletor de período (Hoje / 7 dias / Personalizado) + métricas reais (total de pedidos, média diária, ticket médio e comparativo vs período anterior). Resta só export/CSV, se necessário — seria item novo e menor
- Cardápio com imagens dos itens — ✅ **concluído** (upload no editor modal + exibição em cards na lista; ver `CHANGELOG.md` v0.4.0)
- Redesign visual completo (Nymbus Lab) — ✅ **concluído**: shell (sidebar/bottom-nav), Pedidos, Cardápio, Conexão, Configurações, Simulador e Login/Cadastro, todos fiéis aos protótipos. Ver `CHANGELOG.md` v0.4.0, v0.7.0 e v0.8.0
- Integração com sistemas de PDV / impressora de cupom
- App mobile para o atendente receber pedidos
- **Limpeza ativa de sessões abandonadas (bot)** — varredura periódica (`setInterval`) removendo sessões expiradas, no lugar da expiração lazy atual (que só limpa quando chega nova mensagem). Relevante só quando o volume de clientes simultâneos justificar — cruza com a nota de RAM por tenant no `PROGRESSO.md`.
