const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");

const JS = path.join(__dirname, "..", "public", "app.js");
const HTML = path.join(__dirname, "..", "public", "admin.html");

function corpoDaFuncao(txt, cabecalho) {
  const inicio = txt.indexOf(cabecalho);
  assert.notEqual(inicio, -1, "cabecalho nao encontrado: " + cabecalho);
  const fim = txt.indexOf("\n}", inicio);
  assert.notEqual(fim, -1, "fechamento nao encontrado para: " + cabecalho);
  return txt.slice(inicio, fim + 2);
}

function idMostrado(ref) {
  const m = ref.match(/\$\("([^"]+)"\)\.hidden = false/);
  return m ? m[1] : null;
}

test("carregarPdv: branch !r.ok usa id distinto do branch !data.caixa", () => {
  const js = fs.readFileSync(JS, "utf8");
  const corpo = corpoDaFuncao(js, "async function carregarPdv() {");

  const okBranch = corpo.match(/if \(!r\.ok\) \{([^}]+)\}/);
  assert.ok(okBranch, "branch !r.ok nao encontrada em carregarPdv");
  const idErro = idMostrado(okBranch[1]);
  assert.ok(idErro && idErro !== "pdvSemCaixa", "branch !r.ok deve apontar para id distinto de pdvSemCaixa, achou: " + idErro);

  const caixaBranch = corpo.match(/if \(!data\.caixa\) \{([^}]+)\}/);
  assert.ok(caixaBranch, "branch !data.caixa nao encontrada em carregarPdv");
  const idCaixa = idMostrado(caixaBranch[1]);
  assert.equal(idCaixa, "pdvSemCaixa");
  assert.notEqual(idErro, idCaixa);
});

test("carregarMesas: branch !rMesas.ok usa id distinto do branch !caixaData.caixa", () => {
  const js = fs.readFileSync(JS, "utf8");
  const corpo = corpoDaFuncao(js, "async function carregarMesas() {");

  const okBranch = corpo.match(/if \(!rMesas\.ok\) \{([^}]+)\}/);
  assert.ok(okBranch, "branch !rMesas.ok nao encontrada em carregarMesas");
  const idErro = idMostrado(okBranch[1]);
  assert.ok(idErro && idErro !== "mesasSemCaixa", "branch !rMesas.ok deve apontar para id distinto de mesasSemCaixa, achou: " + idErro);

  const caixaBranch = corpo.match(/if \(!caixaData\.caixa\) \{([^}]+)\}/);
  assert.ok(caixaBranch, "branch !caixaData.caixa nao encontrada em carregarMesas");
  const idCaixa = idMostrado(caixaBranch[1]);
  assert.equal(idCaixa, "mesasSemCaixa");
  assert.notEqual(idErro, idCaixa);
});

test("admin.html tem blocos de erro de rede com ids distintos e botao Tentar de novo", () => {
  const html = fs.readFileSync(HTML, "utf8");
  const blocos = ["pdvErroRede", "mesasErroRede"];
  for (const idBloco of blocos) {
    const ix = html.indexOf('id="' + idBloco + '"');
    assert.notEqual(ix, -1, "bloco #" + idBloco + " nao encontrado em admin.html");
    const trecho = html.slice(ix, ix + 900);
    assert.ok(/<button[^>]*>/.test(trecho), "#" + idBloco + " deve conter um <button>");
    assert.ok(/Tentar de novo/.test(trecho), "#" + idBloco + " deve ter botao com texto Tentar de novo");
  }
  assert.notEqual(blocos[0], blocos[1]);
});