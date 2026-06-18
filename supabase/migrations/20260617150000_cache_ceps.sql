-- ============================================================
-- CACHE DE CEP — evita bater no ViaCEP à toa.
--
-- A 1ª vez que um CEP é consultado, o backend busca no ViaCEP e grava aqui;
-- daí pra frente (qualquer cliente, qualquer tenant) o mesmo CEP vem do banco.
--
-- Dado postal PÚBLICO (CEP → rua/bairro/cidade/uf) — NÃO é PII e NÃO é por
-- tenant (cache global). Acesso só pelo backend (DATABASE_URL privilegiado);
-- mesmo hardening das demais (RLS on + deny-all + grants revogados) por
-- consistência — o navegador nunca toca a tabela direto, só via /api/cep.
-- ============================================================
create table if not exists public.ceps (
  cep        text primary key,              -- 8 dígitos, sem máscara
  logradouro text not null default '',
  bairro     text not null default '',
  cidade     text not null default '',
  uf         text not null default '',
  criado_em  timestamptz not null default now()
);

alter table public.ceps enable row level security;
revoke all on table public.ceps from anon, authenticated;
comment on table public.ceps is
  'Cache de CEP (ViaCEP). Dado postal público, global (não por tenant). Acesso só pelo backend; RLS on + sem policy (deny-all) + grants anon/authenticated revogados.';
