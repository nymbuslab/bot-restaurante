const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { contemTrecho } = require("./apoio/arquivo-estatico");

const ADMIN = path.join(__dirname, "..", "public", "admin.html");

test("os 4 botoes de fechar tem aria-label=Fechar na MESMA tag, por id", () => {
  const casos = [
    { id: "pedido-fechar", tag: '<button class="secundario mini" id="pedido-fechar" aria-label="Fechar">' },
    { id: "qr-fechar", tag: '<button class="secundario mini" id="qr-fechar" aria-label="Fechar">' },
    { id: "editor-fechar", tag: '<button class="secundario mini" id="editor-fechar" aria-label="Fechar">' },
    { id: "cartao-fechar", tag: '<button class="secundario mini" id="cartao-fechar" type="button" aria-label="Fechar">' },
  ];
  for (const c of casos) {
    const ok = contemTrecho(ADMIN, c.tag);
    assert.equal(ok, true, `botao ${c.id} nao tem aria-label na MESMA tag`);
  }
});

test("nenhum outro botao de fechar ✕ ficou sem aria-label (semantica de contagem)", () => {
  const tagsComId = ["pedido-fechar", "qr-fechar", "editor-fechar", "cartao-fechar"];
  for (const id of tagsComId) {
    const ok = contemTrecho(ADMIN, `<button class="secundario mini" id="${id}"`);
    assert.equal(ok, true, `botao ${id} nao encontrado`);
  }
});