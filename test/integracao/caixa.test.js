// ---------------------------------------------------------------------------
// CAIXA — o turno do dinheiro, de ponta a ponta.
//
// Aqui um erro não aparece na tela: ele some com dinheiro. Abrir, receber,
// estornar e fechar mexem em duas tabelas (`caixas`, `caixa_movimentos`) e no
// `recebido_em` do pedido, algumas dentro de transação com lock. Nada disso é
// alcançável por teste de lógica pura — só rodando contra Postgres.
//
// Os casos rodam EM ORDEM e compartilham o mesmo turno de caixa de propósito:
// é assim que o dia do restaurante acontece, e o estado que um caso deixa é a
// entrada do seguinte.
// ---------------------------------------------------------------------------

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");
const db = require("../../src/db");

const PRECO = 10;
const ID_ITEM = 101;
const TOTAL_PEDIDO = PRECO * 2;
const FUNDO = 100;

let loja;      // Plano Completo — caixa é feature do Completo
let essencial; // para provar o porteiro

before(async () => {
  loja = await tenant.criarEmpresa("caixa", { plano: "completo" });
  await tenant.prepararLoja(loja, {
    cardapio: tenant.cardapioDeUmItem({ idItem: ID_ITEM, nome: "Prato da " + loja.marca, preco: PRECO }),
  });
  essencial = await tenant.criarEmpresa("essencial");
});

after(async () => {
  await app.derrubar();
  await tenant.limparTudo();
});

async function estado() {
  const r = await app.pedir("/api/caixa", { token: loja.token });
  assert.equal(r.status, 200, "GET /api/caixa respondeu " + r.status);
  return r.corpo;
}

// Cria um pedido pelo cardápio web e devolve a linha dele já gravada, porque o
// recebimento é por `id` do banco, não pelo número que o cliente vê.
async function criarPedidoAReceber() {
  const novo = await app.pedir("/api/c/" + loja.slug + "/pedido", {
    corpo: {
      cliente: "Cliente de Teste",
      telefone: "11999990000",
      tipoEntrega: "Retirada",
      pagamento: "Dinheiro",
      itens: [{ id: ID_ITEM, qtd: 2 }],
    },
  });
  assert.equal(novo.status, 200, "não consegui criar o pedido: " + JSON.stringify(novo.corpo));

  const lista = await app.pedir("/api/pedidos", { token: loja.token });
  assert.equal(lista.status, 200);
  const linhas = Array.isArray(lista.corpo) ? lista.corpo : lista.corpo.pedidos || [];
  const achado = linhas.find((p) => Number(p.numero) === Number(novo.corpo.numero));
  assert.ok(achado, "pedido " + novo.corpo.numero + " não apareceu na lista");
  return achado;
}

test("sem turno aberto, o caixa responde vazio", async () => {
  const e = await estado();
  assert.equal(e.caixa, null, "não deveria haver caixa aberto numa empresa recém-criada");
});

test("abrir o caixa registra o fundo de troco", async () => {
  const r = await app.pedir("/api/caixa/abrir", { token: loja.token, corpo: { fundoTroco: FUNDO, operador: "Teste" } });
  assert.equal(r.status, 200, "falha ao abrir: " + JSON.stringify(r.corpo));

  const e = await estado();
  assert.ok(e.caixa, "o caixa deveria estar aberto");
  assert.equal(e.caixa.fundoTroco, FUNDO);
  assert.equal(e.caixa.operador, "Teste");
});

test("não abre um segundo caixa por cima do primeiro", async () => {
  const r = await app.pedir("/api/caixa/abrir", { token: loja.token, corpo: { fundoTroco: 50 } });
  assert.equal(r.status, 400, "abriu um segundo caixa (status " + r.status + ")");
  assert.match(String(r.corpo.erro), /aberto/i);
});

test("a trava: não fecha o caixa com pedido a receber", async () => {
  const pedido = await criarPedidoAReceber();
  assert.ok(pedido.id, "pedido precisa ter id do banco");

  const antes = await estado();
  assert.equal(antes.pedidosAReceber, 1, "o pedido novo deveria contar como a receber");

  const r = await app.pedir("/api/caixa/fechar", { token: loja.token, corpo: { contado: FUNDO } });
  assert.equal(r.status, 400, "FECHOU COM VENDA A RECEBER (status " + r.status + ")");
  assert.match(String(r.corpo.erro), /a receber/i);

  // Pedidos antigos a receber têm outro tratamento: aparecem como aviso, mas nao
  // travam o fechamento do caixa de hoje.
});

test("receber com forma que a loja não oferece é recusado", async () => {
  const lista = await app.pedir("/api/pedidos", { token: loja.token });
  const pedido = (Array.isArray(lista.corpo) ? lista.corpo : lista.corpo.pedidos || [])[0];
  const r = await app.pedir("/api/caixa/receber/" + pedido.id, {
    token: loja.token,
    corpo: { forma: "Cartão de Crédito", valor: TOTAL_PEDIDO }, // a loja só aceita Dinheiro
  });
  assert.equal(r.status, 400, "aceitou forma fora da lista (status " + r.status + ")");
});

test("receber em dinheiro lança o movimento e zera o a receber", async () => {
  const lista = await app.pedir("/api/pedidos", { token: loja.token });
  const pedido = (Array.isArray(lista.corpo) ? lista.corpo : lista.corpo.pedidos || [])[0];

  const r = await app.pedir("/api/caixa/receber/" + pedido.id, {
    token: loja.token,
    corpo: { forma: "Dinheiro", valor: TOTAL_PEDIDO },
  });
  assert.equal(r.status, 200, "falha ao receber: " + JSON.stringify(r.corpo));

  const e = await estado();
  assert.equal(e.pedidosAReceber, 0, "depois de receber, não deveria sobrar pedido a receber");
  const recebimento = e.movimentos.find((m) => m.tipo === "recebimento" && m.pedidoId === pedido.id);
  assert.ok(recebimento, "o recebimento não apareceu no extrato do turno");
  assert.ok(recebimento.id, "o extrato precisa expor o id do movimento para parear estornos");
  assert.equal(recebimento.valor, TOTAL_PEDIDO);
  assert.equal(recebimento.forma, "Dinheiro");
});

test("estornar devolve o pedido para a receber", async () => {
  const e0 = await estado();
  const recebimento = e0.movimentos.find((m) => m.tipo === "recebimento" && m.pedidoId);
  assert.ok(recebimento, "preciso de um recebimento para estornar");

  // `metodo` explícito: o estorno é POST SEM corpo, e o ajudante assume GET quando
  // não recebe corpo — sem isto a chamada vira GET e o Express responde 404.
  const r = await app.pedir("/api/caixa/estornar/" + recebimento.pedidoId, { token: loja.token, metodo: "POST" });
  assert.equal(r.status, 200, "falha ao estornar: " + JSON.stringify(r.corpo));

  const e = await estado();
  assert.equal(e.pedidosAReceber, 1, "o pedido estornado tinha que voltar para a receber");
});

test("sangria sai do caixa como movimento próprio", async () => {
  const r = await app.pedir("/api/caixa/movimento", {
    token: loja.token,
    corpo: { tipo: "sangria", valor: 30, descricao: "Retirada de teste" },
  });
  assert.equal(r.status, 200, "falha na sangria: " + JSON.stringify(r.corpo));

  const e = await estado();
  const sangria = e.movimentos.find((m) => m.tipo === "sangria");
  assert.ok(sangria, "a sangria não apareceu no extrato");
  assert.equal(sangria.valor, 30);
});

test("cancelar pedido pago deduz do caixa e aparece como cancelamento", async () => {
  const pedido = await criarPedidoAReceber();
  const receber = await app.pedir("/api/caixa/receber/" + pedido.id, {
    token: loja.token,
    corpo: { forma: "Dinheiro", valor: TOTAL_PEDIDO },
  });
  assert.equal(receber.status, 200, "falha ao receber pedido que será cancelado: " + JSON.stringify(receber.corpo));

  const cancelar = await app.pedir("/api/pedidos/" + pedido.id + "/cancelar", {
    token: loja.token,
    corpo: { devolver: true },
  });
  assert.equal(cancelar.status, 200, "falha ao cancelar pedido pago: " + JSON.stringify(cancelar.corpo));

  const e = await estado();
  const cancelamento = e.movimentos.find((m) => m.tipo === "cancelamento" && m.pedidoId === pedido.id);
  assert.ok(cancelamento, "o cancelamento pago não apareceu no extrato do caixa");
  assert.equal(cancelamento.valor, TOTAL_PEDIDO);
  assert.equal(cancelamento.forma, "Dinheiro");
  assert.equal(e.resumo.cancelamentos, TOTAL_PEDIDO * 2, "estorno + cancelamento pago precisam deduzir o caixa");
});

test("com tudo recebido, o caixa fecha e devolve o relatório", async () => {
  // Recebe de novo o pedido que foi estornado no caso anterior.
  const lista = await app.pedir("/api/pedidos", { token: loja.token });
  const pedido = (Array.isArray(lista.corpo) ? lista.corpo : lista.corpo.pedidos || [])
    .find((p) => !p.recebidoEm && p.status !== "cancelado");
  assert.ok(pedido, "precisava encontrar o pedido estornado como a receber");
  const receber = await app.pedir("/api/caixa/receber/" + pedido.id, {
    token: loja.token,
    corpo: { forma: "Dinheiro", valor: TOTAL_PEDIDO },
  });
  assert.equal(receber.status, 200, "falha ao receber de novo: " + JSON.stringify(receber.corpo));

  const r = await app.pedir("/api/caixa/fechar", {
    token: loja.token,
    corpo: { contado: FUNDO + TOTAL_PEDIDO - 30, eletronico: 0 }, // fundo + recebido - sangria
  });
  assert.equal(r.status, 200, "falha ao fechar: " + JSON.stringify(r.corpo));
  assert.ok(r.corpo.relatorio, "o fechamento tinha que devolver o relatório para impressão");
  assert.match(r.corpo.relatorio, /Dinheiro em Caixa\s+R\$ 90,00/);
  assert.match(r.corpo.relatorio, /Total Conferencia\s+R\$ 90,00/);
  assert.match(r.corpo.relatorio, /CANCELAMENTOS\/ESTORNOS/);

  const e = await estado();
  assert.equal(e.caixa, null, "depois de fechar não pode sobrar caixa aberto");
});

test("pedido antigo a receber avisa, mas não bloqueia o fechamento de hoje", async () => {
  const pedido = await criarPedidoAReceber();
  await db.query("UPDATE pedidos SET criado_em = now() - interval '2 days' WHERE id = $1", [pedido.id]);

  const abrir = await app.pedir("/api/caixa/abrir", { token: loja.token, corpo: { fundoTroco: 0, operador: "Turno novo" } });
  assert.equal(abrir.status, 200, "falha ao abrir novo caixa: " + JSON.stringify(abrir.corpo));

  const e = await estado();
  assert.equal(e.pedidosAReceber, 0, "pedido antigo não deveria contar como pendência do turno");
  assert.equal(e.pedidosAReceberAntigos.quantidade, 1, "pedido antigo deveria aparecer no aviso");
  assert.equal(e.pedidosAReceberAntigos.total, TOTAL_PEDIDO);
  assert.ok(e.pedidosAReceberAntigos.maisAntigoEm, "o aviso precisa trazer a data do pedido mais antigo");

  const fechar = await app.pedir("/api/caixa/fechar", { token: loja.token, corpo: { contado: { Dinheiro: 0 } } });
  assert.equal(fechar.status, 200, "pedido antigo a receber não deve travar o caixa de hoje: " + JSON.stringify(fechar.corpo));
});

test("o caixa é do Plano Completo: quem está no Essencial não entra", async () => {
  for (const rota of ["/api/caixa", "/api/caixa/historico"]) {
    const r = await app.pedir(rota, { token: essencial.token });
    assert.equal(r.status, 403, rota + " respondeu " + r.status + " para plano essencial");
  }
  const abrir = await app.pedir("/api/caixa/abrir", { token: essencial.token, corpo: { fundoTroco: 0 } });
  assert.equal(abrir.status, 403, "plano essencial conseguiu abrir caixa");
});
