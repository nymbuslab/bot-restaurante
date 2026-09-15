const crypto = require("node:crypto");

function hash(entrada) {
  return crypto.createHash("sha256").update(entrada).digest("hex");
}

function idDeterministico(escopo, tipo) {
  const valor = hash(escopo + ":" + tipo).slice(0, 32).split("");
  valor[12] = "4";
  valor[16] = ((parseInt(valor[16], 16) & 3) | 8).toString(16);
  const texto = valor.join("");
  return [texto.slice(0, 8), texto.slice(8, 12), texto.slice(12, 16), texto.slice(16, 20), texto.slice(20)].join("-");
}

function criarCenario({ semente, empresaId, slug }) {
  if (!semente || !empresaId || !slug) {
    throw new Error("semente, empresaId e slug são obrigatórios para criar fixtures isoladas");
  }

  const escopo = [empresaId, slug, semente].join(":");
  const id = (tipo) => idDeterministico(escopo, tipo);
  const produtoId = id("alvo-produto");
  const variacaoId = id("alvo-variacao");
  const fornecedorId = id("fornecedor");
  const contaId = id("conta");
  const compraId = id("compra");

  return {
    empresa: { id: empresaId, slug },
    atores: {
      dono: { id: id("ator-dono"), empresa_id: empresaId, tipo: "dono" },
      funcionario: {
        id: id("ator-funcionario"),
        empresa_id: empresaId,
        tipo: "funcionario",
        perfil: "estoque_compras",
      },
    },
    alvos: {
      produto: {
        id: produtoId,
        empresa_id: empresaId,
        tipo: "produto",
        referencia_local: "101",
      },
      variacao: {
        id: variacaoId,
        empresa_id: empresaId,
        tipo: "variacao",
        referencia_local: "101:sabor-a",
        alvo_pai_id: produtoId,
      },
    },
    fornecedor: {
      id: fornecedorId,
      empresa_id: empresaId,
      nome: "Fornecedor " + semente,
      documento: null,
    },
    conta: {
      id: contaId,
      empresa_id: empresaId,
      nome: "Conta principal",
      saldo_inicial_centavos: 0,
    },
    compra: {
      id: compraId,
      empresa_id: empresaId,
      fornecedor_id: fornecedorId,
      estado: "rascunho",
      chave_idempotencia: "compra_" + hash(escopo + ":idempotencia").slice(0, 40),
      linhas: [
        {
          id: id("compra-linha-1"),
          alvo_id: variacaoId,
          quantidade_embalagens: 4,
          quantidade_por_embalagem: "5.000",
          unidade_base: "kg",
          valor_bruto_centavos: 12000,
        },
      ],
    },
    parcela: {
      id: id("parcela-1"),
      empresa_id: empresaId,
      compra_id: compraId,
      conta_id: contaId,
      numero: 1,
      valor_centavos: 12000,
      estado: "aberta",
    },
  };
}

module.exports = { criarCenario, idDeterministico };
