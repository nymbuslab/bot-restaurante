// ============================================================
// APP — sobe o Express de verdade numa porta livre e conversa com ele por HTTP.
//
// É a diferença entre esta bateria e os testes de test/*.test.js: lá o
// servidor.js é lido como TEXTO e conferido por expressão regular; aqui ele
// atende requisição. Regex na fonte fica verde quando o nome da função continua
// certo e o comportamento dentro dela mudou.
//
// Porta 0 = o sistema operacional escolhe uma livre. Duas baterias em paralelo,
// ou o painel do dono rodando na 3001, não colidem.
// ============================================================

require("./ambiente");

const servidor = require("../../../src/servidor");

let vivo = null;

async function subir() {
  if (vivo) return vivo;
  const s = servidor.iniciar(0);
  if (!s || typeof s.address !== "function") {
    throw new Error(
      "servidor.iniciar(porta) precisa devolver o servidor (return app.listen). " +
        "Sem isso não há como desligá-lo e o processo de teste nunca termina."
    );
  }
  await new Promise((ok, falhou) => {
    s.once("listening", ok);
    s.once("error", falhou);
  });
  vivo = { server: s, base: "http://127.0.0.1:" + s.address().port };
  return vivo;
}

async function derrubar() {
  if (!vivo) return;
  const s = vivo.server;
  vivo = null;
  await new Promise((ok) => s.close(ok));
}

// Requisição com o corpo já interpretado. Devolve status e corpo juntos porque
// todo teste daqui afirma sobre os dois: 200 com o dado errado é falha.
async function pedir(caminho, opcoes = {}) {
  const { base } = await subir();
  const cabecalhos = Object.assign({}, opcoes.cabecalhos);
  if (opcoes.token) cabecalhos.Authorization = "Bearer " + opcoes.token;
  if (opcoes.corpo !== undefined) cabecalhos["Content-Type"] = "application/json";

  const r = await fetch(base + caminho, {
    method: opcoes.metodo || (opcoes.corpo !== undefined ? "POST" : "GET"),
    headers: cabecalhos,
    body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
  });

  const texto = await r.text();
  let corpo = texto;
  try {
    corpo = JSON.parse(texto);
  } catch (_) {
    /* rota que devolve HTML (o cardápio web, por exemplo) */
  }
  return { status: r.status, corpo, texto };
}

module.exports = { subir, derrubar, pedir };
