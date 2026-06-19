-- Plano comercial do tenant (essencial | completo).
-- Default 'essencial'; gravado pelo webhook do Stripe (aplicarSubscription mapeia
-- o price_id da assinatura -> plano). Cortesia / sem assinatura = essencial.
alter table empresas add column if not exists plano text not null default 'essencial';
comment on column empresas.plano is 'Plano comercial: essencial | completo (gravado pelo webhook do Stripe)';
