// agente-impressora/test/transporte.test.js
const test = require("node:test");
const assert = require("node:assert");
const { parseAlvoRede, validarConfigImpressora } = require("../main/transporte");

test("parseAlvoRede: host:porta", () => {
  assert.deepEqual(parseAlvoRede("192.168.0.50:9100"), { host: "192.168.0.50", porta: 9100 });
});
test("parseAlvoRede: so host usa porta 9100", () => {
  assert.deepEqual(parseAlvoRede("192.168.0.50"), { host: "192.168.0.50", porta: 9100 });
});
test("parseAlvoRede: vazio/invalido -> null", () => {
  assert.equal(parseAlvoRede(""), null);
  assert.equal(parseAlvoRede("  "), null);
});
test("validarConfigImpressora: rede sem host -> erro", () => {
  assert.equal(validarConfigImpressora({ conexao: "rede", alvo: "" }).ok, false);
});
test("validarConfigImpressora: rede com host -> ok", () => {
  assert.equal(validarConfigImpressora({ conexao: "rede", alvo: "10.0.0.2:9100" }).ok, true);
});
test("validarConfigImpressora: serial/usb sem alvo -> erro; com alvo -> ok", () => {
  assert.equal(validarConfigImpressora({ conexao: "serial", alvo: "" }).ok, false);
  assert.equal(validarConfigImpressora({ conexao: "serial", alvo: "COM3" }).ok, true);
  assert.equal(validarConfigImpressora({ conexao: "usb", alvo: "" }).ok, false);
  assert.equal(validarConfigImpressora({ conexao: "usb", alvo: "ELGIN i9" }).ok, true);
});
