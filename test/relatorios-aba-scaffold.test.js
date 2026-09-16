const { test } = require("node:test");
const assert = require("node:assert/strict");
const { contemTrecho, trechoEntre } = require("./apoio/arquivo-estatico");

const HTML = "public/admin.html";

test("nav tem o botão data-aba='relatorios' dentro do acordeão Relatórios (navsub-relatorios)", () => {
  const grupo = trechoEntre(HTML, '<div class="nav-sub" id="navsub-relatorios"', '<button data-aba="equipe">');
  assert.ok(grupo, "grupo navsub-relatorios não encontrado");
  assert.match(grupo, /<button data-aba="relatorios">/);
  assert.match(grupo, /<span>Estoque<\/span>/);
});

test("seção #aba-relatorios existe com bloqueio de Plano Completo (mesmo padrão de #estoqueLock)", () => {
  const secao = trechoEntre(HTML, 'id="aba-relatorios"', "</section>");
  assert.ok(secao, "seção #aba-relatorios não encontrada");
  assert.match(secao, /id="relatoriosLock"/);
  assert.match(secao, /Plano Completo/);
  assert.match(secao, /id="relatoriosConteudo"/);
});
