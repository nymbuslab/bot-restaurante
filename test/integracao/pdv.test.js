// ---------------------------------------------------------------------------
// PDV — venda no local, e o estoque que ela consome.
//
// O PDV é o caminho por onde o restaurante mais vende hoje. Ele encosta em três
// coisas ao mesmo tempo: cria pedido, lança movimento no caixa e baixa estoque.
// Uma dessas três falhar no meio é o tipo de defeito que não aparece na tela —
// aparece na contagem do fim do dia.
//
// Os casos rodam EM ORDEM e compartilham o turno de caixa, como no caixa.test.js.
//
// SOBRE "BAIXA ATÔMICA": a rota valida o estoque ANTES de abrir a transação
// (`estoque.validarEstoque` → 409) e só depois baixa dentro dela. Então o caso
// de estoque insuficiente aqui prova o GUARDA, não a atomicidade. Provar que uma
// falha no meio da transação desfaz a baixa exigiria forçar erro dentro do
// commit, o que não dá para fazer por HTTP. Isso fica registrado como limite
// deste arquivo, não como coisa coberta.
// ---------------------------------------------------------------------------

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");

const PRECO = 10;
const ID_ITEM = 101;
const ESTOQUE_INICIAL = 5;

let loja;
let essencial;

before(async () => {
  loja = await tenant.criarEmpresa("pdv", { plano: "completo" });
  await tenant.prepararLoja(loja, {
    cardapio: {
      categorias: [
        {
          nome: "Categoria do Teste",
          ativo: true,
          itens: [
            {
              id: ID_ITEM,
              nome: "Prato da " + loja.marca,
              preco: PRECO,
              disponivel: true,
              // `estoque` presente = controle LIGADO (public/estoque.js: temControle).
              estoque: ESTOQUE_INICIAL,
            },
          ],
        },
      ],
      grupos: [],
    },
  });
  essencial = await tenant.criarEmpresa("essencial-pdv");
});

after(async () => {
  await app.derrubar();
  await tenant.limparTudo();
});

async function saldoDoItem() {
  const r = await app.pedir("/api/cardapio", { token: loja.token });
  assert.equal(r.status, 200, "GET /api/cardapio respondeu " + r.status);
  const cardapio = r.corpo && r.corpo.categorias ? r.corpo : r.corpo.cardapio;
  const item = cardapio.categorias[0].itens.find((i) => Number(i.id) === ID_ITEM);
  assert.ok(item, "o item de teste sumiu do cardápio");
  return Number(item.estoque);
}

async function pedidosDaLoja() {
  const r = await app.pedir("/api/pedidos", { token: loja.token });
  assert.equal(r.status, 200);
  return Array.isArray(r.corpo) ? r.corpo : r.corpo.pedidos || [];
}

function vendaBalcao(qtd = 1, extra = {}) {
  return Object.assign(
    {
      itens: [{ id: ID_ITEM, qtd }],
      tipoEntrega: "Balcão",
      pagamentos: [{ forma: "Dinheiro", valor: PRECO * qtd }],
    },
    extra
  );
}

test("sem caixa aberto, a venda de balcão é recusada", async () => {
  const r = await app.pedir("/api/pdv/vender", { token: loja.token, corpo: vendaBalcao(1) });
  assert.notEqual(r.status, 200, "vendeu no balcão sem caixa aberto");
  assert.match(String(r.corpo.erro || ""), /caixa/i, "o erro deveria falar do caixa: " + JSON.stringify(r.corpo));
});

test("nada foi vendido, então o estoque não se mexeu", async () => {
  assert.equal(await saldoDoItem(), ESTOQUE_INICIAL, "a venda recusada não pode ter baixado estoque");
});

test("venda de balcão nasce recebida e lança movimento no caixa", async () => {
  const abrir = await app.pedir("/api/caixa/abrir", { token: loja.token, corpo: { fundoTroco: 0 } });
  assert.equal(abrir.status, 200, "falha ao abrir o caixa: " + JSON.stringify(abrir.corpo));

  const r = await app.pedir("/api/pdv/vender", { token: loja.token, corpo: vendaBalcao(2) });
  assert.equal(r.status, 200, "falha na venda: " + JSON.stringify(r.corpo));

  const caixa = await app.pedir("/api/caixa", { token: loja.token });
  assert.equal(caixa.status, 200);
  const movimento = caixa.corpo.movimentos.find((m) => m.forma === "Dinheiro" && m.valor === PRECO * 2);
  assert.ok(movimento, "a venda de balcão não virou movimento no caixa");
  assert.equal(caixa.corpo.pedidosAReceber, 0, "venda de balcão é paga na hora, não pode ficar a receber");
});

test("a venda de balcão baixou o estoque", async () => {
  assert.equal(
    await saldoDoItem(),
    ESTOQUE_INICIAL - 2,
    "vendi 2 de " + ESTOQUE_INICIAL + ", o saldo tinha que cair para " + (ESTOQUE_INICIAL - 2)
  );
});

test("venda acima do estoque é recusada, e o saldo fica intacto", async () => {
  const saldoAntes = await saldoDoItem();
  const r = await app.pedir("/api/pdv/vender", { token: loja.token, corpo: vendaBalcao(saldoAntes + 1) });
  assert.equal(r.status, 409, "aceitou vender mais do que existe (status " + r.status + ")");
  assert.equal(await saldoDoItem(), saldoAntes, "a venda recusada mexeu no estoque");
});

test("Retirada nasce a receber e não toca o caixa", async () => {
  const antes = await app.pedir("/api/caixa", { token: loja.token });
  const movimentosAntes = antes.corpo.movimentos.length;

  const r = await app.pedir("/api/pdv/vender", {
    token: loja.token,
    corpo: {
      itens: [{ id: ID_ITEM, qtd: 1 }],
      tipoEntrega: "Retirada",
      cliente: "Cliente Retirada",
      telefone: "11999990000",
    },
  });
  assert.equal(r.status, 200, "falha na venda de retirada: " + JSON.stringify(r.corpo));

  const depois = await app.pedir("/api/caixa", { token: loja.token });
  assert.equal(
    depois.corpo.movimentos.length,
    movimentosAntes,
    "Retirada não é paga na hora: não pode lançar movimento no caixa"
  );
  assert.equal(depois.corpo.pedidosAReceber, 1, "a retirada tinha que ficar a receber");
});

test("os pedidos do PDV são marcados com origem pdv", async () => {
  const lista = await pedidosDaLoja();
  assert.ok(lista.length >= 2, "esperava ao menos as duas vendas do PDV");
  assert.ok(
    lista.every((p) => p.origem === "pdv"),
    "toda venda deste arquivo veio do PDV; origem diferente significa que o alerta de pedido novo vai disparar no balcão"
  );
});

test("o PDV é do Plano Completo: quem está no Essencial não entra", async () => {
  const r = await app.pedir("/api/pdv/vender", { token: essencial.token, corpo: vendaBalcao(1) });
  assert.equal(r.status, 403, "plano essencial conseguiu vender no PDV (status " + r.status + ")");
});
