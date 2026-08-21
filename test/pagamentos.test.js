const { test } = require("node:test");
const assert = require("node:assert/strict");
const { FORMAS_PAGAMENTO, normalizarFormasPagamento } = require("../src/pagamentos");
const pg = require("../src/pagamentos");

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

// ---------------------------------------------------------------------------
// A validação da venda tem que usar a MESMA lista que a tela mostrou.
//
// O PDV recebia as formas normalizadas (`/api/caixa` roda
// `normalizarFormasPagamento`) mas o servidor conferia a escolha contra a lista
// CRUA do `config.pagamentos`. Num tenant com dado legado — `["Dinheiro",
// "Cartão"]`, de quando as formas eram texto livre — a tela oferecia "Cartão de
// Crédito" e o servidor recusava, porque aquela string não existe na lista crua.
// Toda venda no cartão morria com 400 "Forma de pagamento inválida", e o
// operador não tem como adivinhar o motivo.
//
// Ninguém está afetado hoje (salvar as Configurações já normaliza, e os dois
// tenants estão canônicos), mas tenant novo ou restaurado de backup antigo cai
// na armadilha.
// ---------------------------------------------------------------------------

test("formaPermitida: aceita a forma canônica que a tela oferece a partir de legado", () => {
  const legado = ["Dinheiro", "Cartão"]; // texto livre da época antiga
  assert.equal(pg.formaPermitida(legado, "Cartão de Crédito"), true);
  assert.equal(pg.formaPermitida(legado, "Cartão de Débito"), true);
  assert.equal(pg.formaPermitida(legado, "Dinheiro"), true);
});

test("formaPermitida: recusa forma que o dono não ligou", () => {
  assert.equal(pg.formaPermitida(["Dinheiro", "Cartão"], "PIX"), false);
});

test("formaPermitida: lista canônica segue funcionando igual", () => {
  const canon = ["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito"];
  assert.equal(pg.formaPermitida(canon, "PIX"), true);
  assert.equal(pg.formaPermitida(canon, "Vale-refeição"), false);
});

test("formaPermitida: config vazia não bloqueia a venda", () => {
  // `normalizarFormasPagamento` nunca devolve vazio (cai em Dinheiro), e o
  // comportamento antigo também liberava tudo quando não havia config.
  assert.equal(pg.formaPermitida([], "Dinheiro"), true);
  assert.equal(pg.formaPermitida(null, "Dinheiro"), true);
});
