const { test } = require("node:test");
const assert = require("node:assert/strict");

const permissoes = require("../src/permissoes");

test("perfil mais ajustes produz a permissão efetiva", () => {
  const efetivas = permissoes.resolverEfetivas({
    perfil: "caixa",
    ajustes: [
      { permissao: "pedidos.cancelar", permitido: true },
      { permissao: "caixa.fechar", permitido: false },
    ],
  });

  assert.equal(efetivas.has("caixa.abrir"), true);
  assert.equal(efetivas.has("caixa.fechar"), false);
  assert.equal(efetivas.has("pedidos.cancelar"), true);
});

test("funcionário não concede acesso que ele próprio não possui", () => {
  assert.throws(
    () => permissoes.validarDelegacao(new Set(["equipe.gerenciar"]), ["conta.excluir"]),
    /não pode conceder/i
  );
  assert.doesNotThrow(() =>
    permissoes.validarDelegacao(new Set(["equipe.gerenciar", "pedidos.ver"]), ["pedidos.ver"])
  );
});

test("ações exclusivas do dono nunca entram em perfil de funcionário", () => {
  for (const perfil of permissoes.PERFIS) {
    const efetivas = permissoes.resolverEfetivas({ perfil });
    assert.equal(efetivas.has("conta.excluir"), false);
    assert.equal(efetivas.has("assinatura.gerenciar"), false);
    assert.equal(efetivas.has("dispositivos.autorizar"), false);
  }
});
