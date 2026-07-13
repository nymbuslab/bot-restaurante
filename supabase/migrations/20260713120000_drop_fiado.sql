-- ============================================================
-- DROP FIADO — remove do banco a feature de conta a prazo (fiado) + o cadastro
-- ADMINISTRATIVO de cliente. Decisão do dono (2026-07-13): amadurecer a ideia e
-- recriar do zero. O código da feature já foi removido (ver commits chore(fiado)).
--
-- ⚠️ ORDEM OBRIGATÓRIA: aplicar SÓ DEPOIS (ou junto) do DEPLOY do código sem
--    fiado. O app antigo (com fiado) consulta estas colunas/tabelas a cada
--    operação (o caixa lê `a_prazo` sempre) — dropar com o app antigo no ar
--    QUEBRA a produção. Sequência: deploy do código → este drop.
--
-- ⚠️ IRREVERSÍVEL: fazer backup/snapshot do banco antes (painel Supabase).
--
-- CIRÚRGICO: PRESERVA a tabela `clientes` base (nome/telefone/chat_id/datas —
-- o bot reconhece o cliente que volta + LGPD) e a tabela `enderecos` inteira,
-- e MANTÉM o índice único parcial de telefone (o upsert do bot depende dele).
-- Remove só o que é fiado + cadastro administrativo.
--
-- CÓDIGO PAREADO: o código já não referencia estas colunas (o filtro
-- `a_prazo = false` de src/caixa.js foi removido no mesmo lote). A consulta
-- `_contarAReceber` limita por `criado_em >= abertura`, então pedido fiado
-- legado (mais antigo que o caixa atual) não entra — sem quebra na transição.
-- ============================================================

-- 1) Log de baixas de fiado (tabela 100% da feature).
DROP TABLE IF EXISTS public.fiado_baixas;

-- 2) Colunas de fiado em `pedidos` (+ índice). Dropar a coluna remove a FK.
DROP INDEX IF EXISTS public.pedidos_cliente_fiado_idx;
ALTER TABLE public.pedidos DROP COLUMN IF EXISTS a_prazo;
ALTER TABLE public.pedidos DROP COLUMN IF EXISTS cliente_id;
ALTER TABLE public.pedidos DROP COLUMN IF EXISTS vencimento;
ALTER TABLE public.pedidos DROP COLUMN IF EXISTS valor_recebido;

-- 3) Colunas do cadastro admin/fiado em `clientes` (+ CHECKs + unique de documento).
--    PRESERVA nome/telefone/chat_id/criado_em/atualizado_em e o índice único parcial
--    de telefone (clientes_empresa_telefone_uidx) — NÃO tocar nele.
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_tipo_valido;
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_dia_venc_valido;
DROP INDEX IF EXISTS public.clientes_empresa_documento_uidx;
ALTER TABLE public.clientes
  DROP COLUMN IF EXISTS tipo,
  DROP COLUMN IF EXISTS apelido,
  DROP COLUMN IF EXISTS documento,
  DROP COLUMN IF EXISTS ie_rg,
  DROP COLUMN IF EXISTS cep,
  DROP COLUMN IF EXISTS logradouro,
  DROP COLUMN IF EXISTS numero,
  DROP COLUMN IF EXISTS complemento,
  DROP COLUMN IF EXISTS bairro,
  DROP COLUMN IF EXISTS cidade,
  DROP COLUMN IF EXISTS uf,
  DROP COLUMN IF EXISTS limite_credito,
  DROP COLUMN IF EXISTS dia_vencimento,
  DROP COLUMN IF EXISTS convenio_id,
  DROP COLUMN IF EXISTS bloquear_limite,
  DROP COLUMN IF EXISTS bloquear_vencimento,
  DROP COLUMN IF EXISTS liberacao_pontual;
