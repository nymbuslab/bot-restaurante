// ---------------------------------------------------------------------------
// COMANDAS ABERTAS — lista, detalhe, acréscimo e pré-conta.
//
// Fixture própria (empresa Plano Completo, 2 itens e caixa aberto) para não
// depender de outra bateria. Cobre as rotas dedicadas de comanda:
//    GET  /api/comandas/abertas
//    GET  /api/comandas/:id
//    POST /api/comandas/:id/itens
//    POST /api/comandas/:id/imprimir-pre-conta
//
// `pedidos` segue como fonte única: a lista é a mesma tabela, filtrada por
// origem pdv + tipo_entrega Comanda + ainda a receber.
// ---------------------------------------------------------------------------

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");
const fila = require("./ajuda/fila");
const db = require("../../src/db");

const ID_COZINHA = 301;
const ID_BEBIDA = 302;
const PRECO_COZINHA = 12;
const PRECO_BEBIDA = 5;

let loja;
let empId;
let comandaAntiga;
let comandaNova;

async function vender(cliente) {
  const r = await app.pedir("/api/pdv/vender", {
    token: loja.token,
    corpo: {
      itens: [{ id: ID_COZINHA, qtd: 1 }],
      tipoEntrega: "Comanda",
      cliente,
    },
  });
  assert.equal(r.status, 200, "falha na venda Comanda: " + JSON.stringify(r.corpo));
  assert.equal(r.corpo.ok, true);
  assert.ok(r.corpo.pedido && r.corpo.pedido.id, "venda devolve o pedido criado");
  return r.corpo.pedido;
}

async function comandasAbertas() {
  const r = await app.pedir("/api/comandas/abertas", { token: loja.token });
  assert.equal(r.status, 200, "falha ao listar comandas: " + JSON.stringify(r.corpo));
  return r.corpo;
}

before(async () => {
  loja = await tenant.criarEmpresa("comandas-abertas", { plano: "completo" });
  await tenant.prepararLoja(loja, {
    cardapio: {
      categorias: [
        {
          nome: "Categoria Comanda",
          ativo: true,
          itens: [
            { id: ID_COZINHA, nome: "Prato de Cozinha", preco: PRECO_COZINHA, disponivel: true, cozinha: true },
            { id: ID_BEBIDA, nome: "Bebida", preco: PRECO_BEBIDA, disponivel: true },
          ],
        },
      ],
      grupos: [],
    },
  });

  const r = await db.query("SELECT id FROM empresas WHERE slug = $1", [loja.slug]);
  empId = r.rows[0].id;

  const abrir = await app.pedir("/api/caixa/abrir", { token: loja.token, corpo: { fundoTroco: 0 } });
  assert.equal(abrir.status, 200, "falha ao abrir o caixa: " + JSON.stringify(abrir.corpo));

  comandaAntiga = await vender("Mesa antiga");
  comandaNova = await vender("Mesa nova");
  // A lista não filtra por data: força uma comanda de dois dias atrás para provar
  // que ela continua visível depois da virada do dia.
  await db.query("UPDATE pedidos SET criado_em = now() - interval '2 days' WHERE id = $1", [comandaAntiga.id]);
});

after(async () => {
  await app.derrubar();
  await tenant.limparTudo();
});

test("T-02.01: lista traz todas as comandas abertas, mais antiga primeiro, sem filtro de data", async () => {
  const corpo = await comandasAbertas();
  const ids = corpo.comandas.map((c) => c.id);

  assert.ok(corpo.comandas.length >= 2, "esperava as duas comandas abertas");
  assert.equal(ids.indexOf(comandaAntiga.id), 0, "a comanda de dois dias atrás vem primeiro");
  assert.ok(ids.indexOf(comandaNova.id) > 0, "a mais recente vem depois");
  assert.ok(new Date(corpo.comandas[0].criadoEm).getTime() < new Date(corpo.comandas[1].criadoEm).getTime(), "ordem crescente por criação");
  for (const c of corpo.comandas) {
    assert.equal(c.origem, "pdv", "só comanda de PDV entra na lista");
    assert.equal(c.tipoEntrega, "Comanda", "só tipo Comanda entra na lista");
    assert.ok(!c.recebidoEm, "recebida não entra na lista");
    assert.notEqual(c.status, "cancelado", "cancelada não entra na lista");
    assert.ok(Array.isArray(c.itens), "a lista já traz os itens (card mostra a contagem)");
  }
});

test("T-02.01: lista devolve o estado operacional do caixa e as permissões por ação", async () => {
  const corpo = await comandasAbertas();
  assert.equal(corpo.operacao.caixaAberto, true, "caixa do teste está aberto");
  assert.equal(corpo.operacao.caixaVencido, false, "caixa do dia");
  const p = corpo.operacao.permissoes;
  assert.equal(p.acrescentar, true, "dono pode acrescentar");
  assert.equal(p.receber, true, "dono pode receber");
  assert.equal(p.imprimir, true, "dono pode imprimir pré-conta");
  assert.equal(p.cancelar, true, "dono pode cancelar");
});

test("T-02.01: detalhe traz itens e total da comanda certa", async () => {
  const r = await app.pedir("/api/comandas/" + comandaAntiga.id, { token: loja.token });
  assert.equal(r.status, 200, "falha no detalhe: " + JSON.stringify(r.corpo));
  assert.equal(r.corpo.comanda.id, comandaAntiga.id);
  assert.equal(r.corpo.comanda.itens.length, 1);
  assert.equal(r.corpo.comanda.total, PRECO_COZINHA);
  assert.equal(r.corpo.operacao.caixaAberto, true);
});

test("T-02.01: detalhe de id inexistente responde 404", async () => {
  const r = await app.pedir("/api/comandas/99999999", { token: loja.token });
  assert.equal(r.status, 404);
  assert.match(String(r.corpo.erro || ""), /não encontrada/i);
});

test("T-02.01: comanda recebida sai da lista e do detalhe (histórico fica em Pedidos)", async () => {
  const receber = await app.pedir("/api/caixa/receber/" + comandaNova.id, {
    token: loja.token,
    corpo: { pagamentos: [{ forma: "Dinheiro", valor: PRECO_COZINHA }] },
  });
  assert.equal(receber.status, 200, "falha ao receber: " + JSON.stringify(receber.corpo));

  const corpo = await comandasAbertas();
  assert.ok(!corpo.comandas.some((c) => c.id === comandaNova.id), "recebida não aparece mais em abertas");

  const detalhe = await app.pedir("/api/comandas/" + comandaNova.id, { token: loja.token });
  assert.equal(detalhe.status, 404, "detalhe de comanda recebida também é 404");

  const pedidos = await app.pedir("/api/pedidos", { token: loja.token });
  assert.equal(pedidos.status, 200);
  assert.ok((pedidos.corpo.pedidos || []).some((p) => p.id === comandaNova.id), "a comanda recebida continua no histórico");
});

test("T-02.02: acrescentar rodada pela rota de Comanda soma itens, total e estoque", async () => {
  const antes = await app.pedir("/api/comandas/" + comandaAntiga.id, { token: loja.token });
  const itensAntes = antes.corpo.comanda.itens.length;

  const r = await app.pedir("/api/comandas/" + comandaAntiga.id + "/itens", {
    token: loja.token,
    corpo: { itens: [{ id: ID_BEBIDA, qtd: 2 }] },
  });
  assert.equal(r.status, 200, "falha ao acrescentar: " + JSON.stringify(r.corpo));
  assert.equal(r.corpo.itens.length, itensAntes + 1, "a rodada entra como novo item");
  assert.equal(r.corpo.total, PRECO_COZINHA + PRECO_BEBIDA * 2, "total soma a rodada");
  assert.equal(r.corpo.recebidoEm, null, "a comanda continua em aberto");

  const depois = await app.pedir("/api/comandas/" + comandaAntiga.id, { token: loja.token });
  assert.equal(depois.corpo.comanda.total, PRECO_COZINHA + PRECO_BEBIDA * 2);

  const cardapio = await app.pedir("/api/cardapio", { token: loja.token });
  const cats = (cardapio.corpo.cardapio || cardapio.corpo).categorias;
  const bebida = cats[0].itens.find((i) => Number(i.id) === ID_BEBIDA);
  assert.equal(Number(bebida.estoque), 8, "estoque da bebida baixou 2 na mesma transação");
});

test("T-02.02: rodada nova enfileira só a via de cozinha dos itens acrescentados", async () => {
  const r = await app.pedir("/api/comandas/" + comandaAntiga.id + "/itens", {
    token: loja.token,
    corpo: { itens: [{ id: ID_COZINHA, qtd: 1 }] },
  });
  assert.equal(r.status, 200, "falha ao acrescentar item de cozinha: " + JSON.stringify(r.corpo));

  const pendentes = await fila.listar(loja.dir);
  const daComanda = pendentes.filter((t) => (t.vias || []).join("\n").includes("#" + comandaAntiga.numero));
  const cozinha = daComanda.filter((t) => t.tipo === "pdv");
  assert.ok(cozinha.length >= 2, "a abertura e a rodada nova têm via de cozinha");
  const ultima = cozinha[cozinha.length - 1].vias.join("\n");
  assert.match(ultima, /Prato de Cozinha/i, "a rodada nova lista o item acrescentado");
  assert.ok(!/Bebida/.test(ultima), "a rodada nova não repete o que a cozinha já preparou");
});

test("T-02.02: caixa fechado recusa acrescentar sem tocar a comanda", async () => {
  await db.query("UPDATE caixas SET status = 'fechado', fechado_em = now() WHERE empresa_id = $1 AND status = 'aberto'", [empId]);

  const antes = await app.pedir("/api/comandas/" + comandaAntiga.id, { token: loja.token });
  const itensAntes = antes.corpo.comanda.itens.length;

  const r = await app.pedir("/api/comandas/" + comandaAntiga.id + "/itens", {
    token: loja.token,
    corpo: { itens: [{ id: ID_BEBIDA, qtd: 1 }] },
  });
  assert.equal(r.status, 400);
  assert.equal(r.corpo.caixaFechado, true, "o front distinguir caixa fechado de erro de rede");
  assert.match(String(r.corpo.erro || ""), /Abra o caixa/i);

  const depois = await app.pedir("/api/comandas/" + comandaAntiga.id, { token: loja.token });
  assert.equal(depois.corpo.comanda.itens.length, itensAntes, "nada foi acrescentado");
});

test("T-02.02: caixa vencido recusa acrescentar com o marcador próprio", async () => {
  await db.query(
    "UPDATE caixas SET status = 'aberto', aberto_em = now() - interval '2 days', fechado_em = NULL WHERE empresa_id = $1 AND status = 'fechado'",
    [empId]
  );

  const r = await app.pedir("/api/comandas/" + comandaAntiga.id + "/itens", {
    token: loja.token,
    corpo: { itens: [{ id: ID_BEBIDA, qtd: 1 }] },
  });
  assert.equal(r.status, 400);
  assert.equal(r.corpo.caixaVencido, true);
  assert.match(String(r.corpo.erro || ""), /caixa do dia anterior/i);
});

test("T-02.03: pré-conta enfileira só a via da pré-conta, mesmo com o caixa vencido", async () => {
  const antes = await fila.listar(loja.dir);
  const pdvAntes = antes.filter((t) => t.tipo === "pdv").length;

  const r = await app.pedir("/api/comandas/" + comandaAntiga.id + "/imprimir-pre-conta", {
    token: loja.token,
    corpo: {},
  });
  assert.equal(r.status, 200, "falha na pré-conta: " + JSON.stringify(r.corpo));
  assert.equal(r.corpo.ok, true);

  const depois = await fila.listar(loja.dir);
  const novas = depois.slice(antes.length);
  assert.equal(novas.filter((t) => t.tipo === "pdv").length, 0, "pré-conta não gera via de cozinha");
  assert.equal(depois.filter((t) => t.tipo === "pdv").length, pdvAntes, "nenhuma via de cozinha nova");

  const preConta = novas.filter((t) => t.tipo === "comanda-pre-conta");
  assert.equal(preConta.length, 1, "exatamente uma via de pré-conta");
  const texto = preConta[0].vias.join("\n");
  assert.match(texto, /PR..CONTA/, "a via se identifica como pré-conta");
  assert.ok(texto.includes("Comanda: " + comandaAntiga.numero), "a via traz o número da comanda");
  assert.match(texto, /TOTAL:/, "a via traz o total");
});

test("T-02.03: pré-conta de comanda recebida responde 404", async () => {
  const r = await app.pedir("/api/comandas/" + comandaNova.id + "/imprimir-pre-conta", { token: loja.token, corpo: {} });
  assert.equal(r.status, 404);
});

test("T-02.01: empresa sem Plano Completo recebe 403 na lista (gate do plano)", async () => {
  const simples = await tenant.criarEmpresa("comandas-sem-plano", { plano: "essencial" });
  const r = await app.pedir("/api/comandas/abertas", { token: simples.token });
  assert.equal(r.status, 403, "sem PDV/Plano Completo a lista não abre");
});
