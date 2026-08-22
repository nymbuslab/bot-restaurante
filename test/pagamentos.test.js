const { test } = require("node:test");
const assert = require("node:assert/strict");
const { FORMAS_PAGAMENTO, normalizarFormasPagamento } = require("../public/pagamentos");
const pg = require("../public/pagamentos");

test("FORMAS_PAGAMENTO: vocabulário fixo em ordem canônica", () => {
  assert.deepEqual(FORMAS_PAGAMENTO, ["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito"]);
});

test("normalizarFormasPagamento: mapeia strings legadas → canônicas", () => {
  // "Pix" minúsculo, "Cartão (na entrega)" genérico → Crédito + Débito, "Dinheiro" ok.
  assert.deepEqual(
    normalizarFormasPagamento(["Pix", "Cartão (na entrega)", "Dinheiro"]),
    ["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito"]
  );
});

test("normalizarFormasPagamento: mantém a ordem canônica, não a de entrada", () => {
  assert.deepEqual(
    normalizarFormasPagamento(["Cartão de Débito", "PIX", "Dinheiro"]),
    ["Dinheiro", "PIX", "Cartão de Débito"]
  );
});

test("normalizarFormasPagamento: descarta 'A Prazo' (não é mais forma canônica)", () => {
  assert.deepEqual(normalizarFormasPagamento(["Dinheiro", "A Prazo", "fiado"]), ["Dinheiro"]);
});

test("normalizarFormasPagamento: crédito e débito específicos", () => {
  assert.deepEqual(normalizarFormasPagamento(["Cartão de crédito"]), ["Cartão de Crédito"]);
  assert.deepEqual(normalizarFormasPagamento(["cartao de debito"]), ["Cartão de Débito"]);
});

test("normalizarFormasPagamento: descarta desconhecidos e deduplica", () => {
  assert.deepEqual(
    normalizarFormasPagamento(["Outros", "PIX", "pix", "cheque"]),
    ["PIX"]
  );
});

test("normalizarFormasPagamento: nunca vazio (fallback Dinheiro)", () => {
  assert.deepEqual(normalizarFormasPagamento([]), ["Dinheiro"]);
  assert.deepEqual(normalizarFormasPagamento(["Outros"]), ["Dinheiro"]);
  assert.deepEqual(normalizarFormasPagamento(null), ["Dinheiro"]);
  assert.deepEqual(normalizarFormasPagamento("xyz"), ["Dinheiro"]);
});

test("normalizarFormasPagamento: idempotente sobre o conjunto canônico", () => {
  assert.deepEqual(normalizarFormasPagamento(FORMAS_PAGAMENTO), FORMAS_PAGAMENTO);
});

// ---------------------------------------------------------------------------
// A validação da venda tem que usar a MESMA lista que a tela mostrou.
//
// O PDV recebia as formas normalizadas (`/api/caixa` roda
// `normalizarFormasPagamento`) mas o servidor conferia a escolha contra a lista
// CRUA do `config.pagamentos`. Num tenant com dado legado — `["Dinheiro",
// "Cartão"]`, de quando as formas eram texto livre — a tela oferecia "Cartão de
// Crédito" e o servidor recusava, porque aquela string não existe na lista crua.
// Toda venda no cartão morria com 400 "Forma de pagamento inválida", e o
// operador não tem como adivinhar o motivo.
//
// Ninguém está afetado hoje (salvar as Configurações já normaliza, e os dois
// tenants estão canônicos), mas tenant novo ou restaurado de backup antigo cai
// na armadilha.
// ---------------------------------------------------------------------------

test("formaPermitida: aceita a forma canônica que a tela oferece a partir de legado", () => {
  const legado = ["Dinheiro", "Cartão"]; // texto livre da época antiga
  assert.equal(pg.formaPermitida(legado, "Cartão de Crédito"), true);
  assert.equal(pg.formaPermitida(legado, "Cartão de Débito"), true);
  assert.equal(pg.formaPermitida(legado, "Dinheiro"), true);
});

test("formaPermitida: recusa forma que o dono não ligou", () => {
  assert.equal(pg.formaPermitida(["Dinheiro", "Cartão"], "PIX"), false);
});

test("formaPermitida: lista canônica segue funcionando igual", () => {
  const canon = ["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito"];
  assert.equal(pg.formaPermitida(canon, "PIX"), true);
  assert.equal(pg.formaPermitida(canon, "Vale-refeição"), false);
});

test("formaPermitida: config vazia não bloqueia a venda", () => {
  // `normalizarFormasPagamento` nunca devolve vazio (cai em Dinheiro), e o
  // comportamento antigo também liberava tudo quando não havia config.
  assert.equal(pg.formaPermitida([], "Dinheiro"), true);
  assert.equal(pg.formaPermitida(null, "Dinheiro"), true);
});

// ---------------------------------------------------------------------------
// "Isso é dinheiro?" — usado para decidir se o troco pedido no cardápio web
// vale alguma coisa. Troco em Pix ou cartão não significa nada, então o valor
// nem é gravado. Passa pelo mesmo `_mapear` do resto do módulo, para não virar
// uma quarta cópia da regex de "dinheiro" espalhada pelo projeto.
// ---------------------------------------------------------------------------

test("ehDinheiro: reconhece a forma canônica e a legada", () => {
  assert.equal(pg.ehDinheiro("Dinheiro"), true);
  assert.equal(pg.ehDinheiro("dinheiro"), true);
  assert.equal(pg.ehDinheiro("Espécie"), true);
  assert.equal(pg.ehDinheiro("Dinheiro (na entrega)"), true);
});

test("ehDinheiro: as outras formas não são dinheiro", () => {
  ["PIX", "Cartão de Crédito", "Cartão de Débito", "Cartão", "", null, undefined]
    .forEach((f) => assert.equal(pg.ehDinheiro(f), false, String(f)));
});

// ---------------------------------------------------------------------------
// Uma regra so para "e dinheiro", no servidor E no painel.
//
// O front tinha DUAS copias em regex que discordavam entre si: o Caixa usava
// /dinheiro/i e o PDV /dinheiro|esp[ée]cie/i. Eram a quarta e a quinta copia da
// regra no projeto, depois de tres terem sido consolidadas aqui. Com o
// vocabulario canonico as duas concordam, mas "Especie" faria as duas telas do
// mesmo produto discordarem — o Caixa contaria como cartao/Pix e o PDV como
// dinheiro (com troco).
//
// O modulo virou dual-mode e mora em public/, como grupos.js e estoque.js: o
// servidor valida a venda e o painel decide o que e dinheiro pela MESMA funcao,
// por construcao e nao por coincidencia.
// ---------------------------------------------------------------------------

const fsPg = require("fs");
const pathPg = require("path");
const raiz = pathPg.join(__dirname, "..");

test("o módulo é dual-mode e expõe window.Pagamentos no navegador", () => {
  const src = fsPg.readFileSync(pathPg.join(raiz, "public", "pagamentos.js"), "utf8");
  assert.match(src, /root\.Pagamentos = factory\(\)/, "sem isso o painel não enxerga o módulo");
  assert.match(src, /module\.exports = factory\(\)/, "e o servidor precisa continuar importando");
});

test("o painel carrega o módulo antes do app.js", () => {
  const html = fsPg.readFileSync(pathPg.join(raiz, "public", "admin.html"), "utf8");
  const iMod = html.indexOf('src="pagamentos.js"');
  const iApp = html.indexOf('src="app.js"');
  assert.ok(iMod > -1, "admin.html precisa carregar pagamentos.js");
  assert.ok(iApp > -1 && iMod < iApp, "tem que vir ANTES do app.js, que o usa na primeira renderização");
});

test("nenhuma tela define «e dinheiro» por conta própria", () => {
  const app = fsPg.readFileSync(pathPg.join(raiz, "public", "app.js"), "utf8");
  // Os nomes locais (`ehFormaDinheiro`, `pdvEhDinheiro`) FICAM: são oito pontos de
  // chamada e renomeá-los não muda comportamento nenhum. O que não pode voltar é uma
  // REGRA própria dentro deles — era isso que fazia Caixa e PDV discordarem.
  assert.doesNotMatch(app, /function (ehFormaDinheiro|pdvEhDinheiro)\([^)]*\)\s*{\s*return \//,
    "nenhuma das duas pode voltar a testar a forma com regex própria");
  const usos = (app.match(/Pagamentos\.ehDinheiro/g) || []).length;
  assert.ok(usos >= 2, "as duas telas delegam à regra única (achei " + usos + ")");
});

test("o servidor importa do novo lugar", () => {
  ["src/caixa.js", "src/pdv.js", "src/servidor.js"].forEach((f) => {
    const s = fsPg.readFileSync(pathPg.join(raiz, f), "utf8");
    assert.match(s, /require\("\.\.\/public\/pagamentos"\)/, f);
  });
});
