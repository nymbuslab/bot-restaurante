const { test } = require("node:test");
const assert = require("node:assert/strict");
const { recalcularVenda, aplicarDesconto, validarPagamentos, calcularTroco, resumoPagamento, freteEfetivo, totalComFrete } = require("../src/pdv");

const cardapio = {
  categorias: [
    {
      nome: "Espetos",
      itens: [
        { id: "a1", nome: "Espeto de carne", preco: 8, unidade: "un", opcionais: "Bacon | 3.50\nQueijo | 2" },
        { id: "a2", nome: "Picanha (kg)", preco: 80, unidade: "kg", apenasLocal: true },
        { id: "a3", nome: "Indisponível", preco: 5, unidade: "un", disponivel: false },
        { id: "a4", nome: "Arquivado", preco: 5, unidade: "un", arquivado: true },
        { id: "m1", nome: "Marmitex", preco: 18, unidade: "un", opcionais: "Bacon | 3.50", composicao: [
          { nome: "Proteínas", obrigatorio: true, min: 1, max: 1, itens: ["Frango", "Carne"] },
        ] },
      ],
    },
  ],
};

test("recalcularVenda: item un + opcionais, preço pelo cardápio (ignora preço do cliente)", () => {
  const r = recalcularVenda(cardapio, [
    { id: "a1", qtd: 2, preco: 999, opcionais: [{ nome: "Bacon", qtd: 1 }, { nome: "Fantasma", qtd: 5 }] },
  ]);
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].preco, 8);
  assert.equal(r.itens[0].unidade, "un");
  assert.equal(r.itens[0].opcionais.length, 1); // opcional desconhecido descartado
  // (8 + 3.50) * 2 = 23
  assert.equal(r.subtotal, 23);
});

test("recalcularVenda: item por kg usa peso decimal (preço por kg)", () => {
  const r = recalcularVenda(cardapio, [{ id: "a2", qtd: "0,5" }]); // aceita vírgula
  assert.equal(r.itens[0].unidade, "kg");
  assert.equal(r.itens[0].qtd, 0.5);
  assert.equal(r.subtotal, 40); // 80 * 0.5
});

test("recalcularVenda: peso inválido em kg lança erro", () => {
  assert.throws(() => recalcularVenda(cardapio, [{ id: "a2", qtd: 0 }]), /Peso inválido/);
});

test("recalcularVenda: item inexistente/indisponível/arquivado rejeita", () => {
  assert.throws(() => recalcularVenda(cardapio, [{ id: "zzz", qtd: 1 }]), /indisponível/);
  assert.throws(() => recalcularVenda(cardapio, [{ id: "a3", qtd: 1 }]), /indisponível/);
  assert.throws(() => recalcularVenda(cardapio, [{ id: "a4", qtd: 1 }]), /indisponível/);
});

test("aplicarDesconto: valor em R$ e em %, clampa em [0, subtotal]", () => {
  assert.deepEqual(aplicarDesconto(100, { tipo: "valor", valor: 15 }), { desconto: 15, total: 85 });
  assert.deepEqual(aplicarDesconto(100, { tipo: "pct", valor: 10 }), { desconto: 10, total: 90 });
  assert.deepEqual(aplicarDesconto(50, { tipo: "valor", valor: 999 }), { desconto: 50, total: 0 }); // não passa do subtotal
  assert.deepEqual(aplicarDesconto(50, null), { desconto: 0, total: 50 });
});

test("validarPagamentos: soma das formas precisa bater com o total", () => {
  assert.equal(validarPagamentos(45, [{ forma: "Dinheiro", valor: 30 }, { forma: "Pix", valor: 15 }]), true);
  assert.throws(() => validarPagamentos(45, [{ forma: "Dinheiro", valor: 30 }]), /difere do total/);
  assert.throws(() => validarPagamentos(10, [{ forma: "", valor: 10 }]), /Forma de pagamento/);
  assert.throws(() => validarPagamentos(10, [{ forma: "Pix", valor: 0 }]), /Valor de pagamento/);
  assert.throws(() => validarPagamentos(10, []), /Informe a forma/);
});

test("calcularTroco: nunca negativo", () => {
  assert.equal(calcularTroco(50, 35), 15);
  assert.equal(calcularTroco(30, 35), 0);
});

test("resumoPagamento: string legível das formas", () => {
  assert.equal(
    resumoPagamento([{ forma: "Dinheiro", valor: 30 }, { forma: "Pix", valor: 15 }]),
    "Dinheiro R$ 30,00 · Pix R$ 15,00"
  );
});

test("freteEfetivo: aceita só 0 (cortesia) ou o valor calculado pelo servidor", () => {
  assert.equal(freteEfetivo(0, 8), 0);      // lixeira/cortesia
  assert.equal(freteEfetivo(8, 8), 8);      // bate com o calculado
  assert.equal(freteEfetivo(999, 8), 8);    // cliente tenta forjar → usa o calculado
  assert.equal(freteEfetivo(5, 0), 0);      // calculado 0 (fora da área) → 0
});

test("totalComFrete: soma o frete ao total (>= 0)", () => {
  assert.equal(totalComFrete(50, 8), 58);
  assert.equal(totalComFrete(50, 0), 50);
  assert.equal(totalComFrete(50, -3), 50);  // frete negativo é ignorado
});

test("recalcularVenda: composição válida vai no item, não soma preço", () => {
  const r = recalcularVenda(cardapio, [
    { id: "m1", qtd: 1, composicao: [{ grupo: "Proteínas", itens: ["Frango"] }] },
  ]);
  assert.equal(r.subtotal, 18);
  assert.deepEqual(r.itens[0].composicao, [{ grupo: "Proteínas", itens: ["Frango"] }]);
});

test("recalcularVenda: composição obrigatória ausente lança erro", () => {
  assert.throws(() => recalcularVenda(cardapio, [{ id: "m1", qtd: 1 }]), /Proteínas/);
});

// ---- variações no PDV ----
const cardVarPdv = { categorias: [ { nome: "Bebidas", itens: [
  { id: "refr", nome: "Refrigerantes 350ml", preco: 0, unidade: "un", variacoes: [
    { id: "coca", nome: "Coca", preco: 6, estoque: 5 },
    { id: "agua", nome: "Água", preco: 4 },
  ] },
] } ] };

test("recalcularVenda: soma variações e grava selecoes", () => {
  const r = recalcularVenda(cardVarPdv, [{ id: "refr", qtd: 1, variacoes: [{ id: "coca", qtd: 2 }] }]);
  assert.equal(r.subtotal, 12);
  assert.equal(r.itens[0].variacoes[0].qtd, 2);
});

test("recalcularVenda: item de variações sem escolha lança erro", () => {
  assert.throws(() => recalcularVenda(cardVarPdv, [{ id: "refr", qtd: 1 }]), /ao menos 1|opção/i);
});
