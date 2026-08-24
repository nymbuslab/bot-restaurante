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

// ---- estoque por VARIAÇÃO ----
const cardV = { categorias: [ { nome: "Bebidas", itens: [
  { id: "refr", nome: "Refrigerantes 350ml", preco: 0, variacoes: [
    { id: "coca", nome: "Coca", preco: 6, estoque: 5, estoqueMinimo: 1 },
    { id: "guar", nome: "Guaraná", preco: 5, estoque: 0 },
    { id: "agua", nome: "Água", preco: 4 },                       // ilimitada
  ] },
] } ] };

test("validarEstoque (variação): esgotada e over-order rejeitam com rótulo item+sabor", () => {
  const eg = E.validarEstoque(cardV, [{ id: "refr", qtd: 1, variacoes: [{ id: "guar", qtd: 1 }] }]);
  assert.equal(eg.ok, false);
  assert.match(eg.erro, /Refrigerantes 350ml \(Guaraná\).*esgotado/i);
  const over = E.validarEstoque(cardV, [{ id: "refr", qtd: 1, variacoes: [{ id: "coca", qtd: 6 }] }]);
  assert.equal(over.ok, false);
  assert.match(over.erro, /Restam só 5 unidades de Refrigerantes 350ml \(Coca\)/);
});

test("validarEstoque (variação): dentro do estoque e variação ilimitada passam", () => {
  assert.equal(E.validarEstoque(cardV, [{ id: "refr", qtd: 1, variacoes: [{ id: "coca", qtd: 5 }] }]).ok, true);
  assert.equal(E.validarEstoque(cardV, [{ id: "refr", qtd: 1, variacoes: [{ id: "agua", qtd: 99 }] }]).ok, true);
});

test("validarEstoque (variação): agrega a mesma variação em linhas diferentes", () => {
  const r = E.validarEstoque(cardV, [
    { id: "refr", qtd: 1, variacoes: [{ id: "coca", qtd: 3 }] },
    { id: "refr", qtd: 1, variacoes: [{ id: "coca", qtd: 3 }] },
  ]);
  assert.equal(r.ok, false); // 6 > 5
});

test("aplicarBaixa (variação): desconta a variação certa, trava em 0, ignora ilimitada, não muta original", () => {
  const out = E.aplicarBaixa(cardV, [{ id: "refr", qtd: 1, variacoes: [{ id: "coca", qtd: 2 }, { id: "agua", qtd: 9 }] }]);
  const vs = out.categorias[0].itens[0].variacoes;
  assert.equal(vs.find((v) => v.id === "coca").estoque, 3); // 5 - 2
  assert.equal(vs.find((v) => v.id === "guar").estoque, 0); // intacta (já 0)
  assert.equal("estoque" in vs.find((v) => v.id === "agua"), false); // ilimitada intacta
  assert.equal(cardV.categorias[0].itens[0].variacoes[0].estoque, 5); // original não mutado
});

// ---- calcularBaixa / calcularDevolucao (motor comum com lista de movimentos) ----
const baseMov = {
  categorias: [
    { nome: "Cat", itens: [
      { id: "a1", nome: "Espeto", unidade: "un", estoque: 3, estoqueMinimo: 1 },
      { id: "a2", nome: "Picanha", unidade: "kg", estoque: 2 },
      { id: "a3", nome: "Refri", unidade: "un" }, // sem controle
      { id: "a4", nome: "Marmitex", unidade: "un", variacoes: [
        { id: "v1", nome: "P", preco: 18, estoque: 5 },
        { id: "v2", nome: "G", preco: 25 },        // variação sem controle
      ] },
    ] },
  ],
};
const cloneMov = () => JSON.parse(JSON.stringify(baseMov));

test("calcularBaixa: movimento negativo com saldo resultante", () => {
  const r = E.calcularBaixa(cloneMov(), [{ id: "a1", qtd: 2 }]);
  assert.equal(r.cardapio.categorias[0].itens[0].estoque, 1);
  assert.deepEqual(r.movimentos, [
    { itemId: "a1", variacaoId: null, quantidade: -2, saldoDepois: 1, descricao: "Espeto", unidade: "un" },
  ]);
});

test("calcularBaixa: item sem controle não gera movimento", () => {
  const r = E.calcularBaixa(cloneMov(), [{ id: "a3", qtd: 5 }]);
  assert.deepEqual(r.movimentos, []);
});

test("calcularBaixa: trava em zero e registra o delta aplicado", () => {
  const r = E.calcularBaixa(cloneMov(), [{ id: "a1", qtd: 10 }]);
  assert.equal(r.cardapio.categorias[0].itens[0].estoque, 0);
  assert.equal(r.movimentos[0].quantidade, -3); // tinha 3, não -10
  assert.equal(r.movimentos[0].saldoDepois, 0);
});

test("calcularBaixa: kg com três casas", () => {
  const r = E.calcularBaixa(cloneMov(), [{ id: "a2", qtd: "0,5" }]);
  assert.equal(r.movimentos[0].saldoDepois, 1.5);
  assert.equal(r.movimentos[0].quantidade, -0.5);
  assert.equal(r.movimentos[0].unidade, "kg");
});

test("calcularBaixa: variação tem movimento próprio", () => {
  const r = E.calcularBaixa(cloneMov(), [{ id: "a4", qtd: 1, variacoes: [{ id: "v1", qtd: 2 }, { id: "v2", qtd: 1 }] }]);
  assert.equal(r.movimentos.length, 1); // v2 não é controlada
  assert.deepEqual(r.movimentos[0], {
    itemId: "a4", variacaoId: "v1", quantidade: -2, saldoDepois: 3,
    descricao: "Marmitex (P)", unidade: "un",
  });
});

test("calcularBaixa: não muta o cardápio recebido", () => {
  const original = cloneMov();
  E.calcularBaixa(original, [{ id: "a1", qtd: 2 }]);
  assert.equal(original.categorias[0].itens[0].estoque, 3);
});

test("calcularDevolucao: soma de volta com movimento positivo", () => {
  const r = E.calcularDevolucao(cloneMov(), [{ id: "a1", qtd: 2 }]);
  assert.equal(r.cardapio.categorias[0].itens[0].estoque, 5);
  assert.equal(r.movimentos[0].quantidade, 2);
  assert.equal(r.movimentos[0].saldoDepois, 5);
});

test("calcularDevolucao: item sem controle agora não ganha estoque", () => {
  const r = E.calcularDevolucao(cloneMov(), [{ id: "a3", qtd: 2 }]);
  assert.deepEqual(r.movimentos, []);
  assert.equal(r.cardapio.categorias[0].itens[2].estoque, undefined);
});

test("aplicarBaixa segue devolvendo só o cardápio", () => {
  const novo = E.aplicarBaixa(cloneMov(), [{ id: "a1", qtd: 1 }]);
  assert.equal(novo.categorias[0].itens[0].estoque, 2);
});

// ---- diffEstoque ----
test("diffEstoque: mudança de saldo vira movimento de ajuste", () => {
  const antes = cloneMov(), depois = cloneMov();
  depois.categorias[0].itens[0].estoque = 10; // era 3
  assert.deepEqual(E.diffEstoque(antes, depois), [
    { itemId: "a1", variacaoId: null, quantidade: 7, saldoDepois: 10, descricao: "Espeto", unidade: "un" },
  ]);
});

test("diffEstoque: saldo igual não gera movimento", () => {
  assert.deepEqual(E.diffEstoque(cloneMov(), cloneMov()), []);
});

test("diffEstoque: ligar o controle gera movimento com o saldo inicial", () => {
  const antes = cloneMov(), depois = cloneMov();
  depois.categorias[0].itens[2].estoque = 12; // Refri era ilimitado
  const m = E.diffEstoque(antes, depois);
  assert.equal(m.length, 1);
  assert.equal(m[0].itemId, "a3");
  assert.equal(m[0].quantidade, 12);
  assert.equal(m[0].saldoDepois, 12);
});

test("diffEstoque: desligar o controle não gera movimento de saldo", () => {
  const antes = cloneMov(), depois = cloneMov();
  delete depois.categorias[0].itens[0].estoque; // virou ilimitado
  assert.deepEqual(E.diffEstoque(antes, depois), []);
});

test("diffEstoque: alcança variação", () => {
  const antes = cloneMov(), depois = cloneMov();
  depois.categorias[0].itens[3].variacoes[0].estoque = 9; // era 5
  assert.deepEqual(E.diffEstoque(antes, depois), [
    { itemId: "a4", variacaoId: "v1", quantidade: 4, saldoDepois: 9, descricao: "Marmitex (P)", unidade: "un" },
  ]);
});

test("diffEstoque: item novo já controlado entra como movimento", () => {
  const antes = cloneMov(), depois = cloneMov();
  depois.categorias[0].itens.push({ id: "a9", nome: "Suco", unidade: "un", estoque: 4 });
  const m = E.diffEstoque(antes, depois);
  assert.deepEqual(m, [{ itemId: "a9", variacaoId: null, quantidade: 4, saldoDepois: 4, descricao: "Suco", unidade: "un" }]);
});

// ---- acharSaldo / garantirControle (Task 7) ----
test("acharSaldo: acha item, variação e devolve null para id inexistente", () => {
  assert.equal(E.acharSaldo(cloneMov(), "a1", null).quantidade, 3);
  assert.equal(E.acharSaldo(cloneMov(), "a4", "v1").quantidade, 5);
  assert.equal(E.acharSaldo(cloneMov(), "a3", null).controlado, false);
  assert.equal(E.acharSaldo(cloneMov(), "zzz", null), null);
});

test("garantirControle: item ilimitado passa a ter estoque 0 sem mutar o original", () => {
  const c = cloneMov();
  const novo = E.garantirControle(c, "a3", null);
  assert.equal(novo.categorias[0].itens[2].estoque, 0);
  assert.equal(c.categorias[0].itens[2].estoque, undefined);
});

// ---- removerControle (par do garantirControle) ----
// Desligar o controle apaga o saldo, e é o oposto exato de ligar. O editor do
// produto já fazia isso apagando o campo (é o que "Em branco = ilimitado" quer
// dizer), mas a tela de Controle de estoque só sabia ligar.
test("removerControle: item controlado volta a ilimitado sem mutar o original", () => {
  const c = cloneMov();
  const novo = E.removerControle(c, "a1", null);
  assert.equal(E.statusEstoque(novo.categorias[0].itens[0]).controlado, false);
  assert.equal(novo.categorias[0].itens[0].estoque, undefined);
  assert.equal(novo.categorias[0].itens[0].estoqueMinimo, undefined);
  assert.equal(novo.categorias[0].itens[0].nome, "Espeto");   // o resto do item fica
  assert.equal(c.categorias[0].itens[0].estoque, 3);          // original intacto
});

test("removerControle: desliga a variação sem tocar as outras opções", () => {
  const novo = E.removerControle(cloneMov(), "a4", "v1");
  const item = novo.categorias[0].itens[3];
  assert.equal(E.statusEstoque(item.variacoes[0]).controlado, false);
  assert.equal(item.variacoes[0].preco, 18);                  // preço da opção fica
  assert.equal(item.variacoes[1].nome, "G");
});

test("removerControle: alvo inexistente devolve null (rota responde 404)", () => {
  assert.equal(E.removerControle(cloneMov(), "zzz", null), null);
  assert.equal(E.removerControle(cloneMov(), "a4", "vX"), null);
  assert.equal(E.removerControle(cloneMov(), "a1", "v1"), null); // item sem variações
});

test("removerControle: desligar não vira movimento de saldo no diffEstoque", () => {
  const antes = cloneMov();
  const depois = E.removerControle(antes, "a1", null);
  assert.deepEqual(E.diffEstoque(antes, depois), []);
});

test("removerControle: ligar e desligar volta ao ponto de partida", () => {
  const c = cloneMov();
  const ligado = E.garantirControle(c, "a3", null);
  assert.equal(E.statusEstoque(ligado.categorias[0].itens[2]).controlado, true);
  const desligado = E.removerControle(ligado, "a3", null);
  assert.deepEqual(desligado.categorias[0].itens[2], c.categorias[0].itens[2]);
});

// ---- aplicarAjuste (Ruling D — revisão da Task 7) ----
// Motor de ajuste de UM alvo só: nunca reusa o payload de venda (que agrega por
// pedido e força mínimo 1 pra item "un"), porque isso deixava vazar um
// movimento fantasma no item quando o alvo real era a variação.
test("aplicarAjuste: ajusta a variação sem tocar o estoque próprio do item", () => {
  const card = { categorias: [ { nome: "Cat", itens: [
    { id: "a4", nome: "Marmitex", unidade: "un", estoque: 6, variacoes: [
      { id: "v1", nome: "P", estoque: 5 },
    ] },
  ] } ] };
  const r = E.aplicarAjuste(card, { itemId: "a4", variacaoId: "v1", delta: 2 });
  assert.equal(r.movimento.itemId, "a4");
  assert.equal(r.movimento.variacaoId, "v1");
  assert.equal(r.movimento.quantidade, 2);
  assert.equal(r.movimento.saldoDepois, 7);
  assert.equal(r.cardapio.categorias[0].itens[0].estoque, 6); // item intocado
  assert.equal(card.categorias[0].itens[0].estoque, 6);       // original intocado
  assert.equal(card.categorias[0].itens[0].variacoes[0].estoque, 5); // original intocado
});

test("aplicarAjuste: ajusta o item (sem variacaoId), trava em zero e arredonda kg", () => {
  const card = { categorias: [ { nome: "Cat", itens: [
    { id: "p1", nome: "Picanha", unidade: "kg", estoque: 2 },
  ] } ] };
  const r = E.aplicarAjuste(card, { itemId: "p1", variacaoId: null, delta: -5 });
  assert.equal(r.movimento.itemId, "p1");
  assert.equal(r.movimento.variacaoId, null);
  assert.equal(r.movimento.quantidade, -2); // trava em zero, não -5
  assert.equal(r.movimento.saldoDepois, 0);
  assert.equal(r.movimento.unidade, "kg");
});

test("aplicarAjuste: ligaControle liga o controle antes de aplicar; delta zero não gera movimento", () => {
  const card = { categorias: [ { nome: "Cat", itens: [
    { id: "a3", nome: "Refri", unidade: "un" }, // sem controle
  ] } ] };
  const r = E.aplicarAjuste(card, { itemId: "a3", variacaoId: null, delta: 0, ligaControle: true });
  assert.equal(r.movimento, null);
  assert.equal(r.cardapio.categorias[0].itens[0].estoque, 0); // controle ligado em zero
});

test("aplicarAjuste: nada muda quando o delta é zero e o controle já estava ligado", () => {
  const card = { categorias: [ { nome: "Cat", itens: [
    { id: "a1", nome: "Espeto", unidade: "un", estoque: 3 },
  ] } ] };
  const r = E.aplicarAjuste(card, { itemId: "a1", variacaoId: null, delta: 0 });
  assert.equal(r.movimento, null);
  assert.equal(r.cardapio.categorias[0].itens[0].estoque, 3);
});

// ---- linhasDeEstoque (Task 9) ----
const cardLinhas = { categorias: [
  { nome: "Pratos", itens: [
    // item com variações: 1 linha do pai + 1 linha por variação
    { id: "a4", nome: "Marmitex", unidade: "un", variacoes: [
      { id: "v1", nome: "P", estoque: 5, estoqueMinimo: 1 },
      { id: "v2", nome: "G", estoque: 0, estoqueMinimo: 1 },
    ] },
    // item sem controle
    { id: "a3", nome: "Refri", unidade: "un" },
    // item arquivado: não deve aparecer
    { id: "a9", nome: "Descontinuado", unidade: "un", estoque: 4, arquivado: true },
    // item controlado, esgotado
    { id: "a5", nome: "Picanha", unidade: "kg", estoque: 0, estoqueMinimo: 1 },
    // item controlado, baixo
    { id: "a6", nome: "Espeto", unidade: "un", estoque: 2, estoqueMinimo: 3 },
  ] },
] };

test("linhasDeEstoque: item com variações gera a linha do pai mais uma por variação", () => {
  const linhas = E.linhasDeEstoque(cardLinhas);
  const doMarmitex = linhas.filter((l) => l.itemId === "a4");
  assert.equal(doMarmitex.length, 3); // pai + v1 + v2
  const pai = doMarmitex.find((l) => l.variacaoId === null);
  assert.equal(pai.nome, "Marmitex");
  assert.equal(pai.categoria, "Pratos");
  assert.equal(pai.temVariacoes, true);
  const v1 = doMarmitex.find((l) => l.variacaoId === "v1");
  assert.equal(v1.nome, "P");
  assert.equal(v1.pai, "Marmitex");
  assert.equal(v1.controlado, true);
  assert.equal(v1.quantidade, 5);
  const v2 = doMarmitex.find((l) => l.variacaoId === "v2");
  assert.equal(v2.esgotado, true);
});

test("linhasDeEstoque: item não controlado entra com controlado: false", () => {
  const linhas = E.linhasDeEstoque(cardLinhas);
  const refri = linhas.find((l) => l.itemId === "a3");
  assert.ok(refri);
  assert.equal(refri.controlado, false);
  assert.equal(refri.quantidade, null);
});

test("linhasDeEstoque: item arquivado não aparece", () => {
  const linhas = E.linhasDeEstoque(cardLinhas);
  assert.equal(linhas.some((l) => l.itemId === "a9"), false);
});

test("linhasDeEstoque: flags esgotado e baixo refletem o status do saldo", () => {
  const linhas = E.linhasDeEstoque(cardLinhas);
  const picanha = linhas.find((l) => l.itemId === "a5");
  assert.equal(picanha.esgotado, true);
  assert.equal(picanha.baixo, false);
  const espeto = linhas.find((l) => l.itemId === "a6");
  assert.equal(espeto.esgotado, false);
  assert.equal(espeto.baixo, true);
});

// ---- definirMinimo (Task 10) ----
test("definirMinimo: grava no item e na variação, e devolve null para id inexistente", () => {
  const c = cloneMov();
  assert.equal(E.definirMinimo(c, "a1", null, 4).categorias[0].itens[0].estoqueMinimo, 4);
  assert.equal(E.definirMinimo(c, "a4", "v1", 2).categorias[0].itens[3].variacoes[0].estoqueMinimo, 2);
  assert.equal(E.definirMinimo(c, "zzz", null, 1), null);
  assert.equal(c.categorias[0].itens[0].estoqueMinimo, 1); // não mutou
});

// ---------------------------------------------------------------------------
// Variação: a baixa tem que multiplicar pela quantidade da LINHA.
//
// O preço faz `(base + variações) * qtd`, mas a agregação do estoque somava só o
// `qtd` da variação. Uma linha de 3 açaís de 300ml cobrava 3 e tirava 1 — e a
// validação, que usa a mesma agregação, aceitava vender 3 tendo 2 em estoque.
//
// Vivo em produção quando isto foi escrito: o Sabor D' Casa controla estoque em
// duas variações de "Refrigerante 2 Litros", uma delas com 2 unidades. Nunca
// disparou porque as 14 vendas do histórico tinham quantidade 1 na linha.
// ---------------------------------------------------------------------------

const cardVar = {
  categorias: [{ nome: "Açaí", itens: [
    { id: "a1", nome: "Açaí", preco: 0, unidade: "un", variacoes: [
      { id: "v300", nome: "300ml", preco: 12, estoque: 10 },
      { id: "v500", nome: "500ml", preco: 18, estoque: 4 },
    ] },
  ] }],
  grupos: [],
};

function saldoVar(card, itemId, varId) {
  let s = null;
  (card.categorias || []).forEach((c) => (c.itens || []).forEach((i) => {
    if (i.id !== itemId) return;
    (i.variacoes || []).forEach((v) => { if (v.id === varId) s = v.estoque; });
  }));
  return s;
}

test("calcularBaixa: quantidade da linha multiplica a variação escolhida", () => {
  const r = E.calcularBaixa(cardVar, [{ id: "a1", qtd: 3, variacoes: [{ id: "v300", qtd: 1 }] }]);
  assert.equal(saldoVar(r.cardapio, "a1", "v300"), 7); // 10 - 3, não 10 - 1
});

test("calcularBaixa: multiplica linha por variação (2 linhas de 2 unidades = 4)", () => {
  const r = E.calcularBaixa(cardVar, [{ id: "a1", qtd: 2, variacoes: [{ id: "v300", qtd: 2 }] }]);
  assert.equal(saldoVar(r.cardapio, "a1", "v300"), 6);
});

test("validarEstoque: não deixa vender 3 tendo 2 da variação", () => {
  const magro = JSON.parse(JSON.stringify(cardVar));
  magro.categorias[0].itens[0].variacoes[0].estoque = 2;
  const check = E.validarEstoque(magro, [{ id: "a1", qtd: 3, variacoes: [{ id: "v300", qtd: 1 }] }]);
  assert.equal(check.ok, false);
  assert.match(check.erro, /300ml/);
});

test("calcularDevolucao: devolve exatamente o que a baixa tirou", () => {
  const linha = [{ id: "a1", qtd: 3, variacoes: [{ id: "v300", qtd: 2 }] }];
  const depoisVenda = E.calcularBaixa(cardVar, linha).cardapio;
  const depoisCancel = E.calcularDevolucao(depoisVenda, linha).cardapio;
  assert.equal(saldoVar(depoisCancel, "a1", "v300"), saldoVar(cardVar, "a1", "v300"));
});

test("calcularBaixa: linha de quantidade 1 continua igual (caso comum não muda)", () => {
  const r = E.calcularBaixa(cardVar, [{ id: "a1", qtd: 1, variacoes: [{ id: "v500", qtd: 1 }] }]);
  assert.equal(saldoVar(r.cardapio, "a1", "v500"), 3);
});

test("calcularBaixa: duas variações na mesma linha cada uma multiplica", () => {
  const r = E.calcularBaixa(cardVar, [
    { id: "a1", qtd: 2, variacoes: [{ id: "v300", qtd: 1 }, { id: "v500", qtd: 1 }] },
  ]);
  assert.equal(saldoVar(r.cardapio, "a1", "v300"), 8);
  assert.equal(saldoVar(r.cardapio, "a1", "v500"), 2);
});

// ---- saldoMudou: a régua do carimbo `_estoqueEditado` no editor do produto ----
// O campo de saldo abre preenchido com a cópia que o navegador carregou ao abrir o
// painel. Carimbar sem o dono ter mexido no saldo fazia uma edição de preço às 15h
// reescrever o estoque com o número das 9h, desfazendo calado as vendas do dia.
test("saldoMudou: mexer só no preço ou no nome não conta como mudança de saldo", () => {
  const antes  = { id: 1, nome: "Coca", preco: 8, estoque: 100, estoqueMinimo: 10 };
  const depois = { id: 1, nome: "Coca Lata", preco: 9.5, estoque: 100, estoqueMinimo: 10 };
  assert.equal(E.saldoMudou(antes, depois), false);
});
test("saldoMudou: estoque ou mínimo diferente conta", () => {
  const antes = { id: 1, estoque: 100, estoqueMinimo: 10 };
  assert.equal(E.saldoMudou(antes, { id: 1, estoque: 90, estoqueMinimo: 10 }), true);
  assert.equal(E.saldoMudou(antes, { id: 1, estoque: 100, estoqueMinimo: 5 }), true);
});
test("saldoMudou: string do editor e número do banco são o mesmo saldo", () => {
  assert.equal(E.saldoMudou({ id: 1, estoque: 100 }, { id: 1, estoque: "100" }), false);
  assert.equal(E.saldoMudou({ id: 1, estoque: 2.5 }, { id: 1, estoque: "2,5" }), false);
});
test("saldoMudou: ausente, null e \"\" são todos 'sem controle'", () => {
  assert.equal(E.saldoMudou({ id: 1 }, { id: 1, estoque: "" }), false);
  assert.equal(E.saldoMudou({ id: 1, estoque: null }, { id: 1 }), false);
});
test("saldoMudou: ligar ou desligar o controle conta", () => {
  assert.equal(E.saldoMudou({ id: 1 }, { id: 1, estoque: 0 }), true);        // passou a controlar (zerado)
  assert.equal(E.saldoMudou({ id: 1, estoque: 50 }, { id: 1 }), true);        // deixou de controlar
});
test("saldoMudou: variação com saldo alterado conta, reordenar não", () => {
  const a = { id: 1, variacoes: [ { id: "v1", estoque: 10 }, { id: "v2", estoque: 5 } ] };
  assert.equal(E.saldoMudou(a, { id: 1, variacoes: [ { id: "v1", estoque: 10 }, { id: "v2", estoque: 4 } ] }), true);
  assert.equal(E.saldoMudou(a, { id: 1, variacoes: [ { id: "v2", estoque: 5 }, { id: "v1", estoque: 10 } ] }), false);
});
test("saldoMudou: variação criada ou removida conta", () => {
  const a = { id: 1, variacoes: [ { id: "v1", estoque: 10 } ] };
  assert.equal(E.saldoMudou(a, { id: 1, variacoes: [ { id: "v1", estoque: 10 }, { id: "v2", estoque: 3 } ] }), true);
  assert.equal(E.saldoMudou(a, { id: 1, variacoes: [] }), true);              // removida: muda
});
test("saldoMudou: produto novo (sem versão anterior) sempre conta", () => {
  assert.equal(E.saldoMudou(null, { id: 1, estoque: 10 }), true);
});
