// ---------------------------------------------------------------------------
// OBSERVAÇÃO DE ITEM DE COZINHA — PDV avulso e Mesa (D-07).
//
// Um item marcado como "Imprime na cozinha" (item.cozinha === true) sem grupo de
// complemento, vendido pelo PDV avulso ou lançado numa mesa, com uma observação
// digitada, precisa exibir essa observação literalmente na via da cozinha que vai
// para a fila de impressão. A via é montada no servidor (Comanda.montarCozinha)
// e enfileirada em impressao_fila — é o texto que a impressora efetivamente imprime.
// ---------------------------------------------------------------------------

require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const app = require("./ajuda/app");
const tenant = require("./ajuda/tenant");
const fila = require("./ajuda/fila");

const PRECO = 10;
const ID_ITEM = 101;

let loja;
let mesaId;

before(async () => {
  loja = await tenant.criarEmpresa("cozinha-obs", { plano: "completo" });
  await tenant.prepararLoja(loja, {
    cardapio: {
      categorias: [
        {
          nome: "Categoria do Teste",
          ativo: true,
          itens: [
            {
              id: ID_ITEM,
              nome: "Marmitex",
              preco: PRECO,
              disponivel: true,
              // `cozinha` é EXATAMENTE a flag que decide se o item gera via de cozinha.
              cozinha: true,
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

async function filaCozinhaPendente() {
  const pendentes = await fila.listar(loja.dir);
  return pendentes.filter((t) => t.tipo === "pdv" || t.tipo === "mesa-cozinha");
}

test("PDV avulso: venda de item de cozinha com observação enfileira via com 'Obs:'", async () => {
  const abrir = await app.pedir("/api/caixa/abrir", { token: loja.token, corpo: { fundoTroco: 0 } });
  assert.equal(abrir.status, 200, "falha ao abrir o caixa: " + JSON.stringify(abrir.corpo));

  const r = await app.pedir("/api/pdv/vender", {
    token: loja.token,
    corpo: {
      itens: [{ id: ID_ITEM, qtd: 1, observacao: "sem cebola" }],
      tipoEntrega: "Balcão",
      pagamentos: [{ forma: "Dinheiro", valor: PRECO }],
    },
  });
  assert.equal(r.status, 200, "falha na venda do PDV: " + JSON.stringify(r.corpo));

  const pendentes = await filaCozinhaPendente();
  const cozinha = pendentes.filter((t) => t.tipo === "pdv");
  assert.equal(cozinha.length, 1, "a venda de item de cozinha deveria ter enfileirado 1 via de cozinha");
  const texto = cozinha[0].vias.join("\n");
  assert.match(texto, /Obs:\s*sem cebola/i, "a via da cozinha precisava trazer a observação: " + texto);
});

test("Mesa: lançar item de cozinha com observação enfileira via com 'Obs:'", async () => {
  const criar = await app.pedir("/api/mesas/config", {
    token: loja.token,
    corpo: { nomes: ["Mesa Obs"], taxaServico: 0 },
  });
  assert.equal(criar.status, 200, "falha ao criar mesa: " + JSON.stringify(criar.corpo));

  const lista = await (async () => {
    const r = await app.pedir("/api/mesas", { token: loja.token });
    assert.equal(r.status, 200);
    return Array.isArray(r.corpo) ? r.corpo : r.corpo.mesas || [];
  })();
  mesaId = lista[0].id;

  const abrir = await app.pedir("/api/mesas/" + mesaId + "/abrir", { token: loja.token, corpo: { pessoas: 2 } });
  assert.equal(abrir.status, 200, "falha ao abrir a mesa: " + JSON.stringify(abrir.corpo));

  const lancar = await app.pedir("/api/mesas/" + mesaId + "/pedido", {
    token: loja.token,
    corpo: { itens: [{ id: ID_ITEM, qtd: 2, observacao: "ponto da carne" }] },
  });
  assert.equal(lancar.status, 200, "falha ao lançar na mesa: " + JSON.stringify(lancar.corpo));

  const pendentes = await filaCozinhaPendente();
  const cozinha = pendentes.filter((t) => t.tipo === "mesa-cozinha");
  assert.equal(cozinha.length, 1, "a rodada de mesa com item de cozinha deveria ter enfileirado 1 via de cozinha");
  const texto = cozinha[0].vias.join("\n");
  assert.match(texto, /Obs:\s*ponto da carne/i, "a via da cozinha da mesa precisava trazer a observação: " + texto);
});
