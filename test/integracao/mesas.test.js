// ---------------------------------------------------------------------------
// MESAS — o salão, do abrir ao pagar.
//
// A mesa tem uma máquina de estados (livre → ocupada → fechando → livre) e cada
// transição tem uma trava. Errar aqui não some com dinheiro em silêncio como no
// caixa, mas trava o salão no meio do serviço: mesa que não abre, conta que não
// fecha, item lançado na mesa errada.
//
// O caso que mais vale deste arquivo é o cruzamento com o caixa: **o caixa não
// fecha com mesa aberta**. São duas features que se falam por uma contagem no
// banco, e nenhum teste de lógica pura enxerga isso.
//
// Os casos rodam EM ORDEM e compartilham a mesma mesa.
// ---------------------------------------------------------------------------

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");

const PRECO = 10;
const ID_ITEM = 101;

let loja;      // Plano Completo
let vizinha;   // outra empresa no Completo, para o isolamento
let essencial; // para o porteiro
let mesaId;
let mesaBloqueioId;

before(async () => {
  loja = await tenant.criarEmpresa("mesas", { plano: "completo" });
  await tenant.prepararLoja(loja, {
    cardapio: tenant.cardapioDeUmItem({ idItem: ID_ITEM, nome: "Prato da " + loja.marca, preco: PRECO }),
  });
  vizinha = await tenant.criarEmpresa("mesas-vizinha", { plano: "completo" });
  await tenant.prepararLoja(vizinha);
  essencial = await tenant.criarEmpresa("mesas-essencial");
});

after(async () => {
  await app.derrubar();
  await tenant.limparTudo();
});

async function mesas(token = loja.token) {
  const r = await app.pedir("/api/mesas", { token });
  assert.equal(r.status, 200, "GET /api/mesas respondeu " + r.status);
  return Array.isArray(r.corpo) ? r.corpo : r.corpo.mesas || [];
}

async function detalhe(id) {
  const r = await app.pedir("/api/mesas/" + id, { token: loja.token });
  assert.equal(r.status, 200, "GET /api/mesas/" + id + " respondeu " + r.status);
  return r.corpo;
}

test("criar mesas em lote", async () => {
  // taxaServico 0 deixa a conta previsível: total = soma dos itens, sem serviço.
  const r = await app.pedir("/api/mesas/config", {
    token: loja.token,
    corpo: { nomes: ["Mesa 1", "Mesa 2"], taxaServico: 0 },
  });
  assert.equal(r.status, 200, "falha ao criar mesas: " + JSON.stringify(r.corpo));

  const lista = await mesas();
  assert.equal(lista.length, 2, "esperava 2 mesas criadas");
  assert.ok(lista.every((m) => m.status === "livre"), "mesa recém-criada nasce livre");
  mesaId = lista[0].id;
  mesaBloqueioId = lista[1].id;
});

test("não lança pedido em mesa que não foi aberta", async () => {
  const r = await app.pedir("/api/mesas/" + mesaId + "/pedido", {
    token: loja.token,
    corpo: { itens: [{ id: ID_ITEM, qtd: 1 }] },
  });
  assert.equal(r.status, 400, "aceitou pedido em mesa livre (status " + r.status + ")");
  assert.match(String(r.corpo.erro), /abra a mesa/i);
});

test("abrir a mesa registra o número de pessoas", async () => {
  const r = await app.pedir("/api/mesas/" + mesaId + "/abrir", { token: loja.token, corpo: { pessoas: 2 } });
  assert.equal(r.status, 200, "falha ao abrir a mesa: " + JSON.stringify(r.corpo));

  const d = await detalhe(mesaId);
  const mesa = d.mesa || d;
  assert.equal(mesa.status, "ocupada");
  assert.equal(Number(mesa.pessoas), 2);
});

test("lançar itens soma na conta da mesa", async () => {
  const r = await app.pedir("/api/mesas/" + mesaId + "/pedido", {
    token: loja.token,
    corpo: { itens: [{ id: ID_ITEM, qtd: 3 }] },
  });
  assert.equal(r.status, 200, "falha ao lançar: " + JSON.stringify(r.corpo));

  const d = await detalhe(mesaId);
  const total = Number(d.total !== undefined ? d.total : (d.resumo || {}).total);
  assert.equal(total, PRECO * 3, "3 x R$ " + PRECO + " com taxa 0 tinha que dar " + PRECO * 3);
});

test("o caixa não fecha com mesa aberta", async () => {
  const abrir = await app.pedir("/api/caixa/abrir", { token: loja.token, corpo: { fundoTroco: 0 } });
  assert.equal(abrir.status, 200, "falha ao abrir o caixa: " + JSON.stringify(abrir.corpo));

  const r = await app.pedir("/api/caixa/fechar", { token: loja.token, corpo: { contado: 0 } });
  assert.equal(r.status, 400, "FECHOU O CAIXA COM MESA ABERTA (status " + r.status + ")");
  assert.match(String(r.corpo.erro), /mesa/i, "o erro deveria falar da mesa: " + JSON.stringify(r.corpo));
});

test("não paga a mesa sem pedir a conta antes", async () => {
  const r = await app.pedir("/api/mesas/" + mesaId + "/pagar", {
    token: loja.token,
    corpo: { pagamentos: [{ forma: "Dinheiro", valor: PRECO * 3 }] },
  });
  assert.equal(r.status, 400, "pagou sem a mesa estar em fechamento (status " + r.status + ")");
});

test("pagamento parcial impede cancelar item ou mesa sem ajustar o caixa", async () => {
  const abrir = await app.pedir("/api/mesas/" + mesaBloqueioId + "/abrir", { token: loja.token, corpo: { pessoas: 1 } });
  assert.equal(abrir.status, 200, "falha ao abrir mesa de bloqueio: " + JSON.stringify(abrir.corpo));

  const lancar = await app.pedir("/api/mesas/" + mesaBloqueioId + "/pedido", {
    token: loja.token,
    corpo: { itens: [{ id: ID_ITEM, qtd: 3 }] },
  });
  assert.equal(lancar.status, 200, "falha ao lançar na mesa de bloqueio: " + JSON.stringify(lancar.corpo));

  const parcial = await app.pedir("/api/mesas/" + mesaBloqueioId + "/receber-parcial", {
    token: loja.token,
    corpo: { pagamentos: [{ forma: "Dinheiro", valor: PRECO * 2 }] },
  });
  assert.equal(parcial.status, 200, "falha ao receber parcial: " + JSON.stringify(parcial.corpo));

  const d = await detalhe(mesaBloqueioId);
  const pedido = (d.pedidos || [])[0];
  assert.ok(pedido && pedido.id, "detalhe da mesa precisava trazer o pedido para cancelar item");

  const cancelarItem = await app.pedir("/api/mesas/" + mesaBloqueioId + "/cancelar-item", {
    token: loja.token,
    corpo: { pedidoId: pedido.id, itemIdx: 0 },
  });
  assert.equal(cancelarItem.status, 400, "cancelou item que deixaria recebido maior que total");
  assert.match(String(cancelarItem.corpo.erro), /recebido|caixa|pagamento/i);

  const cancelarMesa = await app.pedir("/api/mesas/" + mesaBloqueioId + "/cancelar", {
    token: loja.token,
    corpo: { motivo: "teste de auditoria" },
  });
  assert.equal(cancelarMesa.status, 400, "cancelou mesa que já tinha pagamento parcial");
  assert.match(String(cancelarMesa.corpo.erro), /pagamento|caixa/i);

  const conta = await app.pedir("/api/mesas/" + mesaBloqueioId + "/fechar-conta", { token: loja.token, metodo: "POST" });
  assert.equal(conta.status, 200, "falha ao pedir conta da mesa de bloqueio: " + JSON.stringify(conta.corpo));

  const pagar = await app.pedir("/api/mesas/" + mesaBloqueioId + "/pagar", {
    token: loja.token,
    corpo: { pagamentos: [{ forma: "Dinheiro", valor: PRECO }] },
  });
  assert.equal(pagar.status, 200, "falha ao fechar mesa de bloqueio: " + JSON.stringify(pagar.corpo));
});

test("pedir a conta, pagar, e a mesa volta a ficar livre", async () => {
  const conta = await app.pedir("/api/mesas/" + mesaId + "/fechar-conta", { token: loja.token, metodo: "POST" });
  assert.equal(conta.status, 200, "falha ao pedir a conta: " + JSON.stringify(conta.corpo));

  const r = await app.pedir("/api/mesas/" + mesaId + "/pagar", {
    token: loja.token,
    corpo: { pagamentos: [{ forma: "Dinheiro", valor: PRECO * 3 }] },
  });
  assert.equal(r.status, 200, "falha ao pagar: " + JSON.stringify(r.corpo));

  const lista = await mesas();
  const mesa = lista.find((m) => m.id === mesaId);
  assert.equal(mesa.status, "livre", "depois de paga, a mesa tinha que voltar a livre");

  const caixa = await app.pedir("/api/caixa", { token: loja.token });
  const movimento = caixa.corpo.movimentos.find((m) => m.forma === "Dinheiro" && m.valor === PRECO * 3);
  assert.ok(movimento, "o pagamento da mesa não apareceu no caixa");
});

test("com a mesa fechada, o caixa fecha", async () => {
  const r = await app.pedir("/api/caixa/fechar", { token: loja.token, corpo: { contado: PRECO * 6, eletronico: 0 } });
  assert.equal(r.status, 200, "não fechou mesmo sem mesa aberta: " + JSON.stringify(r.corpo));
});

test("as mesas de uma empresa não aparecem para a outra", async () => {
  const daVizinha = await mesas(vizinha.token);
  assert.equal(daVizinha.length, 0, "VAZAMENTO: a vizinha enxergou " + daVizinha.length + " mesa(s) que não são dela");
});

test("Mesas é do Plano Completo: quem está no Essencial não entra", async () => {
  const r = await app.pedir("/api/mesas", { token: essencial.token });
  assert.equal(r.status, 403, "plano essencial entrou em Mesas (status " + r.status + ")");
});
