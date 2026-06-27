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

  // Padroniza a string de opcionais ("Nome | 3.00" por linha) mexendo SÓ no nome
  // (preserva bullet, espaços e o "| preço").
  function padronizarOpcionais(str) {
    if (!str || typeof str !== "string") return str;
    return str.split("\n").map(function (linha) {
      if (!linha.trim()) return linha;
      const idx = linha.indexOf("|");
      const alvo = idx === -1 ? linha : linha.slice(0, idx);
      const resto = idx === -1 ? "" : linha.slice(idx); // inclui o "|"
      const m = alvo.match(/^(\s*(?:[*\-•]\s*)?)(.*?)(\s*)$/);
      return m[1] + tituloPt(m[2]) + m[3] + resto;
    }).join("\n");
  }

  // Recebe um cardápio e devolve um NOVO com os nomes (categoria, item e opcional)
  // padronizados — não muta o original e preserva todos os outros campos.
  function padronizarNomesCardapio(cardapio) {
    if (!cardapio || !Array.isArray(cardapio.categorias)) return cardapio;
    return Object.assign({}, cardapio, {
      categorias: cardapio.categorias.map(function (cat) {
        const c = Object.assign({}, cat);
        if (typeof c.nome === "string") c.nome = tituloPt(c.nome);
        if (Array.isArray(c.itens)) {
          c.itens = c.itens.map(function (item) {
            const it = Object.assign({}, item);
            if (typeof it.nome === "string") it.nome = tituloPt(it.nome);
            if (typeof it.opcionais === "string" && it.opcionais.trim()) it.opcionais = padronizarOpcionais(it.opcionais);
            return it;
          });
        }
        return c;
      }),
    });
  }

  return { tituloPt: tituloPt, padronizarOpcionais: padronizarOpcionais, padronizarNomesCardapio: padronizarNomesCardapio };
});
