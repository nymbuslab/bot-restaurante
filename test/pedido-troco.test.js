const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// O "Troco para" do cardápio web precisa chegar até o restaurante.
//
// O front pergunta o troco quando o cliente escolhe Dinheiro e manda o valor no
// pedido. O servidor nunca lia esse campo: não havia coluna, o cupom não
// imprimia e o painel não mostrava. Quem ia entregar descobria na porta do
// cliente que precisava de troco e não tinha.
//
// Estes testes travam as três pontas da ligação (rota lê, pedido grava, pedido
// devolve) e o teto que protege a coluna `numeric(10,2)`: um valor absurdo
// vindo do cliente estouraria o tipo e derrubaria o pedido inteiro no INSERT,
// trocando "sem troco" por "sem pedido".
// ---------------------------------------------------------------------------

const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");
const pedidosSrc = fs.readFileSync(path.join(__dirname, "..", "src", "pedidos.js"), "utf8");

function corpoDaRota(marcador) {
  const i = servidor.indexOf(marcador);
  assert.ok(i > -1, "rota não encontrada: " + marcador);
  const fim = servidor.indexOf("\napp.", i + 10);
  return servidor.slice(i, fim === -1 ? undefined : fim);
}

const rota = corpoDaRota('app.post("/api/c/:slug/pedido"');

test("a rota do pedido web lê o troco que o front manda", () => {
  assert.match(rota, /b\.troco/, "o campo `troco` do payload precisa ser lido");
  assert.match(rota, /trocoPara/, "e chegar ao pedido salvo");
});

test("troco só vale quando a forma escolhida é dinheiro", () => {
  assert.match(rota, /ehDinheiro/,
    "sem essa checagem, 'troco para R$ 100' num Pix viraria dado sem sentido no cupom");
});

test("o troco tem teto, senão um valor absurdo derruba o pedido no INSERT", () => {
  assert.match(rota, /TROCO_MAX/,
    "a coluna é numeric(10,2): sem teto, um número gigante estoura o tipo e o pedido inteiro se perde");
});

test("o pedido grava e devolve o troco", () => {
  assert.match(pedidosSrc, /troco_para/, "coluna no INSERT");
  assert.match(pedidosSrc, /trocoPara:\s*r\.troco_para/, "mapeamento de volta para o app");
});
