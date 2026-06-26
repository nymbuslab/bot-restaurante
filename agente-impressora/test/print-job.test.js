// agente-impressora/test/print-job.test.js
const test = require("node:test");
const assert = require("node:assert");
const { montarJob } = require("../main/print-job");

const pedido = {
  numero: 42, cliente: "Joao", telefone: "11999", tipoEntrega: "Entrega",
  endereco: "Rua A, 1", pagamento: "Pix", taxaEntrega: 5, total: 70,
  itens: [{ nome: "X-Burger", qtd: 1, preco: 65, opcionais: [{ nome: "Bacon", preco: 5 }] }],
  observacao: "", criadoEm: "2026-06-26T12:00:00.000Z",
};
const tenant = { restaurante: { nome: "Teste" }, impressao: { rodape: "Volte sempre" } };

test("montarJob: 2 vias x 1 copia = 2 buffers, todos Uint8Array nao-vazios", () => {
  const cfg = { vias: { cozinha: true, cupom: true }, copias: 1, corte: "parcial", semAcento: false };
  const job = montarJob(pedido, tenant, cfg, {});
  assert.equal(job.length, 2);
  job.forEach((b) => { assert.ok(b instanceof Uint8Array); assert.ok(b.length > 10); });
  // 1o byte = ESC @ (init) — 0x1B 0x40
  assert.equal(job[0][0], 0x1B); assert.equal(job[0][1], 0x40);
});

test("montarJob: so cupom, 2 copias = 2 buffers", () => {
  const cfg = { vias: { cozinha: false, cupom: true }, copias: 2, corte: "total", semAcento: false };
  const job = montarJob(pedido, tenant, cfg, {});
  assert.equal(job.length, 2);
});

test("montarJob: so cozinha, 1 copia = 1 buffer", () => {
  const cfg = { vias: { cozinha: true, cupom: false }, copias: 1, corte: "nenhum", semAcento: true };
  const job = montarJob(pedido, tenant, cfg, {});
  assert.equal(job.length, 1);
});

test("montarJob: corte 'nenhum' nao adiciona ESC m nem ESC i no fim", () => {
  const cfg = { vias: { cozinha: true, cupom: false }, copias: 1, corte: "nenhum", semAcento: false };
  const b = montarJob(pedido, tenant, cfg, {})[0];
  const fim = Array.from(b.slice(-2));
  assert.notDeepEqual(fim, [0x1B, 0x6D]); // nao termina em ESC m
  assert.notDeepEqual(fim, [0x1B, 0x69]); // nem ESC i
});
