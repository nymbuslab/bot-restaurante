-- Fechamento de caixa: conferência de cartão/pix + snapshot do detalhamento.
-- Complementa 20260620120000_caixa.sql. `diferenca` (já existente) passa a guardar
-- a diferença GLOBAL (espécie + eletrônico); linhas antigas (só dinheiro) seguem válidas.

alter table public.caixas add column if not exists contado_eletronico numeric(10,2);
alter table public.caixas add column if not exists detalhe_fechamento  jsonb;
