-- Abertura de caixa: operador do turno + observações da abertura (Plano Completo).
-- Complementa 20260620120000_caixa.sql. Colunas opcionais; não quebram caixas existentes.

alter table public.caixas add column if not exists operador     text;
alter table public.caixas add column if not exists obs_abertura text;
