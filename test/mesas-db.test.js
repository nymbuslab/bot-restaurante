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
    [/SELECT p.id, p.numero, p.itens, p.total/i, { rows: [{ id: 42, numero: 7, itens: [{ nome: "Espeto" }], total: 20 }] }],
  ]);
  const pedido = await mesasDb.lancarItens(
    "/x/slug-mesa-a", 1,
    { itens: [{ nome: "Refri" }], total: 8, cliente: "Mesa 1" },
    c
  );
  assert.deepEqual(pedido, { id: 42, numero: 7 }); // pedido JÁ existente, não um novo
  assert.match(c.calls[0].sql, /SELECT p\.id, p\.numero, p\.itens, p\.total/i);
  assert.match(c.calls[1].sql, /UPDATE pedidos SET itens/i); // acumula na mesma linha
  assert.equal(c.calls[1].params[2], 42); // WHERE id = <pedido existente>
  assert.equal(c.calls.filter((q) => /INSERT INTO pedidos/i.test(q.sql)).length, 0);
});

test("lancarItens: mesa sem pedido aberto insere um novo e devolve o id/numero gerados", async () => {
  const c = fakeClient([
    [/SELECT p.id, p.numero, p.itens, p.total/i, { rows: [] }], // nenhum pedido aberto
    [/INSERT INTO pedidos/i, { rows: [{ id: 55, numero: 3 }] }],
  ]);
  const pedido = await mesasDb.lancarItens(
    "/x/slug-mesa-b", 2,
    { itens: [{ nome: "Espeto" }], total: 12, cliente: "Mesa 2" },
    c
  );
  assert.deepEqual(pedido, { id: 55, numero: 3 }); // pedido NOVO
  assert.match(c.calls[1].sql, /INSERT INTO pedidos[\s\S]*RETURNING id, numero/i);
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
  const c = fakeClient([[/SELECT p\.id, p\.numero, p\.itens, p\.total/i, { rows: [] }],
                        [/INSERT INTO pedidos/i, { rows: [{ id: 9, numero: 1 }] }]]);
  await mesasDb.lancarItens("/x/slug-sessao-3", 16, { itens: [{ nome: "Coca" }], total: 3, cliente: "Mesa 01" }, c);
  assert.match(c.calls[0].sql, RECORTE);       // a busca do pedido a reusar é recortada
});

test("lancarItens: o consumo da mesa soma só a sessão atual", async () => {
  const c = fakeClient([[/SELECT p\.id, p\.numero, p\.itens, p\.total/i, { rows: [] }],
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
