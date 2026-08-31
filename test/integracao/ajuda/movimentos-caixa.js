require("./ambiente");

async function configurarComprovantes(app, loja, caixa) {
  const cfgResp = await app.pedir("/api/config", { token: loja.token });
  if (cfgResp.status !== 200) throw new Error("Falha ao ler config: " + JSON.stringify(cfgResp.corpo));
  const cfg = cfgResp.corpo || {};
  cfg.impressao = Object.assign({}, cfg.impressao, { caixa });
  const salvar = await app.pedir("/api/config", { token: loja.token, metodo: "PUT", corpo: cfg });
  if (salvar.status !== 200) throw new Error("Falha ao salvar config: " + JSON.stringify(salvar.corpo));
}

async function criarPedido(app, loja, { idItem, preco }) {
  const novo = await app.pedir("/api/c/" + loja.slug + "/pedido", {
    corpo: {
      cliente: "Cliente Fixture",
      telefone: "11999990001",
      tipoEntrega: "Retirada",
      pagamento: "Dinheiro",
      itens: [{ id: idItem, qtd: 1 }],
    },
  });
  if (novo.status !== 200) throw new Error("Falha ao criar pedido: " + JSON.stringify(novo.corpo));
  const lista = await app.pedir("/api/pedidos", { token: loja.token });
  if (lista.status !== 200) throw new Error("Falha ao listar pedidos: " + JSON.stringify(lista.corpo));
  const pedidos = Array.isArray(lista.corpo) ? lista.corpo : lista.corpo.pedidos || [];
  const pedido = pedidos.find((p) => Number(p.numero) === Number(novo.corpo.numero));
  if (!pedido || !pedido.id) throw new Error("Pedido criado nao apareceu na lista.");
  return Object.assign({}, pedido, { total: Number(preco) || Number(pedido.total) || 0 });
}

async function criarComComprovante(app, loja, opcoes = {}) {
  await configurarComprovantes(app, loja, { suprimento: true, sangria: true, cancelamento: true });

  const suprimento = await app.pedir("/api/caixa/movimento", {
    token: loja.token,
    corpo: { tipo: "suprimento", valor: 4, descricao: "Fixture suprimento" },
  });
  if (suprimento.status !== 200) throw new Error("Falha no suprimento: " + JSON.stringify(suprimento.corpo));

  const sangria = await app.pedir("/api/caixa/movimento", {
    token: loja.token,
    corpo: { tipo: "sangria", valor: 3, descricao: "Fixture sangria" },
  });
  if (sangria.status !== 200) throw new Error("Falha na sangria: " + JSON.stringify(sangria.corpo));

  const pedido = await criarPedido(app, loja, opcoes);
  const receber = await app.pedir("/api/caixa/receber/" + pedido.id, {
    token: loja.token,
    corpo: { forma: "Dinheiro", valor: Number(opcoes.preco) || Number(pedido.total) || 0 },
  });
  if (receber.status !== 200) throw new Error("Falha ao receber pedido: " + JSON.stringify(receber.corpo));

  const cancelar = await app.pedir("/api/pedidos/" + pedido.id + "/cancelar", {
    token: loja.token,
    corpo: { devolver: true },
  });
  if (cancelar.status !== 200) throw new Error("Falha ao cancelar pedido: " + JSON.stringify(cancelar.corpo));

  const caixa = await app.pedir("/api/caixa", { token: loja.token });
  if (caixa.status !== 200) throw new Error("Falha ao ler caixa: " + JSON.stringify(caixa.corpo));
  const cancelamento = (caixa.corpo.movimentos || []).find((m) =>
    m.tipo === "cancelamento" && Number(m.pedidoId) === Number(pedido.id)
  );
  if (!cancelamento || !cancelamento.id) throw new Error("Cancelamento da fixture nao apareceu no extrato.");

  return {
    sangria: Number(sangria.corpo.id),
    suprimento: Number(suprimento.corpo.id),
    cancelamento: Number(cancelamento.id),
  };
}

module.exports = { criarComComprovante };
