-- ============================================================
-- CLIENTES — vínculo com Convênio de vencimento (fiado).
--
-- O vencimento das vendas a prazo deixa de vir do dia_vencimento (dia fixo) e
-- passa a vir de um Convênio (config.convenios, jsonb por restaurante). O cliente
-- referencia o convênio por id (texto). Vazio = sem convênio = venda a prazo sem
-- vencimento. `dia_vencimento` permanece como legado (some da UI; usado só na
-- migração scripts/migrar-convenios.js). Aditivo, sem backfill.
-- ============================================================
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS convenio_id text NOT NULL DEFAULT '';
