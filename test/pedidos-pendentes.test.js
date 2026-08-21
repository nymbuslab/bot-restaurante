const { test } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/db");
const pedidos = require("../src/pedidos");

// ---------------------------------------------------------------------------
// Fila de impressão do cardápio web (o que o agente desktop busca).
//
// O filtro carregava `recebido_em IS NULL` junto com `origem = 'web'`. O
// comentário justificava dizendo que sem ele o PDV Entrega/Retirada, que nasce
// "a receber", cairia aqui — mas `origem = 'web'` já exclui o PDV sozinho, então
// a condição virou redundante e passou a derrubar um caso real: com o agente
// desligado (o computador da impressora apagado, por exemplo), os pedidos se
// acumulam; se o dono receber o pagamento de algum antes de religar, aquele
// pedido some da fila e a comanda NUNCA sai.
//
// Cancelado também não pode imprimir: mandaria a cozinha preparar comida de um
// pedido que não existe mais.
// ---------------------------------------------------------------------------

function espiar(resposta) {
  const calls = [];
  const antes = db.query;
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (/FROM empresas/i.test(sql)) return { rows: [{ id: "emp-uuid" }] };
    return resposta || { rows: [{}] };
  };
  return { calls, restaurar: () => { db.query = antes; } };
}

test("pendentes: pedido web já recebido continua na fila de impressão", async () => {
  const e = espiar();
  try {
    await pedidos.pendentes("/x/slug-impr", "agente-1");
    const q = e.calls.find((c) => /FROM pedidos/i.test(c.sql));
    assert.ok(q, "a consulta da fila precisa existir");
    // Receber o pagamento não pode tirar a comanda da fila.
    assert.doesNotMatch(q.sql, /recebido_em IS NULL/i);
  } finally { e.restaurar(); }
});

test("pendentes: segue restrito ao cardápio web e ao que não foi impresso", async () => {
  const e = espiar();
  try {
    await pedidos.pendentes("/x/slug-impr", "agente-1");
    const q = e.calls.find((c) => /FROM pedidos/i.test(c.sql));
    assert.match(q.sql, /origem = 'web'/i);      // PDV e Mesa têm caminho próprio
    assert.match(q.sql, /impresso_em IS NULL/i); // não reimprime sozinho
  } finally { e.restaurar(); }
});

test("pendentes: pedido cancelado não vai para a impressora", async () => {
  const e = espiar();
  try {
    await pedidos.pendentes("/x/slug-impr", "agente-1");
    const q = e.calls.find((c) => /FROM pedidos/i.test(c.sql));
    assert.match(q.sql, /status <> 'cancelado'/i);
  } finally { e.restaurar(); }
});

// ---------------------------------------------------------------------------
// Indicador de forma de pagamento do Dashboard.
//
// Agrupava por `trim(pedidos.pagamento)`, mas essa coluna guarda o resumo COM o
// valor ("PIX R$ 10,00 · Dinheiro R$ 13,50"), escrito por `receberPedido`,
// `venderLocal` e `finalizarFechamento`. Cada venda virava um grupo de um, então
// a "forma mais usada" mostrava a string de um pedido só, com percentual perto
// de zero. A forma normalizada mora em `caixa_movimentos.forma_pagamento`, que é
// a mesma que a tela do caixa usa.
// ---------------------------------------------------------------------------

test("dashboardRaw: forma de pagamento sai do movimento de caixa, não do texto do pedido", async () => {
  const e = espiar();
  try {
    await pedidos.dashboardRaw("/x/slug-dash");
    const q = e.calls.find((c) => /AS forma/i.test(c.sql));
    assert.ok(q, "a consulta de formas precisa existir");
    assert.match(q.sql, /forma_pagamento/i);
    assert.match(q.sql, /FROM caixa_movimentos/i);
    assert.doesNotMatch(q.sql, /trim\(pagamento\)/i); // a coluna com o valor junto
  } finally { e.restaurar(); }
});

test("dashboardRaw: conta só recebimento e ignora pedido cancelado", async () => {
  const e = espiar();
  try {
    await pedidos.dashboardRaw("/x/slug-dash");
    const q = e.calls.find((c) => /AS forma/i.test(c.sql));
    assert.match(q.sql, /tipo = 'recebimento'/i); // sangria e suprimento não são forma de venda
    assert.match(q.sql, /cancelado/i);
  } finally { e.restaurar(); }
});
