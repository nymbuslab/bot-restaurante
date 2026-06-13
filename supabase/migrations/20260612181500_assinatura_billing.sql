-- ============================================================
-- Billing / assinatura paga (Stripe) — colunas em `empresas`.
--
-- `ativo` (já existente) segue sendo a suspensão MANUAL do super-admin
-- (bloqueia até o login). `assinatura_status` é o estado de COBRANÇA,
-- independente de `ativo`: um tenant pode estar `ativo=true` mas com a
-- assinatura `past_due`/`canceled` (entra no painel para pagar, mas o bot
-- e as features ficam travados — gate aplicado no código).
-- ============================================================

alter table public.empresas
  add column assinatura_status        text not null default 'nenhuma',
  add column trial_ate                timestamptz,
  add column proxima_cobranca         timestamptz,
  add column stripe_customer_id       text,
  add column stripe_subscription_id   text,
  add column assinatura_atualizada_em timestamptz;

-- assinatura_status: nenhuma | trialing | active | past_due | canceled
--   nenhuma   = nunca iniciou assinatura (tenant novo, pré-checkout)
--   trialing  = em teste grátis de 7 dias (acesso liberado)
--   active    = pagante em dia (acesso liberado)
--   past_due  = cobrança falhou, em dunning (acesso travado, login ok p/ pagar)
--   canceled  = cancelou / trial expirou sem pagar (acesso travado)

-- Lookup por webhook do Stripe (customer/subscription -> tenant).
create index empresas_stripe_customer_idx     on public.empresas (stripe_customer_id);
create index empresas_stripe_subscription_idx on public.empresas (stripe_subscription_id);
