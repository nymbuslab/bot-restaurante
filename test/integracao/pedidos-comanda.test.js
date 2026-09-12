// ---------------------------------------------------------------------------
// COMANDA — PDV com pedido em aberto (como mesa, mas avulso).
//
// A fixture deste arquivo sobe uma empresa Plano Completo com cardápio de 2
// itens (um de cozinha, um sem) e caixa aberto. Todos os testes seguintes
// das sprints 2-4 dependem deste setup.
//
// Os casos rodam EM ORDEM e compartilham o turno de caixa, como pdv.test.js.
// ---------------------------------------------------------------------------

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");
const fila = require("./ajuda/fila");
const pedidos = require("../../src/pedidos");

const PRECO_COZINHA = 15;
const PRECO_SEM_COZINHA = 8;
const ID_ITEM_COZINHA = 201;
const ID_ITEM_SEM_COZINHA = 202;
const ESTOQUE_INICIAL = 10;

let loja;

before(async () => {
  loja = await tenant.criarEmpresa("comanda", { plano: "completo" });
  await tenant.prepararLoja(loja, {
    cardapio: {
      categorias: [
        {
          nome: "Categoria Comanda",
          ativo: true,
          itens: [
            {
              id: ID_ITEM_COZINHA,
              nome: "Prato de Cozinha",
              preco: PRECO_COZINHA,
              disponivel: true,
              cozinha: true,
              estoque: ESTOQUE_INICIAL,
            },
            {
              id: ID_ITEM_SEM_COZINHA,
              nome: "Bebida Sem Cozinha",
              preco: PRECO_SEM_COZINHA,
              disponivel: true,
              estoque: ESTOQUE_INICIAL,
            },
          ],
        },
      ],
      grupos: [],
    },
  });
});

after(async () => {
  await app.derrubar();
  await tenant.limparTudo();
});

test("fixture: empresa Plano Completo com 2 itens e caixa aberto", async () => {
  const r = await app.pedir("/api/cardapio", { token: loja.token });
  assert.equal(r.status, 200, "GET /api/cardapio respondeu " + r.status);
  const cardapio = r.corpo && r.corpo.categorias ? r.corpo : r.corpo.cardapio;
  assert.equal(cardapio.categorias[0].itens.length, 2, "esperava 2 itens no cardápio");

  const itens = cardapio.categorias[0].itens;
  const cozinha = itens.find((i) => Number(i.id) === ID_ITEM_COZINHA);
  const semCozinha = itens.find((i) => Number(i.id) === ID_ITEM_SEM_COZINHA);
  assert.ok(cozinha, "item de cozinha encontrado");
  assert.ok(semCozinha, "item sem cozinha encontrado");
  assert.equal(cozinha.cozinha, true, "flag cozinha:true confirmada");
  assert.equal(Number(cozinha.preco), PRECO_COZINHA, "preço do item de cozinha");
  assert.equal(Number(semCozinha.preco), PRECO_SEM_COZINHA, "preço do item sem cozinha");

  const abrir = await app.pedir("/api/caixa/abrir", { token: loja.token, corpo: { fundoTroco: 0 } });
  assert.equal(abrir.status, 200, "falha ao abrir o caixa: " + JSON.stringify(abrir.corpo));
});

// ---- T-02.01: Comanda como tipo de venda válido no PDV, sem cupom na abertura ----

let pedidoComanda;

test("T-02.01: venda Comanda nasce a receber e origem pdv", async () => {
  const r = await app.pedir("/api/pdv/vender", {
    token: loja.token,
    corpo: {
      itens: [{ id: ID_ITEM_COZINHA, qtd: 1 }],
      tipoEntrega: "Comanda",
      cliente: "Cliente Comanda",
    },
  });
  assert.equal(r.status, 200, "falha na venda Comanda: " + JSON.stringify(r.corpo));
  assert.equal(r.corpo.ok, true);
  pedidoComanda = r.corpo.pedido;
  assert.ok(pedidoComanda, "pedido retornado");
  assert.ok(!pedidoComanda.recebidoEm, "Comanda nasce sem pagamento (recebidoEm ausente/nulo)");
  assert.equal(pedidoComanda.origem, "pdv", "origem deve ser pdv");
  assert.equal(pedidoComanda.tipoEntrega, "Comanda", "tipoEntrega deve ser Comanda");
  assert.equal(Number(pedidoComanda.total), PRECO_COZINHA, "total bate com o item");
});

test("T-02.01: Comanda não gera movimento de caixa", async () => {
  const r = await app.pedir("/api/caixa", { token: loja.token });
  assert.equal(r.status, 200);
  const movs = r.corpo.movimentos || [];
  const movComanda = movs.find((m) => m.pedido_id === pedidoComanda.id);
  assert.ok(!movComanda, "Comanda não deveria ter lançado movimento no caixa");
});

test("T-02.01: fila de impressão tem via de cozinha mas nenhum cupom", async () => {
  const pendentes = await fila.listar(loja.dir);
  const doPedido = pendentes.filter((t) => {
    const texto = (t.vias || []).join("\n");
    return texto.includes("#" + pedidoComanda.numero);
  });
  assert.ok(doPedido.length > 0, "deveria ter via de cozinha na fila");
  const viasCozinha = doPedido.filter((t) => t.tipo === "pdv");
  assert.ok(viasCozinha.length >= 1, "via de cozinha tipo pdv presente");
  const textoCozinha = viasCozinha[0].vias.join("\n");
  assert.match(textoCozinha, /Prato de Cozinha/i, "via de cozinha menciona o item");
  const viasCupom = doPedido.filter((t) => t.tipo !== "pdv");
  assert.equal(viasCupom.length, 0, "Comanda não deveria gerar via de cupom");
});

test("T-02.01: estoque do item de cozinha foi baixado", async () => {
  const r = await app.pedir("/api/cardapio", { token: loja.token });
  const cardapio = r.corpo && r.corpo.categorias ? r.corpo : r.corpo.cardapio;
  const item = cardapio.categorias[0].itens.find((i) => Number(i.id) === ID_ITEM_COZINHA);
  assert.equal(Number(item.estoque), ESTOQUE_INICIAL - 1, "estoque baixou em 1");
});

// ---- T-02.02: acrescentarItens em pedidos.js ----

test("T-02.02: acrescentarItens soma itens e total num pedido a receber", async () => {
  const antes = await pedidos.lerPorId(loja.dir, pedidoComanda.id);
  assert.ok(antes, "pedido original existe");
  const itensAntes = antes.itens.length;
  const totalAntes = antes.total;

  await pedidos.acrescentarItens(
    loja.dir,
    pedidoComanda.id,
    {
      itens: [{ id: ID_ITEM_SEM_COZINHA, nome: "Bebida Sem Cozinha", preco: PRECO_SEM_COZINHA, qtd: 2 }],
      subtotal: PRECO_SEM_COZINHA * 2,
    }
  );

  const depois = await pedidos.lerPorId(loja.dir, pedidoComanda.id);
  assert.ok(depois, "pedido continua existindo");
  assert.equal(depois.itens.length, itensAntes + 1, "itens do banco cresceu em 1");
  assert.equal(
    depois.total,
    Math.round((totalAntes + PRECO_SEM_COZINHA * 2) * 100) / 100,
    "total soma o valor da rodada"
  );
  assert.equal(depois.recebidoEm, null, "pedido continua a receber");
});

test("T-02.02: acrescentarItens lança erro num pedido já recebido", async () => {
  const aberto = await app.pedir("/api/pdv/vender", {
    token: loja.token,
    corpo: {
      itens: [{ id: ID_ITEM_COZINHA, qtd: 1 }],
      tipoEntrega: "Comanda",
      cliente: "Para fechar",
    },
  });
  assert.equal(aberto.status, 200, "falha ao criar Comanda: " + JSON.stringify(aberto.corpo));
  const fechar = await app.pedir("/api/caixa/receber/" + aberto.corpo.pedido.id, {
    token: loja.token,
    corpo: { pagamentos: [{ forma: "Dinheiro", valor: PRECO_COZINHA }] },
  });
  assert.equal(fechar.status, 200, "falha ao receber: " + JSON.stringify(fechar.corpo));

  await assert.rejects(
    pedidos.acrescentarItens(
      loja.dir,
      aberto.corpo.pedido.id,
      { itens: [{ id: ID_ITEM_SEM_COZINHA, nome: "Bebida", preco: PRECO_SEM_COZINHA, qtd: 1 }], subtotal: PRECO_SEM_COZINHA }
    ),
    /não encontrado|recebido|cancelado/,
    "pedido recebido não pode receber acréscimo"
  );

  const pedidoFechado = await pedidos.lerPorId(loja.dir, aberto.corpo.pedido.id);
  assert.equal(pedidoFechado.itens.length, 1, "pedido fechado não foi alterado");
});

// ---- T-02.03: Rota POST /api/pedidos/:id/itens ----

let pedidoRodada;

test("T-02.03: adicionar item a pedido a receber via rota", async () => {
  const criar = await app.pedir("/api/pdv/vender", {
    token: loja.token,
    corpo: {
      itens: [{ id: ID_ITEM_SEM_COZINHA, qtd: 1 }],
      tipoEntrega: "Comanda",
      cliente: "Comanda da rota",
    },
  });
  assert.equal(criar.status, 200, "falha ao criar Comanda: " + JSON.stringify(criar.corpo));
  pedidoRodada = criar.corpo.pedido;

  const antes = await pedidos.lerPorId(loja.dir, pedidoRodada.id);
  assert.equal(antes.total, PRECO_SEM_COZINHA, "total inicial só da bebida");

  const adicionar = await app.pedir("/api/pedidos/" + pedidoRodada.id + "/itens", {
    token: loja.token,
    corpo: { itens: [{ id: ID_ITEM_COZINHA, qtd: 1 }] },
  });
  assert.equal(adicionar.status, 200, "falha ao acrescentar item: " + JSON.stringify(adicionar.corpo));

  const depois = await pedidos.lerPorId(loja.dir, pedidoRodada.id);
  assert.equal(depois.itens.length, 2, "pedido agora tem os itens antigos mais o novo");
  assert.equal(depois.total, PRECO_SEM_COZINHA + PRECO_COZINHA, "total soma a rodada nova");
  assert.equal(depois.recebidoEm, null, "pedido continua a receber");
});

test("T-02.03: estoque do item acrescentado baixou na mesma quantidade", async () => {
  const r = await app.pedir("/api/cardapio", { token: loja.token });
  const cardapio = r.corpo && r.corpo.categorias ? r.corpo : r.corpo.cardapio;
  const item = cardapio.categorias[0].itens.find((i) => Number(i.id) === ID_ITEM_COZINHA);
  assert.equal(Number(item.estoque), ESTOQUE_INICIAL - 3, "1 da T-02.01 + 1 do fechado + 1 desta rodada");
});

test("T-02.03: estoque insuficiente responde 409 e não altera pedido nem estoque", async () => {
  const r = await app.pedir("/api/cardapio", { token: loja.token });
  const cardapio = r.corpo && r.corpo.categorias ? r.corpo : r.corpo.cardapio;
  const bebida = cardapio.categorias[0].itens.find((i) => Number(i.id) === ID_ITEM_SEM_COZINHA);
  const saldoAntes = Number(bebida.estoque);
  const pedidoAntes = await pedidos.lerPorId(loja.dir, pedidoRodada.id);
  const itensAntes = pedidoAntes.itens.length;

  const falha = await app.pedir("/api/pedidos/" + pedidoRodada.id + "/itens", {
    token: loja.token,
    corpo: { itens: [{ id: ID_ITEM_SEM_COZINHA, qtd: saldoAntes + 10 }] },
  });
  assert.equal(falha.status, 409, "aceitou vender mais do que existe (status " + falha.status + ")");

  const depois = await pedidos.lerPorId(loja.dir, pedidoRodada.id);
  assert.equal(depois.itens.length, itensAntes, "pedido não foi alterado no 409");
  assert.equal(Number(depois.total), pedidoAntes.total, "total não mudou no 409");

  const r2 = await app.pedir("/api/cardapio", { token: loja.token });
  const cardapio2 = r2.corpo && r2.corpo.categorias ? r2.corpo : r2.corpo.cardapio;
  const bebida2 = cardapio2.categorias[0].itens.find((i) => Number(i.id) === ID_ITEM_SEM_COZINHA);
  assert.equal(Number(bebida2.estoque), saldoAntes, "estoque não mexeu no 409");
});

// ---- T-04.02: Fechamento de Comanda via Receber (caminho já existente) ----

test("T-04.02: Receber com pagamento exato fecha a Comanda (recebidoEm + movimento no caixa)", async () => {
  const criar = await app.pedir("/api/pdv/vender", {
    token: loja.token,
    corpo: {
      itens: [{ id: ID_ITEM_COZINHA, qtd: 1 }],
      tipoEntrega: "Comanda",
      cliente: "Fechar exato",
    },
  });
  assert.equal(criar.status, 200, "falha ao criar Comanda: " + JSON.stringify(criar.corpo));
  const pid = criar.corpo.pedido.id;
  assert.equal(Number(criar.corpo.pedido.total), PRECO_COZINHA, "Comanda de 1 prato");

  const fechar = await app.pedir("/api/caixa/receber/" + pid, {
    token: loja.token,
    corpo: { pagamentos: [{ forma: "Dinheiro", valor: PRECO_COZINHA }] },
  });
  assert.equal(fechar.status, 200, "falha ao receber Comanda: " + JSON.stringify(fechar.corpo));
  assert.equal(fechar.corpo.ok, true);

  const pedido = await pedidos.lerPorId(loja.dir, pid);
  assert.ok(pedido.recebidoEm, "pagamento exato precisa preencher recebidoEm");

  const r = await app.pedir("/api/caixa", { token: loja.token });
  assert.equal(r.status, 200);
  const mov = (r.corpo.movimentos || []).find((m) => m.pedidoId === pid);
  assert.ok(mov, "receber Comanda cria movimento no caixa");
  assert.equal(mov.forma, "Dinheiro");
  assert.equal(Number(mov.valor), PRECO_COZINHA);
});

test("T-04.02: pagamento divergente do total responde 400 (mesma mensagem de Entrega/Retirada)", async () => {
  const criar = await app.pedir("/api/pdv/vender", {
    token: loja.token,
    corpo: {
      itens: [{ id: ID_ITEM_SEM_COZINHA, qtd: 1 }],
      tipoEntrega: "Comanda",
      cliente: "Fechar errado",
    },
  });
  assert.equal(criar.status, 200, "falha ao criar Comanda: " + JSON.stringify(criar.corpo));
  const pid = criar.corpo.pedido.id;

  const falha = await app.pedir("/api/caixa/receber/" + pid, {
    token: loja.token,
    corpo: { pagamentos: [{ forma: "Dinheiro", valor: PRECO_SEM_COZINHA + 10 }] },
  });
  assert.equal(falha.status, 400, "pagamento divergente deve responder 400");
  assert.match(falha.corpo.erro || "", /difere do total/i, "mesma mensagem do fluxo Entrega/Retirada");

  const pedido = await pedidos.lerPorId(loja.dir, pid);
  assert.equal(pedido.recebidoEm, null, "divergência não pode fechar o pedido");
});

// ---- T-04.03: Fim a fim — Comanda com duas rodadas ----

test("T-04.03: abrir, acrescentar 2x, cancelar item e receber fecha com total certo", async () => {
  // Rodada 1 (abertura): 1x Prato de Cozinha.
  const criar = await app.pedir("/api/pdv/vender", {
    token: loja.token,
    corpo: {
      itens: [{ id: ID_ITEM_COZINHA, qtd: 1 }],
      tipoEntrega: "Comanda",
      cliente: "Duas rodadas",
    },
  });
  assert.equal(criar.status, 200, "falha ao abrir Comanda: " + JSON.stringify(criar.corpo));
  const pid = criar.corpo.pedido.id;
  const numero = criar.corpo.pedido.numero;

  // Rodada 2 (acréscimo 1): 2x Bebida Sem Cozinha (soma 16).
  const add1 = await app.pedir("/api/pedidos/" + pid + "/itens", {
    token: loja.token,
    corpo: { itens: [{ id: ID_ITEM_SEM_COZINHA, qtd: 2 }] },
  });
  assert.equal(add1.status, 200, "falha no 1o acréscimo: " + JSON.stringify(add1.corpo));

  // Rodada 3 (acréscimo 2): 2x Prato de Cozinha (soma 30).
  const add2 = await app.pedir("/api/pedidos/" + pid + "/itens", {
    token: loja.token,
    corpo: { itens: [{ id: ID_ITEM_COZINHA, qtd: 2 }] },
  });
  assert.equal(add2.status, 200, "falha no 2o acréscimo: " + JSON.stringify(add2.corpo));

  // itens: [Prato 1x, Bebida 2x, Prato 2x]; total 15 + 16 + 30.
  const intermediario = await pedidos.lerPorId(loja.dir, pid);
  assert.equal(intermediario.itens.length, 3, "itens acumulados das rodadas");
  assert.equal(
    Number(intermediario.total),
    PRECO_COZINHA + PRECO_SEM_COZINHA * 2 + PRECO_COZINHA * 2,
    "total soma as rodadas"
  );
  assert.equal(intermediario.recebidoEm, null, "continua a receber");

  // Cancela a Bebida inteira (idx 1): tira os 16 do total.
  const cancelar = await app.pedir("/api/pedidos/" + pid + "/cancelar-item", {
    token: loja.token,
    corpo: { itemIdx: 1, devolver: true },
  });
  assert.equal(cancelar.status, 200, "falha ao cancelar item: " + JSON.stringify(cancelar.corpo));
  assert.equal(Number(cancelar.corpo.total), PRECO_COZINHA + PRECO_COZINHA * 2, "total final = soma menos o item cancelado");

  // Fecha via o recebimento já existente (T-04.02).
  const receber = await app.pedir("/api/caixa/receber/" + pid, {
    token: loja.token,
    corpo: { pagamentos: [{ forma: "Dinheiro", valor: Number(cancelar.corpo.total) }] },
  });
  assert.equal(receber.status, 200, "falha ao receber: " + JSON.stringify(receber.corpo));

  const fechado = await pedidos.lerPorId(loja.dir, pid);
  assert.ok(fechado.recebidoEm, "recebidoEm preenchido ao fechar");
  assert.equal(Number(fechado.total), PRECO_COZINHA + PRECO_COZINHA * 2, "total final persistido");
  assert.equal(fechado.itens.length, 2, "item cancelado saiu do pedido");

  // A via de cozinha do 2o acréscimo lista SÓ os itens daquela rodada (2x Prato):
  // nem o acúmulo 3x (1x da abertura + 2x da rodada) nem a Bebida (sem cozinha).
  const pendentes = await fila.listar(loja.dir);
  const doPedido = pendentes.filter((t) => (t.vias || []).join("\n").includes("#" + numero));
  assert.ok(doPedido.length > 0, "fila tem vias deste pedido");
  const semRepeticao = doPedido.find((t) => (t.vias || []).join("\n").includes("2x Prato de Cozinha"));
  assert.ok(semRepeticao, "via do 2o acréscimo presente na fila");
  const texto = semRepeticao.vias.join("\n");
  assert.ok(!texto.includes("3x Prato de Cozinha"), "a via da rodada so lista a rodada (nao acumula)");
  assert.ok(!texto.includes("Bebida Sem Cozinha"), "bebida nao vai para a via da cozinha");
});
