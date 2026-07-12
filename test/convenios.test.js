const test = require("node:test");
const assert = require("node:assert");
const {
  calcularVencimentoConvenio, validarConvenio, normalizarConvenios, resumoFaixas,
} = require("../public/convenios");

const cv = (faixas, nome = "C") => ({ id: "cv_x", nome, faixas });

// --- calcularVencimentoConvenio ---
test("fixo: dia 10 mês seguinte — compra dentro do mês vence no próximo (corrige o bug)", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", c), "2026-08-10");
});

test("fixo: meses 0 = mesmo mês", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "fixo", valor: 20, meses: 0 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", c), "2026-07-20");
});

test("fixo: meses 2 = dois meses à frente", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 2 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", c), "2026-09-10");
});

test("fixo: clamp em mês curto (dia 31, meses 1, jan → fevereiro)", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "fixo", valor: 31, meses: 1 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-01-15", c), "2026-02-28");
});

test("fixo: virada de ano (dezembro + meses 1 → janeiro do ano seguinte)", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "fixo", valor: 5, meses: 1 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-12-20", c), "2027-01-05");
});

test("dias: 30 dias após a compra (meses ignorado)", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "dias", valor: 30, meses: 3 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", c), "2026-08-08");
});

test("split: dia 9 cai na 1ª faixa, dia 20 na 2ª", () => {
  const c = cv([
    { de: 1, ate: 15, tipo: "fixo", valor: 10, meses: 1 },
    { de: 16, ate: 31, tipo: "fixo", valor: 15, meses: 2 },
  ]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", c), "2026-08-10");
  assert.strictEqual(calcularVencimentoConvenio("2026-07-20", c), "2026-09-15");
});

test("sem convênio / sem faixas / dia fora das faixas → null", () => {
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", null), null);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", cv([])), null);
  const parcial = cv([{ de: 1, ate: 5, tipo: "fixo", valor: 10, meses: 1 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-20", parcial), null);
});

// --- validarConvenio ---
test("válido: faixas cobrem 1–31", () => {
  assert.strictEqual(validarConvenio(cv([{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }])), null);
});

test("inválido: sem nome", () => {
  assert.match(validarConvenio(cv([{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }], "")), /nome/i);
});

test("inválido: buraco na cobertura (1–15 e 17–31)", () => {
  const c = cv([
    { de: 1, ate: 15, tipo: "fixo", valor: 10, meses: 1 },
    { de: 17, ate: 31, tipo: "fixo", valor: 10, meses: 1 },
  ]);
  assert.match(validarConvenio(c), /1 a 31|cobrir/i);
});

test("inválido: sobreposição (1–20 e 15–31)", () => {
  const c = cv([
    { de: 1, ate: 20, tipo: "fixo", valor: 10, meses: 1 },
    { de: 15, ate: 31, tipo: "fixo", valor: 10, meses: 1 },
  ]);
  assert.notStrictEqual(validarConvenio(c), null);
});

test("inválido: fixo com valor fora de 1–31", () => {
  assert.notStrictEqual(validarConvenio(cv([{ de: 1, ate: 31, tipo: "fixo", valor: 40, meses: 0 }])), null);
});

test("inválido: dias com valor < 1", () => {
  assert.notStrictEqual(validarConvenio(cv([{ de: 1, ate: 31, tipo: "dias", valor: 0, meses: 0 }])), null);
});

// --- normalizarConvenios ---
test("normaliza: descarta inválidos, coage tipos, força meses=0 no tipo dias", () => {
  const entrada = [
    { id: "cv_a", nome: "Ok", faixas: [{ de: "1", ate: "31", tipo: "dias", valor: "30", meses: "5" }] },
    { id: "cv_b", nome: "", faixas: [] }, // inválido: sem nome/faixas
  ];
  const out = normalizarConvenios(entrada);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].faixas[0].meses, 0); // dias força meses 0
  assert.strictEqual(out[0].faixas[0].de, 1);    // coage p/ número
});

test("normaliza: gera id quando ausente", () => {
  const out = normalizarConvenios([{ nome: "Todo 10", faixas: [{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }] }]);
  assert.strictEqual(out.length, 1);
  assert.ok(out[0].id && typeof out[0].id === "string");
});

// --- resumoFaixas ---
test("resumoFaixas: texto legível", () => {
  const s = resumoFaixas(cv([{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }]));
  assert.match(s, /10/);
});

test("resumoFaixas: ramo dias (N dias após a compra)", () => {
  const s = resumoFaixas(cv([{ de: 1, ate: 31, tipo: "dias", valor: 30, meses: 0 }]));
  assert.match(s, /30 dias/);
});

test("normalizarConvenios: desambigua ids colididos (mesmo nome → ids distintos)", () => {
  const out = normalizarConvenios([
    { nome: "Todo 10", faixas: [{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }] },
    { nome: "Todo 10", faixas: [{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }] },
  ]);
  assert.strictEqual(out.length, 2);
  assert.notStrictEqual(out[0].id, out[1].id);
});

test("normalizarConvenios: nome só com símbolos ainda gera id não vazio", () => {
  const out = normalizarConvenios([{ nome: "@@@", faixas: [{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }] }]);
  assert.strictEqual(out.length, 1);
  assert.match(out[0].id, /^cv_.+/); // não fica "cv_" pelado
});
