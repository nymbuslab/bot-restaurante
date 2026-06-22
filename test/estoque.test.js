const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../public/estoque");

const card = { categorias: [ { nome: "P", itens: [
  { id: 1, nome: "Livre", preco: 10 },                       // não controlado
  { id: 2, nome: "Cheio", preco: 10, estoque: 10, estoqueMinimo: 3 },
  { id: 3, nome: "Baixo", preco: 10, estoque: 2, estoqueMinimo: 3 },
  { id: 4, nome: "Zerado", preco: 10, estoque: 0, estoqueMinimo: 3 },
] } ] };

test("statusEstoque: não controlado quando estoque ausente/vazio", () => {
  assert.equal(E.statusEstoque({ id: 1 }).controlado, false);
  assert.equal(E.statusEstoque({ id: 1, estoque: "" }).controlado, false);
  assert.equal(E.statusEstoque({ id: 1, estoque: null }).controlado, false);
});
test("statusEstoque: esgotado / baixo / normal", () => {
  assert.deepEqual(E.statusEstoque({ estoque: 0, estoqueMinimo: 3 }), { controlado: true, esgotado: true, baixo: false, quantidade: 0, minimo: 3, unidade: "un" });
  assert.deepEqual(E.statusEstoque({ estoque: 2, estoqueMinimo: 3 }), { controlado: true, esgotado: false, baixo: true, quantidade: 2, minimo: 3, unidade: "un" });
  assert.deepEqual(E.statusEstoque({ estoque: 10, estoqueMinimo: 3 }), { controlado: true, esgotado: false, baixo: false, quantidade: 10, minimo: 3, unidade: "un" });
});
test("statusEstoque: kg parseia decimal e devolve unidade kg", () => {
  const s = E.statusEstoque({ estoque: "12,5", estoqueMinimo: "2", unidade: "kg" });
  assert.equal(s.unidade, "kg");
  assert.equal(s.quantidade, 12.5);
  assert.equal(s.minimo, 2);
  assert.equal(s.baixo, false);
});
test("formatarQtd: un inteiro, kg decimal BR", () => {
  assert.equal(E.formatarQtd(120, "un"), "120");
  assert.equal(E.formatarQtd(12.5, "kg"), "12,5");
  assert.equal(E.formatarQtd(12, "kg"), "12");
});
test("validarEstoque: esgotado e over-order rejeitam; agrega linhas", () => {
  assert.equal(E.validarEstoque(card, [{ id: 4, qtd: 1 }]).ok, false);          // esgotado
  assert.match(E.validarEstoque(card, [{ id: 4, qtd: 1 }]).erro, /esgotado/i);
  assert.equal(E.validarEstoque(card, [{ id: 3, qtd: 3 }]).ok, false);          // 3 > 2
  assert.match(E.validarEstoque(card, [{ id: 3, qtd: 3 }]).erro, /Restam só 2/);
  assert.equal(E.validarEstoque(card, [{ id: 2, qtd: 6 }, { id: 2, qtd: 6 }]).ok, false); // 12 > 10 agregado
});
test("validarEstoque: item não controlado e pedido válido passam", () => {
  assert.equal(E.validarEstoque(card, [{ id: 1, qtd: 999 }]).ok, true);
  assert.equal(E.validarEstoque(card, [{ id: 2, qtd: 10 }]).ok, true);
});
test("aplicarBaixa: desconta, trava em 0, agrega, não muta o original e ignora não controlado", () => {
  const out = E.aplicarBaixa(card, [{ id: 2, qtd: 4 }, { id: 3, qtd: 5 }, { id: 1, qtd: 2 }]);
  const itens = out.categorias[0].itens;
  assert.equal(itens[1].estoque, 6);   // 10 - 4
  assert.equal(itens[2].estoque, 0);   // 2 - 5 → trava em 0
  assert.equal(itens[0].estoque, undefined); // não controlado intacto
  assert.equal(card.categorias[0].itens[1].estoque, 10); // original não mutado
});
