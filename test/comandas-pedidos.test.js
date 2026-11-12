"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const db = require("../src/db");
const pedidos = require("../src/pedidos");

function linha(patch) {
  return Object.assign({
    id: 1, numero: 33, status: "novo", cliente: "Balcão", telefone: "", chat_id: "",
    tipo_entrega: "Comanda", endereco: "", pagamento: "", pagamento_resumo: "",
    taxa_entrega: 0, itens: [], total: "3.00", observacao: "",
    criado_em: new Date("2026-11-10T17:36:00.000Z"), avisado_em: null,
    recebido_em: null, impresso_em: null, mesa_id: null, origem: "pdv", troco_para: null,
  }, patch || {});
}

function espiar(rows) {
  const antes = db.query;
  const chamadas = [];
  db.query = async (sql, params) => {
    chamadas.push({ sql, params });
    if (/FROM empresas/i.test(sql)) return { rows: [{ id: "emp-comandas" }] };
    return { rows: rows || [] };
  };
  return { chamadas, restaurar: () => { db.query = antes; } };
}

test("listarComandasAbertas filtra no banco e ordena a mais antiga primeiro", async () => {
  const e = espiar([linha({ id: 1 }), linha({ id: 2, numero: 34 })]);
  try {
    const lista = await pedidos.listarComandasAbertas("/x/tenant-comandas-lista");
    assert.equal(lista.length, 2);
    const consulta = e.chamadas.find((c) => /FROM pedidos/i.test(c.sql));
    assert.match(consulta.sql, /origem = 'pdv'/i);
    assert.match(consulta.sql, /tipo_entrega = 'Comanda'/i);
    assert.match(consulta.sql, /recebido_em IS NULL/i);
    assert.match(consulta.sql, /status <> 'cancelado'/i);
    assert.match(consulta.sql, /ORDER BY criado_em ASC, id ASC/i);
  } finally { e.restaurar(); }
});

test("lerComandaAberta aplica o mesmo contrato ao id informado", async () => {
  const e = espiar([linha({ id: 42 })]);
  try {
    const comanda = await pedidos.lerComandaAberta("/x/tenant-comandas-detalhe", 42);
    assert.equal(comanda.id, 42);
    assert.equal(comanda.total, 3);
    const consulta = e.chamadas.find((c) => /FROM pedidos/i.test(c.sql));
    assert.deepEqual(consulta.params, ["emp-comandas", 42]);
    assert.match(consulta.sql, /tipo_entrega = 'Comanda'/i);
  } finally { e.restaurar(); }
});
