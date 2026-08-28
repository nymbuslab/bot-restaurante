// ============================================================
// AMBIENTE — a trava que separa o banco de teste do banco de produção.
//
// Precisa ser o PRIMEIRO require de todo arquivo em test/integracao/, antes de
// qualquer módulo que fale com o banco: ele monta as variáveis de ambiente e
// aborta o processo se o destino não for comprovadamente descartável.
//
// Por que duas travas e não uma: os testes daqui CRIAM e APAGAM empresas. Rodar
// isso por engano contra produção não devolve um erro, devolve dado real
// apagado. Uma trava sozinha é uma linha editada por distração de distância.
//   1. `BANCO_DE_TESTE=1` — marca explícita, só existe no .env.test.
//   2. Comparação com o .env — se o projeto Supabase for o MESMO do arquivo de
//      produção, aborta, mesmo com a marca presente.
// ============================================================

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "..", "..");

function lerArquivoEnv(nome) {
  const caminho = path.join(RAIZ, nome);
  if (!fs.existsSync(caminho)) return null;
  const valores = {};
  for (const linha of fs.readFileSync(caminho, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*)$/);
    if (m) valores[m[1]] = m[2].trim();
  }
  return valores;
}

// Identidade do projeto Supabase, das duas formas de string de conexão:
//   Session pooler → usuário `postgres.<ref>`
//   Direct         → host `db.<ref>.supabase.co`
function refDoProjeto(url) {
  try {
    const u = new URL(url);
    const usuario = decodeURIComponent(u.username).replace(/^postgres\./, "");
    if (usuario && usuario !== "postgres") return usuario;
    const m = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    return m ? m[1] : u.hostname;
  } catch (_) {
    return "";
  }
}

function abortar(motivo) {
  console.error("\n" + "=".repeat(70));
  console.error("BATERIA DE INTEGRAÇÃO ABORTADA");
  console.error(motivo);
  console.error("=".repeat(70) + "\n");
  process.exit(1);
}

// No CI as variáveis chegam pelo ambiente e não há arquivo; localmente o
// .env.test manda. Ele sobrescreve o que veio antes de propósito: rodar um
// arquivo solto com `node --test` tem que cair no mesmo banco do runner.
const doArquivo = lerArquivoEnv(".env.test");
if (doArquivo) Object.assign(process.env, doArquivo);

if (process.env.BANCO_DE_TESTE !== "1") {
  abortar(
    "Falta a marca BANCO_DE_TESTE=1.\n\n" +
      "Ela vive no .env.test e existe para que apontar um banco qualquer aqui\n" +
      "não seja suficiente para a bateria rodar. Modelo: .env.test.example"
  );
}

if (!process.env.DATABASE_URL) {
  abortar("DATABASE_URL vazia. Preencha o .env.test (modelo em .env.test.example).");
}

const refTeste = refDoProjeto(process.env.DATABASE_URL);
const producao = lerArquivoEnv(".env");
if (producao && producao.DATABASE_URL) {
  const refProducao = refDoProjeto(producao.DATABASE_URL);
  if (refProducao && refProducao === refTeste) {
    abortar(
      "O .env.test aponta para o MESMO projeto Supabase do .env.\n\n" +
        "Esta bateria cria e APAGA empresas. Contra o banco de produção isso é\n" +
        "perda de dado real, não erro de teste.\n\n" +
        "Crie um projeto Supabase separado e use a string dele no .env.test."
    );
  }
}

// A saída consciente prevista pelo src/db.js: fora daqui, o acesso ao banco
// dentro do runner segue recusado.
process.env.PERMITIR_BANCO_EM_TESTE = "1";

module.exports = { RAIZ, refDoProjeto, refTeste };
