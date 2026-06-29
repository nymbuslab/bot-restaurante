-- Fila de impressão GENÉRICA, consumida pelo AGENTE de impressão desktop.
-- Diferente do polling de delivery (que lê `pedidos` ainda não impressos e o agente
-- monta a comanda), aqui o SERVIDOR já grava o TEXTO pronto de cada via (jsonb array
-- de strings) — usado por PDV, Mesas (cozinha/pré-conta), fechamento de Caixa e
-- reimpressão manual. O agente busca, imprime cada via (ESC/POS) e marca impresso.
CREATE TABLE IF NOT EXISTS impressao_fila (
  id          bigserial PRIMARY KEY,
  empresa_id  uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo        text NOT NULL,                       -- 'pdv-cozinha' | 'mesa-cozinha' | 'mesa-conta' | 'caixa' | 'reimpressao'
  vias        jsonb NOT NULL DEFAULT '[]'::jsonb,  -- array de strings: o texto de cada via a imprimir
  criado_em   timestamptz NOT NULL DEFAULT now(),
  impresso_em timestamptz                          -- nulo = ainda na fila; preenchido quando o agente confirma
);

-- Índice parcial: o polling só busca os pendentes (impresso_em IS NULL), por empresa, em ordem.
CREATE INDEX IF NOT EXISTS impressao_fila_pendentes_idx
  ON impressao_fila (empresa_id, id) WHERE impresso_em IS NULL;
