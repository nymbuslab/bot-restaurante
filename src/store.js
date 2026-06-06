// ============================================================
// STORE — lê/grava config.json e cardapio.json de um tenant.
// Usa cache com verificação de mtime: o bot detecta mudanças
// feitas pelo painel sem precisar reiniciar.
//
// Todas as funções recebem `dir` (diretório do tenant).
// ============================================================

const fs = require("fs");
const path = require("path");

const cache = {}; // { caminhoAbsoluto: { dados, mtime } }

function ler(caminho) {
  const mtime = fs.statSync(caminho).mtimeMs;
  if (cache[caminho] && cache[caminho].mtime === mtime) return cache[caminho].dados;
  const dados = JSON.parse(fs.readFileSync(caminho, "utf8"));
  cache[caminho] = { dados, mtime };
  return dados;
}

function gravar(caminho, dados) {
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), "utf8");
  cache[caminho] = { dados, mtime: fs.statSync(caminho).mtimeMs };
  return dados;
}

const getConfig   = (dir) => ler(path.join(dir, "config.json"));
const setConfig   = (dir, d) => gravar(path.join(dir, "config.json"), d);
const getCardapio = (dir) => ler(path.join(dir, "cardapio.json"));
const setCardapio = (dir, d) => gravar(path.join(dir, "cardapio.json"), d);

function itensDisponiveis(dir) {
  const mapa = {};
  for (const cat of getCardapio(dir).categorias) {
    for (const item of cat.itens) {
      if (item.disponivel) mapa[item.id] = { ...item, categoria: cat.nome };
    }
  }
  return mapa;
}

module.exports = { getConfig, setConfig, getCardapio, setCardapio, itensDisponiveis };
