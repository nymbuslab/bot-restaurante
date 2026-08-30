require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");

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

async function fila() {
  const r = await app.pedir("/api/agente/fila?agente=teste-caixa", { token: loja.token });
  assert.equal(r.status, 200, "falha ao ler fila: " + JSON.stringify(r.corpo));
  return r.corpo;
}

test("comprovantes do caixa respeitam configuracao por tipo", async () => {
  await abrirCaixa();

  const semConfig = await app.pedir("/api/caixa/movimento", {
    token: loja.token,
    corpo: { tipo: "suprimento", valor: 20, descricao: "Troco extra" },
  });
  assert.equal(semConfig.status, 200, "falha no suprimento sem config: " + JSON.stringify(semConfig.corpo));
  assert.equal((await fila()).length, 0, "config padrao desligada nao deve imprimir");

  await configurarComprovantes({ suprimento: true, sangria: true, cancelamento: true });

  const suprimento = await app.pedir("/api/caixa/movimento", {
    token: loja.token,
    corpo: { tipo: "suprimento", valor: 15, descricao: "Reforco de troco" },
  });
  assert.equal(suprimento.status, 200, "falha no suprimento: " + JSON.stringify(suprimento.corpo));

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

  const trabalhos = await fila();
  assert.equal(trabalhos.length, 3, "deveria enfileirar um comprovante por acao configurada");
  assert.deepEqual(trabalhos.map((j) => j.tipo), ["caixa-comprovante", "caixa-comprovante", "caixa-comprovante"]);
  const textos = trabalhos.map((j) => j.vias.join("\n"));
  assert.match(textos[0], /SUPRIMENTO[\s\S]*Valor\s+R\$ 15,00/);
  assert.match(textos[1], /SANGRIA[\s\S]*Valor\s+- R\$ 5,00/);
  assert.match(textos[2], /CANCELAMENTO[\s\S]*Pedido #[0-9]+[\s\S]*Valor\s+- R\$ 12,00/);
});
