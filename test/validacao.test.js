const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarConfig, validarCardapio, itemNoCanal, tipoImagemPorAssinatura } = require("../src/validacao");

// ---- validarConfig ----
test("validarConfig: objeto normal passa", () => {
  assert.equal(validarConfig({ restaurante: { nome: "X" }, pagamentos: ["Pix"] }), null);
});
test("validarConfig: rejeita não-objeto", () => {
  assert.equal(validarConfig([1, 2]), "Configuração inválida.");
  assert.equal(validarConfig(null), "Configuração inválida.");
  assert.equal(validarConfig("texto"), "Configuração inválida.");
});
test("validarConfig: rejeita payload gigante", () => {
  assert.equal(validarConfig({ x: "a".repeat(300 * 1024) }), "Configuração grande demais.");
});

// ---- validarCardapio ----
test("validarCardapio: cardápio normal passa", () => {
  assert.equal(validarCardapio({ categorias: [{ nome: "Marmitas", itens: [{ id: 1, nome: "P" }] }] }), null);
});
test("validarCardapio: objeto sem categorias passa", () => {
  assert.equal(validarCardapio({}), null);
});
test("validarCardapio: rejeita categorias não-array", () => {
  assert.equal(validarCardapio({ categorias: "x" }), "Cardápio inválido (categorias).");
});
test("validarCardapio: rejeita itens não-array", () => {
  assert.equal(validarCardapio({ categorias: [{ nome: "C", itens: "x" }] }), "Categoria inválida (itens).");
});
test("validarCardapio: rejeita categorias demais", () => {
  const cats = Array.from({ length: 201 }, () => ({ nome: "c" }));
  assert.equal(validarCardapio({ categorias: cats }), "Categorias demais.");
});
test("validarCardapio: rejeita itens demais numa categoria", () => {
  const itens = Array.from({ length: 501 }, (_, i) => ({ id: i, nome: "x" }));
  assert.equal(validarCardapio({ categorias: [{ nome: "C", itens }] }), "Itens demais em uma categoria.");
});

// ---- itemNoCanal (retrocompat dos canais por item) ----
test("itemNoCanal: item SEM canais = só bot (retrocompat)", () => {
  const legado = { nome: "X" };
  assert.equal(itemNoCanal(legado, "bot"), true);
  assert.equal(itemNoCanal(legado, "digital"), false);
});
test("itemNoCanal: respeita as flags explícitas de canais", () => {
  assert.equal(itemNoCanal({ canais: { bot: true, digital: false } }, "bot"), true);
  assert.equal(itemNoCanal({ canais: { bot: true, digital: false } }, "digital"), false);
  assert.equal(itemNoCanal({ canais: { bot: false, digital: true } }, "bot"), false);
  assert.equal(itemNoCanal({ canais: { bot: false, digital: true } }, "digital"), true);
});
test("itemNoCanal: canais ausente/parcial trata flag não-true como false", () => {
  assert.equal(itemNoCanal({ canais: { digital: true } }, "bot"), false);
  assert.equal(itemNoCanal({ canais: {} }, "digital"), false);
  assert.equal(itemNoCanal(null, "bot"), true);
});

// ---- tipoImagemPorAssinatura (magic bytes) ----
test("tipoImagemPorAssinatura: detecta JPEG/PNG/WebP pelos bytes", () => {
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBP")]);
  assert.deepEqual(tipoImagemPorAssinatura(jpg), { ext: "jpg", mime: "image/jpeg" });
  assert.deepEqual(tipoImagemPorAssinatura(png), { ext: "png", mime: "image/png" });
  assert.deepEqual(tipoImagemPorAssinatura(webp), { ext: "webp", mime: "image/webp" });
});
test("tipoImagemPorAssinatura: rejeita arquivo falso (MIME mente) ou curto", () => {
  assert.equal(tipoImagemPorAssinatura(Buffer.from("<?php system($_GET[0]); ?>")), null);
  assert.equal(tipoImagemPorAssinatura(Buffer.from([0xff, 0xd8])), null); // curto demais
  assert.equal(tipoImagemPorAssinatura(null), null);
});
