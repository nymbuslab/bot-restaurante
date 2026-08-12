const test = require("node:test");
const assert = require("node:assert");
const { tituloPt, padronizarNomesCardapio } = require("../public/texto");

test("tituloPt: capitaliza palavras e mantém conectivos minúsculos", () => {
  assert.equal(tituloPt("pastel de queijo"), "Pastel de Queijo");
  assert.equal(tituloPt("pastel de carne com queijo"), "Pastel de Carne com Queijo");
});

test("tituloPt: normaliza ALL CAPS", () => {
  assert.equal(tituloPt("PASTEL DE FRANGO"), "Pastel de Frango");
});

test("tituloPt: colapsa espaços repetidos e apara as pontas", () => {
  assert.equal(tituloPt("  pastel   de    queijo  "), "Pastel de Queijo");
});

test("tituloPt: preserva o hífen capitalizando cada parte", () => {
  assert.equal(tituloPt("x-tudo"), "X-Tudo");
  assert.equal(tituloPt("coca-cola"), "Coca-Cola");
});

test("tituloPt: 1ª palavra sempre capitalizada, mesmo sendo conectivo", () => {
  assert.equal(tituloPt("de queijo"), "De Queijo");
});

test("tituloPt: medida com dígito no começo fica intacta", () => {
  assert.equal(tituloPt("suco 500ml"), "Suco 500ml");
});

test("tituloPt: preserva a unidade em maiúscula da medida (1,5L não vira 1,5l)", () => {
  assert.equal(tituloPt("coca-cola 1,5L"), "Coca-Cola 1,5L");
  assert.equal(tituloPt("fanta laranja 1,5L"), "Fanta Laranja 1,5L");
});

test("tituloPt: abreviações c/ e s/ (com/sem) ficam minúsculas", () => {
  assert.equal(tituloPt("agua c/ gas"), "Agua c/ Gas");
  assert.equal(tituloPt("agua s/gas"), "Agua s/gas");
});

test("tituloPt: vazio/nulo devolve string vazia", () => {
  assert.equal(tituloPt(""), "");
  assert.equal(tituloPt(null), "");
  assert.equal(tituloPt(undefined), "");
});

test("padronizarNomesCardapio: padroniza categoria, item e variação preservando o resto", () => {
  const entrada = {
    categorias: [{
      nome: "pratos executivos",
      itens: [{ nome: "bife a cavalo", preco: 25, estoque: 10, variacoes: [{ id: "v1", nome: "coca-cola", preco: 6 }] }],
    }],
  };
  const out = padronizarNomesCardapio(entrada);
  assert.equal(out.categorias[0].nome, "Pratos Executivos");
  assert.equal(out.categorias[0].itens[0].nome, "Bife a Cavalo");
  assert.equal(out.categorias[0].itens[0].variacoes[0].nome, "Coca-Cola");
  // preserva campos não-nome
  assert.equal(out.categorias[0].itens[0].preco, 25);
  assert.equal(out.categorias[0].itens[0].estoque, 10);
  assert.equal(out.categorias[0].itens[0].variacoes[0].id, "v1");
  // não muta o original
  assert.equal(entrada.categorias[0].nome, "pratos executivos");
  assert.equal(entrada.categorias[0].itens[0].nome, "bife a cavalo");
});

test("padronizarNomesCardapio: padroniza a biblioteca (grupo e opção) preservando id/preço/tipo", () => {
  const entrada = {
    categorias: [],
    grupos: [{
      id: "g1", nome: "guarnicao de casa", tipo: "composicao",
      padrao: { obrigatorio: true, min: 1, max: 2 },
      opcoes: [{ id: "o1", nome: "arroz BRANCO", preco: 0 }, { id: "o2", nome: "ovo frito", preco: 2.5 }],
    }],
  };
  const out = padronizarNomesCardapio(entrada);
  assert.equal(out.grupos[0].nome, "Guarnicao de Casa");
  assert.deepEqual(out.grupos[0].opcoes.map((o) => o.nome), ["Arroz Branco", "Ovo Frito"]);
  assert.equal(out.grupos[0].id, "g1");
  assert.equal(out.grupos[0].tipo, "composicao");
  assert.equal(out.grupos[0].opcoes[1].preco, 2.5);
  assert.deepEqual(out.grupos[0].padrao, { obrigatorio: true, min: 1, max: 2 });
  // não muta o original
  assert.equal(entrada.grupos[0].nome, "guarnicao de casa");
  assert.equal(entrada.grupos[0].opcoes[0].nome, "arroz BRANCO");
});

test("padronizarNomesCardapio: entrada sem categorias volta intacta", () => {
  assert.deepEqual(padronizarNomesCardapio({}), {});
  assert.equal(padronizarNomesCardapio(null), null);
});
