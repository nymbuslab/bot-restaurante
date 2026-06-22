const { test } = require("node:test");
const assert = require("node:assert/strict");
const cw = require("../src/cardapio-web");

// ---- parseOpcionais ----
test("parseOpcionais: 'Nome | preco' por linha → [{nome,preco}]", () => {
  assert.deepEqual(cw.parseOpcionais("Bacon | 3,50\nOvo | 2"), [
    { nome: "Bacon", preco: 3.5 },
    { nome: "Ovo", preco: 2 },
  ]);
});
test("parseOpcionais: vazio/nulo → []", () => {
  assert.deepEqual(cw.parseOpcionais(""), []);
  assert.deepEqual(cw.parseOpcionais(null), []);
});
test("parseOpcionais: sem preço → 0", () => {
  assert.deepEqual(cw.parseOpcionais("Sem cebola"), [{ nome: "Sem cebola", preco: 0 }]);
});

// ---- projetarCardapio (whitelist) ----
test("projetarCardapio: só campos públicos, só itens disponíveis, sem categoria vazia", () => {
  const cru = {
    categorias: [
      { nome: "Lanches", itens: [
        { id: 1, nome: "X", preco: 20, desc: "d", imagem: "u", composicao: "c", opcionais: "Bacon | 3", disponivel: true, segredo: "NAO_VAZAR" },
        { id: 2, nome: "Oculto", preco: 9, disponivel: false },
      ] },
      { nome: "Vazia", itens: [{ id: 3, nome: "Off", disponivel: false }] },
    ],
  };
  const proj = cw.projetarCardapio(cru);
  assert.equal(proj.categorias.length, 1); // categoria só com indisponíveis some
  const it = proj.categorias[0].itens;
  assert.equal(it.length, 1); // item indisponível some
  assert.deepEqual(it[0], {
    id: 1, nome: "X", preco: 20, desc: "d", imagem: "u", composicao: "c",
    opcionais: [{ nome: "Bacon", preco: 3 }], apenasLocal: false, esgotado: false, unidade: "un",
  });
  assert.equal("segredo" in it[0], false); // não vaza campo cru do jsonb
});
test("projetarCardapio: item arquivado fica fora da projeção", () => {
  const cru = { categorias: [ { nome: "P", itens: [
    { id: 1, nome: "A", preco: 10, disponivel: true },
    { id: 2, nome: "Arq", preco: 10, disponivel: true, arquivado: true },
  ] } ] };
  const itens = cw.projetarCardapio(cru).categorias[0].itens;
  assert.equal(itens.length, 1);
  assert.equal(itens[0].id, 1);
});
test("recalcularItens: item por kg não é pedível", () => {
  const card = { categorias: [ { nome: "P", itens: [
    { id: 7, nome: "Buffet", preco: 60, disponivel: true, unidade: "kg" },
  ] } ] };
  assert.throws(() => cw.recalcularItens(card, [{ id: 7, qtd: 1 }]), /indispon/i);
});
test("projetarCardapio: item kg fica na projeção e expõe unidade", () => {
  const cru = { categorias: [ { nome: "P", itens: [
    { id: 1, nome: "Kg", preco: 60, disponivel: true, unidade: "kg" },
    { id: 2, nome: "Un", preco: 10, disponivel: true },
  ] } ] };
  const itens = cw.projetarCardapio(cru).categorias[0].itens;
  assert.equal(itens.length, 2);
  assert.equal(itens[0].unidade, "kg");
  assert.equal(itens[1].unidade, "un");
});
test("recalcularItens: item arquivado não é pedível", () => {
  const card = { categorias: [ { nome: "P", itens: [
    { id: 9, nome: "Arq", preco: 10, disponivel: true, arquivado: true },
  ] } ] };
  assert.throws(() => cw.recalcularItens(card, [{ id: 9, qtd: 1 }]), /indispon/i);
});
test("projetarCardapio: expõe esgotado e NÃO expõe a contagem de estoque", () => {
  const cru = { categorias: [ { nome: "P", itens: [
    { id: 1, nome: "Z", preco: 10, disponivel: true, estoque: 0 },
    { id: 2, nome: "C", preco: 10, disponivel: true, estoque: 5 },
    { id: 3, nome: "L", preco: 10, disponivel: true },
  ] } ] };
  const itens = cw.projetarCardapio(cru).categorias[0].itens;
  assert.equal(itens[0].esgotado, true);
  assert.equal(itens[1].esgotado, false);
  assert.equal(itens[2].esgotado, false);
  assert.equal("estoque" in itens[0], false); // não vaza a contagem
});
test("projetarCardapio: expõe apenasLocal normalizado", () => {
  const cru = { categorias: [ { nome: "P", itens: [
    { id: 1, nome: "A", preco: 10, disponivel: true, apenasLocal: true },
    { id: 2, nome: "B", preco: 10, disponivel: true },
  ] } ] };
  const itens = cw.projetarCardapio(cru).categorias[0].itens;
  assert.equal(itens[0].apenasLocal, true);
  assert.equal(itens[1].apenasLocal, false);
});
test("projetarCardapio: cardápio vazio/sem categorias → { categorias: [] }", () => {
  assert.deepEqual(cw.projetarCardapio(null), { categorias: [] });
  assert.deepEqual(cw.projetarCardapio({}), { categorias: [] });
});

// ---- recalcularItens (recálculo no servidor) ----
const CARD = { categorias: [
  { nome: "L", itens: [
    { id: 1, nome: "Burger", preco: 20, disponivel: true, opcionais: "Bacon | 3\nOvo | 2" },
    { id: 2, nome: "Off", preco: 9, disponivel: false },
  ] },
] };
test("recalcularItens: usa preços do cardápio e soma opcionais×qtd", () => {
  const r = cw.recalcularItens(CARD, [{ id: 1, qtd: 2, opcionais: [{ nome: "Ovo", qtd: 3 }], observacao: "x" }]);
  assert.equal(r.subtotal, 52); // (20 + 2*3) * 2
  assert.equal(r.itens.length, 1);
  assert.deepEqual(r.itens[0].opcionais, [{ nome: "Ovo", preco: 2, qtd: 3 }]);
  assert.equal(r.itens[0].nome, "Burger");
  assert.equal(r.itens[0].preco, 20);
});
test("recalcularItens: ignora preço/nome enviados pelo cliente (anti-fraude)", () => {
  const r = cw.recalcularItens(CARD, [{ id: 1, qtd: 1, preco: 0.01, nome: "HACK", opcionais: [] }]);
  assert.equal(r.subtotal, 20);
  assert.equal(r.itens[0].nome, "Burger");
});
test("recalcularItens: opcional desconhecido é ignorado", () => {
  const r = cw.recalcularItens(CARD, [{ id: 1, qtd: 1, opcionais: [{ nome: "Trufa", qtd: 5 }] }]);
  assert.equal(r.subtotal, 20);
  assert.equal(r.itens[0].opcionais.length, 0);
});
test("recalcularItens: item inexistente/indisponível → lança", () => {
  assert.throws(() => cw.recalcularItens(CARD, [{ id: 999, qtd: 1 }]), /indispon/i);
  assert.throws(() => cw.recalcularItens(CARD, [{ id: 2, qtd: 1 }]), /indispon/i);
});

// ---- token (assinar/verificar) ----
const SECRET = "segredo-de-teste";
test("token: assina e verifica → devolve chatId", () => {
  const agora = 1_000_000;
  const t = cw.assinarToken(SECRET, "sabor", "5511@s.whatsapp.net", agora);
  assert.deepEqual(cw.verificarToken(SECRET, t, "sabor", agora + 1000), { chatId: "5511@s.whatsapp.net" });
});
test("token: expirado → null", () => {
  const agora = 1_000_000;
  const t = cw.assinarToken(SECRET, "sabor", "x@lid", agora);
  assert.equal(cw.verificarToken(SECRET, t, "sabor", agora + cw.TOKEN_TTL_MS + 1), null);
});
test("token: slug diferente → null", () => {
  const t = cw.assinarToken(SECRET, "sabor", "x@lid", 1000);
  assert.equal(cw.verificarToken(SECRET, t, "outro", 2000), null);
});
test("token: assinatura adulterada → null", () => {
  const t = cw.assinarToken(SECRET, "sabor", "x@lid", 1000);
  const adulterado = t.slice(0, -2) + (t.endsWith("aa") ? "bb" : "aa");
  assert.equal(cw.verificarToken(SECRET, adulterado, "sabor", 2000), null);
});
test("token: segredo errado → null", () => {
  const t = cw.assinarToken(SECRET, "sabor", "x@lid", 1000);
  assert.equal(cw.verificarToken("outro-segredo", t, "sabor", 2000), null);
});
test("token: sem segredo ou sem chatId → string vazia", () => {
  assert.equal(cw.assinarToken("", "sabor", "x"), "");
  assert.equal(cw.assinarToken(SECRET, "sabor", ""), "");
});

// ---- itensSoLocal ----
const cardapioSoLocal = {
  categorias: [
    { nome: "Pratos", itens: [
      { id: 1, nome: "Marmitex P", preco: 18, apenasLocal: false },
      { id: 2, nome: "Buffet por kg", preco: 60, apenasLocal: true },
      { id: 3, nome: "Sobremesa local", preco: 9, apenasLocal: true },
    ] },
  ],
};
test("itensSoLocal: retorna os nomes dos itens só-local presentes no payload", () => {
  assert.deepEqual(cw.itensSoLocal(cardapioSoLocal, [{ id: 1 }, { id: 2 }]), ["Buffet por kg"]);
});
test("itensSoLocal: vazio quando o payload não tem item só-local", () => {
  assert.deepEqual(cw.itensSoLocal(cardapioSoLocal, [{ id: 1 }]), []);
});
test("itensSoLocal: ignora id inexistente e não repete nomes", () => {
  assert.deepEqual(
    cw.itensSoLocal(cardapioSoLocal, [{ id: 2 }, { id: 2 }, { id: 99 }, { id: 3 }]),
    ["Buffet por kg", "Sobremesa local"]
  );
});
test("itensSoLocal: payload/cardápio vazios → []", () => {
  assert.deepEqual(cw.itensSoLocal(null, null), []);
  assert.deepEqual(cw.itensSoLocal(cardapioSoLocal, []), []);
});
