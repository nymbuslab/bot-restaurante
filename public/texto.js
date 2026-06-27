// ============================================================
// TEXTO — PURO (dual-mode Node/browser): padroniza nomes em
// "Title Case" do português (ex.: "pastel de queijo" -> "Pastel
// de Queijo"). Usado no editor do cardápio (nome do produto,
// categoria e opcional) ao sair do campo (blur). Não força no
// save — é assistivo, o usuário ainda pode reescrever.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.Texto = factory();
})(typeof self !== "undefined" ? self : this, function () {
  // Conectivos que ficam minúsculos QUANDO não são a 1ª palavra.
  const MINUSCULAS = new Set([
    "de", "da", "do", "das", "dos", "e", "com", "sem", "ou",
    "a", "o", "as", "os", "ao", "aos", "à", "às",
    "na", "no", "nas", "nos", "em", "para", "por", "du", "di",
  ]);

  // Capitaliza um token preservando o hífen: "x-tudo" -> "X-Tudo".
  // Só mexe na 1ª letra de cada parte; dígitos/medidas no começo ficam
  // intactos ("500ml" -> "500ml", pois o 1º caractere não é letra).
  function capitalizarToken(token) {
    return token.split("-").map(function (parte) {
      if (!parte) return parte;
      const lower = parte.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join("-");
  }

  // Title Case PT-BR: 1ª palavra sempre capitalizada; conectivos no
  // meio minúsculos; espaços repetidos colapsados; pontas aparadas.
  // Preserva medidas/números ("1,5L", "350ml") e as abreviações "c/"
  // e "s/" (com/sem) — não vira "1,5l" nem "C/".
  function tituloPt(str) {
    const limpo = String(str == null ? "" : str).trim().replace(/\s+/g, " ");
    if (!limpo) return "";
    return limpo.split(" ").map(function (palavra, i) {
      if (/^[0-9]/.test(palavra)) return palavra; // medida/número: não mexe ("1,5L", "350ml")
      const lower = palavra.toLowerCase();
      if (lower.indexOf("c/") === 0 || lower.indexOf("s/") === 0) return lower; // c/ s/ (com/sem)
      if (i > 0 && MINUSCULAS.has(lower)) return lower;
      return capitalizarToken(palavra);
    }).join(" ");
  }

  return { tituloPt: tituloPt };
});
