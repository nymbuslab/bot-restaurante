const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// As duas acoes que ainda falhavam caladas, no mesmo formato do salvar cardapio.
//
// ESTORNAR RECEBIMENTO incomoda mais: o dialogo de confirmacao fala em dinheiro
// voltando para "a receber", e se a chamada falhasse a tela nao dizia nada — a
// pessoa ficava sem saber se o dinheiro saiu do caixa ou nao.
//
// SALVAR CONFIGURACOES tinha o mesmo buraco, mais o `api()` que LANCA quando o
// fetch falha: sem `finally`, o botao ficava preso em "Salvando...".
//
// Cuidado ao varrer isto por regex: um detector automatico apontou 13 casos no
// app.js e DEZ eram falso positivo — o `else` estava alguns blocos abaixo do
// alcance do script. Confira lendo.
// ---------------------------------------------------------------------------

const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

function trecho(marcador, ateMarcador) {
  const i = app.indexOf(marcador);
  assert.ok(i > -1, "não encontrado: " + marcador);
  const fim = app.indexOf(ateMarcador, i + marcador.length);
  return app.slice(i, fim === -1 ? undefined : fim);
}

test("estornar recebimento avisa quando falha", () => {
  const c = trecho("async function estornarCaixa(", "\n}");
  assert.match(c, /toast\([^)]*"erro"\)/,
    "o diálogo fala em dinheiro saindo do caixa: silêncio deixa a pessoa sem saber o que aconteceu");
  assert.match(c, /\.erro/, "a mensagem do servidor diz o motivo (ex.: caixa já fechado)");
});

test("estornar recebimento sobrevive à queda de rede", () => {
  const c = trecho("async function estornarCaixa(", "\n}");
  assert.match(c, /catch/, "api() lança quando o fetch falha");
});

test("salvar configurações avisa quando falha", () => {
  const c = trecho('const r = await api("PUT", "/api/config"', "\n});");
  assert.match(c, /toast\([^)]*"erro"\)/, "sem isso a recusa do servidor some sem rastro");
  assert.match(c, /\.erro/, "a mensagem do servidor precisa chegar ao dono");
});

test("salvar configurações não deixa o botão preso em 'Salvando...'", () => {
  const c = trecho('const r = await api("PUT", "/api/config"', "\n});");
  assert.match(c, /finally/, "só o finally garante o botão de volta quando o fetch lança");
  const iFinally = c.indexOf("finally");
  const iRestaura = c.indexOf('textContent = "Salvar configurações"');
  assert.ok(iRestaura > iFinally, "restaurar o botão tem que estar DENTRO do finally");
});

test("o caminho de sucesso das configurações mantém o aviso de frete", () => {
  const c = trecho('const r = await api("PUT", "/api/config"', "\n});");
  assert.match(c, /avisoFrete/,
    "o servidor devolve um aviso quando o frete por raio fica incoerente; não pode sumir");
});
