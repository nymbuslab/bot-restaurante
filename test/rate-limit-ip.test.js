const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Incidente de 2026-08-22: um restaurante ficou sem conseguir entrar.
//
// Duas coisas se somaram.
//
// 1. O LOGOUT GLOBAL. A conta de um restaurante e COMPARTILHADA entre os
//    aparelhos (PDV do balcao, celular do dono, tablet do salao). O
//    `signOut(token, "global")` derrubava TODOS quando UMA pessoa clicava em
//    Sair. Passa a ser "local": invalida so aquela sessao, que ja resolve o furo
//    original (sair no computador emprestado). Derrubar a credencial inteira
//    segue existindo onde faz sentido: reset de senha e troca de credencial.
//
// 2. O BALDE COMPARTILHADO. `trust proxy` sozinho nao bastou atras do Fly:
//    `req.ip` caia no IP interno do proxy e a plataforma INTEIRA dividia o mesmo
//    limite de 10 logins por 15 minutos. Os aparelhos da loja tentaram entrar
//    juntos, estouraram o balde, e o 429 travou tambem os outros restaurantes.
//    Medido ao vivo durante o incidente: `ratelimit-remaining: 0` na PRIMEIRA
//    tentativa de um IP que nunca tinha tocado no endpoint.
// ---------------------------------------------------------------------------

const servidor = fs.readFileSync(path.join(__dirname, "..", "src", "servidor.js"), "utf8");

function corpoDaRota(marcador) {
  const i = servidor.indexOf(marcador);
  assert.ok(i > -1, "rota não encontrada: " + marcador);
  const fim = servidor.indexOf("\napp.", i + 10);
  return servidor.slice(i, fim === -1 ? undefined : fim);
}

test("todo limitador usa o IP real como chave, não o padrão", () => {
  const i = servidor.indexOf("function limitador(");
  assert.ok(i > -1);
  const corpo = servidor.slice(i, servidor.indexOf("\n}", i));
  assert.match(corpo, /keyGenerator:\s*chaveDoIp/,
    "sem chave própria, req.ip cai no proxy e um restaurante trava o outro");
});

test("a chave prefere o IP que o Fly manda, e cai no req.ip fora do Fly", () => {
  const i = servidor.indexOf("function chaveDoIp(");
  assert.ok(i > -1, "chaveDoIp não existe");
  const corpo = servidor.slice(i, servidor.indexOf("\n}", i));
  assert.match(corpo, /fly-client-ip/i, "o Fly manda o IP de origem neste cabeçalho");
  assert.match(corpo, /req\.ip/, "fora do Fly (local, outro host) precisa continuar funcionando");
  assert.match(corpo, /ipKeyGenerator/, "IPv6 precisa ser normalizado, senão cada requisição vira uma chave nova");
});

test("sair do painel do restaurante encerra SÓ aquele aparelho", () => {
  const c = corpoDaRota('app.post("/api/logout"');
  assert.match(c, /signOut\(token,\s*"local"\)/,
    'a conta e compartilhada entre aparelhos: "global" derruba a loja inteira');
  assert.doesNotMatch(c, /signOut\([^)]*"global"/, "nenhuma chamada com o escopo antigo (o comentario pode citar a palavra)");
});

test("no painel master o global continua certo — é uma pessoa só", () => {
  const c = corpoDaRota('app.post("/api/admin/logout"');
  assert.match(c, /"global"/,
    "master nao e conta compartilhada de loja; sair tem que sair de todo lugar");
});

test("reset de senha segue derrubando tudo — ali o objetivo é esse", () => {
  const c = corpoDaRota('app.post("/api/redefinir-senha"');
  assert.match(c, /revogarTodasSessoes/,
    "quem redefine a senha desconfia da conta: derrubar tudo e o comportamento certo");
});
