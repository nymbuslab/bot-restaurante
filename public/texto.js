// ============================================================
// TEXTO — PURO (dual-mode Node/browser): padroniza nomes em
// "Title Case" do português (ex.: "pastel de queijo" -> "Pastel
// de Queijo"). Usado no editor do cardápio (nome do produto e da
// categoria) ao sair do campo (blur) e no save, que alcança também
// variações e a biblioteca de complementos (grupo e opção).
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

  // Padroniza os nomes da BIBLIOTECA de complementos (grupo e opção). Sem isso o
  // grupo cadastrado como "guarnicao" ficava fora do padrão das outras telas — e é
  // o mesmo nome que o cliente lê no cardápio. Preço, id e tipo passam intactos.
  function padronizarGrupos(grupos) {
    if (!Array.isArray(grupos)) return grupos;
    return grupos.map(function (g) {
      if (!g || typeof g !== "object") return g;
      const novo = Object.assign({}, g);
      if (typeof novo.nome === "string") novo.nome = tituloPt(novo.nome);
      if (Array.isArray(novo.opcoes)) {
        novo.opcoes = novo.opcoes.map(function (o) {
          return (o && typeof o.nome === "string") ? Object.assign({}, o, { nome: tituloPt(o.nome) }) : o;
        });
      }
      return novo;
    });
  }

  // Recebe um cardápio e devolve um NOVO com os nomes (categoria, item, variação,
  // grupo e opção) padronizados — não muta o original e preserva os outros campos.
  function padronizarNomesCardapio(cardapio) {
    if (!cardapio || !Array.isArray(cardapio.categorias)) return cardapio;
    const saida = Object.assign({}, cardapio, {
      categorias: cardapio.categorias.map(function (cat) {
        const c = Object.assign({}, cat);
        if (typeof c.nome === "string") c.nome = tituloPt(c.nome);
        if (Array.isArray(c.itens)) {
          c.itens = c.itens.map(function (item) {
            const it = Object.assign({}, item);
            if (typeof it.nome === "string") it.nome = tituloPt(it.nome);
            if (Array.isArray(it.variacoes)) {
              it.variacoes = it.variacoes.map(function (v) {
                return (v && typeof v.nome === "string") ? Object.assign({}, v, { nome: tituloPt(v.nome) }) : v;
              });
            }
            return it;
          });
        }
        return c;
      }),
    });
    if (Array.isArray(cardapio.grupos)) saida.grupos = padronizarGrupos(cardapio.grupos);
    return saida;
  }

  return { tituloPt: tituloPt, padronizarGrupos: padronizarGrupos, padronizarNomesCardapio: padronizarNomesCardapio };
});
