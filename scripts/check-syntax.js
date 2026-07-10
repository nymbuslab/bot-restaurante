// ============================================================
// CHECK DE SINTAXE — o "build" honesto de um app CommonJS puro.
// Roda `node --check` em todos os .js de src/, scripts/, public/ e na raiz
// (index.js). Inclui `public/` porque o front é JS puro sem bundler: um erro
// de sintaxe lá (ex.: `const` duplicado) mata o script inteiro no browser e
// derruba TODA a interatividade — `node --check` pega isso antes.
// Uso: npm run check
// ============================================================

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const alvos = [];

function coletar(dir) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === "node_modules" || entrada.name.startsWith(".")) continue;
    const p = path.join(dir, entrada.name);
    if (entrada.isDirectory()) coletar(p);
    else if (entrada.name.endsWith(".js")) alvos.push(p);
  }
}

coletar(path.join(raiz, "src"));
coletar(path.join(raiz, "scripts"));
coletar(path.join(raiz, "public"));
alvos.push(path.join(raiz, "index.js"));

let erros = 0;
for (const arquivo of alvos) {
  try {
    execFileSync(process.execPath, ["--check", arquivo], { stdio: "pipe" });
  } catch (e) {
    erros++;
    console.error("SINTAXE FALHOU:", path.relative(raiz, arquivo), "\n", e.stderr ? e.stderr.toString() : e.message);
  }
}

if (erros === 0) {
  console.log(`OK: ${alvos.length} arquivos sem erro de sintaxe.`);
  process.exit(0);
} else {
  console.error(`\n${erros} arquivo(s) com erro de sintaxe.`);
  process.exit(1);
}
