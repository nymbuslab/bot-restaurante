// Testes de CARACTERIZAÇÃO — trabalho quebra-linha-obs-cozinha.
// Congelaram o comportamento vigente em 2026-09-05. Quatro deles (marcados
// "[depois]" abaixo) tiveram a asserção atualizada porque a task
// quebra-linha-obs-cozinha alterou DE PROPÓSITO o comportamento que eles
// congelavam — o antes/depois de cada um está no comentário logo acima do teste.
// Os demais continuam intocados: NÃO corrija uma asserção por parecer errada
// fora desse contexto — quebra aqui = regressão, não mudança pretendida.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { montarComanda } = require("../public/comanda.js");

const config = { restaurante: { nome: "X" } };

// Gera texto com espaços a cada ~6 caracteres, tamanho exato `n` — para cravar
// o comprimento da linha sem depender de contar letras "no olho".
function gerarTexto(n) {
  let out = "";
  let i = 0;
  while (out.length < n) {
    if (out.length > 0 && out.length % 6 === 5 && out.length + 1 < n) out += " ";
    else out += String.fromCharCode(97 + (i % 26));
    i++;
  }
  return out.slice(0, n);
}

function cozinhaComObsItem(observacao) {
  const pedido = {
    numero: 1, criadoEm: "2026-06-20T17:35:00.000Z", tipoEntrega: "Entrega",
    itens: [{ nome: "Item", preco: 1, qtd: 1, opcionais: [], observacao }],
  };
  return montarComanda(pedido, config).cozinha;
}

function cozinhaComObsGeral(observacaoGeral) {
  const pedido = {
    numero: 1, criadoEm: "2026-06-20T17:35:00.000Z", tipoEntrega: "Entrega",
    observacao: observacaoGeral,
    itens: [{ nome: "Item", preco: 1, qtd: 1, opcionais: [] }],
  };
  return montarComanda(pedido, config).cozinha;
}

// --- Obs: do item (linha 92 de public/comanda.js) ---

test("[caracterização] Obs do item vazia: nenhuma linha 'Obs:' é gerada", () => {
  const cozinha = cozinhaComObsItem("");
  assert.equal(/Obs:/.test(cozinha), false);
});

test("[caracterização] Obs do item curta: uma única linha, com o prefixo '   Obs: '", () => {
  const cozinha = cozinhaComObsItem("sem cebola");
  const linha = cozinha.split("\n").find((l) => l.startsWith("   Obs:"));
  assert.equal(linha, "   Obs: sem cebola");
});

test("[caracterização] Obs do item com exatamente 40 caracteres: cabe em uma linha de 48 colunas", () => {
  const texto = gerarTexto(40);
  const cozinha = cozinhaComObsItem(texto);
  const linha = cozinha.split("\n").find((l) => l.startsWith("   Obs:"));
  assert.equal(linha.length, 48);
  assert.equal(linha, "   Obs: " + texto);
});

test("[depois] Obs do item com 41 caracteres (1 acima do limite): agora quebra em duas linhas, nenhuma acima de 48 colunas", () => {
  // Comportamento congelado antes: 1 linha só, 49 colunas (estourava a bobina 80mm).
  // Comportamento depois desta task: quebra em 2 linhas de até 48 colunas, via quebrar().
  // Autoriza a quebra do teste: quebra-linha-obs-cozinha.
  // Impacto conhecido: nenhum — ninguém consumia o texto da via impressa de volta
  // (é saída de impressora, não dado lido de novo pelo sistema).
  const texto = gerarTexto(41);
  const cozinha = cozinhaComObsItem(texto);
  const todasLinhas = cozinha.split("\n");
  const i = todasLinhas.findIndex((l) => l.startsWith("   Obs:"));
  const linhasObs = [todasLinhas[i], todasLinhas[i + 1]];
  assert.equal(linhasObs[0], "   Obs: abcde ghijk mnopq stuvw yzabc efghi");
  assert.equal(linhasObs[1], "   klmno");
  linhasObs.forEach((l) => assert.ok(l.length <= 48, "linha " + JSON.stringify(l) + " passou de 48"));
});

test("[depois] Obs do item bem longa (88 colunas): agora quebra em várias linhas, nenhuma acima de 48 colunas", () => {
  // Comportamento congelado antes: 1 linha só, 88 colunas.
  // Comportamento depois desta task: quebra em várias linhas, todas <= 48 colunas.
  // Autoriza a quebra do teste: quebra-linha-obs-cozinha.
  const texto = "sem cebola por favor e sem tomate tambem e capricha no molho extra por gentileza";
  const cozinha = cozinhaComObsItem(texto);
  const todasLinhas = cozinha.split("\n");
  const i = todasLinhas.findIndex((l) => l.startsWith("   Obs:"));
  const linhas = [todasLinhas[i], todasLinhas[i + 1]];
  assert.equal(linhas[0], "   Obs: sem cebola por favor e sem tomate tambem");
  assert.equal(linhas[1], "   e capricha no molho extra por gentileza");
  linhas.forEach((l) => assert.ok(l.length <= 48, "linha " + JSON.stringify(l) + " passou de 48"));
});

// --- Obs. geral: do pedido (linha 98 de public/comanda.js) ---

test("[caracterização] Obs. geral vazia: nenhuma linha 'Obs. geral:' é gerada", () => {
  const cozinha = cozinhaComObsGeral("");
  assert.equal(/Obs\. geral:/.test(cozinha), false);
});

test("[caracterização] Obs. geral com exatamente 36 caracteres: cabe em uma linha de 48 colunas", () => {
  const texto = gerarTexto(36);
  const cozinha = cozinhaComObsGeral(texto);
  const linha = cozinha.split("\n").find((l) => l.startsWith("Obs. geral:"));
  assert.equal(linha.length, 48);
  assert.equal(linha, "Obs. geral: " + texto);
});

test("[depois] Obs. geral com 37 caracteres (1 acima do limite): agora quebra em duas linhas, nenhuma acima de 48 colunas", () => {
  // Comportamento congelado antes: 1 linha só, 49 colunas.
  // Comportamento depois desta task: quebra em 2 linhas de até 48 colunas, via quebrar().
  // Autoriza a quebra do teste: quebra-linha-obs-cozinha.
  const texto = gerarTexto(37);
  const cozinha = cozinhaComObsGeral(texto);
  const todasLinhas = cozinha.split("\n");
  const i = todasLinhas.findIndex((l) => l.startsWith("Obs. geral:"));
  const linhas = [todasLinhas[i], todasLinhas[i + 1]];
  assert.equal(linhas[0], "Obs. geral: abcde ghijk mnopq stuvw yzabc efghi");
  assert.equal(linhas[1], "k");
  linhas.forEach((l) => assert.ok(l.length <= 48, "linha " + JSON.stringify(l) + " passou de 48"));
});

test("[depois] Obs. geral bem longa (102 colunas): agora quebra em várias linhas, nenhuma acima de 48 colunas", () => {
  // Comportamento congelado antes: 1 linha só, 102 colunas.
  // Comportamento depois desta task: quebra em 3 linhas de até 48 colunas, via quebrar().
  // Autoriza a quebra do teste: quebra-linha-obs-cozinha.
  const texto = "aniversariante hoje por favor coloque uma velinha e um cartao de feliz aniversario no saco";
  const cozinha = cozinhaComObsGeral(texto);
  const todasLinhas = cozinha.split("\n");
  const i = todasLinhas.findIndex((l) => l.startsWith("Obs. geral:"));
  const linhas = [todasLinhas[i], todasLinhas[i + 1], todasLinhas[i + 2]];
  assert.equal(linhas[0], "Obs. geral: aniversariante hoje por favor");
  assert.equal(linhas[1], "coloque uma velinha e um cartao de feliz");
  assert.equal(linhas[2], "aniversario no saco");
  linhas.forEach((l) => assert.ok(l.length <= 48, "linha " + JSON.stringify(l) + " passou de 48"));
});
