#!/bin/sh
set -e

# Os dados (empresas, pedidos, config, cardápio) vivem no Supabase; sessões do
# WhatsApp e imagens vão para Postgres/Storage. Não há nada para semear em disco
# na primeira execução — o app cria o que precisar sozinho.
exec "$@"
