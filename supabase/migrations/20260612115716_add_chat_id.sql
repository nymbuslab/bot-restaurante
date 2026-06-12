-- chat_id: JID real da conversa (canal por onde o cliente falou), usado pelo
-- botão "avisar cliente". Estava na tabela SQLite e faltou no schema inicial.
alter table public.pedidos add column chat_id text;
