-- Estende plataforma_config (singleton) com os dados da empresa Nymbus que
-- alimentam o lado do cliente (footer da landing etc.) e as credenciais do
-- master (migradas da env para o banco, ficando editáveis pelo painel).
alter table public.plataforma_config
  add column if not exists razao_social     text,
  add column if not exists nome_fantasia    text,
  add column if not exists cnpj             text,
  add column if not exists endereco         text,
  add column if not exists telefone         text,
  add column if not exists facebook         text,
  add column if not exists instagram        text,
  add column if not exists master_email     text,
  add column if not exists master_senha_hash text;

-- master_email / master_senha_hash: NULL = ainda usa a env como bootstrap.
-- A senha fica em HASH (sha256+salt, mesma hashSenha do projeto), nunca em texto.
