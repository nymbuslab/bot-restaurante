const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const db = require("../src/db");
const empresas = require("../src/empresas");

// ---------------------------------------------------------------------------
// Revogar sessão ao redefinir senha e ao sair.
//
// O projeto já derruba as outras sessões quando o dono troca senha ou e-mail
// LOGADO (`_revogarOutrasSessoes`, com o comentário explicando que um refresh
// token roubado não pode sobreviver à troca de credencial). Dois caminhos
// ficaram de fora e quebravam essa mesma regra:
//
// 1. O RESET POR E-MAIL, que é justamente o que alguém usa depois de desconfiar
//    que a conta foi invadida. A senha mudava e o atacante continuava dentro,
//    renovando o token por até 30 dias.
// 2. O LOGOUT, que só limpava cookie. O refresh token seguia válido, então
//    "sair" no computador emprestado não tirava ninguém de lugar nenhum.
//
// O access token já emitido continua valendo até o `exp` (limitação do JWT, não
// da correção). O que se fecha é a RENOVAÇÃO, que é o que dá sobrevida longa.
// ---------------------------------------------------------------------------

const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");

function corpoDaRota(marcador) {
  const i = servidor.indexOf(marcador);
  assert.ok(i > -1, "rota não encontrada: " + marcador);
  const fim = servidor.indexOf("\napp.", i + 10);
  return servidor.slice(i, fim === -1 ? undefined : fim);
}

test("revogarTodasSessoes apaga a sessão pelo user_id", async () => {
  const calls = [];
  const antes = db.query;
  db.query = async (sql, params) => { calls.push({ sql, params }); return { rowCount: 3 }; };
  try {
    const n = await empresas.revogarTodasSessoes("user-123");
    assert.equal(n, 3);
    assert.match(calls[0].sql, /DELETE FROM auth\.sessions/i);
    assert.deepEqual(calls[0].params, ["user-123"]);
  } finally { db.query = antes; }
});

test("revogarTodasSessoes nunca lança: falhar não pode travar a redefinição", async () => {
  const antes = db.query;
  db.query = async () => { throw new Error("banco fora"); };
  try {
    assert.equal(await empresas.revogarTodasSessoes("user-123"), 0);
  } finally { db.query = antes; }
});

test("revogarTodasSessoes ignora chamada sem usuário", async () => {
  const antes = db.query;
  let chamou = false;
  db.query = async () => { chamou = true; return { rowCount: 0 }; };
  try {
    assert.equal(await empresas.revogarTodasSessoes(null), 0);
    assert.equal(chamou, false, "sem user_id, um DELETE solto apagaria a sessão de todo mundo");
  } finally { db.query = antes; }
});

test("redefinir senha derruba as sessões do usuário", () => {
  const c = corpoDaRota('app.post("/api/redefinir-senha"');
  assert.match(c, /revogarTodasSessoes/);
  const iSenha = c.indexOf("updateUserById");
  const iRevoga = c.indexOf("revogarTodasSessoes");
  assert.ok(iSenha > -1 && iRevoga > iSenha, "revoga depois de trocar a senha, não antes");
});

test("logout invalida o refresh token, não só o cookie", () => {
  const c = corpoDaRota('app.post("/api/logout"');
  assert.match(c, /signOut/i);
  assert.match(c, /limparSessaoCookies/); // continua limpando o cookie também
});
