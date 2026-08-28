// ---------------------------------------------------------------------------
// PEDIDO DO CARDÁPIO WEB — o caminho que traz dinheiro.
//
// A regra que sustenta o preço é: o servidor RECALCULA o pedido a partir do
// cardápio e nunca confia no que o navegador mandou. Ela está escrita em
// src/cardapio-web.js e é a única coisa entre o produto e um cliente que edita o
// preço no console do navegador antes de enviar.
//
// Até aqui essa regra era conferida lendo o código-fonte com expressão regular.
// Este teste manda um preço adulterado por HTTP e confere o que foi GRAVADO no
// banco, que é o único lugar onde a resposta importa.
// ---------------------------------------------------------------------------

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");

const PRECO_REAL = 10;
const ID_ITEM = 101; // numérico: a projeção de itens_venda converte para bigint

let loja;

before(async () => {
  loja = await tenant.criarEmpresa("preco");
  await tenant.prepararLoja(loja, {
    cardapio: tenant.cardapioDeUmItem({
      idItem: ID_ITEM,
      nome: "Prato da " + loja.marca,
      preco: PRECO_REAL,
    }),
  });
});

after(async () => {
  await app.derrubar();
  await tenant.limparTudo();
});

function pedidoBase(extra = {}) {
  return Object.assign(
    {
      cliente: "Cliente de Teste",
      telefone: "11999990000",
      tipoEntrega: "Retirada",
      pagamento: "Dinheiro",
      itens: [{ id: ID_ITEM, qtd: 2 }],
    },
    extra
  );
}

// A rota devolve só `{ numero }`. O total conferido é o do pedido GRAVADO, lido
// de volta pela API autenticada do painel: é o número que o restaurante vai
// cobrar, e o único que interessa. Conferir o eco da resposta provaria menos.
async function totalGravado(numero) {
  const r = await app.pedir("/api/pedidos", { token: loja.token });
  assert.equal(r.status, 200, "não consegui reler os pedidos (status " + r.status + ")");
  const lista = Array.isArray(r.corpo) ? r.corpo : r.corpo.pedidos || [];
  const achado = lista.find((p) => Number(p.numero) === Number(numero));
  assert.ok(achado, "pedido " + numero + " não apareceu na lista do painel");
  return Number(achado.total);
}

test("o cardápio público serve o item cadastrado", async () => {
  const r = await app.pedir("/api/c/" + loja.slug);
  assert.equal(r.status, 200, "cardápio público respondeu " + r.status);
  assert.match(JSON.stringify(r.corpo), new RegExp(loja.marca));
});

test("um pedido honesto é aceito e gravado pelo preço do cardápio", async () => {
  const r = await app.pedir("/api/c/" + loja.slug + "/pedido", { corpo: pedidoBase() });
  assert.equal(r.status, 200, "pedido recusado: " + JSON.stringify(r.corpo));
  assert.equal(
    await totalGravado(r.corpo.numero),
    PRECO_REAL * 2,
    "2 x R$ " + PRECO_REAL + " tinha que gravar " + PRECO_REAL * 2
  );
});

test("preço adulterado pelo cliente é ignorado", async () => {
  // O que um cliente mal-intencionado faria: mesmo item, preço de um centavo.
  const r = await app.pedir("/api/c/" + loja.slug + "/pedido", {
    corpo: pedidoBase({ itens: [{ id: ID_ITEM, qtd: 2, preco: 0.01 }], total: 0.02 }),
  });
  assert.equal(r.status, 200, "pedido recusado: " + JSON.stringify(r.corpo));
  const gravado = await totalGravado(r.corpo.numero);
  assert.equal(gravado, PRECO_REAL * 2, "O PREÇO DO CLIENTE FOI ACEITO. Total gravado: " + gravado);
});

test("item que não existe no cardápio é recusado", async () => {
  // 409 e não 400: a rota trata o que `recalcularItens` lança como conflito de
  // disponibilidade ("Item indisponível no cardápio"), não como corpo malformado.
  const r = await app.pedir("/api/c/" + loja.slug + "/pedido", {
    corpo: pedidoBase({ itens: [{ id: 99999, qtd: 1 }] }),
  });
  assert.equal(r.status, 409, "aceitou item fora do cardápio (status " + r.status + ")");
});

test("carrinho vazio é recusado", async () => {
  const r = await app.pedir("/api/c/" + loja.slug + "/pedido", { corpo: pedidoBase({ itens: [] }) });
  assert.equal(r.status, 400);
});

test("forma de pagamento fora da lista da loja é recusada", async () => {
  const r = await app.pedir("/api/c/" + loja.slug + "/pedido", {
    corpo: pedidoBase({ pagamento: "Cartão de Crédito" }), // a loja só aceita Dinheiro
  });
  assert.equal(r.status, 400, "aceitou forma que a loja não oferece (status " + r.status + ")");
});
