const { test } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/db"); // stubado abaixo: nenhum teste aqui toca o banco real
const mesasDb = require("../src/mesas-db");

// mesasDb.empresaId resolve o slug via db.query (fora da transação, cacheado por
// slug). Stub para nunca sair do processo — o .env local aponta pra produção.
db.query = async () => ({ rows: [{ id: "emp-uuid" }] });

// Client fake: registra as queries e devolve respostas canned (sem tocar o banco).
function fakeClient(respostas) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      for (const [re, resposta] of respostas) {
        if (re.test(sql)) return typeof resposta === "function" ? resposta(params) : resposta;
      }
      return { rows: [] };
    },
  };
}

test("lancarItens: mesa com pedido aberto acumula os itens e devolve o id/numero existentes", async () => {
  const c = fakeClient([
    [/SELECT status FROM mesas/i, { rows: [{ status: "ocupada" }] }],
    [/SELECT p.id, p.numero, p.itens, p.total/i, { rows: [{ id: 42, numero: 7, itens: [{ nome: "Espeto" }], total: 20 }] }],
  ]);
  const pedido = await mesasDb.lancarItens(
    "/x/slug-mesa-a", 1,
    { itens: [{ nome: "Refri" }], total: 8, cliente: "Mesa 1" },
    c
  );
  assert.deepEqual(pedido, { id: 42, numero: 7 }); // pedido JÁ existente, não um novo
  // Busca por conteúdo, não por índice: a função ganhou uma trava na frente e
  // asserção por posição quebra a cada pré-condição nova.
  assert.ok(c.calls.find((q) => /SELECT p\.id, p\.numero, p\.itens, p\.total/i.test(q.sql)));
  const acumulou = c.calls.find((q) => /UPDATE pedidos SET itens/i.test(q.sql));
  assert.ok(acumulou, "acumula na mesma linha");
  assert.equal(acumulou.params[2], 42); // WHERE id = <pedido existente>
  assert.equal(c.calls.filter((q) => /INSERT INTO pedidos/i.test(q.sql)).length, 0);
});

test("lancarItens: mesa sem pedido aberto insere um novo e devolve o id/numero gerados", async () => {
  const c = fakeClient([
    [/SELECT status FROM mesas/i, { rows: [{ status: "ocupada" }] }],
    [/SELECT p.id, p.numero, p.itens, p.total/i, { rows: [] }], // nenhum pedido aberto
    [/INSERT INTO pedidos/i, { rows: [{ id: 55, numero: 3 }] }],
  ]);
  const pedido = await mesasDb.lancarItens(
    "/x/slug-mesa-b", 2,
    { itens: [{ nome: "Espeto" }], total: 12, cliente: "Mesa 2" },
    c
  );
  assert.deepEqual(pedido, { id: 55, numero: 3 }); // pedido NOVO
  assert.ok(c.calls.find((q) => /INSERT INTO pedidos[\s\S]*RETURNING id, numero/i.test(q.sql)));
});

// ---------------------------------------------------------------------------
// Fronteira de sessão da mesa. Um pedido que ficou sem receber numa sessão antiga
// não pode reaparecer para o próximo cliente: era o bug em que a mesa livre
// mostrava R$ 24,00 de consumo e a rodada nova ia parar DENTRO daquele pedido.
// Os testes olham a SQL emitida, porque é lá que o recorte vive.
// ---------------------------------------------------------------------------

// Casa o predicado de sessão em qualquer uma das consultas.
const RECORTE = /m\.aberta_em IS NOT NULL AND p\.criado_em >= m\.aberta_em/i;

// Captura as queries feitas via db.query (fora de transação).
function espiarDbQuery(resposta) {
  const calls = [];
  const antes = db.query;
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (/FROM empresas/i.test(sql)) return { rows: [{ id: "emp-uuid" }] };
    return typeof resposta === "function" ? resposta(sql, params) : (resposta || { rows: [] });
  };
  return { calls, restaurar: () => { db.query = antes; } };
}

test("pedidosDaMesa: a conta da mesa só enxerga pedido da sessão atual", async () => {
  const espiao = espiarDbQuery({ rows: [] });
  try {
    await mesasDb.pedidosDaMesa("/x/slug-sessao-1", 16);
    const q = espiao.calls.find((c) => /FROM pedidos p/i.test(c.sql));
    assert.ok(q, "a consulta da conta precisa existir");
    assert.match(q.sql, RECORTE);
    assert.match(q.sql, /JOIN mesas m/i); // sem o join não há aberta_em para comparar
  } finally { espiao.restaurar(); }
});

test("listar: o alerta de mesa parada se data pela sessão, não por sobra antiga", async () => {
  const espiao = espiarDbQuery({ rows: [] });
  try {
    await mesasDb.listar("/x/slug-sessao-2");
    const q = espiao.calls.find((c) => /ultimo_pedido_em/i.test(c.sql));
    assert.match(q.sql, RECORTE);
  } finally { espiao.restaurar(); }
});

test("lancarItens: a rodada nova nunca é acumulada num pedido de sessão anterior", async () => {
  const c = fakeClient([[/SELECT status FROM mesas/i, { rows: [{ status: "ocupada" }] }],
                        [/SELECT p\.id, p\.numero, p\.itens, p\.total/i, { rows: [] }],
                        [/INSERT INTO pedidos/i, { rows: [{ id: 9, numero: 1 }] }]]);
  await mesasDb.lancarItens("/x/slug-sessao-3", 16, { itens: [{ nome: "Coca" }], total: 3, cliente: "Mesa 01" }, c);
  const busca = c.calls.find((q) => /SELECT p\.id, p\.numero, p\.itens, p\.total/i.test(q.sql));
  assert.match(busca.sql, RECORTE);           // a busca do pedido a reusar é recortada
});

test("lancarItens: o consumo da mesa soma só a sessão atual", async () => {
  const c = fakeClient([[/SELECT status FROM mesas/i, { rows: [{ status: "ocupada" }] }],
                        [/SELECT p\.id, p\.numero, p\.itens, p\.total/i, { rows: [] }],
                        [/INSERT INTO pedidos/i, { rows: [{ id: 9, numero: 1 }] }]]);
  await mesasDb.lancarItens("/x/slug-sessao-4", 16, { itens: [{ nome: "Coca" }], total: 3, cliente: "Mesa 01" }, c);
  const rec = c.calls.find((q) => /UPDATE mesas m SET total_consumido/i.test(q.sql));
  assert.ok(rec, "o recálculo do consumo precisa acontecer");
  assert.match(rec.sql, RECORTE);
});

test("vincularPedido: o recálculo do consumo usa o mesmo recorte", async () => {
  const c = fakeClient([]);
  await mesasDb.vincularPedido("/x/slug-sessao-5", 16, 1, c);
  assert.match(c.calls[0].sql, /UPDATE mesas m SET total_consumido/i);
  assert.match(c.calls[0].sql, RECORTE);
});

// ---------------------------------------------------------------------------
// Transferir para mesa OCUPADA sem comanda aberta.
//
// Regressão introduzida junto com a fronteira de sessão: o recuo do `aberta_em`
// do destino estava preso a `status = 'livre'`. Mesa aberta às 21h que ainda não
// pediu nada não é "livre", então o recuo não acontecia; os pedidos movidos,
// criados às 20h na origem, caíam FORA da janela do destino e a conta inteira
// sumia — `total_consumido` zerava, o painel não listava nada e a origem era
// liberada. Cliente trocando de mesa perdia o consumo.
// ---------------------------------------------------------------------------

// `transferir` abre a própria conexão (db.pool.connect), então o client fake tem
// que entrar por aí — passar como argumento não alcança. Sem este stub o teste
// sai falando com o banco de PRODUÇÃO, que é o que o .env local aponta.
function comPoolFake(respostas, fn) {
  const c = fakeClient(respostas);
  const antes = db.pool;
  db.pool = { connect: async () => Object.assign(c, { release() {} }) };
  return fn(c).finally(() => { db.pool = antes; });
}

test("transferir: o destino recua a abertura mesmo estando ocupado", async () => {
  const antigo = new Date("2026-08-20T20:00:00.000Z");
  await comPoolFake([
    [/SELECT nome FROM mesas/i, { rows: [{ nome: "05" }] }],
    [/SELECT p\.id, p\.itens, p\.total, p\.criado_em/i, { rows: [{ id: 7, itens: [], total: 30, criado_em: antigo }] }],
  ], async (c) => {
    await mesasDb.transferir("/x/slug-transf", 1, 2, []);
    const up = c.calls.find((q) => /UPDATE mesas SET[\s\S]*aberta_em/i.test(q.sql) && /LEAST/i.test(q.sql));
    assert.ok(up, "o destino precisa ter o UPDATE que recua a abertura");
    // O filtro do WHERE era o bug; o CASE no SET e o comportamento desejado.
    assert.doesNotMatch(up.sql.split(/WHERE/i)[1], /status/i);
    assert.equal(up.params[2], antigo);                 // recua ate o pedido mais antigo movido
    assert.match(up.sql, /CASE WHEN status = 'livre'/i); // so promove quem estava livre
  });
});

test("transferir: no merge nao recua a abertura do destino", async () => {
  await comPoolFake([
    [/SELECT nome FROM mesas/i, { rows: [{ nome: "05" }] }],
    [/SELECT p\.id, p\.itens, p\.total, p\.criado_em/i, { rows: [{ id: 7, itens: [], total: 30, criado_em: new Date("2026-08-20T20:00:00.000Z") }] }],
    // destino JA tem comanda aberta: os itens sao fundidos nela e as linhas movidas apagadas
    [/SELECT p\.id, p\.itens, p\.total\s+FROM pedidos p/i, { rows: [{ id: 99, itens: [], total: 10 }] }],
  ], async (c) => {
    await mesasDb.transferir("/x/slug-merge", 1, 2, []);
    const up = c.calls.find((q) => /UPDATE mesas SET[\s\S]*aberta_em/i.test(q.sql) && /LEAST/i.test(q.sql));
    // Recuar no merge so ampliaria a janela e poderia ressuscitar sobra antiga.
    assert.equal(up.params[2], null);
  });
});

// ---------------------------------------------------------------------------
// Fechar a conta não pode quitar pedido CANCELADO.
//
// O UPDATE filtrava só por `recebido_em IS NULL`, e pedido cancelado também tem
// esse campo nulo. Resultado: um item cancelado durante a sessão (o cliente
// desistiu, veio errado da cozinha) ganhava `recebido_em` e o resumo de
// pagamento no fechamento, entrando no faturamento sem dinheiro ter entrado. E o
// `estornarRecebimento` se recusa a consertar depois, porque enxerga um pedido
// cancelado — o número errado fica no relatório para sempre.
// ---------------------------------------------------------------------------

test("finalizarFechamento: não marca pedido cancelado como recebido", async () => {
  await comPoolFake([
    [/SELECT id, status, aberta_em FROM mesas/i, { rows: [{ id: 1, status: "ocupada", aberta_em: new Date("2026-08-20T18:00:00.000Z") }] }],
    [/SELECT forma_pagamento AS forma/i, { rows: [{ forma: "PIX", total: 30 }] }],
    [/UPDATE mesas SET status = 'livre'/i, { rows: [{ id: 1, nome: "01", status: "livre", taxa_servico: 0, pessoas: 1, total_consumido: 0 }] }],
  ], async (c) => {
    await mesasDb.finalizarFechamento("/x/slug-fech", 1, [{ forma: "PIX", valor: 30 }], "01");
    const up = c.calls.find((q) => /UPDATE pedidos SET recebido_em/i.test(q.sql));
    assert.ok(up, "o fechamento precisa quitar os pedidos da sessão");
    assert.match(up.sql, /status <> 'cancelado'/i);
  });
});

test("cancelar: recusa mesa que já tem pagamento registrado no caixa", async () => {
  await comPoolFake([
    [/SELECT id, status, aberta_em FROM mesas/i, { rows: [{ id: 1, status: "ocupada", aberta_em: new Date("2026-08-20T18:00:00.000Z") }] }],
    [/SELECT COALESCE\(SUM\(valor\), 0\) AS total/i, { rows: [{ total: 20 }] }],
  ], async (c) => {
    await assert.rejects(
      () => mesasDb.cancelar("/x/slug-cancelar-pago", 1, {}),
      /pagamento registrado|divergência no caixa/i
    );
    assert.equal(c.calls.filter((q) => /UPDATE pedidos SET status = 'cancelado'/i.test(q.sql)).length, 0);
    assert.equal(c.calls.filter((q) => /UPDATE mesas SET status = 'livre'/i.test(q.sql)).length, 0);
  });
});

test("cancelarItem: recusa item quando o total ficaria menor que o já recebido", async () => {
  await comPoolFake([
    [/SELECT id, status, aberta_em FROM mesas/i, { rows: [{ id: 1, status: "ocupada", aberta_em: new Date("2026-08-20T18:00:00.000Z") }] }],
    [/SELECT p\.id, p\.numero, p\.itens/i, { rows: [{ id: 9, numero: 4, itens: [{ nome: "Prato", preco: 30, qtd: 1 }] }] }],
    [/FROM caixa_movimentos/i, { rows: [{ total: 20 }] }],
    [/SUM\(CASE WHEN p\.id = \$3/i, { rows: [{ total: 0 }] }],
  ], async (c) => {
    await assert.rejects(
      () => mesasDb.cancelarItem("/x/slug-item-pago", 1, 9, 0, {}),
      /menor que o valor já recebido/i
    );
    assert.equal(c.calls.filter((q) => /UPDATE pedidos SET itens/i.test(q.sql)).length, 0);
    assert.equal(c.calls.filter((q) => /UPDATE pedidos SET itens='\\[\\]'::jsonb/i.test(q.sql)).length, 0);
  });
});

// ---------------------------------------------------------------------------
// Lançar rodada tem que travar a mesa e reconferir o status.
//
// A rota checa o status ANTES de abrir a transação, e `lancarItens` não travava
// nem reconferia. Entre a checagem e o INSERT cabe um `finalizarFechamento`
// inteiro: a rodada nasce presa a uma mesa que já voltou a livre, com
// `criado_em` posterior ao `aberta_em` que foi zerado. O pedido não aparece no
// painel da mesa, não entra em conta nenhuma e nunca é recebido — some do
// sistema levando junto a baixa de estoque que a rota já fez.
// ---------------------------------------------------------------------------

test("lancarItens: trava a mesa e recusa quando ela já não está ocupada", async () => {
  const c = fakeClient([
    [/SELECT status FROM mesas[\s\S]*FOR UPDATE/i, { rows: [{ status: "livre" }] }],
  ]);
  await assert.rejects(
    () => mesasDb.lancarItens("/x/slug-corrida", 1, { itens: [{ nome: "Coca" }], total: 3, cliente: "Mesa 1" }, c),
    /fechad|livre|não está/i
  );
  assert.match(c.calls[0].sql, /FOR UPDATE/i);
  assert.equal(c.calls.filter((q) => /INSERT INTO pedidos/i.test(q.sql)).length, 0);
});

test("lancarItens: mesa ocupada segue lançando normalmente", async () => {
  const c = fakeClient([
    [/SELECT status FROM mesas[\s\S]*FOR UPDATE/i, { rows: [{ status: "ocupada" }] }],
    [/SELECT p\.id, p\.numero, p\.itens, p\.total/i, { rows: [] }],
    [/INSERT INTO pedidos/i, { rows: [{ id: 77, numero: 4 }] }],
  ]);
  const pedido = await mesasDb.lancarItens("/x/slug-ok", 1, { itens: [{ nome: "Coca" }], total: 3, cliente: "Mesa 1" }, c);
  assert.deepEqual(pedido, { id: 77, numero: 4 });
});
