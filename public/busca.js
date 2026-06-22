// ============================================================
// Busca do cardápio (painel do dono) — helpers puros e testáveis.
// normalizarTexto: minúsculas, sem acento, sem espaços nas pontas.
// itemCasaBusca: o nome do item contém o termo digitado?
// Dual-mode: window.Busca no browser, module.exports no Node (testes).
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.Busca = api;
})(this, function () {
  function normalizarTexto(s) {
    return String(s == null ? "" : s)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "") // remove acentos (marcas diacríticas)
      .toLowerCase()
      .trim();
  }

  function itemCasaBusca(nome, termo) {
    const t = normalizarTexto(termo);
    if (t === "") return true;
    return normalizarTexto(nome).includes(t);
  }

  return { normalizarTexto, itemCasaBusca };
});
