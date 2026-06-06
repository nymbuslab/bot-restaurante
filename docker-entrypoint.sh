#!/bin/sh
set -e

# Na primeira execução o volume está vazio — copia os dados padrão
if [ ! -f /app/data/config.json ]; then
  echo "Primeira execução: inicializando config.json padrão..."
  cp /app/data-default/config.json /app/data/config.json
fi

if [ ! -f /app/data/cardapio.json ]; then
  echo "Primeira execução: inicializando cardapio.json padrão..."
  cp /app/data-default/cardapio.json /app/data/cardapio.json
fi

exec "$@"
