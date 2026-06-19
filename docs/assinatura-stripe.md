# Assinatura (Stripe)

Monetização via **assinatura mensal** (1 plano, **R$ 79/mês**, **7 dias grátis com cartão**).
Pacote `stripe`; lógica em `src/stripe.js`. Sem chave/preço (`STRIPE_SECRET_KEY` +
`STRIPE_PRICE_ID`), as rotas `/api/assinatura/*` respondem **503** (igual ao super-admin).

- **Dois eixos de acesso (independentes), em `empresas.js`:**
  - `ativo` (boolean) = suspensão **manual** do admin (hard block, bloqueia até o login).
  - `assinatura_status` (coluna) = estado de billing: `nenhuma | trialing | active |
    cortesia | past_due | canceled`. (`cortesia` = acesso liberado **manualmente** pelo
    super-admin, sem Stripe.)
  - `podeLogar(emp)` = só `ativo` (o inadimplente entra para pagar). `acessoLiberado(emp)` =
    `ativo` **e** status em `["trialing","active","cortesia"]` → controla **bot ligado** e
    features. Middleware `exigeAssinatura` (depois de `exigeAuth`) responde **402** sem acesso;
    aplicado em `POST /api/bot/conectar`. Colunas de billing: ver migration
    `supabase/migrations/*_assinatura_billing.sql` (`trial_ate`, `proxima_cobranca`,
    `stripe_customer_id`, `stripe_subscription_id`).

- **Checkout PRÓPRIO (Stripe Elements, identidade Nymbus)** — `public/checkout.html`:
  o fluxo padrão **não** usa a tela hospedada do Stripe. Como o requisito é **cartão no início
  do trial**, coletamos o cartão ANTES de criar a assinatura (senão a assinatura nasceria
  `trialing` sem cartão):
  1. `POST /api/assinatura/setup-intent` → cria Customer (se preciso) + **SetupIntent**
     (`usage: off_session`, só cartão); devolve `{ clientSecret, publishableKey }`.
  2. O front monta o **Payment Element** (iframe do Stripe, PCI baixo/SAQ A) com a
     **Appearance API** (tema escuro Nymbus) e faz `confirmSetup({ redirect: "if_required" })`.
  3. `POST /api/assinatura/confirmar { setupIntentId }` → valida o SetupIntent (succeeded +
     pertence ao Customer), define o cartão como **padrão** do Customer e cria a **subscription**
     (`trial_period_days: 7`, `default_payment_method`). **Idempotente** (não duplica se já houver
     assinatura viva). Volta pro painel (`admin.html?assinatura=ok`).
  - `STRIPE_PUBLISHABLE_KEY` (pública) vai pro front via a resposta do setup-intent + carrega
    `https://js.stripe.com/v3`. A rota antiga `/api/assinatura/checkout` (Checkout hospedado)
    **fica como fallback**, não é usada pelo front.

- **Webhook** `POST /api/stripe/webhook`: **raw body + verificação de assinatura**, registrado
  ANTES do `express.json` global. Trata `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed` →
  `aplicarSubscription()` grava o estado e **liga/desliga o bot** (`past_due`/`canceled` →
  `multiBot.desconectar`). Não toca `ativo`.

- **Gerenciar** (cliente): aba **Assinatura** no painel + **gate** que trava o painel sem acesso.
  Página de billing com **card largo do plano** (plano `Plano Nymbus Pedidos` · `R$ 79,00/mês` ·
  próximo vencimento · badge de status), duas colunas (Pagamento + "Precisa de ajuda?" à esquerda,
  **Histórico de Faturas** à direita) e, no mobile, tudo empilhado (faturas viram cards via
  `data-label`). "Gerenciar assinatura" abre o **Customer Portal** hospedado
  (`/api/assinatura/portal` — cancelamento). Reativar = passar pelo checkout próprio de novo.
  - **Histórico de faturas (real):** `GET /api/assinatura` devolve `faturas` (via
    `stripe.listarFaturas` quando há `stripeCustomerId`): data, valor, status (Pago/Em aberto/…) e
    **link de PDF**. Sem Customer (cortesia/sem assinatura) → lista vazia → estado vazio honesto.
  - **"Falar com Suporte" → WhatsApp:** `GET /api/plataforma` devolve `{ suporteWhatsapp }` lido da
    env `SUPORTE_WHATSAPP` (só dígitos, formato `wa.me`). O card "Precisa de ajuda?" só aparece com
    número configurado (nunca botão quebrado). **Futuro:** a aba "Nymbus" do painel master vai
    gerenciar este e outros dados da plataforma, substituindo a env.

- **Gestão de cartões NO PAINEL** (sem o portal hospedado) — seção "Forma de pagamento" na aba
  Assinatura. `admin.html` carrega `js.stripe.com/v3` e reusa o **Payment Element** (mesma
  Appearance API escura do checkout) num modal pra adicionar cartão. Rotas (sob `exigeAuth`):
  `GET /api/assinatura/cartoes` (lista bandeira/últimos4/validade + qual é o padrão) ·
  `POST .../cartoes/setup-intent` (SetupIntent avulso, só anexa cartão ao Customer, não cria
  assinatura) · `PATCH .../cartoes/:id/padrao` (`stripe.definirCartaoPadrao` → atualiza
  `invoice_settings.default_payment_method` do Customer **e** a subscription) · `DELETE
  .../cartoes/:id` (detach). **Travas** em `removerCartao`: não remove o cartão **padrão** nem
  o **último** (tenant nunca fica sem forma de cobrança). A seção só aparece com Customer no
  Stripe — em **cortesia**/sem assinatura fica oculta (lista vazia). Funções em `src/stripe.js`.

- **Gerenciar (super-admin):** no painel master, o botão **Gerenciar** de cada restaurante abre
  um modal com status + ações + **histórico de faturas** (`GET .../assinatura`): liberar/revogar
  **cortesia** (`PATCH .../assinatura/cortesia|revogar`), **cancelar no Stripe**
  (`PATCH .../assinatura/cancelar`), suspender/reativar (eixo `ativo`) e excluir.
  Métricas de billing (trial/pagantes/cortesia/atraso/cancelados) em `GET /api/admin/metrics`.

- **Suspender/excluir refletem no Stripe** (cancelar/pausar) — ver [super-admin.md](super-admin.md)
  e [lgpd-e-conta.md](lgpd-e-conta.md).

## Ambientes do Stripe (teste × produção) — importante

O Stripe novo tem **três ambientes isolados**, que **não compartilham** produtos, preços, clientes
nem webhooks:

1. **Área restrita (Sandbox)** — ambiente de teste isolado. Usado no **`.env` local** (dev), com as
   chaves `sk_test`/`pk_test`. **Não é mais o que roda em produção.**
2. **Modo de teste** (clássico) — outro ambiente de teste, **vazio** (não usado).
3. **Produção (Live)** — **É onde o app roda em produção desde 2026-06-18** (go-live feito). Os
   secrets do **Fly** são as chaves `sk_live`/`pk_live`, com o produto **"Plano Essencial"**
   (`prod_UjIR38QCFMhn9E` / `price_1Tjpqo2OKIQsz5AIqYw0XpcZ`, R$ 79,00/mês) e o webhook live ativo.

> O botão de modo no dashboard é só uma **lente de visualização** — alternar entre os ambientes
> não cria, apaga nem cobra nada. O que decide se há cobrança real é **qual chave está rodando no
> app** (Fly secrets), não o que está selecionado no painel.

## Webhook: estado atual

**Produção (live): webhook ativo** — `we_1TjrFC...` (`enabled`), apontando para
`https://pedidos.nymbuslab.com.br/api/stripe/webhook` com os 6 eventos do checklist abaixo. O
`STRIPE_WEBHOOK_SECRET` no Fly é o signing secret desse endpoint. Eventos de ciclo de assinatura
(renovação, falha, cancelamento) **sincronizam**.

> **Dev local:** o caminho normal segue sendo `stripe listen --forward-to
> localhost:3000/api/stripe/webhook`, que gera um `whsec` de sessão (sandbox) — separado do webhook
> de produção.

## Go-live (teste → produção) — checklist ✅ CONCLUÍDO em 2026-06-18

Mantido como referência (e para repetir ao criar um 2º plano / migrar de domínio). Passos:

1. **Criar o produto/preço em Produção** (Live) — espelhar "Nymbus Pedidos - Assinatura", R$ 79/mês.
   Anotar o novo `price_live_...`.
2. **Pegar as chaves Live** (dashboard em Produção → Desenvolvedores → Chaves de API): `sk_live_...`
   e `pk_live_...`.
3. **Cadastrar o webhook em Produção** apontando para o domínio:

   ```bash
   stripe webhook_endpoints create \
     --api-key sk_live_... \
     --url https://pedidos.nymbuslab.com.br/api/stripe/webhook \
     --enabled-events checkout.session.completed \
     --enabled-events customer.subscription.created \
     --enabled-events customer.subscription.updated \
     --enabled-events customer.subscription.deleted \
     --enabled-events invoice.paid \
     --enabled-events invoice.payment_failed
   ```

   Guardar o `whsec_...` que ele devolve (signing secret do endpoint).
4. **Trocar os 4 secrets no Fly** pelas versões live (dispara redeploy):

   ```bash
   fly secrets set \
     STRIPE_SECRET_KEY="sk_live_..." \
     STRIPE_PUBLISHABLE_KEY="pk_live_..." \
     STRIPE_PRICE_ID="price_live_..." \
     STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

5. **Testar em produção** com um cartão real (e estornar): cadastro → checkout → assinatura
   `trialing`/`active` no painel; conferir no dashboard (Live) que o webhook entregou os eventos.
6. **Reconciliar:** se algum tenant testou no período sem webhook, conferir o `assinatura_status`.
