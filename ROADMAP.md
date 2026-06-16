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

- **WhatsApp: biblioteca não-oficial → API Oficial (Cloud API)** — hoje roda via **Baileys**
  (não-oficial, WebSocket; substituiu o `whatsapp-web.js`/Chromium por instabilidade — QR
  parava de gerar quando o WhatsApp Web mudava). Baileys é mais leve e estável, **mas continua
  não-oficial** (pode quebrar quando o WhatsApp muda; risco de bloqueio do número). A **Cloud
  API** da Meta é o caminho de produção séria: estável e sem banimento, porém tem **custo por
  conversa**, exige **Meta Business + templates aprovados** e muda o onboarding (cada número
  habilitado na API). **Migrar quando houver tração** (clientes pagando) — é reescrita +
  burocracia, prematuro antes disso.
- Relatórios de pedidos por período no painel — ✅ **concluído** (no redesign de Pedidos): seletor de período (Hoje / 7 dias / Personalizado) + métricas reais (total de pedidos, média diária, ticket médio e comparativo vs período anterior) + **export CSV** dos pedidos filtrados (botão Exportar; ver `CHANGELOG.md` v0.22.4)
- Cardápio com imagens dos itens — ✅ **concluído** (upload no editor modal + exibição em cards na lista; ver `CHANGELOG.md` v0.4.0)
- Redesign visual completo (Nymbus Lab) — ✅ **concluído**: shell (sidebar/bottom-nav), Pedidos, Cardápio, Conexão, Configurações, Simulador e Login/Cadastro, todos fiéis aos protótipos. Ver `CHANGELOG.md` v0.4.0, v0.7.0 e v0.8.0
- Integração com sistemas de PDV / impressora de cupom
- App mobile para o atendente receber pedidos
- **Limpeza ativa de sessões abandonadas (bot)** — varredura periódica (`setInterval`) removendo sessões expiradas, no lugar da expiração lazy atual (que só limpa quando chega nova mensagem). Relevante só quando o volume de clientes simultâneos justificar — cruza com a nota de RAM por tenant no `PROGRESSO.md`.
- **Resiliência: sair de processo/máquina única** — hoje é **um processo Node numa máquina só**: se cai, cai para todos, e **todos os bots rodam no mesmo processo** (um crash afeta geral). Caminhos, em ordem: (1) supervisor que reinicia sozinho (PM2/systemd — já no `DEPLOY.md`); (2) redundância real (múltiplas instâncias com sessão/estado compartilhados — exige sair do SQLite local para **Postgres**); (3) isolamento de falha entre tenants. **Prematuro — só importa com volume**; levantado na revisão "crescer e vender".
