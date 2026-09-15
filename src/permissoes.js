const PERFIS = ["administrador", "gerente", "caixa", "atendimento", "cozinha", "estoque_compras"];

const EXCLUSIVAS_DONO = new Set([
  "assinatura.gerenciar",
  "conta.excluir",
  "conta.credenciais",
  "dispositivos.autorizar",
]);

const PADROES = {
  administrador: [
    "equipe.gerenciar",
    "atividades.ver",
    "pedidos.ver",
    "pedidos.editar",
    "pedidos.cancelar",
    "pdv.operar",
    "mesas.operar",
    "caixa.abrir",
    "caixa.movimentar",
    "caixa.fechar",
    "cardapio.editar",
    "estoque.ver",
    "estoque.movimentar",
    "clientes.ver",
    "relatorios.ver",
    "configuracoes.editar",
    "custos.ver",
    "compras.criar",
    "compras.confirmar",
  ],
  gerente: [
    "equipe.gerenciar",
    "atividades.ver",
    "pedidos.ver",
    "pedidos.editar",
    "pedidos.cancelar",
    "pdv.operar",
    "mesas.operar",
    "caixa.abrir",
    "caixa.movimentar",
    "caixa.fechar",
    "cardapio.editar",
    "estoque.ver",
    "estoque.movimentar",
    "clientes.ver",
    "relatorios.ver",
    "custos.ver",
    "compras.criar",
    "compras.confirmar",
  ],
  caixa: ["pedidos.ver", "pdv.operar", "mesas.operar", "caixa.abrir", "caixa.movimentar", "caixa.fechar"],
  atendimento: ["pedidos.ver", "pedidos.editar", "clientes.ver", "mesas.operar"],
  cozinha: ["pedidos.ver"],
  estoque_compras: ["estoque.ver", "estoque.movimentar", "custos.ver", "compras.criar"],
};

function resolverEfetivas({ perfil, permissoesPerfil = [], ajustes = [] }) {
  if (!PERFIS.includes(perfil)) throw new Error("Perfil de equipe inválido.");
  const efetivas = new Set(PADROES[perfil]);

  for (const regra of permissoesPerfil) {
    if (!regra || EXCLUSIVAS_DONO.has(regra.permissao)) continue;
    if (regra.permitido) efetivas.add(regra.permissao);
    else efetivas.delete(regra.permissao);
  }
  for (const ajuste of ajustes) {
    if (!ajuste || EXCLUSIVAS_DONO.has(ajuste.permissao)) continue;
    if (ajuste.permitido) efetivas.add(ajuste.permissao);
    else efetivas.delete(ajuste.permissao);
  }
  return efetivas;
}

function validarDelegacao(permissoesAtor, solicitadas) {
  for (const permissao of solicitadas || []) {
    if (EXCLUSIVAS_DONO.has(permissao) || !permissoesAtor.has(permissao)) {
      throw new Error("O funcionário não pode conceder uma permissão que não possui.");
    }
  }
  return true;
}

module.exports = { PERFIS, EXCLUSIVAS_DONO, PADROES, resolverEfetivas, validarDelegacao };
