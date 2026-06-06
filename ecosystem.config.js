// Configuração do PM2 — mantém o bot rodando 24h.
// Uso:  pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "bot-restaurante",
      script: "index.js",
      autorestart: true, // reinicia sozinho se cair
      max_restarts: 20,
      restart_delay: 5000, // espera 5s antes de reiniciar
      watch: false,
      env: {
        PORT: 3000,
      },
    },
  ],
};
