// ============================================================
// RESTAURAR-BACKUP — decripta um pacote gerado pelo scripts/backup.js e
// restaura banco (schema public) + Storage no projeto Supabase DE TESTES.
//
// Apaga e recria o schema public do projeto de testes antes de restaurar
// (ele é descartável — os testes de integração recriam o que precisam na
// próxima rodada). Evita ter que reconciliar "clean" contra estado antigo,
// e nem tenta tocar nos schemas internos do Supabase (auth/storage/etc.):
// esses não são nossos e já vêm prontos em qualquer projeto.
//
// Nunca roda contra produção: exige `.env.test` (o mesmo projeto descartável
// do `test:integracao`) com `BANCO_DE_TESTE=1`, e recusa se o DATABASE_URL
// dali for igual ao do `.env` de produção. É o ensaio que prova que o
// backup realmente restaura, não só que ele "existe".
//
// Uso:
//   node scripts/restaurar-backup.js <arquivo.tar.gz.age> <chave-privada-age.txt>
// ============================================================

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { Client } = require("pg");
const { tipoImagemPorAssinatura } = require("../src/validacao");

// O tar do Git Bash (MSYS) confunde "\" seguido de certas letras (ex.: o "\n"
// que aparece em "...\nymbu\..." de um path com usuário/pasta começando com
// "n") com escape de controle e corrompe o argumento. Barra normal funciona
// igual no Windows e evita a ambiguidade inteira; no Linux já é assim mesmo.
function paraTar(caminho) {
  return caminho.replace(/\\/g, "/");
}

const RAIZ = path.join(__dirname, "..");
const ENV_TESTE = path.join(RAIZ, ".env.test");
const ENV_PRODUCAO = path.join(RAIZ, ".env");

const [arquivoCifrado, chavePrivada] = process.argv.slice(2);
if (!arquivoCifrado || !chavePrivada) {
  console.error("Uso: node scripts/restaurar-backup.js <arquivo.tar.gz.age> <chave-privada-age.txt>");
  process.exit(1);
}
if (!fs.existsSync(arquivoCifrado)) {
  console.error(`Arquivo não encontrado: ${arquivoCifrado}`);
  process.exit(1);
}
if (!fs.existsSync(chavePrivada)) {
  console.error(`Chave privada não encontrada: ${chavePrivada}`);
  process.exit(1);
}

if (!fs.existsSync(ENV_TESTE)) {
  console.error("Falta o .env.test na raiz do projeto (veja .env.test.example).");
  process.exit(1);
}
require("dotenv").config({ path: ENV_TESTE });

if (process.env.BANCO_DE_TESTE !== "1") {
  console.error("Defina BANCO_DE_TESTE=1 no .env.test para confirmar que é o projeto descartável.");
  process.exit(1);
}

if (fs.existsSync(ENV_PRODUCAO)) {
  const match = fs.readFileSync(ENV_PRODUCAO, "utf8").match(/^DATABASE_URL\s*=\s*(.*)$/m);
  const urlProducao = match ? match[1].trim() : null;
  if (urlProducao && urlProducao === (process.env.DATABASE_URL || "").trim()) {
    console.error("DATABASE_URL do .env.test é igual ao do .env de produção. Abortando.");
    process.exit(1);
  }
}

function exigirEnv(nome) {
  const valor = process.env[nome];
  if (!valor) {
    console.error(`Falta a variável de ambiente ${nome} no .env.test.`);
    process.exit(1);
  }
  return valor;
}

async function subirStorage(supabase, pastaLocal, prefixo = "") {
  const bucket = "cardapio";
  for (const nome of fs.readdirSync(pastaLocal, { withFileTypes: true })) {
    const caminhoLocal = path.join(pastaLocal, nome.name);
    const caminhoRemoto = prefixo ? `${prefixo}/${nome.name}` : nome.name;
    if (nome.isDirectory()) {
      await subirStorage(supabase, caminhoLocal, caminhoRemoto);
    } else {
      const conteudo = fs.readFileSync(caminhoLocal);
      // O bucket só aceita jpeg/png/webp (setup-storage.js); sem contentType
      // explícito o SDK manda "text/plain" por padrão e o Storage rejeita.
      const tipo = tipoImagemPorAssinatura(conteudo);
      const { error } = await supabase.storage
        .from(bucket)
        .upload(caminhoRemoto, conteudo, { upsert: true, contentType: tipo ? tipo.mime : undefined });
      if (error) throw error;
    }
  }
}

async function main() {
  const databaseUrlTeste = exigirEnv("DATABASE_URL");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nymbus-restore-"));
  const pacotePath = path.join(tmp, "pacote.tar.gz");

  console.log("Decriptando...");
  execFileSync("age", ["--decrypt", "-i", chavePrivada, "-o", pacotePath, arquivoCifrado]);

  console.log("Extraindo...");
  // --force-local: sem isso, o tar do Git Bash lê "C:\..." como host remoto
  // (sintaxe antiga host:caminho). Barra normal em vez de invertida: o tar
  // do Git Bash (MSYS) confunde "\" seguido de certas letras (e.g. "\n" em
  // "...\nymbu\...") com escape de controle e corrompe o argumento — barra
  // normal funciona igual no Windows e é como o caminho já chega no Linux.
  execFileSync("tar", ["--force-local", "-xzf", paraTar(pacotePath), "-C", paraTar(tmp)]);

  const dumpPath = path.join(tmp, "banco.dump");
  const storageDir = path.join(tmp, "storage");

  console.log("Apagando o schema public do projeto de testes...");
  // Só apaga — o dump (--schema=public) já traz o próprio "CREATE SCHEMA
  // public" dele; recriar aqui também só duplicaria e o pg_restore acusaria
  // "already exists".
  const cliente = new Client({ connectionString: databaseUrlTeste });
  await cliente.connect();
  try {
    await cliente.query("DROP SCHEMA IF EXISTS public CASCADE;");
  } finally {
    await cliente.end();
  }

  console.log(`Restaurando banco (schema public) em ${databaseUrlTeste}...`);
  execFileSync(
    "pg_restore",
    // --no-privileges: mesmo motivo do backup.js — dumps antigos podem ainda
    // carregar GRANT/ALTER DEFAULT PRIVILEGES do projeto de origem.
    ["--no-owner", "--no-privileges", "--dbname", databaseUrlTeste, dumpPath],
    { stdio: "inherit" }
  );

  console.log("Reenviando objetos do Storage para o projeto de testes...");
  const supabaseTeste = createClient(
    exigirEnv("SUPABASE_URL"),
    exigirEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
  if (fs.existsSync(storageDir)) {
    await subirStorage(supabaseTeste, storageDir);
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("Restauração concluída no projeto de testes.");
}

main().catch((erro) => {
  console.error("Falha na restauração:", erro);
  process.exit(1);
});
