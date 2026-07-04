-- ============================================================
-- caixa_movimentos: rastreio de valor_pago (entregue) e troco (Fase 2 da normalização).
--
-- Até aqui, num recebimento em dinheiro só ficava o `valor` LÍQUIDO (o que entra na
-- gaveta). O quanto o cliente ENTREGOU e o TROCO devolvido eram descartados — daí o
-- bug em que a Mesa gravava o entregue como se fosse a venda. Agora guardamos os dois
-- e o banco passa a EXIGIR a coerência (valor_pago = valor + troco), virando rede de
-- segurança contra esse tipo de erro.
--
-- Colunas ANULÁVEIS, SEM backfill: o rastreio começa daqui pra frente. Movimentos
-- antigos (e os que não são recebimento: sangria/suprimento/cancelamento/estorno)
-- ficam NULL — a constraint aceita NULL. Isso também deixa o app ATUAL em produção
-- (que ainda não envia os campos) gravar normal até o próximo deploy.
-- ============================================================

ALTER TABLE caixa_movimentos ADD COLUMN IF NOT EXISTS valor_pago numeric;
ALTER TABLE caixa_movimentos ADD COLUMN IF NOT EXISTS troco      numeric;

-- Troco nunca negativo.
ALTER TABLE caixa_movimentos DROP CONSTRAINT IF EXISTS caixa_mov_troco_nonneg;
ALTER TABLE caixa_movimentos ADD  CONSTRAINT caixa_mov_troco_nonneg
  CHECK (troco IS NULL OR troco >= 0);

-- Invariante central: o entregue = o que entrou + o troco. Só cobra quando
-- valor_pago foi informado (NULL = não rastreado, aceito).
ALTER TABLE caixa_movimentos DROP CONSTRAINT IF EXISTS caixa_mov_pago_coerente;
ALTER TABLE caixa_movimentos ADD  CONSTRAINT caixa_mov_pago_coerente
  CHECK (valor_pago IS NULL OR valor_pago = valor + COALESCE(troco, 0));
