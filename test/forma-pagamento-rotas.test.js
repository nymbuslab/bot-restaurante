const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Toda rota que recebe dinheiro confere a forma contra a lista do tenant.
//
// So o PDV conferia (8a366eb). Fechar mesa, receber parcial e receber um pedido
// aceitavam qualquer texto que o front mandasse, e esse texto ia direto para
// `caixa_movimentos.forma_pagamento` — a coluna que alimenta a conferencia do
// caixa e o dashboard.
//
// Nao causava dano hoje porque o painel manda o vocabulario canonico. O risco
// estava na combinacao: `mesaFormasPagamento()` tinha uma lista de reserva com o
// vocabulario ANTIGO ("Cartao Debito", "Pix", "Outros") — exatamente as grafias
// normalizadas do banco em 22/08 — e nenhuma das tres rotas barraria.
//
// A validacao usa `formaPermitida`, que compara contra a lista NORMALIZADA (a
// mesma que as telas recebem). Comparar contra a crua recusaria a forma que a
// propria tela ofereceu, que foi o defeito corrigido em 8a366eb.
// ---------------------------------------------------------------------------

const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

function corpoDaRota(marcador) {
  const i = servidor.indexOf(marcador);
  assert.ok(i > -1, "rota não encontrada: " + marcador);
  const fim = servidor.indexOf("\napp.", i + 10);
  return servidor.slice(i, fim === -1 ? undefined : fim);
}

const ROTAS_DE_DINHEIRO = [
  'app.post("/api/pdv/vender"',
  'app.post("/api/mesas/:id/pagar"',
  'app.post("/api/mesas/:id/receber-parcial"',
  'app.post("/api/caixa/receber/:pedidoId"',
];

ROTAS_DE_DINHEIRO.forEach((rota) => {
  const nome = rota.replace(/^app\.\w+\("/, "").replace(/"$/, "");
  test(`${nome} confere a forma de pagamento`, () => {
    assert.match(corpoDaRota(rota), /formaPermitida/,
      "sem isso, qualquer texto do cliente vira forma de pagamento no caixa");
  });
});

test("a lista de reserva do pagamento da mesa usa o vocabulário canônico", () => {
  const i = app.indexOf("function mesaFormasPagamento(");
  assert.ok(i > -1);
  const corpo = app.slice(i, app.indexOf("\n}", i));
  // Olha o RETURN, nao o texto da funcao: a primeira versao deste teste reprovava
  // o proprio comentario que explica quais grafias saíram.
  assert.doesNotMatch(corpo, /return \[\s*"/,
    "lista literal de formas aqui reintroduziria as grafias que a migracao de 22/08 limpou");
  assert.match(corpo, /Pagamentos\.FORMAS_PAGAMENTO/,
    "a reserva tem que vir do vocabulário único, não de um literal paralelo");
});
