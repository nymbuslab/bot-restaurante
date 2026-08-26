// ============================================================
// TEST:CI — roda a suíte na MESMA condição do runner do GitHub.
//
// Por que existe: em 21/08 o CI ficou vermelho por cinco dias e ninguém notou,
// porque a suíte passava no notebook. O motivo é o `dotenv`: todo módulo que
// precisa de credencial chama `require("dotenv").config()`, que lê o `.env` da
// pasta ATUAL. Com o `.env` do dono ali, o teste carrega as chaves reais; no
// runner, que não tem `.env`, o mesmo módulo lança no `require` e o arquivo de
// teste morre inteiro antes do primeiro caso.
//
// A única diferença que importa, então, é o diretório de onde o Node roda. Este
// script executa o runner a partir de uma pasta VAZIA: o `dotenv` não acha nada
// para repor e o resultado é o do GitHub, com o mesmo `DATABASE_URL` de mentira
// que o workflow define.
//
// Uso: `npm run test:ci` (o hook de pre-push chama este script).
// ============================================================

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const TESTES = path.join(RAIZ, "test");

const arquivos = fs
  .readdirSync(TESTES)
  .filter((f) => f.endsWith(".test.js"))
  .map((f) => path.join(TESTES, f));

if (!arquivos.length) {
  console.error("Nenhum arquivo *.test.js em test/ — o glob do npm test mudou?");
  process.exit(1);
}

// Pasta vazia e descartável só para servir de cwd. Se sobrar de uma execução
// anterior, tudo bem: o que importa é não ter `.env` dentro.
const limpo = path.join(os.tmpdir(), "nymbus-test-ci");
fs.mkdirSync(limpo, { recursive: true });
if (fs.existsSync(path.join(limpo, ".env"))) fs.unlinkSync(path.join(limpo, ".env"));

console.log("Rodando " + arquivos.length + " arquivos de teste na condição do CI (sem .env).\n");

const r = spawnSync(process.execPath, ["--test", ...arquivos], {
  cwd: limpo,
  stdio: "inherit",
  env: Object.assign({}, process.env, {
    // Mesmo valor de mentira do .github/workflows/test.yml: o pg.Pool não conecta
    // ao ser criado, só evita o db.js lançar "DATABASE_URL não definida".
    DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci",
    // As três abaixo são apagadas de propósito: é justamente a ausência delas que
    // o CI tem e a máquina do dono não. Um teste que precise delas tem que trazer
    // o próprio preâmbulo de env dummy (modelo: test/seguranca.test.js).
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
  }),
});

process.exit(r.status === null ? 1 : r.status);
