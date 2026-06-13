-- Configuração global da plataforma (Nymbus), gerenciada pelo painel master.
-- Tabela de UMA linha só (singleton). Por ora guarda o WhatsApp de suporte que
-- alimenta o botão "Falar com Suporte" no painel do cliente; a aba "Configurações
-- Master" passa a editar isto. Futuro: mais campos da identidade da plataforma.
create table if not exists public.plataforma_config (
  id               boolean primary key default true,
  suporte_whatsapp text,
  atualizado_em    timestamptz not null default now(),
  constraint plataforma_config_singleton check (id)
);

-- Garante a linha única.
insert into public.plataforma_config (id) values (true) on conflict (id) do nothing;

-- RLS ligado, sem policies: só a conexão privilegiada do backend acessa
-- (mesmo padrão de empresas/pedidos/wa_auth).
alter table public.plataforma_config enable row level security;
