-- ============================================================
-- Remove a feature Equipe (funcionários, dispositivos, sessões e permissões
-- por cargo) e o acesso rápido do dono (usuário + senha de 6 dígitos).
--
-- Nenhum tenant real chegou a usar: antes desta migration, `equipe_funcionarios`
-- e `equipe_sessoes` estavam vazias em produção, e as colunas `usuario`/
-- `senha_hash`/`tentativas_senha`/`bloqueado_ate` do acesso rápido do dono nunca
-- chegaram a ser aplicadas em produção (ficaram só em rascunho local).
--
-- `auditoria_operacional` NÃO é apagada aqui: é usada também pelos eventos de
-- fornecedor/financeiro (fora da Equipe) via src/auditoria-operacional.js.
-- ============================================================

drop table if exists public.equipe_sessoes;
drop table if exists public.equipe_funcionario_permissoes;
drop table if exists public.equipe_funcionarios;
drop table if exists public.equipe_dispositivos;
drop table if exists public.equipe_perfil_permissoes;
drop table if exists public.equipe_perfis;

alter table public.empresas
  drop column if exists equipe_habilitada,
  drop column if exists compras_habilitadas,
  drop column if exists confirmacao_compras_habilitada,
  drop column if exists ficha_tecnica_habilitada,
  drop column if exists baixa_insumos_habilitada,
  drop column if exists usuario,
  drop column if exists senha_hash,
  drop column if exists tentativas_senha,
  drop column if exists bloqueado_ate;
