// Copia os modulos puros compartilhados do app principal (public/) para vendor/,
// para que o electron-builder os empacote dentro do asar (arquivos de fora do app
// root NAO sao empacotados pelo glob `files`). Roda antes do `electron-builder` (ver package.json).
const fs = require("fs");
const path = require("path");

const ORIGEM = path.join(__dirname, "..", "public");
const DESTINO = path.join(__dirname, "vendor");
const ARQUIVOS = ["comanda.js", "serial-escpos.js"];

fs.mkdirSync(DESTINO, { recursive: true });
for (const nome of ARQUIVOS) {
  const de = path.join(ORIGEM, nome);
  const para = path.join(DESTINO, nome);
  fs.copyFileSync(de, para);
  console.log(`copiado: public/${nome} -> vendor/${nome}`);
}
