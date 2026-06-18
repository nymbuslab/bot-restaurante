-- ============================================================
-- Normaliza a mensagem de boas-vindas dos tenants ANTIGOS.
--
-- O bot conversacional antigo embutia "Como posso ajudar? Digite o número da
-- opção:" na própria boas-vindas. Agora o menu numerado (1 Fazer pedido / 2
-- Atendente) é montado pelo src/fluxo.js — então esse trecho na config virou
-- duplicado/confuso. Tenants novos já nascem com o default limpo.
--
-- Atualiza SOMENTE quem ainda tem o default antigo EXATO (comparação literal):
-- quem personalizou a mensagem não é tocado.
-- ============================================================
update public.empresas
   set config = jsonb_set(
         config,
         '{mensagens,boasVindas}',
         '"Olá! 👋 Bem-vindo(a) ao *{restaurante}*."'::jsonb
       )
 where config->'mensagens'->>'boasVindas'
       = E'Olá! 👋 Bem-vindo(a) ao *{restaurante}*.\n\nComo posso ajudar? Digite o número da opção:';
