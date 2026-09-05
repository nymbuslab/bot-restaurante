const fs = require("fs");
const path = require("path");

function lerArquivo(caminho) {
  const conteudo = fs.readFileSync(path.resolve(__dirname, "..", "..", caminho), "utf8");
  return conteudo.replace(/\r\n/g, "\n");
}

function contemTrecho(caminho, trecho) {
  return lerArquivo(caminho).includes(trecho);
}

function trechoEntre(caminho, inicio, fim) {
  const conteudo = lerArquivo(caminho);
  const iInicio = conteudo.indexOf(inicio);
  if (iInicio === -1) return null;
  const iFim = conteudo.indexOf(fim, iInicio);
  if (iFim === -1) return null;
  return conteudo.slice(iInicio, iFim);
}

module.exports = { contemTrecho, trechoEntre };
