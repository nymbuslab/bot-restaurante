const test = require("node:test");
const assert = require("node:assert/strict");
const H = require("../public/horario");

// Segunda 10:00 como referência (dia 1 = segunda).
const seg = (hh, mm) => ({ dia: 1, min: hh * 60 + (mm || 0) });
const ter = (hh, mm) => ({ dia: 2, min: hh * 60 + (mm || 0) });

const cfg = (horarios, aberto) => ({ atendimento: aberto === undefined ? {} : { aberto }, horarios });

test("abertoAgora: janela normal no mesmo dia", () => {
  const c = cfg({ seg: { abre: "11:00", fecha: "22:00" } });
  assert.equal(H.abertoAgora(c, seg(10, 59)), false);
  assert.equal(H.abertoAgora(c, seg(11, 0)), true);
  assert.equal(H.abertoAgora(c, seg(21, 59)), true);
  assert.equal(H.abertoAgora(c, seg(22, 0)), false);   // fecha é exclusivo
});

// O caso que o dono viu na tela: 00:00 às 00:00 quer dizer "aberto 24 horas".
// A versão antiga do painel fazia `min >= 0 && min < 0` e dizia fechado o dia todo.
test("abertoAgora: 00:00 às 00:00 é 24 horas abertas", () => {
  const c = cfg({ seg: { abre: "00:00", fecha: "00:00" } });
  assert.equal(H.abertoAgora(c, seg(0, 0)), true);
  assert.equal(H.abertoAgora(c, seg(3, 30)), true);
  assert.equal(H.abertoAgora(c, seg(23, 59)), true);
});

test("abertoAgora: fechar às 00:00 vale o dia inteiro até a meia-noite", () => {
  const c = cfg({ seg: { abre: "11:00", fecha: "00:00" } });
  assert.equal(H.abertoAgora(c, seg(10, 59)), false);
  assert.equal(H.abertoAgora(c, seg(23, 59)), true);
});

// Pizzaria das 18:00 às 02:00: o painel antigo ficava fechado 24h por dia.
test("abertoAgora: horário que vira a noite abre antes da meia-noite", () => {
  const c = cfg({ seg: { abre: "18:00", fecha: "02:00" } });
  assert.equal(H.abertoAgora(c, seg(17, 59)), false);
  assert.equal(H.abertoAgora(c, seg(18, 0)), true);
  assert.equal(H.abertoAgora(c, seg(23, 59)), true);
});

test("abertoAgora: cauda da madrugada conta a janela do dia anterior", () => {
  const c = cfg({ seg: { abre: "18:00", fecha: "02:00" }, ter: { fechado: true } });
  assert.equal(H.abertoAgora(c, ter(1, 59)), true);    // ainda é a segunda que virou
  assert.equal(H.abertoAgora(c, ter(2, 0)), false);
});

test("abertoAgora: config sem `atendimento.aberto` NÃO fecha a loja", () => {
  const c = { horarios: { seg: { abre: "11:00", fecha: "22:00" } } };
  assert.equal(H.abertoAgora(c, seg(12, 0)), true);
  assert.equal(H.abertoAgora({ atendimento: {}, horarios: c.horarios }, seg(12, 0)), true);
});

test("abertoAgora: o interruptor manual fecha mesmo dentro do horário", () => {
  const c = cfg({ seg: { abre: "11:00", fecha: "22:00" } }, false);
  assert.equal(H.abertoAgora(c, seg(12, 0)), false);
});

test("abertoAgora: dia marcado como fechado, e sem tabela de horários", () => {
  assert.equal(H.abertoAgora(cfg({ seg: { fechado: true, abre: "11:00", fecha: "22:00" } }), seg(12, 0)), false);
  assert.equal(H.abertoAgora({ atendimento: { aberto: true } }, seg(3, 0)), true); // sem horários = sempre aberto
});

test("abertoAgora: dia aberto sem horário definido fica sempre aberto", () => {
  assert.equal(H.abertoAgora(cfg({ seg: {} }), seg(4, 0)), true);
});

test("textoHorario: agrupa dias seguidos e pula os fechados", () => {
  const horarios = {
    seg: { abre: "11:00", fecha: "22:00" }, ter: { abre: "11:00", fecha: "22:00" },
    qua: { abre: "11:00", fecha: "22:00" }, qui: { abre: "11:00", fecha: "22:00" },
    sex: { abre: "11:00", fecha: "22:00" }, sab: { abre: "11:00", fecha: "23:00" },
    dom: { fechado: true },
  };
  assert.equal(H.textoHorario(horarios),
    "Nosso atendimento é de *Segunda* a *Sexta* das *11:00* às *22:00*; *Sábado* das *11:00* às *23:00*");
});

test("textoHorario: sem nenhum dia aberto devolve vazio (o fallback é de quem chama)", () => {
  const tudoFechado = {};
  H.DIAS.forEach((d) => { tudoFechado[d] = { fechado: true }; });
  assert.equal(H.textoHorario(tudoFechado), "");
  assert.equal(H.textoHorario(null), "");
});

// Comportamento herdado das duas implementações antigas, preservado de propósito:
// dia AUSENTE da tabela não é "fechado", é o padrão 11:00 às 22:00.
test("textoHorario: dia ausente da tabela vale como 11:00 às 22:00", () => {
  assert.equal(H.textoHorario({ seg: { fechado: true } }),
    "Nosso atendimento é de *Terça* a *Domingo* das *11:00* às *22:00*");
});

test("proximaAbertura: hoje, amanhã e dia nomeado", () => {
  const c = cfg({ seg: { abre: "18:00", fecha: "23:00" }, ter: { abre: "08:00", fecha: "23:00" } });
  assert.equal(H.proximaAbertura(c, seg(10, 0)), "hoje às *18:00*");
  assert.equal(H.proximaAbertura(c, seg(19, 0)), "amanhã (terça) às *08:00*");
  assert.equal(H.proximaAbertura(cfg({ sab: { abre: "10:00", fecha: "20:00" } }), seg(9, 0)), "sábado às *10:00*");
});

test("paraMin: 00:00 é 0 na abertura e 1440 no fechamento", () => {
  assert.equal(H.paraMin("00:00"), 0);
  assert.equal(H.paraMin("00:00", true), 1440);
  assert.equal(H.paraMin("18:30"), 1110);
});
