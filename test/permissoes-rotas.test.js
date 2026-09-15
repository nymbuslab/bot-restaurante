const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");

function linhaDaRota(metodo, rota) {
  return servidor
    .split(/\r?\n/)
    .find((linha) => linha.includes(`app.${metodo}("${rota}"`)) || "";
}

function exige(metodo, rota, permissao) {
  const linha = linhaDaRota(metodo, rota);
  assert.ok(linha, `${metodo.toUpperCase()} ${rota} não existe`);
  assert.match(linha, new RegExp(`exigePermissao\\("${permissao.replace(".", "\\.")}"\\)`));
}

test("pedidos, PDV, mesas, caixa, catálogo, estoque, relatórios e configuração têm regra explícita", () => {
  exige("get", "/api/pedidos", "pedidos.ver");
  exige("post", "/api/pedidos/:id/itens", "pedidos.editar");
  exige("post", "/api/pedidos/:id/cancelar", "pedidos.cancelar");
  exige("post", "/api/pdv/vender", "pdv.operar");
  exige("get", "/api/mesas", "mesas.operar");
  exige("post", "/api/caixa/abrir", "caixa.abrir");
  exige("post", "/api/caixa/movimento", "caixa.movimentar");
  exige("post", "/api/caixa/fechar", "caixa.fechar");
  exige("put", "/api/cardapio", "cardapio.editar");
  exige("get", "/api/estoque", "estoque.ver");
  exige("post", "/api/estoque/movimentos", "estoque.movimentar");
  exige("get", "/api/dashboard", "relatorios.ver");
  exige("put", "/api/config", "configuracoes.editar");
});

test("toda rota mutável autenticada possui autorização explícita", () => {
  const linhas = servidor.split(/\r?\n/).filter((linha) =>
    /app\.(post|put|patch|delete)\(/.test(linha) && linha.includes("exigeAuth")
  );
  assert.ok(linhas.length > 30, "a varredura encontrou poucas rotas mutáveis");
  for (const linha of linhas) {
    assert.match(linha, /exigePermissao\(/, `rota mutável sem permissão: ${linha.trim()}`);
  }
});

test("assinatura, credenciais e exclusão da conta continuam exclusivas do dono", () => {
  exige("post", "/api/assinatura/checkout", "assinatura.gerenciar");
  exige("patch", "/api/conta/senha", "conta.credenciais");
  exige("patch", "/api/conta/email", "conta.credenciais");
  exige("delete", "/api/conta", "conta.excluir");
});
