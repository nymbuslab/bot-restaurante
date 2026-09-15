const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
test("Atividades tem filtros, quatro estados e detalhe somente leitura", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/admin.html"), "utf8");
  for (const id of ["atividadesLista", "atividadesCarregando", "atividadesVazio", "atividadesErro", "atividadesEvento", "atividadesAtor", "atividadesMais", "atividadesDetalhe"]) assert.ok(html.includes(`id="${id}"`), id);
});
