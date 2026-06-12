-- Sessão do WhatsApp (Baileys) persistida no Postgres → app stateless.
-- Uma linha por (slug, chave): chave = 'creds' ou '{tipo}:{id}' das chaves de signal.
-- valor é o objeto serializado com BufferJSON (Buffers preservados) como jsonb.
create table public.wa_auth (
  slug   text not null,
  chave  text not null,
  valor  jsonb not null,
  primary key (slug, chave)
);

-- RLS: tranca acesso pela API pública; o backend usa a conexão privilegiada.
alter table public.wa_auth enable row level security;
