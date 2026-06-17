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
    opcionais: [{ nome: "Bacon", preco: 3 }],
  });
  assert.equal("segredo" in it[0], false); // não vaza campo cru do jsonb
});
test("projetarCardapio: cardápio vazio/sem categorias → { categorias: [] }", () => {
  assert.deepEqual(cw.projetarCardapio(null), { categorias: [] });
  assert.deepEqual(cw.projetarCardapio({}), { categorias: [] });
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
