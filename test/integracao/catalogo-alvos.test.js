// ============================================================
// CATÁLOGO-ALVOS — T-04.01 (Sprint 04).
//
// `store.setCardapio` passa a sincronizar o registro-ponte relacional
// (catalogo_alvos) na MESMA transação do salvamento do jsonb. Cobre:
//   1. isolamento entre tenants (dois tenants reusam o mesmo ID local sem
//      colidir e sem cruzar alvos um do outro);
//   2. produto com variações cria só alvos de VARIAÇÃO, não de produto;
//   3. o JSONB devolvido pelas APIs existentes não ganha campo novo.
// ============================================================

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const db = require("../../src/db");
const store = require("../../src/store");
const catalogoAlvosDb = require("../../src/catalogo-alvos-db");
const tenant = require("./ajuda/tenant");

let lojaA;
let lojaB;

before(async () => {
  lojaA = await tenant.criarEmpresa("catalogo-alvos-a");
  lojaB = await tenant.criarEmpresa("catalogo-alvos-b");
  await store.ensure(lojaA.dir);
  await store.ensure(lojaB.dir);
});

after(async () => {
  await tenant.limparTudo();
});

test("dois tenants reusam o MESMO id local de produto sem colisão e sem cruzar alvos", async () => {
  const cardapio = {
    categorias: [{
      nome: "Categoria", ativo: true,
      itens: [{ id: 501, nome: "Produto sem variação", preco: 10, disponivel: true }],
    }],
    grupos: [],
  };
  await store.setCardapio(lojaA.dir, cardapio);
  await store.setCardapio(lojaB.dir, cardapio);

  const empIdA = await catalogoAlvosDb.empresaId(lojaA.dir);
  const empIdB = await catalogoAlvosDb.empresaId(lojaB.dir);

  const alvosA = await catalogoAlvosDb.listar(lojaA.dir);
  const alvosB = await catalogoAlvosDb.listar(lojaB.dir);

  assert.equal(alvosA.length, 1);
  assert.equal(alvosB.length, 1);
  assert.equal(alvosA[0].produtoId, "501");
  assert.equal(alvosB[0].produtoId, "501");
  // Não cruza: cada listagem só devolve alvo da própria empresa.
  assert.ok(alvosA.every((a) => a.empresaId === empIdA));
  assert.ok(alvosB.every((a) => a.empresaId === empIdB));
  assert.notEqual(empIdA, empIdB);
});

test("produto com variações cria SOMENTE alvos de variação (nenhum alvo de produto)", async () => {
  const cardapio = {
    categorias: [{
      nome: "Categoria", ativo: true,
      itens: [{
        id: 900, nome: "Produto com variação", preco: 20, disponivel: true,
        variacoes: [
          { id: "v1", nome: "Pequeno", preco: 15 },
          { id: "v2", nome: "Grande", preco: 25 },
        ],
      }],
    }],
    grupos: [],
  };
  await store.setCardapio(lojaA.dir, cardapio);

  const alvos = await catalogoAlvosDb.listar(lojaA.dir, { produtoId: "900" });
  assert.equal(alvos.length, 2);
  assert.ok(alvos.every((a) => a.tipo === "variacao"));
  assert.ok(alvos.some((a) => a.variacaoId === "v1"));
  assert.ok(alvos.some((a) => a.variacaoId === "v2"));
  assert.ok(!alvos.some((a) => a.tipo === "produto"));
});

test("salvar cardápio sincroniza o registro-ponte sem alterar o JSONB devolvido", async () => {
  const cardapio = {
    categorias: [{
      nome: "Categoria", ativo: true,
      itens: [{ id: 777, nome: "Produto simples", preco: 12, disponivel: true }],
    }],
    grupos: [],
  };
  const salvo = await store.setCardapio(lojaA.dir, cardapio);

  // O jsonb persistido/devolvido não ganhou campo novo por causa da sincronização.
  const item = salvo.categorias[0].itens[0];
  assert.deepEqual(Object.keys(item).sort(), ["disponivel", "id", "nome", "preco"].sort());

  const doBanco = await db.query("select cardapio from empresas where slug = $1", [lojaA.slug]);
  const itemBanco = doBanco.rows[0].cardapio.categorias[0].itens[0];
  assert.deepEqual(Object.keys(itemBanco).sort(), ["disponivel", "id", "nome", "preco"].sort());

  const alvos = await catalogoAlvosDb.listar(lojaA.dir, { produtoId: "777" });
  assert.equal(alvos.length, 1);
  assert.equal(alvos[0].tipo, "produto");
});

test("excluir o produto do cardápio NÃO apaga o histórico do alvo (só aditivo)", async () => {
  const comProduto = {
    categorias: [{
      nome: "Categoria", ativo: true,
      itens: [{ id: 321, nome: "Produto a remover", preco: 8, disponivel: true }],
    }],
    grupos: [],
  };
  await store.setCardapio(lojaA.dir, comProduto);
  const antes = await catalogoAlvosDb.listar(lojaA.dir, { produtoId: "321" });
  assert.equal(antes.length, 1);

  const semProduto = { categorias: [{ nome: "Categoria", ativo: true, itens: [] }], grupos: [] };
  await store.setCardapio(lojaA.dir, semProduto);

  const depois = await catalogoAlvosDb.listar(lojaA.dir, { produtoId: "321" });
  assert.equal(depois.length, 1, "alvo continua existindo mesmo com o produto removido do jsonb");
});
