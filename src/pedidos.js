// ============================================================
// PERSISTÊNCIA DE PEDIDOS — salva e lê pedidos.json
// ============================================================

const fs = require("fs");
const path = require("path");

const ARQUIVO = path.join(__dirname, "..", "data", "pedidos.json");

function lerTodos() {
  try {
    if (fs.existsSync(ARQUIVO)) {
      return JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
    }
  } catch (e) {
    console.error("Erro lendo pedidos.json:", e.message);
  }
  return [];
}

function salvarPedido(pedido) {
  const lista = lerTodos();
  const registro = {
    numero: lista.length + 1,
    status: "novo", // novo | preparando | entregue | cancelado
    ...pedido,
    criadoEm: new Date().toISOString(),
  };
  lista.push(registro);
  fs.writeFileSync(ARQUIVO, JSON.stringify(lista, null, 2), "utf8");
  return registro;
}

module.exports = { salvarPedido, lerTodos };
