const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validarConfig, validarCardapio, tipoImagemPorAssinatura, validarCpf, validarCnpj, validarDocumento } = require("../src/validacao");

// ---- validarCpf / validarCnpj / validarDocumento ----
test("validarCpf: aceita CPF válido (com e sem máscara)", () => {
  assert.equal(validarCpf("111.444.777-35"), true);
  assert.equal(validarCpf("11144477735"), true);
});
test("validarCpf: rejeita dígito errado, repetido e tamanho errado", () => {
  assert.equal(validarCpf("111.444.777-00"), false);
  assert.equal(validarCpf("111.111.111-11"), false); // todos iguais
  assert.equal(validarCpf("123"), false);
  assert.equal(validarCpf(""), false);
});
test("validarCnpj: aceita CNPJ válido (com e sem máscara)", () => {
  assert.equal(validarCnpj("11.222.333/0001-81"), true);
  assert.equal(validarCnpj("11222333000181"), true);
});
test("validarCnpj: rejeita dígito errado, repetido e tamanho errado", () => {
  assert.equal(validarCnpj("11.222.333/0001-00"), false);
  assert.equal(validarCnpj("00.000.000/0000-00"), false); // todos iguais
  assert.equal(validarCnpj("1122233300"), false);
});
test("validarDocumento: vazio é aceito; senão valida pelo tipo", () => {
  assert.equal(validarDocumento("PF", ""), true);
  assert.equal(validarDocumento("PJ", ""), true);
  assert.equal(validarDocumento("PF", "111.444.777-35"), true);
  assert.equal(validarDocumento("PF", "11.222.333/0001-81"), false); // CNPJ no PF
  assert.equal(validarDocumento("PJ", "11.222.333/0001-81"), true);
  assert.equal(validarDocumento("PJ", "111.444.777-35"), false); // CPF no PJ
});

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
