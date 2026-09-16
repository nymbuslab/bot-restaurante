const { test } = require("node:test");
const assert = require("node:assert/strict");
const { contemTrecho, trechoEntre } = require("./apoio/arquivo-estatico");
const ExtratoEstoque = require("../public/extrato-estoque");

test("módulo é dual-mode: expõe window.ExtratoEstoque no browser", () => {
  assert.ok(contemTrecho("public/extrato-estoque.js", "window.ExtratoEstoque"));
});

test("montarQueryString: tipos + período customizado (desde/ate) monta tipos=...&desde=...&ate=...", () => {
  const qs = ExtratoEstoque.montarQueryString({
    tipos: ["entrada", "perda"],
    periodo: "customizado",
    desde: "2026-09-01",
    ate: "2026-09-10",
  });
  assert.equal(qs, "tipos=entrada,perda&desde=2026-09-01&ate=2026-09-10");
});

test("montarQueryString: período hoje monta só periodo=hoje, sem desde/ate", () => {
  const qs = ExtratoEstoque.montarQueryString({
    tipos: ["entrada", "perda", "contagem", "ajuste"],
    periodo: "hoje",
    desde: "2026-09-01",
    ate: "2026-09-10", // presentes mas devem ser IGNORADOS quando periodo é preset
  });
  assert.equal(qs, "tipos=entrada,perda,contagem,ajuste&periodo=hoje");
});

test("montarQueryString: período 7dias monta periodo=7dias", () => {
  const qs = ExtratoEstoque.montarQueryString({ tipos: ["venda"], periodo: "7dias" });
  assert.equal(qs, "tipos=venda&periodo=7dias");
});

test("montarQueryString: sem tipos nenhum (array vazio) não manda tipos=", () => {
  const qs = ExtratoEstoque.montarQueryString({ tipos: [], periodo: "hoje" });
  assert.equal(qs, "periodo=hoje");
});

test("montarQueryString: período customizado só com desde (sem até) manda só o que tem", () => {
  const qs = ExtratoEstoque.montarQueryString({ tipos: ["entrada"], periodo: "customizado", desde: "2026-09-01" });
  assert.equal(qs, "tipos=entrada&desde=2026-09-01");
});

test("tiposPadrao: devolve exatamente os 4 tipos operacionais (D-01), nem mais nem menos", () => {
  assert.deepEqual(ExtratoEstoque.tiposPadrao(), ["entrada", "perda", "contagem", "ajuste"]);
});

test("tiposPadrao: cada chamada devolve um array novo (não compartilha referência)", () => {
  const a = ExtratoEstoque.tiposPadrao();
  const b = ExtratoEstoque.tiposPadrao();
  assert.notEqual(a, b);
  a.push("venda");
  assert.deepEqual(b, ["entrada", "perda", "contagem", "ajuste"]);
});

test("alternarTipo: tipo ausente entra no array (sem mutar o original)", () => {
  const original = ["entrada", "perda"];
  const resultado = ExtratoEstoque.alternarTipo(original, "venda");
  assert.deepEqual(resultado, ["entrada", "perda", "venda"]);
  assert.deepEqual(original, ["entrada", "perda"]);
});

test("alternarTipo: tipo já presente sai do array, sem duplicar nem repetir busca", () => {
  const resultado = ExtratoEstoque.alternarTipo(["entrada", "perda", "venda"], "perda");
  assert.deepEqual(resultado, ["entrada", "venda"]);
});

test("alternarTipo: alternar o mesmo tipo duas vezes volta ao estado original", () => {
  const original = ["entrada"];
  const ida = ExtratoEstoque.alternarTipo(original, "perda");
  const volta = ExtratoEstoque.alternarTipo(ida, "perda");
  assert.deepEqual(volta, original);
});

test("montarQueryString: cursor (antes/antesId) e limite entram quando informados", () => {
  const qs = ExtratoEstoque.montarQueryString({
    tipos: ["entrada"], periodo: "hoje", antes: "2026-09-10T12:00:00.000Z", antesId: 42, limite: 30,
  });
  assert.equal(qs, "tipos=entrada&periodo=hoje&limite=30&antes=" + encodeURIComponent("2026-09-10T12:00:00.000Z") + "&antesId=42");
});

// T-03.04: recorte SÓ da seção #aba-relatorios (não contemTrecho no arquivo
// inteiro) — "venda"/"hoje"/"entrada" já aparecem em PDV/Caixa/Pedidos, então
// buscar solto no admin.html inteiro daria falso positivo mesmo sem os chips
// desta tela existirem.
test("seção #aba-relatorios tem os 6 chips de tipo e os 3 presets de período", () => {
  const secao = trechoEntre("public/admin.html", '<section class="aba" id="aba-relatorios">', "</section>");
  assert.ok(secao, "seção #aba-relatorios não encontrada");
  ["entrada", "perda", "contagem", "ajuste", "venda", "devolucao"].forEach((tipo) => {
    assert.match(secao, new RegExp('data-rel-tipo="' + tipo + '"'), "chip de tipo ausente: " + tipo);
  });
  ["hoje", "7dias", "customizado"].forEach((periodo) => {
    assert.match(secao, new RegExp('data-rel-periodo="' + periodo + '"'), "preset de período ausente: " + periodo);
  });
  // Os 4 operacionais (D-01) nascem marcados; venda/devolução nascem neutros.
  const chipEntrada = trechoEntre("public/admin.html", 'data-rel-tipo="entrada"', ">");
  assert.match(chipEntrada, /class="filtro-chip ativo"/);
  const chipVenda = trechoEntre("public/admin.html", 'data-rel-tipo="venda"', ">");
  assert.doesNotMatch(chipVenda, /ativo/);
});
