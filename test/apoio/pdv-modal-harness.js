const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("node:assert/strict");

function criarArnês() {
  const app = fs.readFileSync(path.join(__dirname, "..", "..", "public", "app.js"), "utf8");

  const InicioVar = app.indexOf("function pdvVariacaoClick(");
  const FimVar = app.indexOf("\nfunction pdvBadgeDoItem", InicioVar);
  assert.ok(InicioVar > -1 && FimVar > InicioVar, "pdvVariacaoClick não encontrado em public/app.js");

  const InicioTile = app.indexOf("function pdvTileClick(");
  const FimTile = app.indexOf("\n// Grupos da biblioteca", InicioTile);
  assert.ok(InicioTile > -1 && FimTile > InicioTile, "pdvTileClick não encontrado em public/app.js");

  const InicioGrupos = app.indexOf("function pdvGruposDoItem(");
  const FimGrupos = app.indexOf("\n// ---- Modal de item", InicioGrupos);
  assert.ok(InicioGrupos > -1 && FimGrupos > InicioGrupos, "pdvGruposDoItem não encontrado em public/app.js");

  const trecho = app.slice(InicioVar, FimVar) + "\n" +
    app.slice(InicioTile, FimTile) + "\n" +
    app.slice(InicioGrupos, FimGrupos);

  const pdvCart = [];
  let pdvUidSeq = 1;
  const chamadasModal = [];

  const ctx = {
    pdvCart,
    pdvUidSeq,
    pdvGruposDoItem: () => [],
    abrirPdvItemModal: () => {},
    renderPdvCarrinho: () => {},
    window: { Variacoes: { normalizarVariacoes: (v) => v || [] } },
    pdvEsc: (s) => String(s == null ? "" : s),
    pdvMoney: (n) => "R$ " + (Number(n) || 0).toFixed(2).replace(".", ","),
  };

  vm.runInNewContext(trecho, ctx);

  // Sobrescreve APÓS a execução: as closures de pdvTileClick/pdvVariacaoClick
  // fazem lookup dinâmico de pdvGruposDoItem no contexto a cada chamada.
  ctx.pdvGruposDoItem = (item) => item.grupos || [];
  ctx.abrirPdvItemModal = (item, uid) => { chamadasModal.push({ item, uid }); };

  function simularCliqueTile(item) {
    ctx.pdvUidSeq = pdvUidSeq;
    ctx.pdvTileClick(item);
    pdvUidSeq = ctx.pdvUidSeq;
  }

  function simularCliqueVariacao(item, variacao) {
    ctx.pdvUidSeq = pdvUidSeq;
    ctx.pdvVariacaoClick(item, variacao);
    pdvUidSeq = ctx.pdvUidSeq;
  }

  return { pdvCart, chamadasModal, simularCliqueTile, simularCliqueVariacao };
}

module.exports = { criarArnês };
