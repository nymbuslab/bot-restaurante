require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");
const fila = require("./ajuda/fila");
const movimentosCaixa = require("./ajuda/movimentos-caixa");
const caixa = require("../../src/caixa");

const PRECO = 12;
const ID_ITEM = 707;

let loja;

before(async () => {
  loja = await tenant.criarEmpresa("caixa-comprovantes", { plano: "completo" });
  await tenant.prepararLoja(loja, {
    cardapio: tenant.cardapioDeUmItem({ idItem: ID_ITEM, nome: "Prato de Teste", preco: PRECO }),
  });
});

after(async () => {
  await app.derrubar();
  await tenant.limparTudo();
});

async function abrirCaixa() {
  const r = await app.pedir("/api/caixa/abrir", {
    token: loja.token,
    corpo: { fundoTroco: 100, operador: "Operador Teste" },
  });
  assert.equal(r.status, 200, "falha ao abrir caixa: " + JSON.stringify(r.corpo));
}

async function configurarComprovantes(caixa) {
  const cfgResp = await app.pedir("/api/config", { token: loja.token });
  assert.equal(cfgResp.status, 200);
  const cfg = cfgResp.corpo;
  cfg.impressao = Object.assign({}, cfg.impressao, { caixa });
  const salvar = await app.pedir("/api/config", { token: loja.token, metodo: "PUT", corpo: cfg });
  assert.equal(salvar.status, 200, "falha ao salvar config: " + JSON.stringify(salvar.corpo));
}

async function criarPedido() {
  const novo = await app.pedir("/api/c/" + loja.slug + "/pedido", {
    corpo: {
      cliente: "Cliente Teste",
      telefone: "11999990000",
      tipoEntrega: "Retirada",
      pagamento: "Dinheiro",
      itens: [{ id: ID_ITEM, qtd: 1 }],
    },
  });
  assert.equal(novo.status, 200, "falha ao criar pedido: " + JSON.stringify(novo.corpo));
  const lista = await app.pedir("/api/pedidos", { token: loja.token });
  assert.equal(lista.status, 200);
  return (Array.isArray(lista.corpo) ? lista.corpo : lista.corpo.pedidos || [])
    .find((p) => Number(p.numero) === Number(novo.corpo.numero));
}

test("comprovantes do caixa respeitam configuracao por tipo", async () => {
  await abrirCaixa();

  const semConfig = await app.pedir("/api/caixa/movimento", {
    token: loja.token,
    corpo: { tipo: "suprimento", valor: 20, descricao: "Troco extra" },
  });
  assert.equal(semConfig.status, 200, "falha no suprimento sem config: " + JSON.stringify(semConfig.corpo));
  assert.equal((await fila.listar(loja.dir)).length, 0, "config padrao desligada nao deve imprimir");

  await configurarComprovantes({ suprimento: true, sangria: true, cancelamento: true });

  const suprimento = await app.pedir("/api/caixa/movimento", {
    token: loja.token,
    corpo: { tipo: "suprimento", valor: 15, descricao: "Reforco de troco" },
  });
  assert.equal(suprimento.status, 200, "falha no suprimento: " + JSON.stringify(suprimento.corpo));

  const primeiraLeitura = await fila.listar(loja.dir);
  const segundaLeitura = await fila.listar(loja.dir);
  assert.equal(segundaLeitura.length, 1, "a leitura sem consumo deve preservar o suprimento na fila");
  assert.deepEqual(segundaLeitura, primeiraLeitura, "duas leituras seguidas devem devolver o mesmo trabalho");

  const sangria = await app.pedir("/api/caixa/movimento", {
    token: loja.token,
    corpo: { tipo: "sangria", valor: 5, descricao: "Retirada para conferencia" },
  });
  assert.equal(sangria.status, 200, "falha na sangria: " + JSON.stringify(sangria.corpo));

  const pedido = await criarPedido();
  assert.ok(pedido && pedido.id, "pedido precisa existir");
  const receber = await app.pedir("/api/caixa/receber/" + pedido.id, {
    token: loja.token,
    corpo: { forma: "Dinheiro", valor: PRECO },
  });
  assert.equal(receber.status, 200, "falha ao receber: " + JSON.stringify(receber.corpo));

  const cancelar = await app.pedir("/api/pedidos/" + pedido.id + "/cancelar", {
    token: loja.token,
    corpo: { devolver: true },
  });
  assert.equal(cancelar.status, 200, "falha ao cancelar: " + JSON.stringify(cancelar.corpo));

  const trabalhos = await fila.listar(loja.dir);
  assert.equal(trabalhos.length, 3, "deveria enfileirar um comprovante por acao configurada");
  assert.deepEqual(trabalhos.map((j) => j.tipo), ["caixa-comprovante", "caixa-comprovante", "caixa-comprovante"]);
  const textos = trabalhos.map((j) => j.vias.join("\n"));
  assert.ok(textos.some((t) => /SUPRIMENTO[\s\S]*Valor\s+R\$ 15,00/.test(t)), "faltou comprovante de suprimento");
  assert.ok(textos.some((t) => /SANGRIA[\s\S]*Valor\s+- R\$ 5,00/.test(t)), "faltou comprovante de sangria");
  assert.ok(textos.some((t) => /CANCELAMENTO[\s\S]*Pedido #[0-9]+[\s\S]*Valor\s+- R\$ 12,00/.test(t)), "faltou comprovante de cancelamento");
});

test("fixture cria os tres tipos de movimento com comprovante", async () => {
  const ids = await movimentosCaixa.criarComComprovante(app, loja, {
    idItem: ID_ITEM,
    preco: PRECO,
  });

  assert.equal(typeof ids.sangria, "number");
  assert.equal(typeof ids.suprimento, "number");
  assert.equal(typeof ids.cancelamento, "number");
  assert.equal(new Set([ids.sangria, ids.suprimento, ids.cancelamento]).size, 3);

  const caixa = await app.pedir("/api/caixa", { token: loja.token });
  assert.equal(caixa.status, 200, "falha ao ler caixa: " + JSON.stringify(caixa.corpo));
  const idsDoExtrato = new Set((caixa.corpo.movimentos || []).map((m) => Number(m.id)));
  assert.ok(idsDoExtrato.has(ids.sangria), "id de sangria nao apareceu no extrato");
  assert.ok(idsDoExtrato.has(ids.suprimento), "id de suprimento nao apareceu no extrato");
  assert.ok(idsDoExtrato.has(ids.cancelamento), "id de cancelamento nao apareceu no extrato");
});

test("le movimento guardado com operador, pedido e hora original", async () => {
  const ids = await movimentosCaixa.criarComComprovante(app, loja, {
    idItem: ID_ITEM,
    preco: PRECO,
  });
  const resumo = await app.pedir("/api/caixa", { token: loja.token });
  assert.equal(resumo.status, 200, "falha ao ler caixa: " + JSON.stringify(resumo.corpo));
  const movimentos = resumo.corpo.movimentos || [];
  const sangriaExtrato = movimentos.find((m) => Number(m.id) === ids.sangria);
  const cancelamentoExtrato = movimentos.find((m) => Number(m.id) === ids.cancelamento);
  assert.ok(sangriaExtrato, "sangria precisa aparecer no extrato");
  assert.ok(cancelamentoExtrato, "cancelamento precisa aparecer no extrato");

  const sangria = await caixa.lerMovimentoComprovante(loja.dir, ids.sangria);
  assert.equal(sangria.tipo, "sangria");
  assert.equal(sangria.valor, 3);
  assert.equal(sangria.operador, "Operador Teste");
  assert.equal(sangria.criadoEm, sangriaExtrato.quando);

  const cancelamento = await caixa.lerMovimentoComprovante(loja.dir, ids.cancelamento);
  assert.equal(cancelamento.tipo, "cancelamento");
  assert.equal(cancelamento.pedidoNumero, cancelamentoExtrato.numero);
  assert.equal(cancelamento.criadoEm, cancelamentoExtrato.quando);
});

test("le cancelamento reagrupado por qualquer movimento irmao", async () => {
  const cfgResp = await app.pedir("/api/config", { token: loja.token });
  assert.equal(cfgResp.status, 200);
  const cfg = cfgResp.corpo;
  cfg.pagamentos = ["Dinheiro", "PIX"];
  const salvar = await app.pedir("/api/config", { token: loja.token, metodo: "PUT", corpo: cfg });
  assert.equal(salvar.status, 200, "falha ao salvar formas: " + JSON.stringify(salvar.corpo));

  const pedido = await criarPedido();
  assert.ok(pedido && pedido.id, "pedido precisa existir");
  const receber = await app.pedir("/api/caixa/receber/" + pedido.id, {
    token: loja.token,
    corpo: { pagamentos: [{ forma: "Dinheiro", valor: 8 }, { forma: "PIX", valor: 4 }] },
  });
  assert.equal(receber.status, 200, "falha ao receber split: " + JSON.stringify(receber.corpo));

  const cancelar = await app.pedir("/api/pedidos/" + pedido.id + "/cancelar", {
    token: loja.token,
    corpo: { devolver: true },
  });
  assert.equal(cancelar.status, 200, "falha ao cancelar split: " + JSON.stringify(cancelar.corpo));

  const resumo = await app.pedir("/api/caixa", { token: loja.token });
  assert.equal(resumo.status, 200, "falha ao ler caixa: " + JSON.stringify(resumo.corpo));
  const ids = (resumo.corpo.movimentos || [])
    .filter((m) => m.tipo === "cancelamento" && Number(m.pedidoId) === Number(pedido.id))
    .map((m) => Number(m.id));
  assert.equal(ids.length, 2, "cancelamento split precisa gerar dois movimentos");

  for (const id of ids) {
    const mov = await caixa.lerMovimentoComprovante(loja.dir, id);
    assert.equal(mov.valor, 12);
    assert.equal(mov.formas.length, 2);
    assert.deepEqual(
      mov.formas.map((f) => [f.forma, f.valor]).sort((a, b) => a[0].localeCompare(b[0])),
      [["Dinheiro", 8], ["PIX", 4]]
    );
  }
});

test("rota reimprime comprovante ignorando toggle desligado", async () => {
  const antes = await fila.listar(loja.dir);
  const maxAntes = Math.max(0, ...antes.map((j) => Number(j.id) || 0));
  const ids = await movimentosCaixa.criarComComprovante(app, loja, {
    idItem: ID_ITEM,
    preco: PRECO,
  });
  const originais = (await fila.listar(loja.dir)).filter((j) => Number(j.id) > maxAntes);
  const textoOriginal = {
    sangria: (originais.find((j) => /SANGRIA[\s\S]*Fixture sangria/.test(j.vias.join("\n"))) || {}).vias,
    suprimento: (originais.find((j) => /SUPRIMENTO[\s\S]*Fixture suprimento/.test(j.vias.join("\n"))) || {}).vias,
    cancelamento: (originais.find((j) => /CANCELAMENTO[\s\S]*Cancelamento pedido/.test(j.vias.join("\n"))) || {}).vias,
  };
  assert.ok(textoOriginal.sangria, "faltou texto original de sangria");
  assert.ok(textoOriginal.suprimento, "faltou texto original de suprimento");
  assert.ok(textoOriginal.cancelamento, "faltou texto original de cancelamento");

  await configurarComprovantes({ sangria: false, suprimento: false, cancelamento: false });
  const maxOriginal = Math.max(0, ...(await fila.listar(loja.dir)).map((j) => Number(j.id) || 0));

  for (const tipo of ["sangria", "suprimento", "cancelamento"]) {
    const r = await app.pedir("/api/caixa/movimento/" + ids[tipo] + "/reimprimir", {
      token: loja.token,
      corpo: {},
    });
    assert.equal(r.status, 200, "falha ao reimprimir " + tipo + ": " + JSON.stringify(r.corpo));
    assert.deepEqual(r.corpo, { ok: true });
  }

  const reimpressos = (await fila.listar(loja.dir)).filter((j) => Number(j.id) > maxOriginal);
  assert.equal(reimpressos.length, 3);
  const textos = reimpressos.map((j) => j.vias.join("\n"));
  assert.ok(textos.includes(textoOriginal.sangria.join("\n")), "sangria reimpressa precisa ser string-identica");
  assert.ok(textos.includes(textoOriginal.suprimento.join("\n")), "suprimento reimpresso precisa ser string-identico");
  assert.ok(textos.includes(textoOriginal.cancelamento.join("\n")), "cancelamento reimpresso precisa ser string-identico");
});

test("rota de reimpressao barra tipo, plano e outra empresa", async () => {
  const pedido = await criarPedido();
  const receber = await app.pedir("/api/caixa/receber/" + pedido.id, {
    token: loja.token,
    corpo: { forma: "Dinheiro", valor: PRECO },
  });
  assert.equal(receber.status, 200, "falha ao receber: " + JSON.stringify(receber.corpo));
  const resumo = await app.pedir("/api/caixa", { token: loja.token });
  assert.equal(resumo.status, 200);
  const recebimento = (resumo.corpo.movimentos || []).find((m) =>
    m.tipo === "recebimento" && Number(m.pedidoId) === Number(pedido.id)
  );
  assert.ok(recebimento && recebimento.id, "recebimento precisa aparecer no extrato");

  const tipoErrado = await app.pedir("/api/caixa/movimento/" + recebimento.id + "/reimprimir", {
    token: loja.token,
    corpo: {},
  });
  assert.equal(tipoErrado.status, 400);

  const outra = await tenant.criarEmpresa("caixa-reimpressao-outra", { plano: "completo" });
  await tenant.prepararLoja(outra);
  const outroTenant = await app.pedir("/api/caixa/movimento/" + recebimento.id + "/reimprimir", {
    token: outra.token,
    corpo: {},
  });
  assert.equal(outroTenant.status, 404);

  const essencial = await tenant.criarEmpresa("caixa-reimpressao-essencial");
  await tenant.prepararLoja(essencial);
  const semPlano = await app.pedir("/api/caixa/movimento/" + recebimento.id + "/reimprimir", {
    token: essencial.token,
    corpo: {},
  });
  assert.equal(semPlano.status, 403);
});

test("rota limita rajada por movimento, nao por rota", async () => {
  const ids = await movimentosCaixa.criarComComprovante(app, loja, {
    idItem: ID_ITEM,
    preco: PRECO,
  });

  const maxAntesMesmo = Math.max(0, ...(await fila.listar(loja.dir)).map((j) => Number(j.id) || 0));
  const primeiro = await app.pedir("/api/caixa/movimento/" + ids.sangria + "/reimprimir", {
    token: loja.token,
    corpo: {},
  });
  const segundo = await app.pedir("/api/caixa/movimento/" + ids.sangria + "/reimprimir", {
    token: loja.token,
    corpo: {},
  });
  assert.equal(primeiro.status, 200);
  assert.notEqual(segundo.status, 200);
  assert.match(String(segundo.corpo && segundo.corpo.erro), /aguarde|reimprimir/i);
  const aposMesmo = (await fila.listar(loja.dir)).filter((j) => Number(j.id) > maxAntesMesmo);
  assert.equal(aposMesmo.length, 1);

  const maxAntesDiferentes = Math.max(0, ...(await fila.listar(loja.dir)).map((j) => Number(j.id) || 0));
  const rA = await app.pedir("/api/caixa/movimento/" + ids.suprimento + "/reimprimir", {
    token: loja.token,
    corpo: {},
  });
  const rB = await app.pedir("/api/caixa/movimento/" + ids.cancelamento + "/reimprimir", {
    token: loja.token,
    corpo: {},
  });
  assert.equal(rA.status, 200);
  assert.equal(rB.status, 200);
  const aposDiferentes = (await fila.listar(loja.dir)).filter((j) => Number(j.id) > maxAntesDiferentes);
  assert.equal(aposDiferentes.length, 2);
});
