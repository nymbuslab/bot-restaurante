-- Trilha mínima de auditoria LGPD (Art. 37): eventos sensíveis com dados pessoais
-- (conta criada/excluída, dados exportados). O `slug` é TEXTO sem FK → o registro
-- SOBREVIVE à exclusão da conta. `detalhe` não guarda PII (só contexto não-pessoal).
create table if not exists auditoria (
  id bigserial primary key,
  evento text not null,
  slug text,
  detalhe jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists auditoria_criado_em_idx on auditoria (criado_em desc);
create index if not exists auditoria_slug_idx on auditoria (slug);

-- RLS deny-all (defesa em profundidade): acesso só pelo backend (service_role, que ignora RLS).
alter table auditoria enable row level security;
