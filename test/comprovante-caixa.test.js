const { test } = require("node:test");
const assert = require("node:assert/strict");

const ComprovanteCaixa = require("../public/comprovante-caixa");

test("comprovante de sangria traz dados de conferencia", () => {
  const txt = ComprovanteCaixa.montarComprovanteCaixa({
    restaurante: "Sabor D Casa",
    tipo: "sangria",
    caixaId: 42,
    operador: "Sabor D Casa",
    valor: 6.99,
    descricao: "Retirada para fornecedor",
    criadoEm: "2026-08-29T14:06:00.000Z",
  });

  assert.match(txt, /SABOR D CASA/);
  assert.match(txt, /COMPROVANTE DE CAIXA/);
  assert.match(txt, /SANGRIA/);
  assert.match(txt, /Caixa #42/);
  assert.match(txt, /Operador:\s+Sabor D Casa/);
  assert.match(txt, /Valor\s+- R\$ 6,99/);
  assert.match(txt, /Motivo: Retirada para fornecedor/);
});

test("comprovante de cancelamento traz pedido e forma quando existirem", () => {
  const txt = ComprovanteCaixa.montarComprovanteCaixa({
    restaurante: "Meu Restaurante",
    tipo: "cancelamento",
    caixaId: 9,
    operador: "Caixa",
    pedidoNumero: 86,
    forma: "PIX",
    valor: 17,
    descricao: "Cancelamento pedido #86",
    criadoEm: "2026-08-29T15:20:00.000Z",
  });

  assert.match(txt, /CANCELAMENTO/);
  assert.match(txt, /Pedido #86/);
  assert.match(txt, /Forma:\s+PIX/);
  assert.match(txt, /Valor\s+- R\$ 17,00/);
});
