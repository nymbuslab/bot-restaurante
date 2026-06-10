// ============================================================
// GERADOR DE HASH DA SENHA MASTER (super-admin)
//
// Usa EXATAMENTE a mesma função hashSenha do empresas.js (mesmo
// salt) — assim o SUPERADMIN_SENHA_HASH gerado aqui sempre bate
// com a verificação do login master no servidor.
//
// Uso:
//   node scripts/gerar-hash.js "minhaSenhaForte"
//   npm run gerar-hash-admin -- "minhaSenhaForte"
//
// Copie a linha SUPERADMIN_SENHA_HASH=... para o seu .env
// (ou, em produção: fly secrets set SUPERADMIN_SENHA_HASH=...).
// ============================================================

const { hashSenha } = require("../src/empresas");

const senha = process.argv[2];

if (!senha) {
  console.error('Uso: node scripts/gerar-hash.js "suaSenhaForte"');
  process.exit(1);
}

console.log("\nAdicione ao seu .env (nunca commite este valor):\n");
console.log(`SUPERADMIN_SENHA_HASH=${hashSenha(senha)}\n`);
