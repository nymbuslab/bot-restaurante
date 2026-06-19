-- Cache de geocodificação (Geoapify) — evita chamadas repetidas à API.
-- Chave: endereço completo normalizado (lower + espaços colapsados). Dado
-- público (coordenadas de endereço), cache global. Padrão cache-first (src/frete.js).
create table if not exists geo_cache (
  endereco_norm text primary key,
  lat double precision not null,
  lon double precision not null,
  criado_em timestamptz not null default now()
);

-- Hardening (igual às demais): RLS on + sem grants p/ anon/authenticated.
-- O acesso é só pelo backend (service role / pool), nunca via PostgREST.
alter table geo_cache enable row level security;
revoke all on geo_cache from anon, authenticated;
comment on table geo_cache is 'Cache de geocodificação Geoapify (endereço normalizado -> lat/lon)';
