const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizarGrupos } = require("../public/grupos");

test("normalizarGrupos: coage tipos e descarta subgrupo sem itens", () => {
  const g = normalizarGrupos([
    { nome: " X ", obrigatorio: 1, min: "2", max: "4", itens: [" a ", "", "b"] },
    { nome: "Vazio", itens: [] },
    "lixo",
  ]);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0], { nome: "X", obrigatorio: true, min: 2, max: 4, itens: ["a", "b"] });
});

test("normalizarGrupos: não-array vira []", () => {
  assert.deepEqual(normalizarGrupos("Principal:\n* Arroz"), []);
  assert.deepEqual(normalizarGrupos(undefined), []);
});

test("normalizarGrupos: max < min sobe para o mínimo (subgrupo satisfazível)", () => {
  const g = normalizarGrupos([{ nome: "X", min: 3, max: 1, itens: ["a", "b", "c"] }]);
  assert.equal(g[0].min, 3);
  assert.equal(g[0].max, 3); // 1 < 3 → sobe a 3 (senão nunca dá pra satisfazer)
  const g2 = normalizarGrupos([{ nome: "Y", min: 2, max: 0, itens: ["a"] }]);
  assert.equal(g2[0].max, 0); // max 0 = ilimitado, preservado
});

// ---- Biblioteca de grupos (cardapio.grupos) + vínculo do item (item.grupos) ----
const { normalizarBiblioteca, resolverGrupos } = require("../public/grupos");

const biblio = [
  { id: "g1", nome: "Guarnições", padrao: { obrigatorio: true, min: 1, max: 1 },
    opcoes: [{ id: "o1", nome: "Farofa", preco: 0 }, { id: "o2", nome: "Vinagrete", preco: 0 }] },
  { id: "g2", nome: "Adicionais", padrao: { obrigatorio: false, min: 0, max: 0 },
    opcoes: [{ id: "o3", nome: "Bacon", preco: 3 }] },
];

test("normalizarBiblioteca: coage tipos e descarta grupo sem id, sem opções ou não-objeto", () => {
  const b = normalizarBiblioteca([
    { id: "g1", nome: " X ", padrao: { obrigatorio: 1, min: "2", max: "4" },
      opcoes: [{ id: "o1", nome: " a ", preco: "3.5" }, { id: "", nome: "sem id", preco: 1 }, { id: "o2", nome: "", preco: 1 }] },
    { id: "g2", nome: "Vazio", opcoes: [] },
    { nome: "Sem id", opcoes: [{ id: "o9", nome: "x", preco: 0 }] },
    "lixo",
  ]);
  assert.equal(b.length, 1);
  assert.deepEqual(b[0], {
    id: "g1", nome: "X",
    tipo: "complemento",   // sem `tipo` no dado, infere pelo preço da opção
    padrao: { obrigatorio: true, min: 2, max: 4 },
    opcoes: [{ id: "o1", nome: "a", preco: 3.5 }],
  });
});

test("normalizarBiblioteca: não-array vira []", () => {
  assert.deepEqual(normalizarBiblioteca(undefined), []);
  assert.deepEqual(normalizarBiblioteca("x"), []);
});

test("normalizarBiblioteca: max < min sobe para o mínimo", () => {
  const b = normalizarBiblioteca([{ id: "g", nome: "G", padrao: { min: 3, max: 1 }, opcoes: [{ id: "o", nome: "a", preco: 0 }] }]);
  assert.equal(b[0].padrao.min, 3);
  assert.equal(b[0].padrao.max, 3);
});

test("resolverGrupos: aplica a regra do item por cima do padrão do grupo, na ordem do item", () => {
  const item = { grupos: [{ id: "g2" }, { id: "g1", obrigatorio: true, min: 3, max: 3 }] };
  const r = resolverGrupos(item, biblio);
  assert.equal(r.length, 2);
  assert.equal(r[0].id, "g2");
  assert.equal(r[0].min, 0);
  assert.equal(r[1].id, "g1");
  assert.deepEqual([r[1].obrigatorio, r[1].min, r[1].max], [true, 3, 3]);
  assert.equal(r[1].opcoes.length, 2);
});

test("resolverGrupos: vínculo órfão é ignorado sem quebrar", () => {
  const r = resolverGrupos({ grupos: [{ id: "nao-existe" }, { id: "g1" }] }, biblio);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "g1");
});

test("resolverGrupos: item sem grupos vira []", () => {
  assert.deepEqual(resolverGrupos({}, biblio), []);
  assert.deepEqual(resolverGrupos({ grupos: "x" }, biblio), []);
});

// ---- Escolhas do cliente contra os grupos resolvidos (saída nos campos legados) ----
const { avaliarEscolhas } = require("../public/grupos");

const resolvidos = [
  { id: "g1", nome: "Guarnições", tipo: "composicao", obrigatorio: true, min: 2, max: 2,
    opcoes: [{ id: "o1", nome: "Farofa", preco: 0 }, { id: "o2", nome: "Vinagrete", preco: 0 }, { id: "o3", nome: "Purê", preco: 0 }] },
  { id: "g2", nome: "Adicionais", tipo: "complemento", obrigatorio: false, min: 0, max: 0,
    opcoes: [{ id: "o4", nome: "Bacon", preco: 3 }, { id: "o5", nome: "Ovo", preco: 2 }] },
];

test("avaliarEscolhas: separa sem custo em composicao e pago em opcionais", () => {
  const r = avaliarEscolhas(resolvidos, [
    { grupo: "g1", opcoes: ["o1", "o2"] },
    { grupo: "g2", opcoes: ["o4"] },
  ]);
  assert.equal(r.valido, true);
  assert.equal(r.addUnit, 3);
  assert.deepEqual(r.composicao, [{ grupo: "Guarnições", itens: ["Farofa", "Vinagrete"] }]);
  assert.deepEqual(r.opcionais, [{ nome: "Bacon", preco: 3, qtd: 1 }]);
});

test("avaliarEscolhas: abaixo do mínimo gera pendência e invalida", () => {
  const r = avaliarEscolhas(resolvidos, [{ grupo: "g1", opcoes: ["o1"] }]);
  assert.equal(r.valido, false);
  assert.match(r.pendencias[0], /Guarnições/);
});

test("avaliarEscolhas: acima do máximo invalida", () => {
  const r = avaliarEscolhas(resolvidos, [{ grupo: "g1", opcoes: ["o1", "o2", "o3"] }]);
  assert.equal(r.valido, false);
  assert.match(r.pendencias[0], /no máximo 2/);
});

test("avaliarEscolhas: max 0 significa sem limite", () => {
  const r = avaliarEscolhas(resolvidos, [
    { grupo: "g1", opcoes: ["o1", "o2"] },
    { grupo: "g2", opcoes: ["o4", "o5"] },
  ]);
  assert.equal(r.valido, true);
  assert.equal(r.addUnit, 5);
});

test("avaliarEscolhas: opção de outro grupo, id inexistente e duplicata são descartados", () => {
  const r = avaliarEscolhas(resolvidos, [
    { grupo: "g1", opcoes: ["o1", "o1", "o4", "xx", "o2"] },
  ]);
  assert.equal(r.valido, true);
  assert.deepEqual(r.composicao, [{ grupo: "Guarnições", itens: ["Farofa", "Vinagrete"] }]);
  assert.equal(r.addUnit, 0);
});

test("avaliarEscolhas: grupo opcional sem escolha não entra na saída", () => {
  const r = avaliarEscolhas(resolvidos, [{ grupo: "g1", opcoes: ["o1", "o2"] }]);
  assert.equal(r.valido, true);
  assert.deepEqual(r.opcionais, []);
});

// ---- Composição x complemento: regras diferentes, não variações da mesma ----

test("avaliarEscolhas: complemento aceita quantidade e multiplica o preço", () => {
  const r = avaliarEscolhas(resolvidos, [
    { grupo: "g1", opcoes: ["o1", "o2"] },
    { grupo: "g2", opcoes: [{ id: "o4", qtd: 2 }, { id: "o5", qtd: 3 }] },
  ]);
  assert.equal(r.valido, true);
  assert.equal(r.addUnit, 12); // 2x3 + 3x2
  assert.deepEqual(r.opcionais, [
    { nome: "Bacon", preco: 3, qtd: 2 },
    { nome: "Ovo", preco: 2, qtd: 3 },
  ]);
});

test("avaliarEscolhas: composição ignora quantidade (é escolha, não acréscimo)", () => {
  const r = avaliarEscolhas(resolvidos, [
    { grupo: "g1", opcoes: [{ id: "o1", qtd: 5 }, { id: "o2", qtd: 2 }] },
  ]);
  assert.equal(r.valido, true);
  assert.deepEqual(r.composicao, [{ grupo: "Guarnições", itens: ["Farofa", "Vinagrete"] }]);
});

test("avaliarEscolhas: no complemento o máximo conta UNIDADES, não opções", () => {
  const g = [{ id: "gx", nome: "Adicionais", tipo: "complemento", obrigatorio: false, min: 0, max: 3,
    opcoes: [{ id: "a", nome: "Ovo", preco: 2 }] }];
  assert.equal(avaliarEscolhas(g, [{ grupo: "gx", opcoes: [{ id: "a", qtd: 3 }] }]).valido, true);
  const excede = avaliarEscolhas(g, [{ grupo: "gx", opcoes: [{ id: "a", qtd: 4 }] }]);
  assert.equal(excede.valido, false);
  assert.match(excede.pendencias[0], /no máximo 3 unidades/);
});

test("avaliarEscolhas: sem tipo declarado, opção paga não cai na composição", () => {
  const g = [{ id: "gy", nome: "Extras", obrigatorio: false, min: 0, max: 0,
    opcoes: [{ id: "b", nome: "Bacon", preco: 3 }] }];
  const r = avaliarEscolhas(g, [{ grupo: "gy", opcoes: ["b"] }]);
  assert.equal(r.addUnit, 3);
  assert.deepEqual(r.opcionais, [{ nome: "Bacon", preco: 3, qtd: 1 }]);
  assert.deepEqual(r.composicao, []);
});

test("normalizarBiblioteca: composição zera preço da opção; complemento preserva", () => {
  const b = normalizarBiblioteca([
    { id: "g1", nome: "Proteína", tipo: "composicao", opcoes: [{ id: "o1", nome: "Picanha", preco: 5 }] },
    { id: "g2", nome: "Extras", tipo: "complemento", opcoes: [{ id: "o2", nome: "Bacon", preco: 3 }] },
  ]);
  assert.equal(b[0].tipo, "composicao");
  assert.equal(b[0].opcoes[0].preco, 0);
  assert.equal(b[1].tipo, "complemento");
  assert.equal(b[1].opcoes[0].preco, 3);
});

test("resolverGrupos: propaga o tipo do grupo para o vínculo resolvido", () => {
  const r = resolverGrupos({ grupos: [{ id: "g1" }, { id: "g2" }] }, biblio);
  assert.equal(r[0].tipo, "composicao");
  assert.equal(r[1].tipo, "complemento");
});

test("converterCardapio: composição vira tipo composicao e opcionais viram complemento", () => {
  const r = converterCardapio({
    categorias: [{ nome: "C", itens: [{
      id: 1, nome: "Marmita",
      composicao: [{ nome: "Guarnição", obrigatorio: true, min: 1, max: 1, itens: ["Arroz"] }],
      opcionais: "Ovo | 2.50",
    }] }],
  }, idFake());
  assert.deepEqual(r.grupos.map((g) => [g.nome, g.tipo]), [["Guarnição", "composicao"], ["Complementos", "complemento"]]);
});

// ---- Conversão do formato legado (composicao/opcionais) para a biblioteca ----
const { converterCardapio } = require("../public/grupos");

const idFake = () => { let n = 0; return (p) => p + (++n); };

test("converterCardapio: junta o idêntico e separa o divergente com sufixo", () => {
  const cardapio = { itens: [
    { id: 1, nome: "X-Salada", opcionais: "Bacon | 3.00" },
    { id: 2, nome: "X-Bacon",  opcionais: "Bacon | 3.00" },
    { id: 3, nome: "X-Especial", opcionais: "Bacon | 4.00" },
  ] };
  const r = converterCardapio(cardapio, idFake());
  assert.equal(r.grupos.length, 2);
  assert.equal(r.criados, 2);
  assert.equal(r.reusados, 1);
  assert.equal(r.grupos[0].nome, "Complementos");
  assert.equal(r.grupos[1].nome, "Complementos 2");   // sufixo por divergência
  assert.equal(r.grupos[0].opcoes[0].preco, 3);
  assert.equal(r.grupos[1].opcoes[0].preco, 4);       // nenhum preço foi alterado
  assert.equal(r.itens[0].grupos[0].id, r.itens[1].grupos[0].id);
  assert.notEqual(r.itens[0].grupos[0].id, r.itens[2].grupos[0].id);
});

test("converterCardapio: composicao vira grupo com preço 0 e regra preservada", () => {
  const cardapio = { itens: [
    { id: 1, nome: "Marmitex", composicao: [
      { nome: "Guarnições", obrigatorio: true, min: 2, max: 2, itens: ["Farofa", "Vinagrete"] },
    ], opcionais: "Ovo | 3.00" },
  ] };
  const r = converterCardapio(cardapio, idFake());
  assert.equal(r.grupos.length, 2);
  assert.equal(r.grupos[0].nome, "Guarnições");
  assert.equal(r.grupos[0].opcoes[0].preco, 0);
  assert.deepEqual(r.grupos[0].padrao, { obrigatorio: true, min: 2, max: 2 });
  // ordem: composições antes dos complementos, como aparece hoje no cardápio
  assert.deepEqual(r.itens[0].grupos.map((g) => g.id), [r.grupos[0].id, r.grupos[1].id]);
  assert.deepEqual(r.itens[0].grupos[0], { id: r.grupos[0].id, obrigatorio: true, min: 2, max: 2 });
});

test("converterCardapio: preserva os campos legados e ignora item já convertido", () => {
  const cardapio = { itens: [
    { id: 1, nome: "A", opcionais: "Bacon | 3.00" },
    { id: 2, nome: "B", opcionais: "Queijo | 1.00", grupos: [{ id: "ja-existe" }] },
  ] };
  const r = converterCardapio(cardapio, idFake());
  assert.equal(r.itens[0].opcionais, "Bacon | 3.00");        // legado intacto
  assert.deepEqual(r.itens[1].grupos, [{ id: "ja-existe" }]); // não remexe
  assert.equal(r.grupos.length, 1);
});

test("converterCardapio: item sem composicao e sem opcionais não gera vínculo", () => {
  const r = converterCardapio({ itens: [{ id: 1, nome: "Refri" }] }, idFake());
  assert.equal(r.grupos.length, 0);
  assert.equal(r.itens[0].grupos, undefined);
});

test("converterCardapio: itens dentro das categorias (formato real do cardápio)", () => {
  const cardapio = { categorias: [
    { nome: "Marmitas", itens: [
      { id: 1, nome: "Marmitex P", composicao: [{ nome: "Guarnições", obrigatorio: true, min: 1, max: 1, itens: ["Farofa"] }] },
      { id: 2, nome: "Marmitex G", opcionais: "Ovo | 2.50" },
    ] },
    { nome: "Bebidas", itens: [{ id: 3, nome: "Refri" }] },
  ] };
  const r = converterCardapio(cardapio, idFake());
  assert.equal(r.grupos.length, 2);
  assert.equal(r.categorias[0].nome, "Marmitas");                      // categoria preservada
  assert.equal(r.categorias[0].itens[0].grupos[0].id, r.grupos[0].id); // vínculo no item certo
  assert.equal(r.categorias[0].itens[1].grupos[0].id, r.grupos[1].id);
  assert.equal(r.categorias[1].itens[0].grupos, undefined);            // item sem opções não ganha vínculo
  assert.equal(r.itens.length, 3);                                     // lista plana com todos
});

test("converterCardapio: sem categorias devolve categorias null", () => {
  const r = converterCardapio({ itens: [{ id: 1, nome: "A", opcionais: "Bacon | 3.00" }] }, idFake());
  assert.equal(r.categorias, null);
  assert.equal(r.itens.length, 1);
});
