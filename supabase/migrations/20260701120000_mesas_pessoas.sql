-- Nº de pessoas na mesa (covers). Informado ao abrir a mesa (opcional, padrão 1);
-- usado para "valor por pessoa" na conta e no fechamento.
-- ============================================================
alter table public.mesas
  add column if not exists pessoas integer not null default 1;
