// ============================================================
// TEST:INTEGRAÇÃO — a bateria que fala com um Postgres de verdade.
//
// Irmão do test:ci, com o objetivo oposto. O test:ci prova que a suíte passa SEM
// segredo nenhum, reproduzindo o runner do GitHub. Este existe para exercitar o
// que aquele não alcança: rota HTTP, transação e SQL contra um banco real.
//
// O banco NUNCA é o de produção. Ele vem do .env.test, que aponta para um
// projeto Supabase separado e descartável, e as travas que garantem isso estão
// em test/integracao/ajuda/ambiente.js, antes do primeiro caso.
//
// Assim como o test:ci, roda a partir de uma pasta VAZIA. Lá o motivo é imitar a
// falta de .env; aqui é impedir que o `dotenv` de qualquer módulo ache o .env do
// dono e reponha uma variável de PRODUÇÃO que este script não tenha sobrescrito.
//
// Uso: `npm run test:integracao`
// ============================================================

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const PASTA = path.join(RAIZ, "test", "integracao");

if (!fs.existsSync(PASTA)) {
  console.error("Pasta test/integracao/ não existe.");
  process.exit(1);
}

const arquivos = fs
  .readdirSync(PASTA)
  .filter((f) => f.endsWith(".test.js"))
  .map((f) => path.join(PASTA, f));

if (!arquivos.length) {
  console.error("Nenhum arquivo *.test.js em test/integracao/.");
  process.exit(1);
}

const arquivoEnv = path.join(RAIZ, ".env.test");
const usandoAmbienteCI = !fs.existsSync(arquivoEnv) && process.env.CI;
if (!fs.existsSync(arquivoEnv) && !usandoAmbienteCI) {
  console.error(
    "\nFalta o .env.test na raiz do projeto.\n\n" +
      "Ele aponta para o projeto Supabase descartável usado por esta bateria.\n" +
      "Copie o .env.test.example e preencha. Ele não vai para o git.\n"
  );
  process.exit(1);
}

const doArquivo = {};
if (usandoAmbienteCI) {
  for (const chave of [
    "BANCO_DE_TESTE",
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    if (process.env[chave]) doArquivo[chave] = process.env[chave];
  }
} else {
  for (const linha of fs.readFileSync(arquivoEnv, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);
    if (m) doArquivo[m[1]] = m[2].trim();
  }
}

// Toda variável que possa carregar credencial de produção sai antes de o
// .env.test entrar. Sem isso, uma chave exportada no shell sobreviveria.
const ambiente = Object.assign({}, process.env);
for (const chave of Object.keys(ambiente)) {
  if (
    /^(DATABASE_URL|SUPABASE_|STRIPE_|RESEND_|EMAIL_FROM|PUBLIC_URL|GEOAPIFY_|SUPERADMIN_|CARDAPIO_LINK_SECRET)/.test(
      chave
    )
  ) {
    delete ambiente[chave];
  }
}
Object.assign(ambiente, doArquivo);
ambiente.PERMITIR_BANCO_EM_TESTE = "1";

const limpo = path.join(os.tmpdir(), "nymbus-test-integracao");
fs.mkdirSync(limpo, { recursive: true });
if (fs.existsSync(path.join(limpo, ".env"))) fs.unlinkSync(path.join(limpo, ".env"));

console.log("Rodando " + arquivos.length + " arquivo(s) de integração contra o banco do .env.test.\n");

const r = spawnSync(process.execPath, ["--test", ...arquivos], {
  cwd: limpo,
  stdio: "inherit",
  env: ambiente,
});

process.exit(r.status === null ? 1 : r.status);
