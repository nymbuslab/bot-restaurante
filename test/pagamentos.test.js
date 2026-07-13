const { test } = require("node:test");
const assert = require("node:assert/strict");
const { FORMAS_PAGAMENTO, normalizarFormasPagamento } = require("../src/pagamentos");

test("FORMAS_PAGAMENTO: vocabulário fixo em ordem canônica", () => {
  assert.deepEqual(FORMAS_PAGAMENTO, ["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito"]);
});

test("normalizarFormasPagamento: mapeia strings legadas → canônicas", () => {
  // "Pix" minúsculo, "Cartão (na entrega)" genérico → Crédito + Débito, "Dinheiro" ok.
  assert.deepEqual(
    normalizarFormasPagamento(["Pix", "Cartão (na entrega)", "Dinheiro"]),
    ["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito"]
  );
});

test("normalizarFormasPagamento: mantém a ordem canônica, não a de entrada", () => {
  assert.deepEqual(
    normalizarFormasPagamento(["Cartão de Débito", "PIX", "Dinheiro"]),
    ["Dinheiro", "PIX", "Cartão de Débito"]
  );
});

test("normalizarFormasPagamento: descarta 'A Prazo' (não é mais forma canônica)", () => {
  assert.deepEqual(normalizarFormasPagamento(["Dinheiro", "A Prazo", "fiado"]), ["Dinheiro"]);
});

test("normalizarFormasPagamento: crédito e débito específicos", () => {
  assert.deepEqual(normalizarFormasPagamento(["Cartão de crédito"]), ["Cartão de Crédito"]);
  assert.deepEqual(normalizarFormasPagamento(["cartao de debito"]), ["Cartão de Débito"]);
});

test("normalizarFormasPagamento: descarta desconhecidos e deduplica", () => {
  assert.deepEqual(
    normalizarFormasPagamento(["Outros", "PIX", "pix", "cheque"]),
    ["PIX"]
  );
});

test("normalizarFormasPagamento: nunca vazio (fallback Dinheiro)", () => {
  assert.deepEqual(normalizarFormasPagamento([]), ["Dinheiro"]);
  assert.deepEqual(normalizarFormasPagamento(["Outros"]), ["Dinheiro"]);
  assert.deepEqual(normalizarFormasPagamento(null), ["Dinheiro"]);
  assert.deepEqual(normalizarFormasPagamento("xyz"), ["Dinheiro"]);
});

test("normalizarFormasPagamento: idempotente sobre o conjunto canônico", () => {
  assert.deepEqual(normalizarFormasPagamento(FORMAS_PAGAMENTO), FORMAS_PAGAMENTO);
});
