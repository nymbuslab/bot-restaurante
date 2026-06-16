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
  Página de billing com **card largo do plano** (plano `Plano Nymbus Lab` · `R$ 79,00/mês` ·
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
