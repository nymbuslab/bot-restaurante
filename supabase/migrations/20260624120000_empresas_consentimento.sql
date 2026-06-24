-- Registro do aceite de Termos/Privacidade no cadastro (prova de consentimento — LGPD Art. 8, §2).
-- Gravados no INSERT de `empresas` ao criar a conta (src/empresas.js: termos_aceitos_em = now(),
-- termos_versao = TERMOS_VERSAO). Contas criadas antes desta migração ficam com os campos nulos.
alter table empresas
  add column if not exists termos_aceitos_em timestamptz,
  add column if not exists termos_versao text;
