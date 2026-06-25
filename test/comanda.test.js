const { test } = require("node:test");
const assert = require("node:assert/strict");
const { montarComanda } = require("../public/comanda.js");

const config = { restaurante: { nome: "Pizzaria do João" } };

const pedidoBase = {
  numero: 123,
  criadoEm: "2026-06-20T17:35:00.000Z", // 14:35 BRT
  cliente: "João Silva",
  telefone: "11987654321",
  tipoEntrega: "Entrega",
  endereco: "Rua X, 42, apto 101",
  pagamento: "Pix",
  taxaEntrega: 5.5,
  total: 60.5,
  observacao: "entrega rápida",
  itens: [
    { nome: "Burger X", preco: 25, qtd: 2,
      opcionais: [{ grupo: "Adicionais", nome: "Bacon", preco: 3, qtd: 1 }, { grupo: "Adicionais", nome: "Queijo Extra", preco: 2.5, qtd: 2 }],
      observacao: "sem cebola" },
    { nome: "Refrigerante", preco: 5, qtd: 1, opcionais: [], observacao: "" },
  ],
};

test("via cozinha: tem cabeçalho, número, itens e observações — SEM preços", () => {
  const { cozinha } = montarComanda(pedidoBase, config);
  assert.match(cozinha, /PIZZARIA DO JOÃO/i);
  assert.match(cozinha, /COZINHA/i);
  assert.match(cozinha, /#123/);
  assert.match(cozinha, /2x Burger X/);
  assert.match(cozinha, /Bacon/);
  assert.match(cozinha, /2x Queijo Extra/);
  assert.match(cozinha, /Adicionais: Bacon, 2x Queijo Extra/); // escolhas agrupadas por grupo
  assert.match(cozinha, /sem cebola/);
  assert.match(cozinha, /entrega rápida/);
  assert.equal(/R\$/.test(cozinha), false, "via cozinha não deve ter preços");
});

test("via cupom: tem cliente, endereço, pagamento, taxa e total", () => {
  const { cupom } = montarComanda(pedidoBase, config);
  assert.match(cupom, /CUPOM/i);
  assert.match(cupom, /João Silva/);
  assert.match(cupom, /Rua X, 42/);
  assert.match(cupom, /Pix/);
  assert.match(cupom, /5,50/);   // taxa
  assert.match(cupom, /60,50/);  // total
});

test("cupom: cabeçalho traz endereço e telefone da empresa", () => {
  const cfg = { restaurante: { nome: "Pizzaria do João", endereco: "Rua das Flores, 100 - Centro", telefone: "(47) 99999-9999" } };
  const { cupom } = montarComanda(pedidoBase, cfg);
  assert.match(cupom, /Rua das Flores, 100 - Centro/);
  assert.match(cupom, /Tel: \(47\) 99999-9999/);
});

test("cupom: CEP sai do endereço e vai pra mesma linha do telefone", () => {
  const cfg = { restaurante: { nome: "X", endereco: "Rua das Flores, 100 - Centro - Ribeirão Preto/SP · CEP 14021-520", telefone: "16997636045" } };
  const { cupom } = montarComanda(pedidoBase, cfg);
  // CEP e Tel na mesma linha
  assert.match(cupom, /CEP 14021-520 {2}Tel: 16997636045/);
  // a linha do endereço (rua) não repete o CEP
  const linhaRua = cupom.split("\n").find((l) => /Rua das Flores/.test(l));
  assert.equal(/CEP/.test(linhaRua), false, "o CEP não deve ficar na linha do endereço");
});

test("cupom: rodapé usa mensagem padrão quando não há config", () => {
  const { cupom } = montarComanda(pedidoBase, config);
  assert.match(cupom, /Obrigado pela preferência! Volte sempre\./);
});

test("cupom: rodapé usa a mensagem personalizada do tenant", () => {
  const cfg = { restaurante: { nome: "X" }, impressao: { rodape: "Siga @pizzaria no Insta" } };
  const { cupom } = montarComanda(pedidoBase, cfg);
  assert.match(cupom, /Siga @pizzaria no Insta/);
  assert.equal(/Volte sempre/.test(cupom), false);
});

test("cupom: inclui o link do cardápio sem o https:// quando passado em extras", () => {
  const { cupom } = montarComanda(pedidoBase, config, { linkCardapio: "https://pedidos.exemplo.com/c/pizzaria-joao" });
  assert.match(cupom, /cardápio digital/i);
  assert.match(cupom, /pedidos\.exemplo\.com\/c\/pizzaria-joao/);
  assert.equal(/https:\/\//.test(cupom), false);
});

test("retirada: via cozinha marca RETIRADA e cupom omite endereço", () => {
  const ped = { ...pedidoBase, tipoEntrega: "Retirada", endereco: "" };
  const { cozinha, cupom } = montarComanda(ped, config);
  assert.match(cozinha, /RETIRADA/i);
  assert.equal(/End:/.test(cupom), false);
});

test("taxa 0: cupom omite a linha de taxa mas mantém o total", () => {
  const ped = { ...pedidoBase, taxaEntrega: 0, total: 55 };
  const { cupom } = montarComanda(ped, config);
  assert.equal(/Taxa/i.test(cupom), false);
  assert.match(cupom, /55,00/);
});

test("item sem opcionais/observação: 1 linha, sem 'Obs'", () => {
  const ped = { ...pedidoBase, itens: [{ nome: "Coca", preco: 5, qtd: 1, opcionais: [], observacao: "" }] };
  const { cozinha } = montarComanda(ped, config);
  assert.match(cozinha, /1x Coca/);
  assert.equal(/Obs:/.test(cozinha), false);
});

test("nome de item muito longo: a linha do preço não passa de 48 colunas (alinhamento preservado)", () => {
  const ped = { ...pedidoBase, itens: [{ nome: "X".repeat(60), preco: 10, qtd: 1, opcionais: [], observacao: "" }] };
  const { cupom } = montarComanda(ped, config);
  const linha = cupom.split("\n").find((l) => /10,00/.test(l));
  assert.ok(linha && linha.length <= 48, "linha do preço passou de 48: " + (linha && linha.length));
});

test("pedido sem itens: não gera dois separadores colados (mostra '(sem itens)')", () => {
  const ped = { ...pedidoBase, itens: [] };
  const { cozinha, cupom } = montarComanda(ped, config);
  assert.match(cozinha, /\(sem itens\)/);
  assert.match(cupom, /\(sem itens\)/);
});
