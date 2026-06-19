# Roadmap

Direção do produto. O que está planejado, por prioridade.

## Visão

Plataforma SaaS multi-tenant para restaurantes receberem pedidos via WhatsApp.
O bot é a **porta de entrada** — coleta o pedido completo (itens, opcionais, entrega, pagamento)
e registra. O ciclo do pedido (preparo, status, entrega) é gerenciado pelo sistema do restaurante.

> **Implementado (2026-06-17):** o pedido **conversacional** foi **substituído** por um **cardápio web
> linkado** — o bot manda o link e o cliente monta/finaliza na web. Ver *"Cardápio web como canal de
> pedido"* no fim deste arquivo.

## Fora de escopo

> **Nota (2026-06-17):** os itens abaixo sobre **ciclo do pedido, cozinha e pagamento** estão **em
> reavaliação** dado o objetivo de evoluir para um sistema de restaurante — ver *"Avaliação: evoluir
> para sistema de restaurante"* no fim deste arquivo. A decisão original abaixo continua valendo até
> que o novo escopo seja aprovado.

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

**Robustez para produto comercial** (levantado na revisão de arquitetura "crescer e vender"):

- [x] **Migração SQLite → Supabase (Postgres + Auth)** — ✅ **concluído**: dados em Postgres gerenciado (empresas/pedidos/config/cardápio), schema versionado em `supabase/migrations/`, isolamento por `empresa_id` (+ RLS). Ver `CHANGELOG.md` v0.16.0.
- [x] **Hash de senha com bcrypt/argon2** — ✅ **resolvido pelo Supabase Auth** (senha em bcrypt no `auth.users`; o login de restaurante não usa mais o SHA-256). Só o super-admin (conta única env-based) segue SHA-256+salt. Ver `CHANGELOG.md` v0.16.0.
- [x] **Sessão persistente (não deslogar no deploy)** — ✅ **resolvido pelo Supabase Auth** (sessão é JWT stateless; sobrevive a reinício/deploy do app). O super-admin segue com token em memória (conta única). Ver `CHANGELOG.md` v0.16.0.
- [x] **App stateless (sessões + imagens fora do disco)** — ✅ **concluído**: sessões do WhatsApp no Postgres (`wa_auth` + adapter `wa-auth.js`), imagens no Supabase Storage (bucket `cardapio`). O app não grava nada em disco → dispensa volume persistente e habilita múltiplas instâncias. Ver `CHANGELOG.md` v0.17.0.
- [x] **Validar JWT localmente** — ✅ **concluído**: `exigeAuth` valida o JWT pelo JWKS público do Supabase (ES256), sem ida à rede por request (fallback para `getUser` em erro). Ver `CHANGELOG.md` v0.17.0.

(Os dois itens *funcionais* que já estiveram aqui — botões de status do pedido e taxa por bairro/CEP — foram decididos como **fora de escopo**; ver a seção acima.)

## P2 — Melhorias de produto

- [x] **Pergunta de bebida configurável** — ✅ **concluído**: toggle no painel (Configurações → Comportamento do bot); `config.atendimento.perguntarBebida`, default ligado. Ver `CHANGELOG.md` v0.12.0.
- [x] **Observação configurável** — ✅ **concluído**: toggle no painel; `config.atendimento.perguntarObservacao`, default ligado. Ver `CHANGELOG.md` v0.12.0.
- [x] **HTTPS em produção** — ✅ **resolvido no Fly.io**: certificado TLS gerenciado pela
  plataforma no domínio `.fly.dev` + `force_https = true` no `fly.toml` (redirect http→https).
  Sem config manual. Ressalva: em **VPS/local** o HTTPS depende do operador (Nginx + TLS).
- [x] **Backup dos dados** — ✅ **resolvido pelo Supabase** (point-in-time recovery gerenciado).
  Com o app stateless (v0.17.0), tudo migrou para o Supabase — dados, sessões do WhatsApp
  (`wa_auth`) e imagens (Storage) — e não há mais nada em disco. O backup manual do lado do app
  (`npm run backup` + tela no `/admin-master`), feito na era SQLite, foi **removido na v0.18.0**
  por ficar obsoleto. Ver `CHANGELOG.md` v0.10.0 (criação) e v0.18.0 (remoção).
- [x] **Exibição de preço com opcional (bot)** — ✅ **concluído**: no resumo/confirmação, item com opcionais mostra preço base + opcionais + `subtotal` (itálico); sem opcional fica em 1 linha. Só texto (`fluxo.js`, helper `linhasItemPedido`); cálculo e total finais inalterados. Ver `CHANGELOG.md` v0.11.3.
- [x] **Saudação com carrinho aberto (bot)** — ✅ **concluído**: saudação com carrinho não-vazio pergunta *continuar* (mantém) ou *recomeçar* (zera), em vez de retomar o carrinho silenciosamente. Estado `CONFIRMA_REINICIO` em `fluxo.js`. Ver `CHANGELOG.md` v0.12.1.
- [x] **Onboarding via wizard de cadastro** — ✅ **concluído**: cadastro em 4 etapas (Conta → Dados → Horário → Entrega → painel), reusando `POST /api/cadastro`+`/api/login` (etapa 1) e `PUT /api/config` (etapas 2–4, persistência incremental). Dados obrigatório; horário/entrega puláveis; abandono cai direto no painel no próximo login. Trajeto anterior: a barra-guia no painel (v0.14.0) foi revertida (v0.14.1) e o flag `config.onboardingConcluido`/rota `POST /api/onboarding/concluir` (código morto) foram removidos. Ver `CHANGELOG.md` v0.15.0.

## P3 — Ideias futuras (sem compromisso)

- [ ] **WhatsApp: biblioteca não-oficial → API Oficial (Cloud API)** — hoje roda via **Baileys**
  (não-oficial, WebSocket; substituiu o `whatsapp-web.js`/Chromium por instabilidade — QR
  parava de gerar quando o WhatsApp Web mudava). Baileys é mais leve e estável, **mas continua
  não-oficial** (pode quebrar quando o WhatsApp muda; risco de bloqueio do número). A **Cloud
  API** da Meta é o caminho de produção séria: estável e sem banimento, porém tem **custo por
  conversa**, exige **Meta Business + templates aprovados** e muda o onboarding (cada número
  habilitado na API). **Migrar quando houver tração** (clientes pagando) — é reescrita +
  burocracia, prematuro antes disso.
- [x] Relatórios de pedidos por período no painel — ✅ **concluído** (no redesign de Pedidos): seletor de período (Hoje / 7 dias / Personalizado) + métricas reais (total de pedidos, média diária, ticket médio e comparativo vs período anterior) + **export CSV** dos pedidos filtrados (botão Exportar; ver `CHANGELOG.md` v0.22.4)
- [x] Cardápio com imagens dos itens — ✅ **concluído** (upload no editor modal + exibição em cards na lista; ver `CHANGELOG.md` v0.4.0)
- [x] Redesign visual completo (Nymbus Pedidos) — ✅ **concluído**: shell (sidebar/bottom-nav), Pedidos, Cardápio, Conexão, Configurações, Simulador e Login/Cadastro, todos fiéis aos protótipos. Ver `CHANGELOG.md` v0.4.0, v0.7.0 e v0.8.0
- [ ] Integração com sistemas de PDV / impressora de cupom
- [ ] App mobile para o atendente receber pedidos
- [x] **Limpeza ativa de sessões abandonadas (bot)** — ✅ **concluído**: `sessoes.limparExpiradas()` varre o Map e descarta as sessões inativas há +30min, agendada a cada 10min no `index.js` (no lugar da expiração só-lazy, que nunca limpava conversa abandonada). Sem mudança de comportamento; só libera RAM. Ver `CHANGELOG.md` v0.24.0.
- [ ] **Resiliência: sair de processo/máquina única** — ainda é **um processo Node numa máquina só**.
  - [x] **Auto-cura concluída (2026-06-18)** — o app se recupera sozinho de qualquer travada: o Fly reinicia em crash; se travar "vivo" (event loop preso, segurado pelos guardas de erro do `index.js`), o **health check** (`GET /health` + `[[http_service.checks]]` no `fly.toml`, cutuca a cada 15s) **recicla a máquina**; e o job `restaurarBots()` (`index.js`, ~10s após o boot) **religa os bots** sem QR. Os guardas globais (`uncaughtException`/`unhandledRejection`) já impedem o erro de um bot de derrubar o processo (parte do isolamento de falha entre tenants).
  - [ ] **Redundância real (múltiplas instâncias)** — deferido, **só com volume**. O bloqueio NÃO é mais o SQLite (já migrado pra **Postgres/Supabase** desde a v0.16.0); é o **Baileys**: o WhatsApp aceita só **1 sessão ativa por número**, então N instâncias exigem "**dono por tenant**" (sharding) + cache compartilhado (`store.js`/`sessoes.js` são por processo, com pub/sub). Reescrita séria; prematuro nesta fase. Levantado na revisão "crescer e vender".

---

## Avaliação: evoluir para sistema de restaurante (2026-06-17)

Análise honesta a pedido do dono: a stack atual se comporta como um **sistema completo de
restaurante** (atendimento, produtos, venda, impressos de venda/cozinha, relatórios)?

**Veredito:** não — hoje é um **bot de captura de pedidos no WhatsApp + painel de gestão**,
escopado de propósito como "porta de entrada". Cobre bem **Atendimento** (bot completo) e
**parcialmente** Produtos/Venda/Relatórios; **não tem** impressão, cozinha (KDS), caixa, fiscal
nem venda presencial. Chegar em "completo" = praticamente **construir um PDV/ERP em volta** do
que existe.

Roadmap de evolução priorizado (valor × esforço × atrito com a arquitetura). Esforço: **P** dias ·
**M** 1-2 semanas · **G** semanas/mês+.

### Fase 0 — Fundação operacional (cabe 100% na stack; maior valor / menor custo)

- [ ] **Status do pedido + linha do tempo** (P) — a coluna `status` já existe e nunca é atualizada;
  falta transições (recebido → preparo → pronto → entregue/cancelado) + botões no painel.
  *Reverte a decisão "fora de escopo" acima — precisa de aval consciente.*
- [ ] **Relatórios de verdade** (P/M) — faturamento agregado, mais vendidos, mix de pagamento,
  horário de pico. Dados já estão em `pedidos`.

### Fase 1 — Operação de loja (cabe na stack; tempo real começa com polling)

- [ ] **KDS / tela de cozinha** (M) — depende do status; polling no início, pub-sub ao escalar.
- [ ] **Estoque simples** (M) — quantidade + baixa no pedido + alerta (item é jsonb, sem migração pesada).
- [ ] **Caixa / fechamento** (M) — nova tabela de movimentos; reusa o total do pedido.

### Fase 2 — Venda presencial e dinheiro

- [ ] **PDV de balcão / comanda / mesa** (G) — lançar pedido manual no painel; reusa o modelo de pedido.
- [ ] **Pagamento real do cliente (Pix/cartão)** (M/G) — gateway novo (não confundir com o Stripe da assinatura).

### Fase 3 — Os "duros" (esbarram na arquitetura / regulados)

- [ ] **Impressão (cupom de venda + comanda de cozinha)** (G + decisão de arquitetura) — app web
  stateless **não imprime em térmica** direto; exige agente local (ex.: QZ Tray), impressora com
  API ou app desktop. Escolher o caminho antes de codar.
- [ ] **Fiscal (NFC-e/SAT)** (G + regulatório) — via parceiro fiscal (PlugNotas/Focus NFe/Tecnospeed);
  praticamente um produto à parte.

### Transversal (quando houver tração)

- [ ] Tempo real: instância única + cache em memória → invalidação/pub-sub (ex.: Redis) + múltiplas instâncias.
- [ ] WhatsApp Baileys (não-oficial) → Cloud API oficial (reduz risco de bloqueio) — ver P3 acima.

**Ordem recomendada:** Fase 0 → 1 → 2 → 3. Começar pelo **status do pedido** (menor custo, sem
tocar na arquitetura, reaproveita dados existentes).

---

## Cardápio web como canal de pedido — ✅ implementado (2026-06-17)

Substituiu o pedido **conversacional** do bot (ver *Visão*): com cardápio grande, a conversa ficava
longa e o cliente desistia. Agora o bot manda **um link** e o cliente monta/finaliza o pedido na web;
o pedido cai no backend (recalculado lá) e o bot **confirma** no WhatsApp. Baseado no projeto de
referência `docs/cardapio` (React/Tailwind) — usado como **referência visual**, portado pro stack
vanilla do repo (os tokens de design já eram idênticos).

**Status:** entregue nas Fases 1→5 (API pública + token, página vanilla, POST com recálculo no
servidor + confirmação pelo bot, bot envia o link, docs). Migração `20260617120000_pedido_observacao`
aplicada. **Requer no ambiente:** `PUBLIC_URL` (`CARDAPIO_LINK_SECRET` virou opcional — ver atualização).

> **Atualização (2026-06-18):** o link agora é **limpo** (`/c/:slug`, **sem** `?p=<token>`). A
> confirmação do pedido passou a usar o **telefone informado no checkout** (o fallback que já existia) —
> motivo: no caso `@lid` o WhatsApp não expõe o número na mensagem recebida, e o checkout coleta o
> telefone de qualquer forma. O bot **não gera mais** o token; o backend ainda aceita `?p=` de links
> antigos. Logo, `CARDAPIO_LINK_SECRET` virou **opcional**. Os trechos abaixo que citam o token
> descrevem o **desenho original**.

### Decisões travadas

- **Stack:** **HTML/CSS/JS puro** (sem build; casa com a CSP `scriptSrc 'self'` e a convenção do repo).
- **Integração:** **web → backend + bot confirma** — bot manda link com **token assinado** (carrega o
  `chatId`); a web faz `POST` do pedido; o bot confirma sozinho. (Não usa `wa.me`/reenvio.)
- **Bot:** **substituir** o fluxo conversacional de pedido (mantendo saudação, "falar com atendente" e
  a confirmação, que passa a vir do `POST` da web).

### Fluxo

```text
"oi" no WhatsApp → bot envia 1 link LIMPO: <PUBLIC_URL>/c/<slug>
 → web carrega GET /api/c/<slug> (cardápio whitelisted do tenant)
 → cliente monta carrinho (itens + opcionais + obs) e faz checkout (informa telefone)
 → POST /api/c/<slug>/pedido → backend RECALCULA total por id → salvarPedido
 → bot confirma (config.mensagens.pedidoConfirmado) p/ telefone do checkout → web "pedido enviado"
   (links antigos com ?p=<token> ainda são aceitos e confirmam pelo chatId)
```

### Fases

- [x] **Fase 1 — API + token:** `GET /api/c/:slug` (sem auth, rate-limited; projeção whitelisted + parse
  de opcionais), helper de token HMAC (`crypto`, sem dep nova) e env novo `PUBLIC_URL`.
- [x] **Fase 2 — Página vanilla:** `/c/:slug` (`cardapio.html`/`.js`/`.css` reusando tokens do `style.css`):
  categorias roláveis, busca, cards iFood, modal com opcionais/obs, carrinho, checkout — reusa
  `dinheiro.js`/`endereco-cep.js`.
- [x] **Fase 3 — Fechar pedido:** `POST /api/c/:slug/pedido` → recalcula no servidor → `salvarPedido` →
  bot confirma via `enviarMensagem`. Bot offline → salva mesmo assim.
- [x] **Fase 4 — Encolher o bot:** saudação → envia o link; aposenta os estados de pedido do `fluxo.js`.
- [x] **Fase 5 — Docs + testes:** atualizar `CLAUDE.md`/`docs/modelo-dados.md`; testes de whitelist, parse
  de opcionais, recálculo de total e token.

### Premissas e reuso

- **Premissas:** opcionais entram já; loja fechada bloqueia o envio; **sem gating por plano** (é o canal
  principal); funciona **com ou sem token** (QR na mesa cai no telefone do checkout).
- **Reuso:** `pedidos.salvarPedido`, `store.getCardapio`, `multiBot.enviarMensagem`,
  `empresas.buscarPorSlug`, `dinheiro.js`/`endereco-cep.js`. Precedente: a feature revertida
  `cardapio-publico` (`/c/:slug`).

### Riscos

- **Confiança no cliente** → preço/total **sempre** recalculados no servidor; nunca devolver jsonb cru.
- **Token** TTL curto; ausente/expirado → confirmação cai no telefone do checkout.
- **Loja fechada / bot offline** → bloquear envio / salvar sem confirmar (não perde venda).
