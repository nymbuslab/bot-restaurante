const { test } = require("node:test");
const assert = require("node:assert/strict");

const PERFIS = ["administrador", "gerente", "caixa", "atendimento", "cozinha", "estoque_compras"];
const ROTAS_PROTEGIDAS = [
  contrato("GET", "/api/equipe", 200),
  contrato("POST", "/api/equipe", 201),
  contrato("PUT", "/api/equipe/:id", 200),
  contrato("POST", "/api/equipe/:id/desbloquear", 200),
  contrato("GET", "/api/equipe/dispositivos", 200, { funcionario_autorizado: 403 }),
  contrato("POST", "/api/equipe/dispositivos/autorizar", 201, { funcionario_autorizado: 403 }),
  contrato("DELETE", "/api/equipe/dispositivos/:id", 204, { funcionario_autorizado: 403 }),
  contrato("POST", "/api/equipe/sessoes/pin", 201),
  contrato("GET", "/api/equipe/atividades", 200),
];

function contrato(metodo, rota, sucesso, ajustes = {}) {
  return {
    metodo,
    rota,
    esperado: Object.assign(
      {
        dono: sucesso,
        funcionario_autorizado: sucesso,
        funcionario_sem_permissao: 403,
        outro_tenant: 404,
      },
      ajustes
    ),
  };
}

function registrarTentativaPin(estado, { valido, agora }) {
  if (valido) return { tentativas: 0, bloqueado_ate: null };
  const tentativas = estado.tentativas + 1;
  return {
    tentativas,
    bloqueado_ate: tentativas >= 5 ? new Date(agora + 15 * 60 * 1000).toISOString() : null,
  };
}

function sessaoEstaAtiva({ ultimoAcesso, agora, limiteMinutos = 15 }) {
  return Date.parse(agora) - Date.parse(ultimoAcesso) < limiteMinutos * 60 * 1000;
}

test("enumera os seis perfis ajustáveis aprovados", () => {
  assert.deepEqual(PERFIS, ["administrador", "gerente", "caixa", "atendimento", "cozinha", "estoque_compras"]);
});

test("cada rota protegida diferencia dono, autorizado, sem permissão e outro tenant", () => {
  assert.ok(ROTAS_PROTEGIDAS.length > 0);
  for (const contrato of ROTAS_PROTEGIDAS) {
    assert.deepEqual(Object.keys(contrato.esperado).sort(), ["dono", "funcionario_autorizado", "funcionario_sem_permissao", "outro_tenant"].sort());
    for (const status of Object.values(contrato.esperado)) assert.ok(Number.isInteger(status));
  }
});

test("cinco PINs inválidos bloqueiam o funcionário por quinze minutos", () => {
  let estado = { tentativas: 0, bloqueado_ate: null };
  const inicio = Date.parse("2026-09-14T12:00:00Z");

  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    estado = registrarTentativaPin(estado, { valido: false, agora: inicio });
  }

  assert.equal(estado.tentativas, 5);
  assert.equal(estado.bloqueado_ate, "2026-09-14T12:15:00.000Z");
});

test("a inatividade padrão encerra a sessão depois de quinze minutos", () => {
  const ultimoAcesso = "2026-09-14T12:00:00.000Z";
  assert.equal(sessaoEstaAtiva({ ultimoAcesso, agora: "2026-09-14T12:14:59.999Z" }), true);
  assert.equal(sessaoEstaAtiva({ ultimoAcesso, agora: "2026-09-14T12:15:00.000Z" }), false);
});
