-- Plano/tier do tenant. Default 'bot' faz o backfill de todos os tenants
-- existentes para o plano atual (Bot, R$79). Sem CHECK de propósito: o registro
-- em src/planos.js é a fonte de verdade; valor desconhecido cai em 'bot' no código.
alter table empresas add column if not exists plano text not null default 'bot';
