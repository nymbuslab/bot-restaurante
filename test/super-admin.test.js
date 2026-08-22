const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Painel master: as duas correções que o restaurante já tinha e a conta mais
// privilegiada do produto não.
//
// 1. REVOGAÇÃO DE SESSÃO. O restaurante ganhou isso em 30d0148: sair invalida o
//    refresh token (`signOut(token, "global")`) e trocar credencial derruba as
//    outras sessões (`signOut(jwt, "others")`). O master ficou de fora nas duas
//    pontas — `/api/admin/logout` era um no-op e `/api/admin/conta` trocava
//    e-mail e senha sem derrubar nada. Medido em produção quando o defeito foi
//    encontrado: 35 sessões abertas do master, a mais antiga com dois meses.
//
//    Agrava que a própria rota de conta faz `signInWithPassword` só para
//    conferir a senha atual, criando MAIS uma sessão a cada verificação. Como
//    essa sessão nova não é a do token em uso, o "others" a derruba junto.
//
// 2. CORPO DESPROTEGIDO. Rejeição async fora de try/catch não derruba o
//    processo (o `index.js` instala um handler global de unhandledRejection),
//    mas também nunca responde: a requisição fica pendurada. Verificado rodando
//    com o mesmo handler — 5s sem resposta contra um 500 imediato com try.
//    Mesma classe corrigida em 3170279 para os gates de plano.
//
//    No excluir é pior: o cancelamento no Stripe acontece ANTES do
//    `empresas.excluir`, então uma falha ali deixa a assinatura cancelada, o
//    tenant de pé e o admin sem resposta para saber em que pé ficou.
// ---------------------------------------------------------------------------

const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");
const linhas = servidor.split("\n");

function corpoDaRota(marcador) {
  const i = servidor.indexOf(marcador);
  assert.ok(i > -1, "rota não encontrada: " + marcador);
  const fim = servidor.indexOf("\napp.", i + 10);
  return servidor.slice(i, fim === -1 ? undefined : fim);
}

// Primeira instrução de código do corpo (ignora comentários e linhas vazias).
function primeiraInstrucao(marcador) {
  let i = linhas.findIndex((l) => l.startsWith(marcador));
  assert.ok(i > -1, "rota não encontrada: " + marcador);
  for (let j = i + 1; j < linhas.length; j++) {
    const t = linhas[j].trim();
    if (t && !t.startsWith("//")) return t;
  }
  return "";
}

test("sair do painel master invalida a sessão, não só o token na aba", () => {
  const c = corpoDaRota('app.post("/api/admin/logout"');
  assert.match(c, /signOut/, "logout no-op deixava 35 refresh tokens vivos");
  assert.match(c, /"global"/, "sair é sair de todo lugar, como já é no restaurante");
});

test("trocar e-mail ou senha do master derruba as outras sessões", () => {
  const c = corpoDaRota('app.patch("/api/admin/conta"');
  assert.match(c, /signOut/);
  assert.match(c, /"others"/, "mantém a sessão de quem está trocando, derruba o resto");
  const iUpd = c.indexOf("updateUserById");
  const iRev = c.indexOf("signOut");
  assert.ok(iUpd > -1 && iRev > iUpd, "revoga DEPOIS de trocar, senão a troca falha e derrubou à toa");
});

// ---- corpo protegido ----

const ROTAS_CRITICAS = [
  'app.get("/api/admin/tenants"',
  'app.patch("/api/admin/tenants/:slug/suspender"',
  'app.patch("/api/admin/tenants/:slug/reativar"',
  'app.delete("/api/admin/tenants/:slug"',
  'app.patch("/api/admin/tenants/:slug/plano"',
  'app.patch("/api/admin/tenants/:slug/assinatura/cortesia"',
  'app.patch("/api/admin/tenants/:slug/assinatura/revogar"',
  'app.patch("/api/admin/tenants/:slug/assinatura/cancelar"',
];

ROTAS_CRITICAS.forEach((rota) => {
  const nome = rota.replace(/^app\.\w+\("/, "").replace(/"$/, "");
  test(`${nome} responde mesmo se o banco falhar`, () => {
    assert.equal(primeiraInstrucao(rota), "try {",
      "o corpo inteiro precisa estar no try: um await solto antes dele pendura a requisição");
  });
});

test("o excluir diz ao admin em que pé ficou quando falha no meio", () => {
  const c = corpoDaRota('app.delete("/api/admin/tenants/:slug"');
  const iStripe = c.indexOf("cancelarAssinatura");
  const iExcluir = c.indexOf("empresas.excluir");
  assert.ok(iStripe > -1 && iExcluir > iStripe, "Stripe antes de apagar segue valendo");
  assert.match(c, /assinatura j\u00e1 foi cancelada/i,
    "falhar depois do Stripe exige mensagem própria: silêncio esconde a cobrança já cancelada");
});
