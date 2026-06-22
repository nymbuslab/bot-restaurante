const test = require("node:test");
const assert = require("node:assert/strict");
const { montarEscPos } = require("../public/serial-escpos");

function bytes(arr) { return Array.from(arr); }

test("montarEscPos: começa com init + codepage CP850", () => {
  const b = bytes(montarEscPos("AB", {}));
  assert.deepEqual(b.slice(0, 5), [0x1B, 0x40, 0x1B, 0x74, 0x02]); // ESC @ + ESC t 2
  assert.equal(b[5], 0x41); // A
  assert.equal(b[6], 0x42); // B
});
test("montarEscPos: padrão = avanço + corte parcial GS V 1", () => {
  const b = bytes(montarEscPos("X", {}));
  assert.deepEqual(b.slice(-6), [0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x01]);
});
test("montarEscPos: corte total emite GS V 0", () => {
  const b = bytes(montarEscPos("X", { corte: "total" }));
  assert.deepEqual(b.slice(-6), [0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x00]);
});
test("montarEscPos: corte nenhum termina no avanço (sem GS V)", () => {
  const b = bytes(montarEscPos("X", { corte: "nenhum" }));
  assert.deepEqual(b.slice(-3), [0x0A, 0x0A, 0x0A]);
  assert.ok(!b.includes(0x56)); // sem comando de corte
});
test("montarEscPos: acento mapeado em CP850 (ç=0x87, ã=0xC6)", () => {
  const b = bytes(montarEscPos("ç ã", {}));
  assert.ok(b.includes(0x87));
  assert.ok(b.includes(0xC6));
});
test("montarEscPos: semAcento normaliza (ç→c) e não emite codepage", () => {
  const b = bytes(montarEscPos("ção", { semAcento: true }));
  assert.deepEqual(b.slice(0, 2), [0x1B, 0x40]);      // init
  assert.notDeepEqual(b.slice(2, 4), [0x1B, 0x74]);   // sem ESC t
  assert.ok(b.includes(0x63));   // 'c'
  assert.ok(!b.includes(0x87));  // sem byte CP850
});
