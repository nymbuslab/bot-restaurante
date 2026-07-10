-- ============================================================
-- CLIENTES — cadastro administrativo (PF/PJ) + limite de crédito (fiado).
--
-- A tabela `clientes` já existia (alimentada em background pelo checkout web /
-- bot: chave empresa_id+telefone). Aqui ela ganha os campos do cadastro manual
-- no painel: pessoa física/jurídica, documento (CPF/CNPJ), endereço do cadastro
-- e os controles de crédito (limite, dia de vencimento, bloqueios).
--
-- Tudo ADD COLUMN IF NOT EXISTS (aditivo, sem backfill): clientes já existentes
-- ficam PF, sem documento e sem limite — o dono completa quando quiser. O app
-- atual (que não lê esses campos) segue funcionando até o deploy.
--
-- `Valor Gasto`/`Saldo` NÃO são colunas: são derivados das vendas a prazo em
-- aberto (Fase 3/4). Aqui fica só o `limite_credito` e as regras de bloqueio.
-- ============================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo         text    NOT NULL DEFAULT 'PF';   -- 'PF' | 'PJ'
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS apelido      text    NOT NULL DEFAULT '';     -- Apelido (PF) / Nome Fantasia (PJ)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS documento    text    NOT NULL DEFAULT '';     -- CPF (PF) / CNPJ (PJ), só dígitos
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ie_rg        text    NOT NULL DEFAULT '';     -- RG (PF) / Inscrição Estadual (PJ)

-- Endereço do cadastro (a tabela `enderecos` 1-N fica como histórico de entrega do web).
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cep          text    NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS logradouro   text    NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS numero       text    NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS complemento  text    NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bairro       text    NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade       text    NOT NULL DEFAULT '';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS uf           text    NOT NULL DEFAULT '';

-- Limite de crédito (fiado) + regras de bloqueio.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS limite_credito      numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dia_vencimento      smallint;                 -- 1..31, NULL = sem vencimento fixo
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bloquear_limite     boolean NOT NULL DEFAULT false;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS bloquear_vencimento boolean NOT NULL DEFAULT false;
-- Liberação pontual: quando true, libera a PRÓXIMA venda a prazo mesmo estourado/vencido;
-- é consumida na venda (volta a false). Ver src/fiado.js (Fase 3).
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS liberacao_pontual   boolean NOT NULL DEFAULT false;

-- Coerência dos novos campos.
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_tipo_valido;
ALTER TABLE clientes ADD  CONSTRAINT clientes_tipo_valido CHECK (tipo IN ('PF', 'PJ'));
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_dia_venc_valido;
ALTER TABLE clientes ADD  CONSTRAINT clientes_dia_venc_valido
  CHECK (dia_vencimento IS NULL OR (dia_vencimento BETWEEN 1 AND 31));

-- A unique (empresa_id, telefone) impedia dois cadastros sem telefone (ambos '').
-- Troca por unique PARCIAL (só quando preenchido) + unique parcial de documento.
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_empresa_id_telefone_key;
CREATE UNIQUE INDEX IF NOT EXISTS clientes_empresa_telefone_uidx
  ON clientes (empresa_id, telefone) WHERE telefone <> '';
CREATE UNIQUE INDEX IF NOT EXISTS clientes_empresa_documento_uidx
  ON clientes (empresa_id, documento) WHERE documento <> '';
