const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../public/estoque");

// ---------------------------------------------------------------------------
// Salvar o cardápio não pode desfazer venda.
//
// O editor manda o cardápio INTEIRO, incluindo os produtos que o dono nem abriu
// (a cópia que o navegador carregou quando o painel abriu). Se uma venda cair
// enquanto ele mexe no preço de um produto, o saldo do OUTRO produto voltava ao
// valor antigo ao salvar — e o `diffEstoque` registrava como "ajuste / Editor do
// produto", então a trilha ainda dizia o motivo errado.
//
// Não dá para simplesmente ignorar o estoque do payload: o editor edita saldo de
// verdade, do produto e de cada variação. A régua é a intenção: vale o que veio
// só para o item que o dono realmente editou (marcado no envio); todo o resto
// mantém o saldo do banco.
// ---------------------------------------------------------------------------

const banco = {
  categorias: [{ nome: "Bebidas", itens: [
    { id: 1, nome: "Coca", preco: 3, estoque: 8, estoqueMinimo: 2 },
    { id: 2, nome: "Suco", preco: 5, estoque: 4 },
    { id: 3, nome: "Açaí", preco: 0, variacoes: [
      { id: "v1", nome: "300ml", preco: 12, estoque: 6 },
      { id: "v2", nome: "500ml", preco: 18, estoque: 3 },
    ] },
  ] }],
};

// Simula o navegador: cópia carregada ANTES das vendas (saldos antigos).
function payloadDoNavegador() {
  return JSON.parse(JSON.stringify({
    categorias: [{ nome: "Bebidas", itens: [
      { id: 1, nome: "Coca", preco: 3, estoque: 10, estoqueMinimo: 2 },
      { id: 2, nome: "Suco", preco: 5, estoque: 9 },
      { id: 3, nome: "Açaí", preco: 0, variacoes: [
        { id: "v1", nome: "300ml", preco: 12, estoque: 9 },
        { id: "v2", nome: "500ml", preco: 18, estoque: 9 },
      ] },
    ] }],
  }));
}

function achar(card, id) {
  let r = null;
  (card.categorias || []).forEach((c) => (c.itens || []).forEach((i) => { if (i.id === id) r = i; }));
  return r;
}

test("preservarSaldos: item que o dono não editou mantém o saldo do banco", () => {
  const out = E.preservarSaldos(banco, payloadDoNavegador());
  assert.equal(achar(out, 1).estoque, 8); // a venda que caiu no meio, não os 10 do navegador
  assert.equal(achar(out, 2).estoque, 4);
});

test("preservarSaldos: item marcado como editado usa o saldo que veio", () => {
  const p = payloadDoNavegador();
  achar(p, 2)._estoqueEditado = true;
  const out = E.preservarSaldos(banco, p);
  assert.equal(achar(out, 2).estoque, 9); // o dono digitou 9, vale 9
  assert.equal(achar(out, 1).estoque, 8); // o vizinho segue protegido
});

test("preservarSaldos: o marcador não é gravado no cardápio", () => {
  const p = payloadDoNavegador();
  achar(p, 2)._estoqueEditado = true;
  const out = E.preservarSaldos(banco, p);
  assert.equal("_estoqueEditado" in achar(out, 2), false);
});

test("preservarSaldos: variação segue a marca do próprio item", () => {
  const p = payloadDoNavegador();
  const out = E.preservarSaldos(banco, p);
  assert.equal(achar(out, 3).variacoes[0].estoque, 6); // do banco
  assert.equal(achar(out, 3).variacoes[1].estoque, 3);

  const p2 = payloadDoNavegador();
  achar(p2, 3)._estoqueEditado = true;
  const out2 = E.preservarSaldos(banco, p2);
  assert.equal(achar(out2, 3).variacoes[0].estoque, 9); // o dono editou o item inteiro
});

test("preservarSaldos: produto novo entra com o que veio", () => {
  const p = payloadDoNavegador();
  p.categorias[0].itens.push({ id: 99, nome: "Água", preco: 2, estoque: 12 });
  const out = E.preservarSaldos(banco, p);
  assert.equal(achar(out, 99).estoque, 12);
});

test("preservarSaldos: limpar o saldo para ilimitado continua funcionando", () => {
  const p = payloadDoNavegador();
  const item = achar(p, 1);
  delete item.estoque; delete item.estoqueMinimo;
  item._estoqueEditado = true;
  const out = E.preservarSaldos(banco, p);
  assert.equal("estoque" in achar(out, 1), false);
});

test("preservarSaldos: item que era ilimitado no banco não ganha saldo do nada", () => {
  const semControle = { categorias: [{ itens: [{ id: 1, nome: "Coca", preco: 3 }] }] };
  const p = { categorias: [{ itens: [{ id: 1, nome: "Coca", preco: 3, estoque: 50 }] }] };
  const out = E.preservarSaldos(semControle, p);
  assert.equal("estoque" in achar(out, 1), false); // sem marca, o banco manda: ilimitado
});

test("preservarSaldos: o mínimo acompanha o saldo", () => {
  const out = E.preservarSaldos(banco, payloadDoNavegador());
  assert.equal(achar(out, 1).estoqueMinimo, 2);
});

test("preservarSaldos: não muta o que recebeu", () => {
  const p = payloadDoNavegador();
  E.preservarSaldos(banco, p);
  assert.equal(achar(p, 1).estoque, 10); // o payload original segue intacto
});

test("preservarSaldos: entrada vazia não quebra", () => {
  assert.deepEqual(E.preservarSaldos(null, { categorias: [] }), { categorias: [] });
  assert.deepEqual(E.preservarSaldos(banco, null), null);
});
