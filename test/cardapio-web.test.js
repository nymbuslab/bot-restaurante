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
  // Sem vínculo com a biblioteca o item não expõe opção nenhuma, nem a antiga
  // "Bacon | 3" que segue gravada no jsonb: o que vale é só `grupos`.
  assert.deepEqual(it[0], {
    id: 1, nome: "X", preco: 20, desc: "d", imagem: "u",
    grupos: [], variacoes: [], precoAPartir: null,
    apenasLocal: false, esgotado: false, unidade: "un", destaque: false,
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
test("projetarCardapio: expõe destaque", () => {
  const cru = { categorias: [ { nome: "P", itens: [
    { id: 1, nome: "A", preco: 10, disponivel: true, destaque: true },
    { id: 2, nome: "B", preco: 10, disponivel: true },
  ] } ] };
  const itens = cw.projetarCardapio(cru).categorias[0].itens;
  assert.equal(itens[0].destaque, true);
  assert.equal(itens[1].destaque, false);
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
test("projetarCardapio: campos do formato antigo NÃO vazam para o cliente", () => {
  const cardapio = { categorias: [{ nome: "Marmitas", itens: [
    { id: 1, nome: "Marmitex", preco: 18, composicao: [
      { nome: "Proteínas", obrigatorio: true, min: 1, max: 1, itens: ["Frango", "Carne"] },
    ], opcionais: "Bacon | 3.50" },
  ] }] };
  const it = cw.projetarCardapio(cardapio).categorias[0].itens[0];
  // O dono apagou o vínculo: o cliente não pode continuar vendo a opção antiga.
  assert.deepEqual(it.grupos, []);
  assert.equal("composicao" in it, false);
  assert.equal("opcionais" in it, false);
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
test("recalcularItens: item sem vínculo IGNORA opcional do formato antigo enviado pelo cliente", () => {
  const r = cw.recalcularItens(CARD, [{ id: 1, qtd: 2, opcionais: [{ nome: "Ovo", qtd: 3 }], observacao: "x" }]);
  assert.equal(r.subtotal, 40); // 20 * 2 — o "Ovo | 2" do jsonb antigo não vale mais
  assert.equal(r.itens.length, 1);
  assert.deepEqual(r.itens[0].opcionais, []);
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

// ---- recalcularItens com composição ----
const cardComp = { categorias: [{ nome: "M", itens: [
  { id: 7, nome: "Marmitex", preco: 18, opcionais: "Bacon | 3.50", composicao: [
    { nome: "Proteínas", obrigatorio: true, min: 1, max: 1, itens: ["Frango", "Carne"] },
    { nome: "Principais", obrigatorio: true, min: 1, max: 3, itens: ["Arroz", "Feijão"] },
  ] },
] }] };

test("recalcularItens: composição do formato antigo não vale mais nem como obrigatória", () => {
  // O item tem composicao/opcionais gravados, mas nenhum grupo vinculado. Nada de
  // opção entra no pedido, e a antiga obrigatoriedade não pode barrar a venda.
  const r = cw.recalcularItens(cardComp, [
    { id: 7, qtd: 1, composicao: [
      { grupo: "Proteínas", itens: ["Frango"] },
    ], opcionais: [{ nome: "Bacon", qtd: 1 }] },
  ]);
  assert.equal(r.subtotal, 18);
  assert.deepEqual(r.itens[0].composicao, []);
  assert.deepEqual(r.itens[0].opcionais, []);
});

// ---- variações (opções com preço + estoque) ----
const cardVar = { categorias: [ { nome: "Bebidas", itens: [
  { id: "refr", nome: "Refrigerantes 350ml", preco: 0, variacoes: [
    { id: "coca", nome: "Coca", preco: 6, estoque: 5 },
    { id: "guar", nome: "Guaraná", preco: 5, estoque: 0 },
    { id: "agua", nome: "Água", preco: 4 },
  ] },
] } ] };

test("projetarCardapio: expõe variacoes (id/nome/preco/esgotado) + precoAPartir, sem vazar contagem", () => {
  const it = cw.projetarCardapio(cardVar).categorias[0].itens[0];
  assert.equal(it.precoAPartir, 4); // menor entre as não esgotadas (agua 4 ilimitada; coca 6; guar esgotada)
  assert.equal(it.variacoes.length, 3);
  const coca = it.variacoes.find((v) => v.id === "coca");
  assert.deepEqual(coca, { id: "coca", nome: "Coca", preco: 6, esgotado: false });
  assert.equal(it.variacoes.find((v) => v.id === "guar").esgotado, true);
  assert.equal("estoque" in coca, false); // não vaza contagem
});

test("recalcularItens: soma o preço das variações escolhidas (base 0)", () => {
  const r = cw.recalcularItens(cardVar, [
    { id: "refr", qtd: 2, variacoes: [{ id: "coca", qtd: 1 }, { id: "agua", qtd: 1 }] },
  ]);
  assert.equal(r.subtotal, (0 + 6 + 4) * 2); // 20
  assert.equal(r.itens[0].variacoes.length, 2);
});

test("recalcularItens: item de variações sem nenhuma escolha lança erro", () => {
  assert.throws(() => cw.recalcularItens(cardVar, [{ id: "refr", qtd: 1 }]), /ao menos 1|opção/i);
});

// ---- Biblioteca de grupos (cardapio.grupos) no cardápio web ----
const cardapioComBiblioteca = {
  grupos: [
    { id: "g1", nome: "Adicionais", padrao: { obrigatorio: false, min: 0, max: 0 },
      opcoes: [{ id: "o1", nome: "Bacon", preco: 3 }] },
    { id: "g2", nome: "Ponto da carne", padrao: { obrigatorio: true, min: 1, max: 1 },
      opcoes: [{ id: "o2", nome: "Ao ponto", preco: 0 }, { id: "o3", nome: "Bem passada", preco: 0 }] },
  ],
  categorias: [{ nome: "Lanches", itens: [
    { id: 1, nome: "X", preco: 10, disponivel: true, grupos: [{ id: "g1" }] },
    { id: 2, nome: "Burger", preco: 20, disponivel: true, grupos: [{ id: "g2" }] },
  ] }],
};

test("projetarCardapio: item com biblioteca expõe os grupos resolvidos", () => {
  const p = cw.projetarCardapio(cardapioComBiblioteca);
  const item = p.categorias[0].itens[0];
  assert.equal(item.grupos.length, 1);
  assert.equal(item.grupos[0].opcoes[0].nome, "Bacon");
  assert.equal(item.grupos[0].opcoes[0].preco, 3);
});

test("recalcularItens: soma o preço da opção escolhida pela biblioteca", () => {
  const r = cw.recalcularItens(cardapioComBiblioteca, [
    { id: 1, qtd: 1, grupos: [{ grupo: "g1", opcoes: ["o1"] }] },
  ]);
  assert.equal(r.subtotal, 13);
  // o `id` chega ao payload que o servidor grava: é ele que a baixa de insumo vai ler
  assert.deepEqual(r.itens[0].opcionais, [{ nome: "Bacon", preco: 3, qtd: 1, id: "o1" }]);
});

test("recalcularItens: opção sem custo entra em composicao e não muda o total", () => {
  const r = cw.recalcularItens(cardapioComBiblioteca, [
    { id: 2, qtd: 1, grupos: [{ grupo: "g2", opcoes: ["o3"] }] },
  ]);
  assert.equal(r.subtotal, 20);
  assert.deepEqual(r.itens[0].composicao, [{ grupo: "Ponto da carne", itens: ["Bem passada"], ids: ["o3"] }]);
  assert.deepEqual(r.itens[0].opcionais, []);
});

test("recalcularItens: grupo obrigatório sem escolha barra o pedido", () => {
  assert.throws(
    () => cw.recalcularItens(cardapioComBiblioteca, [{ id: 2, qtd: 1, grupos: [] }]),
    /Ponto da carne/
  );
});

test("recalcularItens: apagar o grupo da biblioteca tira a opção do pedido", () => {
  // Cenário real: o dono apagou os grupos, mas o item ainda tem o vínculo órfão e o
  // campo antigo gravado. Nada disso pode continuar sendo vendido.
  const semBiblioteca = { grupos: [], categorias: [{ nome: "L", itens: [
    { id: 1, nome: "X", preco: 10, disponivel: true, opcionais: "Bacon | 3.00", grupos: [{ id: "g_sumiu" }] },
  ] }] };
  const r = cw.recalcularItens(semBiblioteca, [
    { id: 1, qtd: 1, opcionais: [{ nome: "Bacon", qtd: 1 }], grupos: [{ grupo: "g_sumiu", opcoes: ["o1"] }] },
  ]);
  assert.equal(r.subtotal, 10);
  assert.deepEqual(r.itens[0].opcionais, []);
  assert.deepEqual(r.itens[0].composicao, []);
});

// ---------------------------------------------------------------------------
// Excedente de quantidade (mesma regra do PDV, teto de 50 no cardápio web).
// O carrinho do cliente não trava o "+", então dá para chegar a 60 clicando.
// Cortar calado grava 50 e cobra 50 sem avisar; o excedente existe para o
// servidor poder recusar e dizer o porquê.
// ---------------------------------------------------------------------------

test("recalcularItens: acima de 50 reporta o excedente", () => {
  const card = { categorias: [{ nome: "B", itens: [{ id: 1, nome: "Coca", preco: 3 }] }], grupos: [] };
  const r = cw.recalcularItens(card, [{ id: 1, qtd: 60 }]);
  assert.equal(r.itens[0].qtd, 50);
  assert.deepEqual(r.excedentes, [{ nome: "Coca", pedido: 60, limite: 50, unidade: "un" }]);
});

test("recalcularItens: dentro do limite não reporta excedente", () => {
  const card = { categorias: [{ nome: "B", itens: [{ id: 1, nome: "Coca", preco: 3 }] }], grupos: [] };
  assert.deepEqual(cw.recalcularItens(card, [{ id: 1, qtd: 5 }]).excedentes, []);
});

test("mensagemExcedente: nomeia o item, o limite e o que foi pedido", () => {
  const m = cw.mensagemExcedente([{ nome: "Coca", pedido: 60, limite: 50, unidade: "un" }]);
  assert.equal(m, "O máximo é 50 unidades de Coca por pedido. Você pediu 60. Ajuste a quantidade e tente de novo.");
});

test("mensagemExcedente: peso sai em kg com vírgula", () => {
  const m = cw.mensagemExcedente([{ nome: "Picanha", pedido: 250.5, limite: 100, unidade: "kg" }]);
  assert.equal(m, "O máximo é 100 kg de Picanha por pedido. Você pediu 250,5 kg. Ajuste a quantidade e tente de novo.");
});

test("mensagemExcedente: limite de 1 unidade não vira plural", () => {
  const m = cw.mensagemExcedente([{ nome: "Brinde", pedido: 3, limite: 1, unidade: "un" }]);
  assert.match(m, /O máximo é 1 unidade de Brinde/);
});

test("mensagemExcedente: com mais de um item, lista todos", () => {
  const m = cw.mensagemExcedente([
    { nome: "Coca", pedido: 60, limite: 50, unidade: "un" },
    { nome: "Guaraná", pedido: 80, limite: 50, unidade: "un" },
  ]);
  assert.match(m, /Coca/);
  assert.match(m, /Guaraná/);
  assert.match(m, /Ajuste as quantidades/);
});

test("mensagemExcedente: lista vazia não gera mensagem", () => {
  assert.equal(cw.mensagemExcedente([]), "");
  assert.equal(cw.mensagemExcedente(null), "");
});
