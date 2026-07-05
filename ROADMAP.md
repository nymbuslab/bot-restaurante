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
- **Taxa de entrega por bairro/CEP** — **parcialmente revertido.** A opção **(b) por raio/km
  via geocoding foi IMPLEMENTADA** no **Plano Completo** (frete por raio: Geoapify +
  Haversine + faixas por km; CEP+número no checkout) — ver `CHANGELOG.md` v0.27.0 e
  [docs/planos-e-frete.md](docs/planos-e-frete.md). Seguem **fora de escopo**: (a) **por bairro
  cadastrado** — manutenção infinita por tenant; (c) **geolocalização por IP** — inviável, não
  há IP do cliente numa conversa de WhatsApp. O **Essencial** mantém **taxa única por tenant**.

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
- [x] **Integração com sistemas de PDV / impressora de cupom** — ✅ **entregue**: aba **PDV** (venda no balcão) + app desktop **Nymbus Impressora** imprimindo automaticamente todos os fluxos (delivery/PDV/Mesas/Caixa) via fila genérica. Ver `CHANGELOG.md` v0.49.0 (PDV) e v0.59.0/0.62.0 (agente como único canal de impressão).
- [ ] **Formas de Pagamento configuráveis + taxa por forma (recebimento líquido)** — aba dedicada em
  Configurações pra gerir as formas (hoje editáveis como lista simples em `config.pagamentos`),
  com **granularidade Crédito/Débito/Pix** e **taxa (%) por forma** que a administradora cobra.
  Habilita **relatórios de recebimento líquido** (bruto − taxa = base de recebimento). Separar a
  forma **grossa** que o cliente escolhe no cardápio (Dinheiro/Cartão/Pix) da forma **detalhada +
  taxa** usada pelo operador/relatório. Levantado em 2026-06-20, durante o fechamento de caixa
  (contador de cédulas) — o fechamento v1 usa as formas já configuradas; esta feature vem depois,
  junto do relatório que consome a taxa.
- [ ] **Caixa do dia — evolução (gaps de mercado)** — levantado em 2026-06-21 (pesquisa de boas
  práticas de PDV/frente de caixa BR). O que **já temos**: abertura com fundo+operador+observações,
  sangria/suprimento com motivo e imutáveis, recebimento por forma com estorno, fechamento com
  contagem de cédulas, **bloqueio de fechar com vendas a receber**, relatório + histórico reabrível.
  **Gaps priorizados:**
  - **P0 (segurança/integridade, baixo esforço):**
    - **Conferência cega (opcional):** no fechamento, esconder "Esperado"/"Diferença" até o operador
      confirmar a contagem (anti-fraude/anti-viés). Toggle em Configurações.
    - **Justificativa obrigatória quando há diferença** no fechamento (reusa a coluna `caixas.observacao`,
      hoje ociosa) — toda quebra documentada para auditoria.
    - **Limite de gaveta + alerta de sangria de segurança:** config `limiteGaveta`; aviso no painel
      quando o dinheiro em caixa passa do teto.
  - **P1:** comprovante de sangria/suprimento (impressão térmica); **tolerância de divergência**
    configurável (não acusa falta/sobra abaixo de X); **fundo de troco no fechamento** (quanto fica de
    troco, sangra o resto); **relatório de quebras por período** (consolidado, hoje é por caixa).
  - **P2 (dependem de multi-usuário):** **múltiplos operadores + permissões/supervisor** (quem pode
    sangria/estorno/fechar; aprovação de divergência) — exige usuários/perfis por tenant (hoje 1 conta);
    **reabertura de caixa** com trilha de auditoria.
  - **Fora de escopo** (premissa: bot é porta de entrada): NFC-e/fiscal (SAT), controle de estoque,
    venda a prazo/fiado — ficam no sistema próprio do restaurante.
    > **Atualização (2026-06-29):** o **cancelamento de venda** saiu do "fora de escopo" — foi
    > **implementado** a pedido do dono como controle **anti-fraude** (CHANGELOG 0.60.0): cancelar um
    > pedido pago deduz no caixa **mantendo o rastro** (movimento `cancelamento`, não apaga o recebimento),
    > aparece no extrato e no relatório de fechamento. Estoque, fiado e fiscal seguem fora.
  - Fontes (boas práticas BR): Conta Azul, Infovarejo, Comercial Mariano (POP fechamento), Soften,
    Planilha de Fluxo, CR Sistemas, RP Info, Eccosys.
- [ ] App mobile para o atendente receber pedidos
- [x] **Observabilidade / monitoramento** — ✅ **entregue**: aba **Monitoramento** no painel master — **Fase 1** (Banco/App/Bots/Fila ao vivo via `GET /api/admin/diagnostico` + log da causa dos 500 de auth) e **Fase 2** (tabela `incidentes` + histórico no painel) — mais **monitor de uptime externo** (UptimeRobot no `/health`, 2 camadas: cliente + app direto). Ver `CHANGELOG.md` v0.79.0.
- [x] **Limpeza ativa de sessões abandonadas (bot)** — ✅ **concluído**: `sessoes.limparExpiradas()` varre o Map e descarta as sessões inativas há +30min, agendada a cada 10min no `index.js` (no lugar da expiração só-lazy, que nunca limpava conversa abandonada). Sem mudança de comportamento; só libera RAM. Ver `CHANGELOG.md` v0.24.0.
- [x] **Resiliência: sair de processo/máquina única** — ✅ **encerrado (2026-06-18)**. Segue como **um processo Node numa máquina só**, por decisão — coberto pela auto-cura abaixo. Redundância real fica como nota de arquitetura, **fora de escopo** (sem plano de mexer).
  - [x] **Auto-cura concluída (2026-06-18)** — o app se recupera sozinho de qualquer travada: o Fly reinicia em crash; se travar "vivo" (event loop preso, segurado pelos guardas de erro do `index.js`), o **health check** (`GET /health` + `[[http_service.checks]]` no `fly.toml`, cutuca a cada 15s) **recicla a máquina**; e o job `restaurarBots()` (`index.js`, ~10s após o boot) **religa os bots** sem QR. Os guardas globais (`uncaughtException`/`unhandledRejection`) já impedem o erro de um bot de derrubar o processo (parte do isolamento de falha entre tenants).
  - [x] **Redundância real (múltiplas instâncias) — decidido NÃO fazer** (2026-06-18; reabrir só se houver volume). Nota de arquitetura p/ o futuro: o bloqueio NÃO é o SQLite (já migrado pra **Postgres/Supabase** desde a v0.16.0); é o **Baileys** — o WhatsApp aceita só **1 sessão ativa por número**, então N instâncias exigiriam "**dono por tenant**" (sharding) + cache compartilhado (`store.js`/`sessoes.js` são por processo, com pub/sub). Reescrita séria. Levantado na revisão "crescer e vender".

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
- [ ] **Refino de UX tela a tela (benchmark concorrentes)** (P, em curso) — revisão das telas do painel
  contra os ERPs do segmento (iFood Gestor, Saipos, Goomer, Anota AI, Menew), corrigindo atrito e
  trazendo padrões de mercado **dentro do escopo** (sem virar KDS). Dashboard ✅ (header + análises);
  **Pedidos** ✅ (resumo, cancelado, prévia, canal, ações rápidas). Detalhe acionável por tela no
  `PROGRESSO.md`. PDV ✅ (confirmar cancelar, badge, digitar qtd, fluxo por tipo de venda + origem).
  Atual: **Tela de Mesas** — split no pagamento, reforço anti-fraude do cancelar, transferir/juntar (UI),
  resumo de ocupação, alerta de tempo, nº de pessoas (valor por pessoa na conta/fechamento).

### Fase 1 — Operação de loja (cabe na stack; tempo real começa com polling)

- [ ] **KDS / tela de cozinha** (M) — depende do status; polling no início, pub-sub ao escalar.
- [x] **Estoque simples** — ✅ **entregue**: campos estoque/estoque mínimo no item (jsonb, sem migração pesada), **baixa atômica no pedido** (cardápio web + PDV via `store.baixarEstoqueTx` com `FOR UPDATE`) e selos **Esgotado/Baixo**. Estendido com **estoque por VARIAÇÃO** (opções com estoque próprio — ver `CHANGELOG.md` 0.53.0). Ver também a etapa "estoque ativo (3a)" no `CHANGELOG.md`.
- [x] **Caixa / fechamento** — ✅ **entregue** (Plano Completo): abrir caixa com fundo de troco,
  **recebimento por pedido** (estornável), sangria/suprimento, e **fechamento com conferência de
  dinheiro físico** (esperado em espécie × contado → diferença). Tabelas `caixas`/`caixa_movimentos`
  e coluna `pedidos.recebido_em`; cálculos puros em `src/caixa-calc.js`. Ver `CHANGELOG.md` 0.30.0 e
  [docs/planos-e-frete.md](docs/planos-e-frete.md).

### Fase 2 — Venda presencial e dinheiro

- [x] **PDV de balcão** — ✅ **entregue** (Plano Completo): aba **PDV** com grade de produtos + carrinho (opcionais/composição/**variações**/kg), tela de pagamento (desconto R$/%, **split**, troco); a venda vira **pedido recebido** + **baixa de estoque** + movimento no caixa, recalculada no servidor. Ver `CHANGELOG.md` 0.49.0 e [docs/planos-e-frete.md](docs/planos-e-frete.md).
- [x] **Mesas / Comandas** — ✅ **entregue** (Plano Completo, v0.57.0): aba **Mesas** com grade de mesas/comandas por status (livre/ocupada/pediu_conta/fechando); abrir mesa, lançar rodadas com grade de produtos do PDV, imprimir cozinha; solicitar conta → bloqueia novos lançamentos; reabrir se o cliente desistir; **taxa de serviço** configurável (%); recebimento parcial (cada pagamento é um movimento no caixa com `mesa_id`); **split por forma de pagamento** + **valor por pessoa** (rateio igualitário no display/impresso; divisão por produto não implementada); **pré-conta** impressa (subtotal + taxa + já recebido + rateio); fechar → pedidos marcados como recebidos, mesa volta a livre. Tabelas `mesas` e colunas `pedidos.mesa_id` / `caixa_movimentos.mesa_id`. Ver `CHANGELOG.md` v0.57.0.
- [ ] **Pagamento real do cliente (Pix/cartão)** (M/G) — gateway novo (não confundir com o Stripe da assinatura).

### Fase 3 — Os "duros" (esbarram na arquitetura / regulados)

- [x] **Impressão (comanda de cozinha + cupom)** — ✅ **entregue via AGENTE** (Plano Completo). O caminho
  navegador inicial (`window.print()`/Web Serial, CHANGELOG 0.29.0/0.40.0) foi **substituído** pelo app
  desktop **Nymbus Impressora**, que imprime **todos** os fluxos automaticamente (delivery + PDV + Mesas +
  Caixa) via fila genérica; o caminho navegador foi **removido** (CHANGELOG 0.62.0). Ver *"Agente local"*
  abaixo e [docs/planos-e-frete.md](docs/planos-e-frete.md). **Futuro:** gaveta + TEF + impressão sem
  painel aberto (já entregue: impressão sem painel aberto).
- [ ] **Fiscal (NFC-e/SAT)** (G + regulatório) — via **ACBr** (`ACBrNFCe`/`ACBrSAT`) no agente local **ou**
  parceiro fiscal por API (PlugNotas/Focus NFe/Tecnospeed); praticamente um produto à parte.
  > A **v1 do agente de impressão** (ESC/POS de todos os fluxos, Rede 9100/Serial) já está **entregue** —
  > ver *"Impressão"* acima. Falta só a camada **fiscal/TEF/gaveta**, adiada sob demanda (cliente pagante
  > pedindo). Diretrizes travadas abaixo para quando for a hora.
  - **Engine: ACBr** (não reinventar) — `ACBrPosPrinter` (ESC/POS + corte + **gaveta**), `ACBrTEF`,
    `ACBrSAT`/`ACBrNFCe`. Via **ACBrMonitor** (executável controlado por socket/arquivo — sem escrever
    Delphi) ou **ACBrLib** (DLLs chamáveis, inclusive de Node via FFI). O valor do ACBr é **TEF + fiscal**;
    para ESC/POS+gaveta puros, raw ESC/POS já resolve.
  - **Distribuição: NÃO** gerar um `.exe` por cliente (cada um exigiria assinatura → antivírus/SmartScreen
    barra). Em vez disso: **um agente único, assinado uma vez** (code-signing ~US$200–500/ano), que o
    cliente instala, **pareia por token** do painel e **puxa a config da API**. Roda na bandeja/serviço.
  - **Conexão: agente conecta de saída** ao servidor (WebSocket/long-poll) e **recebe os trabalhos de lá**
    → imprime mesmo com o painel fechado (modelo iFood) e evita a dor de browser→`localhost` https.
  - **Gaveta:** fora de escopo por ora (sugestão dos colegas). Muitos drivers abrem a gaveta "ao imprimir"
    (de graça, como o corte); controle fino da gaveta só com o agente.

### Transversal (quando houver tração)

- [ ] Tempo real: instância única + cache em memória → invalidação/pub-sub (ex.: Redis) + múltiplas instâncias.
- [ ] WhatsApp Baileys (não-oficial) → Cloud API oficial (reduz risco de bloqueio) — ver P3 acima.

**Ordem recomendada:** Fase 0 → 1 → 2 → 3. Começar pelo **status do pedido** (menor custo, sem
tocar na arquitetura, reaproveita dados existentes).

---

## Cardápio web como canal de pedido — ✅ implementado (2026-06-17)

Substituiu o pedido **conversacional** do bot (ver *Visão*): com cardápio grande, a conversa ficava
longa e o cliente desistia. Agora o bot manda **um link** e o cliente monta/finaliza o pedido na web;
o pedido cai no backend (recalculado lá) e o bot **confirma** no WhatsApp. Foi baseado num projeto de
referência em React/Tailwind (usado só como **referência visual** na época e **já portado** pro stack
vanilla do repo — `public/cardapio.*` —, pois os tokens de design já eram idênticos).

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

