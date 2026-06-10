FROM node:20-slim

# Baileys é WebSocket puro (sem browser) → não precisa de Chromium nem libs X11.
# - git: a dependência `libsignal` do Baileys vem de um repositório GitHub.
# - python3/make/g++: compilação nativa do better-sqlite3.
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Salva cópia dos dados padrão — usada pelo entrypoint na primeira execução
# (quando o volume é montado, /app/data fica vazio)
RUN cp -r data /app/data-default

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "index.js"]
