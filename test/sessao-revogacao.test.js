const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// Env dummy: `src/supabase.js` LANÇA no require quando falta credencial, e o
// `src/empresas.js` logo abaixo o carrega. Sem isto o arquivo inteiro morre antes
// do primeiro teste — e some do CI, que não tem `.env`. Aqui a máquina do dono
// passava porque o dotenv repõe as chaves a partir do `.env` local, então a
// suíte ficava verde no notebook e vermelha no GitHub. Mesmo preâmbulo do
// `test/seguranca.test.js`. Valores fake só para os módulos CARREGAREM: nenhum
// teste deste arquivo toca a rede ou o banco (ele lê `src/servidor.js` como texto).
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "anon-dummy";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "service-dummy";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://u:p@localhost:5432/db";
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

// ---------------------------------------------------------------------------
// Gate de plano na impressão térmica.
//
// `/api/agente/pendentes`, `/api/agente/fila` e `/api/pedidos/:id/reimprimir`
// tinham só `exigeAuth`. Um tenant do Essencial que instalasse o agente ganhava
// impressão automática de graça — a documentação lista impressão térmica como
// feature do Plano Completo, e Caixa e PDV já eram barrados.
//
// As rotas que MARCAM como impresso ficam abertas de propósito: são
// escrituração idempotente, e barrar faria o agente de um tenant que acabou de
// cair de plano tentar para sempre o mesmo trabalho.
// ---------------------------------------------------------------------------

test("temImpressao segue a mesma regra dos outros gates do Completo", () => {
  const completo = { plano: "completo", assinatura_status: "active", ativo: true };
  const essencial = { plano: "essencial", assinatura_status: "active", ativo: true };
  assert.equal(empresas.temImpressao(completo), empresas.temPdv(completo));
  assert.equal(empresas.temImpressao(essencial), false);
  assert.equal(empresas.temImpressao(essencial), empresas.temPdv(essencial));
});

test("temImpressao exige acesso liberado, não só o plano", () => {
  const suspenso = { plano: "completo", assinatura_status: "active", ativo: false };
  assert.equal(empresas.temImpressao(suspenso), false);
});

test("as rotas que buscam trabalho de impressão passam pelo gate de plano", () => {
  ['app.get("/api/agente/pendentes"', 'app.get("/api/agente/fila"', 'app.post("/api/pedidos/:id/reimprimir"']
    .forEach((rota) => {
      const c = corpoDaRota(rota);
      assert.match(c, /exigeImpressao/, rota + " precisa do gate de plano");
    });
});

test("as rotas que marcam como impresso seguem sem gate", () => {
  const c = corpoDaRota('app.post("/api/agente/fila/:id/impresso"');
  assert.doesNotMatch(c, /exigeImpressao/,
    "barrar a marcação faria o agente de um tenant rebaixado repetir o mesmo trabalho para sempre");
});

test("os gates de plano nao deixam a requisicao sem resposta", () => {
  ["async function exigePdv", "async function exigeCaixa", "async function bloqueiaMesaSeVencido"]
    .forEach((nome) => {
      const i = servidor.indexOf(nome);
      assert.ok(i > -1, nome);
      const corpo = servidor.slice(i, servidor.indexOf("\n}", i));
      // Chamados FORA do try das rotas: rejeição solta pendura a requisição.
      assert.match(corpo, /catch/, nome + " precisa capturar a falha de banco");
    });
});
