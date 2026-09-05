const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { trechoEntre } = require("./apoio/arquivo-estatico");

const ADMIN = path.join(__dirname, "..", "public", "admin.html");

test("editor-tabs-nav tem role=tablist no container e role=tab nos 3 botoes", () => {
  const trecho = trechoEntre(ADMIN, 'class="editor-tabs" id="editor-tabs-nav"', "</div>");
  assert.notEqual(trecho, null, "trecho de editor-tabs-nav nao encontrado");

  assert.ok(
    trecho.includes('class="editor-tabs" id="editor-tabs-nav" role="tablist"'),
    "container deve ter role=tablist"
  );
  assert.ok(
    trecho.includes('role="tab" aria-selected="true"') && trecho.includes('class="editor-tab ativo"'),
    "aba ativa deve ter role=tab e aria-selected=true"
  );

  const botoes = (trecho.match(/role="tab"/g) || []).length;
  assert.equal(botoes, 3, "deve haver 3 botoes com role=tab");
});

test("aria-selected=true so no botao ativo", () => {
  const trecho = trechoEntre(ADMIN, 'class="editor-tabs" id="editor-tabs-nav"', "</div>");
  const countSelected = (trecho.match(/aria-selected="true"/g) || []).length;
  assert.equal(countSelected, 1, "aria-selected=true deve aparecer apenas no botao ativo");
  const iAtivo = trecho.indexOf('class="editor-tab ativo"');
  const iSelected = trecho.indexOf('aria-selected="true"');
  assert.ok(iAtivo > -1 && iSelected > -1 && iAtivo < iSelected, "aria-selected=true deve estar na MESMA tag do botao ativo");
});