-- Tokens de "esqueci a senha" (cliente e master — ambos usuários do Supabase Auth).
-- Guarda o HASH do token (nunca o token cru), com expiração e uso único.
create table if not exists password_resets (
  token_hash text primary key,
  email      text not null,
  expira_em  timestamptz not null,
  usado      boolean not null default false,
  criado_em  timestamptz not null default now()
);
create index if not exists idx_password_resets_email on password_resets (email);

-- Hardening (igual às demais): RLS on + sem grants p/ anon/authenticated.
alter table password_resets enable row level security;
revoke all on password_resets from anon, authenticated;
comment on table password_resets is 'Tokens de reset de senha (hash) — fluxo via Resend';
