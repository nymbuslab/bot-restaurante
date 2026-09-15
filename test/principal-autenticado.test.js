const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");

function corpoExigeAuth() {
  const inicio = servidor.indexOf("async function exigeAuth(");
  assert.ok(inicio >= 0, "exigeAuth precisa existir");
  const fim = servidor.indexOf("\nfunction exigePermissao", inicio);
  return servidor.slice(inicio, fim);
}

test("o middleware resolve tanto JWT do dono quanto sessão opaca de funcionário", () => {
  const corpo = corpoExigeAuth();
  assert.match(servidor, /require\(["']\.\/equipe-db["']\)/);
  assert.match(corpo, /empresas\.resolverPorToken\(/);
  assert.match(corpo, /equipeDb\.resolverSessao\(/);
});

test("toda autenticação protegida expõe empresa e ator antes de liberar a rota", () => {
  const corpo = corpoExigeAuth();
  const empresa = corpo.indexOf("req.empresaId =");
  const ator = corpo.indexOf("req.ator =");
  const proxima = corpo.indexOf("next()");
  assert.ok(empresa >= 0, "req.empresaId não foi definido");
  assert.ok(ator >= 0, "req.ator não foi definido");
  assert.ok(empresa < proxima && ator < proxima, "o principal precisa existir antes de next()");
});

test("o servidor possui um gate reutilizável de permissão e preserva acesso irrestrito do dono", () => {
  assert.match(servidor, /function exigePermissao\(/);
  const inicio = servidor.indexOf("function exigePermissao(");
  const fim = servidor.indexOf("\nasync function exigeAssinatura", inicio);
  const corpo = servidor.slice(inicio, fim);
  assert.match(corpo, /ator\.tipo\s*===\s*["']dono["']/);
  assert.match(corpo, /status\(403\)/);
});
