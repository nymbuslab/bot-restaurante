const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { trechoEntre } = require("./apoio/arquivo-estatico");

const APP = path.join(__dirname, "..", "public", "app.js");

test("confirmações destrutivas identificam categoria, grupo, item e mesa pelo nome", () => {
  const categorias = trechoEntre(APP, "function renderCategorias()", "\nif ($(\"btnNovaCategoria\"))");
  const grupos = trechoEntre(APP, "async function grpExcluir(", "\nfunction grpAbrirGaveta(");
  const itens = trechoEntre(APP, "async function fluxoExcluirItem(", "\nfunction renderCardapioMetricas(");
  const mesas = trechoEntre(APP, "function renderMesasConfigLista()", "\nasync function salvarConfigurarMesas(");

  assert.match(categorias, /Excluir categoria.*cat\.nome/);
  assert.match(grupos, /Excluir grupo.*grupo.*grupo\.nome/);
  assert.match(itens, /Excluir item.*item\.nome/);
  assert.match(mesas, /Remover mesa.*mesa.*mesa\.nome/);
});
