// ============================================================
// ASSETS — cache-busting dos estáticos (CSS/JS) SEM build.
//
// versaoAssets(publicDir): hash do conteúdo de TODOS os .css/.js de public/ →
//   a versão muda quando qualquer asset muda (deploy real) e é estável entre
//   restarts com o mesmo código (não busta cache à toa).
// injetarVersao(html, v): PURA — injeta `?v=<v>` nos href/src locais de .css/.js
//   das páginas HTML. URLs externas (http/https/protocol-relative) ficam intactas;
//   links de página (.html) não são versionados.
// ============================================================
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function versaoAssets(publicDir) {
  try {
    const arquivos = fs.readdirSync(publicDir).filter((f) => /\.(css|js)$/i.test(f)).sort();
    const h = crypto.createHash("sha1");
    for (const f of arquivos) {
      try { h.update(f); h.update(fs.readFileSync(path.join(publicDir, f))); } catch (_) { /* pula ilegível */ }
    }
    return h.digest("hex").slice(0, 8);
  } catch (_) {
    return "0";
  }
}

// Pura. Regex: captura href/src que terminam em .css/.js (com query opcional, que
// é substituída) e injeta ?v=v; pula URL externa (esquema:// ou //).
function injetarVersao(html, v) {
  if (!v) return String(html);
  return String(html).replace(
    /(\b(?:href|src)=")([^"]+?\.(?:css|js))(\?[^"]*)?(")/gi,
    function (m, pre, url, _query, post) {
      if (/^(?:[a-z]+:)?\/\//i.test(url)) return m; // http:// https:// //cdn
      return pre + url + "?v=" + v + post;
    }
  );
}

module.exports = { versaoAssets, injetarVersao };
