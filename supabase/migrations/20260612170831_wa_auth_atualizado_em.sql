-- Marca quando cada linha de wa_auth foi gravada — permite limpar sessões
-- (`session:*`) inativas há muito tempo, sem mexer em creds/pre-keys/app-state.
alter table public.wa_auth add column atualizado_em timestamptz not null default now();
