const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Salvar o cardapio precisa avisar quando NAO salva.
//
// O handler era `if (r && r.ok) toast("Cardapio salvo!")`, sem else. O servidor
// recusa com mensagem propria ("Cardapio grande demais.", teto de 512 KB, ou o
// erro de validacao) e a tela jogava fora: o botao voltava de "Salvando..." ao
// normal e nada mais acontecia. O dono concluia que salvou, seguia editando, e
// nada persistia. E a unica acao importante do painel que nao avisava ao falhar,
// e o cardapio e o artefato central do produto.
//
// Havia um segundo furo no mesmo lugar: `api()` LANCA quando o fetch falha (rede
// caindo). A execucao parava no await e as duas linhas de reabilitar o botao
// nunca rodavam — ele ficava preso em "Salvando..." ate recarregar a pagina.
// Justamente o cenario mais provavel num restaurante com Wi-Fi oscilando.
//
// A mensagem do servidor tem que aparecer como veio: "Cardapio grande demais."
// diz o que fazer, um "erro ao salvar" generico nao.
// ---------------------------------------------------------------------------

const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

function handlerSalvarCardapio() {
  const i = app.indexOf('$("btnSalvarCardapio").addEventListener');
  assert.ok(i > -1, "handler de salvar cardápio não encontrado");
  const fim = app.indexOf("\n});", i);
  return app.slice(i, fim === -1 ? undefined : fim);
}

const h = handlerSalvarCardapio();

test("salvar cardápio avisa quando o servidor recusa", () => {
  // Cobra o COMPORTAMENTO (existe aviso de erro no caminho da recusa), nao o
  // mecanismo: a primeira versao exigia um `else` literal e reprovava a solucao
  // com retorno antecipado, que e mais legivel e faz exatamente a mesma coisa.
  assert.match(h, /toast\([^)]*"erro"\)/, "o caminho de falha precisa terminar num toast de erro");
  const iOk = h.indexOf("r.ok");
  const iErro = h.search(/toast\([^)]*"erro"\)/);
  assert.ok(iOk > -1 && iErro > iOk, "o aviso vem depois de constatar que NAO deu certo");
});

test("a mensagem do servidor chega ao dono, não um texto genérico", () => {
  assert.match(h, /\.erro/, 'precisa ler o campo `erro` da resposta ("Cardápio grande demais.")');
});

test("falha de rede não deixa o botão preso em 'Salvando...'", () => {
  assert.match(h, /catch/, "api() lança quando o fetch falha");
  assert.match(h, /finally/, "só o finally garante o botão de volta nos dois caminhos");
  const iFinally = h.indexOf("finally");
  const iRestaura = h.indexOf('textContent = "Salvar cardápio"');
  assert.ok(iRestaura > iFinally,
    "restaurar o botão tem que estar DENTRO do finally, senão a exceção pula a linha");
});

test("o caminho de sucesso continua confirmando que salvou", () => {
  assert.match(h, /Card\u00e1pio salvo/, "o dono precisa da confirmação positiva também");
});
