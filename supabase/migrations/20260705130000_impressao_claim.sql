-- Claim/lease de impressão: evita 2 agentes do mesmo tenant imprimirem o MESMO
-- trabalho em duplicata. O agente "reserva" os pendentes (reservado_em/por) atomicamente
-- (FOR UPDATE SKIP LOCKED); só imprime o que reservou. A reserva expira (30s) → se o
-- agente cair antes de marcar impresso, outro reimprime (nunca perde comanda).
ALTER TABLE pedidos        ADD COLUMN IF NOT EXISTS reservado_em  timestamptz;
ALTER TABLE pedidos        ADD COLUMN IF NOT EXISTS reservado_por text;
ALTER TABLE impressao_fila ADD COLUMN IF NOT EXISTS reservado_em  timestamptz;
ALTER TABLE impressao_fila ADD COLUMN IF NOT EXISTS reservado_por text;
