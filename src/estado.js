// Estado compartilhado entre o bot e o servidor web.
const estado = {
  botStatus: "iniciando", // iniciando | aguardando_qr | conectado | desconectado
  qrDataUrl: null,
};
module.exports = estado;
