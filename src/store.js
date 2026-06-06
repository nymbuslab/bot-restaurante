// ============================================================
// STORE — camada de dados (lê/grava os JSON em /data).
// Usa cache com verificação de data de modificação (mtime):
// quando o painel salva um arquivo, o bot detecta e recarrega
// automaticamente, SEM precisar reiniciar. É isso que faz o
// cardápio mudar "na hora" para o cliente final.
// ============================================================

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "data");
const CAMINHOS = {
  config: path.join(DIR, "config.json"),
  cardapio: path.join(DIR, "cardapio.json"),
};

const cache = {}; // { chave: { dados, mtime } }

function ler(chave) {
  const caminho = CAMINHOS[chave];
  const stat = fs.statSync(caminho);
  const mtime = stat.mtimeMs;

  // Reaproveita o cache se o arquivo não mudou
  if (cache[chave] && cache[chave].mtime === mtime) {
    return cache[chave].dados;
  }

  const dados = JSON.parse(fs.readFileSync(caminho, "utf8"));
  cache[chave] = { dados, mtime };
  return dados;
}

function gravar(chave, dados) {
  const caminho = CAMINHOS[chave];
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), "utf8");
  // Atualiza o cache imediatamente
  const stat = fs.statSync(caminho);
  cache[chave] = { dados, mtime: stat.mtimeMs };
  return dados;
}

// ---- Atalhos ----
const getConfig = () => ler("config");
const setConfig = (d) => gravar("config", d);
const getCardapio = () => ler("cardapio");
const setCardapio = (d) => gravar("cardapio", d);

// Mapa id -> item (apenas itens DISPONÍVEIS), montado on-the-fly
function itensDisponiveis() {
  const cardapio = getCardapio();
  const mapa = {};
  for (const cat of cardapio.categorias) {
    for (const item of cat.itens) {
      if (item.disponivel) mapa[item.id] = { ...item, categoria: cat.nome };
    }
  }
  return mapa;
}

module.exports = {
  getConfig,
  setConfig,
  getCardapio,
  setCardapio,
  itensDisponiveis,
};
