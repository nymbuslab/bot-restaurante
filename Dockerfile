FROM node:22-slim

# Baileys é WebSocket puro (sem browser) → não precisa de Chromium nem libs X11.
# - git: a dependência `libsignal` do Baileys vem de um repositório GitHub.
# Sem módulo nativo: `pg` (Postgres) é JS puro — não precisa de python/make/g++.
RUN apt-get update && apt-get install -y \
    git \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "index.js"]
