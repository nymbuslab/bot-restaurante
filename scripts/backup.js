// ============================================================
// BACKUP — dump criptografado do Postgres + objetos do Storage,
// enviado para o bucket R2 (Cloudflare, S3-compatible).
//
// Sem Supabase Pro não há PITR nem backup automático do projeto, então
// esta é a proteção própria: `pg_dump` (custom format) + download de todo
// o bucket `cardapio` do Storage, empacotados num .tar.gz, criptografados
// com `age` (chave assimétrica — só quem tem a privada restaura) e
// enviados ao R2 via AWS CLI (endpoint compatível com S3).
//
// Roda todo dia pelo `.github/workflows/backup.yml`, mas também dá pra
// rodar manualmente com as mesmas variáveis de ambiente no `.env`:
//   node scripts/backup.js
//
// Restauração/ensaio: ver scripts/restaurar-backup.js.
// ============================================================

require("dotenv").config();
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function exigirEnv(nome) {
  const valor = process.env[nome];
  if (!valor) {
    console.error(`Falta a variável de ambiente ${nome}.`);
    process.exit(1);
  }
  return valor;
}

async function listarArquivosStorage(supabase, bucket, prefixo = "") {
  const { data, error } = await supabase.storage.from(bucket).list(prefixo, { limit: 1000 });
  if (error) throw error;

  let arquivos = [];
  for (const item of data) {
    const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
    // Pastas vêm sem `id` na listagem do Storage; arquivos sempre têm.
    if (item.id === null) {
      arquivos = arquivos.concat(await listarArquivosStorage(supabase, bucket, caminho));
    } else {
      arquivos.push(caminho);
    }
  }
  return arquivos;
}

async function baixarStorage(destino) {
  const supabase = createClient(
    exigirEnv("SUPABASE_URL"),
    exigirEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
  const bucket = "cardapio";

  const arquivos = await listarArquivosStorage(supabase, bucket);
  console.log(`Storage: ${arquivos.length} arquivo(s) para baixar.`);

  for (const caminho of arquivos) {
    const { data, error } = await supabase.storage.from(bucket).download(caminho);
    if (error) throw error;
    const destinoArquivo = path.join(destino, caminho);
    fs.mkdirSync(path.dirname(destinoArquivo), { recursive: true });
    fs.writeFileSync(destinoArquivo, Buffer.from(await data.arrayBuffer()));
  }
}

async function main() {
  const databaseUrl = exigirEnv("DATABASE_URL");
  const chavePublica = exigirEnv("BACKUP_AGE_PUBLIC_KEY");
  const bucketR2 = exigirEnv("R2_BUCKET");
  const accountId = exigirEnv("R2_ACCOUNT_ID");
  const accessKeyId = exigirEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = exigirEnv("R2_SECRET_ACCESS_KEY");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nymbus-backup-"));
  const dumpPath = path.join(tmp, "banco.dump");
  const storageDir = path.join(tmp, "storage");
  fs.mkdirSync(storageDir);

  console.log("Gerando dump do Postgres...");
  execFileSync("pg_dump", ["--format=custom", "--file", dumpPath, databaseUrl], { stdio: "inherit" });

  console.log("Baixando objetos do Storage...");
  await baixarStorage(storageDir);

  const dataHora = new Date().toISOString().replace(/[:.]/g, "-");
  const nomePacote = `backup-${dataHora}.tar.gz`;
  const pacotePath = path.join(tmp, nomePacote);
  console.log("Empacotando dump + storage...");
  execFileSync("tar", ["-czf", pacotePath, "-C", tmp, "banco.dump", "storage"]);

  const cifradoPath = `${pacotePath}.age`;
  console.log("Criptografando com age...");
  execFileSync("age", ["-r", chavePublica, "-o", cifradoPath, pacotePath]);

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const destinoS3 = `s3://${bucketR2}/${path.basename(cifradoPath)}`;
  console.log(`Enviando para ${destinoS3}...`);
  execFileSync("aws", ["s3", "cp", cifradoPath, destinoS3, "--endpoint-url", endpoint], {
    stdio: "inherit",
    env: {
      ...process.env,
      AWS_ACCESS_KEY_ID: accessKeyId,
      AWS_SECRET_ACCESS_KEY: secretAccessKey,
      AWS_DEFAULT_REGION: "auto",
    },
  });

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("Backup concluído: " + nomePacote + ".age");
}

main().catch((erro) => {
  console.error("Falha no backup:", erro);
  process.exit(1);
});
