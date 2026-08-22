const { test } = require("node:test");
const assert = require("node:assert/strict");
const { recalcularVenda, aplicarDesconto, validarPagamentos, normalizarPagamentos, calcularTroco, resumoPagamento, freteEfetivo, totalComFrete } = require("../src/pdv");

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

test("recalcularVenda: preço vem do cardápio e opcional do formato antigo é ignorado", () => {
  const r = recalcularVenda(cardapio, [
    { id: "a1", qtd: 2, preco: 999, opcionais: [{ nome: "Bacon", qtd: 1 }, { nome: "Fantasma", qtd: 5 }] },
  ]);
  assert.equal(r.itens.length, 1);
  assert.equal(r.itens[0].preco, 8);
  assert.equal(r.itens[0].unidade, "un");
  assert.deepEqual(r.itens[0].opcionais, []); // sem vínculo na biblioteca, sem opção
  assert.equal(r.subtotal, 16); // 8 * 2
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

test("validarPagamentos: total 0 (cortesia/100% desconto) dispensa pagamento", () => {
  assert.equal(validarPagamentos(0, []), true);
  assert.equal(validarPagamentos(0, undefined), true);
  assert.equal(validarPagamentos(-0.001, []), true); // ruído de arredondamento também
});

test("normalizarPagamentos: troco só no dinheiro; demais formas zeram troco", () => {
  // Dinheiro entregue R$ 50 para uma venda de R$ 28 → valor 28, valorPago 50, troco 22.
  assert.deepEqual(
    normalizarPagamentos([{ forma: "Dinheiro", valor: 28, valorPago: 50, troco: 22 }]),
    [{ forma: "Dinheiro", valor: 28, valorPago: 50, troco: 22 }]
  );
  // Cliente adulterado: "troco no Pix" → servidor força troco 0 e valorPago = valor.
  assert.deepEqual(
    normalizarPagamentos([{ forma: "Pix", valor: 50, valorPago: 100, troco: 50 }]),
    [{ forma: "Pix", valor: 50, valorPago: 50, troco: 0 }]
  );
  // Split: dinheiro com troco + cartão sem troco.
  assert.deepEqual(
    normalizarPagamentos([{ forma: "Dinheiro", valor: 20, valorPago: 30 }, { forma: "Cartão", valor: 15 }]),
    [{ forma: "Dinheiro", valor: 20, valorPago: 30, troco: 10 }, { forma: "Cartão", valor: 15, valorPago: 15, troco: 0 }]
  );
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

test("recalcularVenda: composição do formato antigo não entra nem barra a venda", () => {
  // Item com composicao gravada mas sem grupo vinculado: nada de opção na venda, e a
  // antiga obrigatoriedade não pode travar o operador no balcão.
  const r = recalcularVenda(cardapio, [
    { id: "m1", qtd: 1, composicao: [{ grupo: "Proteínas", itens: ["Frango"] }] },
  ]);
  assert.equal(r.subtotal, 18);
  assert.deepEqual(r.itens[0].composicao, []);
  assert.deepEqual(recalcularVenda(cardapio, [{ id: "m1", qtd: 1 }]).itens[0].composicao, []);
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

// ---- Biblioteca de grupos (cardapio.grupos) no PDV ----
const cardapioBiblioteca = {
  grupos: [
    { id: "g1", nome: "Adicionais", padrao: { obrigatorio: false, min: 0, max: 0 },
      opcoes: [{ id: "o1", nome: "Bacon", preco: 3.5 }] },
    { id: "g2", nome: "Proteínas", padrao: { obrigatorio: true, min: 1, max: 1 },
      opcoes: [{ id: "o2", nome: "Frango", preco: 0 }, { id: "o3", nome: "Carne", preco: 0 }] },
  ],
  categorias: [{ nome: "Pratos", itens: [
    { id: "b1", nome: "Espeto", preco: 8, unidade: "un", grupos: [{ id: "g1" }] },
    { id: "b2", nome: "Marmitex", preco: 18, unidade: "un", grupos: [{ id: "g2" }, { id: "g1" }] },
  ] }],
};

test("recalcularVenda: soma a opção paga vinda da biblioteca", () => {
  const r = recalcularVenda(cardapioBiblioteca, [{ id: "b1", qtd: 2, grupos: [{ grupo: "g1", opcoes: ["o1"] }] }]);
  assert.equal(r.subtotal, 23); // (8 + 3,50) x 2
  assert.deepEqual(r.itens[0].opcionais, [{ nome: "Bacon", preco: 3.5, qtd: 1, id: "o1" }]);
});

test("recalcularVenda: opção sem custo vai para composicao sem mexer no total", () => {
  const r = recalcularVenda(cardapioBiblioteca, [{ id: "b2", qtd: 1, grupos: [{ grupo: "g2", opcoes: ["o3"] }] }]);
  assert.equal(r.subtotal, 18);
  assert.deepEqual(r.itens[0].composicao, [{ grupo: "Proteínas", itens: ["Carne"], ids: ["o3"] }]);
});

test("recalcularVenda: grupo obrigatório sem escolha barra a venda", () => {
  assert.throws(() => recalcularVenda(cardapioBiblioteca, [{ id: "b2", qtd: 1, grupos: [] }]), /Proteínas/);
});

test("recalcularVenda: vínculo órfão (grupo apagado da biblioteca) não vende nada", () => {
  const semBiblioteca = { grupos: [], categorias: [{ nome: "L", itens: [
    { id: "x1", nome: "X", preco: 10, unidade: "un", opcionais: "Bacon | 3.50", grupos: [{ id: "g_sumiu" }] },
  ] }] };
  const r = recalcularVenda(semBiblioteca, [
    { id: "x1", qtd: 1, opcionais: [{ nome: "Bacon", qtd: 1 }], grupos: [{ grupo: "g_sumiu", opcoes: ["o1"] }] },
  ]);
  assert.equal(r.subtotal, 10);
  assert.deepEqual(r.itens[0].opcionais, []);
});

// ---------------------------------------------------------------------------
// Excedente de quantidade: o teto tem que ser DITO, não aplicado calado.
//
// O recálculo limita a 99 unidades (100 kg por peso). Enquanto o corte era
// silencioso, o cliente pedia 150, o pedido gravava 99 e cobrava 99 sem uma
// linha explicando as 51 que sumiram. Quem corta é quem sabe do corte, então o
// excedente sai daqui e não de uma segunda checagem que duplicaria o número.
// ---------------------------------------------------------------------------

test("recalcularVenda: acima de 99 unidades reporta o excedente", () => {
  const r = recalcularVenda(cardapio, [{ id: "a1", qtd: 150 }]);
  assert.equal(r.itens[0].qtd, 99);
  assert.deepEqual(r.excedentes, [
    { nome: "Espeto de carne", pedido: 150, limite: 99, unidade: "un" },
  ]);
});

test("recalcularVenda: peso acima de 100 kg reporta o excedente", () => {
  const r = recalcularVenda(cardapio, [{ id: "a2", qtd: "250,5" }]);
  assert.equal(r.itens[0].qtd, 100);
  assert.deepEqual(r.excedentes, [
    { nome: "Picanha (kg)", pedido: 250.5, limite: 100, unidade: "kg" },
  ]);
});

test("recalcularVenda: dentro do limite não reporta excedente", () => {
  const r = recalcularVenda(cardapio, [{ id: "a1", qtd: 3 }, { id: "a2", qtd: "1,5" }]);
  assert.deepEqual(r.excedentes, []);
});

// ---------------------------------------------------------------------------
// O resumo do pagamento usava um terceiro formato de dinheiro.
//
// `toFixed(2)` não tem separador de milhar, então num pedido de R$ 1.234,56 o
// cupom saía com "TOTAL: 1.234,56" e, duas linhas abaixo, "Pagamento: Dinheiro
// R$ 1234,56" — dois formatos para o mesmo número, no mesmo papel. O padrão
// único do projeto (CLAUDE.md) manda espelhar o `fmtBR` dos impressos.
// ---------------------------------------------------------------------------

test("resumoPagamento: valor na casa do milhar sai com ponto, como o resto do sistema", () => {
  assert.equal(resumoPagamento([{ forma: "Dinheiro", valor: 1234.56 }]), "Dinheiro R$ 1.234,56");
});

test("resumoPagamento: milhão também, e o split mantém o separador em cada forma", () => {
  assert.equal(
    resumoPagamento([{ forma: "Dinheiro", valor: 1000000 }, { forma: "PIX", valor: 2500.5 }]),
    "Dinheiro R$ 1.000.000,00 · PIX R$ 2.500,50"
  );
});

test("resumoPagamento: abaixo de mil segue idêntico ao que já era", () => {
  assert.equal(resumoPagamento([{ forma: "Dinheiro", valor: 999.9 }]), "Dinheiro R$ 999,90");
});
