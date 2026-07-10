const { test } = require("node:test");
const assert = require("node:assert/strict");
const Documento = require("../public/documento");

test("valido: espelha CPF/CNPJ do servidor; vazio é aceito", () => {
  assert.equal(Documento.valido("PF", "111.444.777-35"), true);
  assert.equal(Documento.valido("PF", "111.444.777-00"), false);
  assert.equal(Documento.valido("PJ", "11.222.333/0001-81"), true);
  assert.equal(Documento.valido("PJ", "11.222.333/0001-00"), false);
  assert.equal(Documento.valido("PF", ""), true);
  assert.equal(Documento.valido("PJ", ""), true);
});

test("formatarDocumento: máscara progressiva de CPF (PF)", () => {
  assert.equal(Documento.formatarDocumento("111", "PF"), "111");
  assert.equal(Documento.formatarDocumento("1114", "PF"), "111.4");
  assert.equal(Documento.formatarDocumento("1114447", "PF"), "111.444.7");
  assert.equal(Documento.formatarDocumento("11144477735", "PF"), "111.444.777-35");
  assert.equal(Documento.formatarDocumento("111444777359999", "PF"), "111.444.777-35"); // trunca em 11
});

test("formatarDocumento: máscara progressiva de CNPJ (PJ)", () => {
  assert.equal(Documento.formatarDocumento("112", "PJ"), "11.2");
  assert.equal(Documento.formatarDocumento("11222333", "PJ"), "11.222.333");
  assert.equal(Documento.formatarDocumento("112223330001", "PJ"), "11.222.333/0001");
  assert.equal(Documento.formatarDocumento("11222333000181", "PJ"), "11.222.333/0001-81");
});

test("formatarTelefone: celular (11) e fixo (10)", () => {
  assert.equal(Documento.formatarTelefone("11987654321"), "(11) 98765-4321");
  assert.equal(Documento.formatarTelefone("1132654321"), "(11) 3265-4321");
  assert.equal(Documento.formatarTelefone("119"), "(11) 9");
  assert.equal(Documento.formatarTelefone(""), "");
});

test("digitos: remove tudo que não é número", () => {
  assert.equal(Documento.digitos("(11) 98765-4321"), "11987654321");
  assert.equal(Documento.digitos("11.222.333/0001-81"), "11222333000181");
});
