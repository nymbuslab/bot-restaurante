-- Reversão do módulo Mesas & Comandas.
-- Desfaz a migration 20260628120000_mesas.sql.
-- =================================================

alter table if exists public.pedidos
  drop column if exists cliente_divisao,
  drop column if exists mesa_id;

drop index if exists public.pedidos_mesa_id_idx;
drop index if exists public.mesas_empresa_id_idx;

drop table if exists public.mesas cascade;
