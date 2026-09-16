// ============================================================
// FORNECEDORES — T-04.02 (Sprint 04).
//
// Cadastro de fornecedores, identificadores do catálogo (código interno +
// GTIN por alvo) e o vínculo fornecedor-alvo, por HTTP.
// ============================================================

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");
const store = require("../../src/store");

let loja;
let outraLoja;
const PRODUTO_ID = "601";

before(async () => {
  loja = await tenant.criarEmpresa("fornecedores-a", { plano: "completo" });
  outraLoja = await tenant.criarEmpresa("fornecedores-b", { plano: "completo" });
  await tenant.prepararLoja(loja, {
    cardapio: {
      categorias: [{
        nome: "Categoria", ativo: true,
        itens: [{ id: Number(PRODUTO_ID), nome: "Produto do teste", preco: 10, disponivel: true }],
      }],
      grupos: [],
    },
  });
  await tenant.prepararLoja(outraLoja);
});

after(async () => {
  await app.derrubar();
  await tenant.limparTudo();
});

test("POST /api/fornecedores cria com só o nome, preservando o rascunho recebido", async () => {
  const r = await app.pedir("/api/fornecedores", { token: loja.token, corpo: { nome: "Distribuidora Teste" } });
  assert.equal(r.status, 201);
  assert.equal(r.corpo.fornecedor.nome, "Distribuidora Teste");
  assert.equal(r.corpo.fornecedor.documento, null);
  assert.equal(r.corpo.fornecedor.telefone, null);
  assert.equal(r.corpo.fornecedor.arquivado, false);
});

test("POST /api/fornecedores sem nome devolve 400", async () => {
  const r = await app.pedir("/api/fornecedores", { token: loja.token, corpo: {} });
  assert.equal(r.status, 400);
});

test("CNPJ é único por tenant: segundo fornecedor com o mesmo documento devolve 409", async () => {
  const primeiro = await app.pedir("/api/fornecedores", {
    token: loja.token, corpo: { nome: "Fornecedor A", documento: "11.222.333/0001-81" },
  });
  assert.equal(primeiro.status, 201);
  const segundo = await app.pedir("/api/fornecedores", {
    token: loja.token, corpo: { nome: "Fornecedor A duplicado", documento: "11222333000181" },
  });
  assert.equal(segundo.status, 409);
});

test("o MESMO documento pode ser usado em tenants DIFERENTES (isolamento)", async () => {
  const daLoja = await app.pedir("/api/fornecedores", {
    token: loja.token, corpo: { nome: "Fornecedor Compartilhado", documento: "22333444000199" },
  });
  const daOutraLoja = await app.pedir("/api/fornecedores", {
    token: outraLoja.token, corpo: { nome: "Fornecedor Compartilhado", documento: "22333444000199" },
  });
  assert.equal(daLoja.status, 201);
  assert.equal(daOutraLoja.status, 201, "mesmo CNPJ em tenant diferente não deve colidir");
});

test("GET /api/fornecedores/:id 404 para fornecedor inexistente", async () => {
  const r = await app.pedir("/api/fornecedores/999999", { token: loja.token });
  assert.equal(r.status, 404);
});

test("PUT /api/fornecedores/:id atualiza e POST .../arquivar arquiva (some da listagem padrão)", async () => {
  const criado = await app.pedir("/api/fornecedores", { token: loja.token, corpo: { nome: "Fornecedor Para Editar" } });
  const id = criado.corpo.fornecedor.id;

  const atualizado = await app.pedir(`/api/fornecedores/${id}`, {
    token: loja.token, metodo: "PUT", corpo: { nome: "Fornecedor Editado", telefone: "11999998888" },
  });
  assert.equal(atualizado.status, 200);
  assert.equal(atualizado.corpo.fornecedor.nome, "Fornecedor Editado");
  assert.equal(atualizado.corpo.fornecedor.telefone, "11999998888");

  const arquivado = await app.pedir(`/api/fornecedores/${id}/arquivar`, { token: loja.token, metodo: "POST", corpo: {} });
  assert.equal(arquivado.status, 200);
  assert.equal(arquivado.corpo.fornecedor.arquivado, true);

  const listaPadrao = await app.pedir("/api/fornecedores", { token: loja.token });
  assert.ok(!listaPadrao.corpo.fornecedores.some((f) => f.id === id));
  const listaComArquivados = await app.pedir("/api/fornecedores?arquivados=1", { token: loja.token });
  assert.ok(listaComArquivados.corpo.fornecedores.some((f) => f.id === id));
});

test("código interno e GTIN são únicos por tenant (PUT /api/catalogo/identificadores)", async () => {
  const cardapio2 = {
    categorias: [{
      nome: "Categoria", ativo: true,
      itens: [
        { id: Number(PRODUTO_ID), nome: "Produto do teste", preco: 10, disponivel: true },
        { id: 602, nome: "Segundo produto", preco: 15, disponivel: true },
      ],
    }],
    grupos: [],
  };
  await store.setCardapio(loja.dir, cardapio2);

  const primeiro = await app.pedir("/api/catalogo/identificadores", {
    token: loja.token, metodo: "PUT",
    corpo: { tipo: "produto", produtoId: PRODUTO_ID, codigoInterno: "COD-1", gtin: "7891234567890" },
  });
  assert.equal(primeiro.status, 200);
  assert.equal(primeiro.corpo.identificador.codigoInterno, "COD-1");

  const codigoDuplicado = await app.pedir("/api/catalogo/identificadores", {
    token: loja.token, metodo: "PUT",
    corpo: { tipo: "produto", produtoId: "602", codigoInterno: "COD-1" },
  });
  assert.equal(codigoDuplicado.status, 409);

  const gtinDuplicado = await app.pedir("/api/catalogo/identificadores", {
    token: loja.token, metodo: "PUT",
    corpo: { tipo: "produto", produtoId: "602", gtin: "7891234567890" },
  });
  assert.equal(gtinDuplicado.status, 409);
});

test("identificadores em produto não sincronizado devolve 404 (ALVO_NAO_ENCONTRADO)", async () => {
  const r = await app.pedir("/api/catalogo/identificadores", {
    token: loja.token, metodo: "PUT",
    corpo: { tipo: "produto", produtoId: "999999-inexistente", codigoInterno: "X" },
  });
  assert.equal(r.status, 404);
});

test("vincular fornecedor a um alvo de OUTRO tenant é recusado pela FK composta (404, não vaza)", async () => {
  const fornecedor = await app.pedir("/api/fornecedores", { token: loja.token, corpo: { nome: "Fornecedor Vínculo" } });
  const idFornecedor = fornecedor.corpo.fornecedor.id;

  // Produto existe SOMENTE na loja principal — tentando vincular pela sessão
  // da OUTRA loja, catalogoAlvosDb.buscarId (escopado por empresa_id) não acha
  // o alvo e a rota responde 404, sem cruzar tenant.
  const r = await app.pedir(`/api/fornecedores/${idFornecedor}/vincular`, {
    token: outraLoja.token, metodo: "POST",
    corpo: { tipo: "produto", produtoId: PRODUTO_ID },
  });
  assert.equal(r.status, 404);
});

test("criar fornecedor inline, vincular ao alvo e depois ver o vínculo sugerido", async () => {
  const criado = await app.pedir("/api/fornecedores", {
    token: loja.token, corpo: { nome: "Fornecedor Sugerido" },
  });
  assert.equal(criado.status, 201);
  const idFornecedor = criado.corpo.fornecedor.id;

  const vinculo = await app.pedir(`/api/fornecedores/${idFornecedor}/vincular`, {
    token: loja.token, metodo: "POST",
    corpo: { tipo: "produto", produtoId: PRODUTO_ID, codigoFornecedor: "SKU-777" },
  });
  assert.equal(vinculo.status, 201);
  assert.equal(vinculo.corpo.vinculo.codigoFornecedor, "SKU-777");

  const sugestoes = await app.pedir(`/api/fornecedores/sugestoes?tipo=produto&produtoId=${PRODUTO_ID}`, { token: loja.token });
  assert.equal(sugestoes.status, 200);
  assert.ok(sugestoes.corpo.fornecedores.some((f) => f.fornecedorId === idFornecedor && f.codigoFornecedor === "SKU-777"));
});

test("403 sem o plano (exigePdv) — dono de tenant Plano Essencial", async () => {
  const semPlano = await tenant.criarEmpresa("fornecedores-essencial");
  const r = await app.pedir("/api/fornecedores", { token: semPlano.token });
  assert.equal(r.status, 403);
});
