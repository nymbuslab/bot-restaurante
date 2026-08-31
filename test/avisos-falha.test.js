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

test("reimprimir comprovante do caixa desabilita durante o envio e mostra resultado", () => {
  const c = trecho("async function reimprimirComprovanteCaixa(", "\n// \"Ã‰ dinheiro?\"");
  const iDisabled = c.indexOf("disabled = true");
  const iRota = c.indexOf("/reimprimir");
  const iFinally = c.indexOf("finally");
  const iReabilita = c.indexOf("disabled = false", iFinally);
  assert.ok(iDisabled > -1 && iRota > -1 && iDisabled < iRota,
    "o botao precisa desabilitar antes de chamar a rota");
  assert.ok(iFinally > -1 && iReabilita > iFinally,
    "a reabilitacao precisa ficar dentro do finally");
  assert.match(c, /toast\([^)]*impress/i, "sucesso precisa avisar que foi para impressao");
  assert.match(c, /toast\([^)]*"erro"\)/, "falha da rota precisa aparecer como erro");
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

test("movimentação do caixa mostra aviso quando o comprovante não entra na fila", () => {
  const helper = trecho("function toastResultadoComImpressao(", "\n}\n\nasync function movimentoCaixa");
  assert.match(helper, /avisoImpressao/,
    "o helper precisa ler o campo que o servidor devolve quando a fila falha");
  assert.match(helper, /toast\([^)]*"erro"\)/,
    "aviso de comprovante precisa aparecer como alerta, não como sucesso comum");
  assert.match(helper, /toast\(\s*sucesso[^)]*"erro"\)/,
    "a confirmação de sucesso precisa sair JUNTO do aviso: quem lê só a falha acha que o movimento não entrou e repete a sangria ou o cancelamento");
  const c = trecho("async function movimentoCaixa(", "\n// \"É dinheiro?\"");
  assert.match(c, /await r\.json/,
    "o handler precisa ler o corpo de sucesso, onde vem o avisoImpressao");
  assert.match(c, /toastResultadoComImpressao/,
    "o sucesso precisa passar pelo helper que transforma aviso de impressão em alerta visível");
});

test("cancelar pedido pago mostra aviso quando o comprovante não entra na fila", () => {
  const c = trecho("// Botão de cancelar pedido", "\nasync function avisarCliente");
  assert.match(c, /await r\.json/,
    "o handler precisa ler o corpo de sucesso, onde vem o avisoImpressao");
  assert.match(c, /toastResultadoComImpressao/,
    "o sucesso do cancelamento precisa ler o corpo e mostrar o aviso de impressão");
});

test("aviso de comprovante do caixa se sustenta sozinho, sem repetir a confirmação", () => {
  const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");
  const i = servidor.indexOf("async function enfileirarComprovanteCaixa(");
  assert.ok(i > -1, "não encontrado: enfileirarComprovanteCaixa");
  const bloco = servidor.slice(i, servidor.indexOf("\napp.post", i));
  const msg = /erro: "([^"]+)"/.exec(bloco);
  assert.ok(msg, "a função precisa devolver um texto de aviso quando a fila falha");
  assert.doesNotMatch(msg[1], /registrad/i,
    "quem confirma o movimento é a tela, que sabe se foi sangria, suprimento ou o pedido #N; repetir aqui daria duas confirmações na mesma frase");
  assert.match(msg[1], /impress/i,
    "a frase precisa dizer sozinha que o problema foi a impressão");
});
