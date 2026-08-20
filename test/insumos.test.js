const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../public/insumos");

// Cardápio de teste. Insumos por id: 10 arroz(kg), 11 feijão(kg), 12 frango(kg),
// 13 carne(kg), 14 ovo(un), 15 óleo(l) — o 15 aparece no produto E na opção, para
// provar que o mesmo insumo vindo de dois lugares vira UMA linha só.
const card = {
  categorias: [{ nome: "Pratos", itens: [
    { id: 1, nome: "Marmitex P", preco: 15,
      ficha: [{ insumoId: 10, qtd: 0.2 }, { insumoId: 11, qtd: 0.15 }, { insumoId: 15, qtd: 0.01 }] },
    { id: 2, nome: "Coca", preco: 5 },                                   // revenda: sem ficha
    { id: 3, nome: "Picanha", preco: 80, unidade: "kg",
      ficha: [{ insumoId: 12, qtd: 1 }] },                               // ficha POR KG vendido
    { id: 4, nome: "Açaí", preco: 12,
      variacoes: [{ id: "v1", nome: "300ml", preco: 12 }, { id: "v2", nome: "500ml", preco: 18 }] },
  ] }],
  grupos: [
    { id: "grp_prot", nome: "Proteína", tipo: "composicao",
      padrao: { obrigatorio: true, min: 1, max: 1 },
      opcoes: [
        { id: "op_frango", nome: "Frango", preco: 0, ficha: [{ insumoId: 12, qtd: 0.12 }, { insumoId: 15, qtd: 0.02 }] },
        { id: "op_carne", nome: "Carne", preco: 0, ficha: [{ insumoId: 13, qtd: 0.12 }] },
      ] },
    { id: "grp_extra", nome: "Extras", tipo: "complemento",
      padrao: { obrigatorio: false, min: 0, max: 0 },
      opcoes: [{ id: "op_ovo", nome: "Ovo", preco: 2.5, ficha: [{ insumoId: 14, qtd: 1 }] }] },
  ],
};

// Acha o delta de um insumo no resultado (ou undefined).
function delta(res, insumoId) {
  const l = res.find((x) => x.insumoId === insumoId);
  return l && l.delta;
}

// ---------------------------------------------------------------- chave do movimento
test("chaveMovimento e ehInsumo: ida e volta", () => {
  assert.equal(I.chaveMovimento(12), "ins_12");
  assert.equal(I.ehInsumo("ins_12"), true);
  assert.equal(I.idDaChave("ins_12"), 12);
});
test("ehInsumo: id numérico de produto NÃO é insumo", () => {
  assert.equal(I.ehInsumo("1755031234567"), false);
  assert.equal(I.ehInsumo(1755031234567), false);
  assert.equal(I.idDaChave("1755031234567"), null);
});

// ---------------------------------------------------------------- normalizarInsumo
test("normalizarInsumo: nome é obrigatório", () => {
  assert.equal(I.normalizarInsumo({ nome: "  " }), null);
  assert.equal(I.normalizarInsumo(null), null);
});
test("normalizarInsumo: unidade fora da lista cai para un", () => {
  assert.equal(I.normalizarInsumo({ nome: "Arroz", unidade: "g" }).unidade, "un");
  assert.equal(I.normalizarInsumo({ nome: "Arroz", unidade: "kg" }).unidade, "kg");
  assert.equal(I.normalizarInsumo({ nome: "Óleo", unidade: "l" }).unidade, "l");
});
test("normalizarInsumo: saldo PODE ser negativo, mínimo não", () => {
  assert.equal(I.normalizarInsumo({ nome: "Arroz", saldo: "-8,5", unidade: "kg" }).saldo, -8.5);
  assert.equal(I.normalizarInsumo({ nome: "Arroz", minimo: -3 }).minimo, 0);
});

// ---------------------------------------------------------------- normalizarFicha
test("normalizarFicha: descarta linha sem insumoId e com qtd <= 0", () => {
  const f = I.normalizarFicha([
    { insumoId: 10, qtd: 0.2 },
    { qtd: 1 },                    // sem id
    { insumoId: 11, qtd: 0 },      // qtd zero
    { insumoId: 12, qtd: -1 },     // qtd negativa
  ]);
  assert.deepEqual(f, [{ insumoId: 10, qtd: 0.2 }]);
});
test("normalizarFicha: entrada inválida vira lista vazia", () => {
  assert.deepEqual(I.normalizarFicha(null), []);
  assert.deepEqual(I.normalizarFicha("arroz"), []);
});
test("normalizarFicha: aceita vírgula e soma o insumo repetido", () => {
  const f = I.normalizarFicha([{ insumoId: "10", qtd: "0,2" }, { insumoId: 10, qtd: "0,05" }]);
  assert.deepEqual(f, [{ insumoId: 10, qtd: 0.25 }]);
});

// ---------------------------------------------------------------- unidades
test("converterEntrada: grama vira kg e ml vira litro", () => {
  assert.equal(I.converterEntrada("200", "g", "kg"), 0.2);
  assert.equal(I.converterEntrada("500", "ml", "l"), 0.5);
  assert.equal(I.converterEntrada("1,5", "kg", "kg"), 1.5);
  assert.equal(I.converterEntrada("3", "un", "un"), 3);
});
test("formatarQtd: un inteiro, kg e l com vírgula", () => {
  assert.equal(I.formatarQtd(3, "un"), "3");
  assert.equal(I.formatarQtd(0.25, "kg"), "0,25");
  assert.equal(I.formatarQtd(-8.5, "kg"), "-8,5");
  assert.equal(I.formatarQtd(1.5, "l"), "1,5");
});

// ---------------------------------------------------------------- calcularConsumo
test("calcularConsumo: produto sem ficha não consome nada", () => {
  const res = I.calcularConsumo([{ id: 2, qtd: 3, composicao: [], opcionais: [], variacoes: [] }], card);
  assert.deepEqual(res, []);
});
test("calcularConsumo: ficha do produto multiplica pela quantidade", () => {
  const res = I.calcularConsumo([{ id: 1, qtd: 2, composicao: [], opcionais: [], variacoes: [] }], card);
  assert.equal(delta(res, 10), -0.4);
  assert.equal(delta(res, 11), -0.3);
});
test("calcularConsumo: opção de composição consome, e o mesmo insumo vira UMA linha", () => {
  const res = I.calcularConsumo([{
    id: 1, qtd: 2,
    composicao: [{ grupo: "Proteína", itens: ["Frango"], ids: ["op_frango"] }],
    opcionais: [], variacoes: [],
  }], card);
  assert.equal(delta(res, 12), -0.24);            // 0.12 x 1 x 2
  assert.equal(delta(res, 15), -0.06);            // produto 0.01x2 + opção 0.02x1x2
  assert.equal(res.filter((l) => l.insumoId === 15).length, 1);
});
test("calcularConsumo: complemento multiplica pela quantidade da opção", () => {
  const res = I.calcularConsumo([{
    id: 1, qtd: 2, composicao: [],
    opcionais: [{ nome: "Ovo", preco: 2.5, qtd: 3, id: "op_ovo" }],
    variacoes: [],
  }], card);
  assert.equal(delta(res, 14), -6);               // 1 x 3 x 2
});
test("calcularConsumo: item por kg multiplica pelo peso vendido", () => {
  const res = I.calcularConsumo([{ id: 3, qtd: 1.5, unidade: "kg", composicao: [], opcionais: [], variacoes: [] }], card);
  assert.equal(delta(res, 12), -1.5);
});
test("calcularConsumo: item com variações multiplica pela soma das variações", () => {
  const res = I.calcularConsumo([{
    id: 4, qtd: 1, composicao: [],
    opcionais: [{ nome: "Ovo", preco: 2.5, qtd: 1, id: "op_ovo" }],
    variacoes: [{ id: "v1", nome: "300ml", preco: 12, qtd: 3 }],
  }], card);
  assert.equal(delta(res, 14), -3);               // 1 x 1 x 3 unidades
});
test("calcularConsumo: opção e produto desconhecidos não lançam e não geram linha", () => {
  const res = I.calcularConsumo([{
    id: 999, qtd: 1, composicao: [{ grupo: "X", itens: ["Y"], ids: ["op_naoexiste"] }],
    opcionais: [{ nome: "Z", preco: 1, qtd: 1, id: "op_fantasma" }], variacoes: [],
  }], card);
  assert.deepEqual(res, []);
});
test("calcularConsumo: insumo órfão na ficha não quebra o cálculo", () => {
  const cardOrfao = { categorias: [{ itens: [{ id: 7, nome: "X", ficha: [{ insumoId: 404, qtd: 1 }] }] }], grupos: [] };
  const res = I.calcularConsumo([{ id: 7, qtd: 1, composicao: [], opcionais: [], variacoes: [] }], cardOrfao);
  assert.deepEqual(res, [{ insumoId: 404, delta: -1 }]);   // quem descarta o id órfão é o banco
});
test("calcularConsumo: várias linhas do mesmo produto somam num delta só", () => {
  const res = I.calcularConsumo([
    { id: 1, qtd: 1, composicao: [], opcionais: [], variacoes: [] },
    { id: 1, qtd: 1, composicao: [], opcionais: [], variacoes: [] },
  ], card);
  assert.equal(res.filter((l) => l.insumoId === 10).length, 1);
  assert.equal(delta(res, 10), -0.4);
});
test("calcularConsumo: entrada vazia devolve lista vazia", () => {
  assert.deepEqual(I.calcularConsumo([], card), []);
  assert.deepEqual(I.calcularConsumo(null, card), []);
  assert.deepEqual(I.calcularConsumo([{ id: 1, qtd: 1 }], null), []);
});
test("calcularConsumo: não acumula deriva de float em venda repetida", () => {
  const cardMil = { categorias: [{ itens: [{ id: 8, nome: "Café", ficha: [{ insumoId: 20, qtd: 0.005 }] }] }], grupos: [] };
  let total = 0;
  for (let i = 0; i < 300; i++) {
    total += I.calcularConsumo([{ id: 8, qtd: 1, composicao: [], opcionais: [], variacoes: [] }], cardMil)[0].delta;
  }
  assert.equal(Math.round(total * 1000) / 1000, -1.5);
});
