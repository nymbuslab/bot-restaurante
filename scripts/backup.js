// ============================================================
// BACKUP MANUAL — gera um arquivo único e CONSISTENTE de data/
//
// Empacota TODA a pasta data/ (config, cardápio, pedidos.db de cada
// tenant, sessões baileys, empresas.db) num backup-AAAA-MM-DD-HHmm.tar.gz
// dentro de backups/ (gitignored — contém dados de cliente).
//
// Consistência do SQLite: os .db podem estar ABERTOS/em escrita pelo
// servidor. NÃO copiamos o arquivo cru (risco de backup torn/corrompido).
// Para cada .db usamos a Online Backup API do SQLite via better-sqlite3
// (db.backup), que produz uma cópia consistente página-a-página mesmo
// com o banco aberto. Roda SEM downtime (servidor pode estar no ar).
//
// Uso:
//   npm run backup
//
// IMPORTANTE no Fly.io: backups/ fica no FS EFÊMERO do container (fora
// do volume). Gere e BAIXE o arquivo na mesma sessão — ver DEPLOY.md.
// ============================================================

const path = require("path");
const fs = require("fs");
const tar = require("tar");
const Database = require("better-sqlite3");

const RAIZ = path.join(__dirname, "..");
const DATA_DIR = path.join(RAIZ, "data");
const BACKUPS_DIR = path.join(RAIZ, "backups");

// ---- Timestamp local AAAA-MM-DD-HHmm ----
function carimbo() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
}

// Bancos DO APP (abertos pelo servidor) → precisam de snapshot consistente.
// Qualquer outro .db em data/ (ex.: caches do Chromium nas pastas órfãs
// session-{slug}/) NÃO é nosso e é copiado cru — inclusive porque pode nem
// ser SQLite válido, o que quebraria o new Database().
const DBS_DO_APP = new Set(["empresas.db", "pedidos.db"]);
const ehDbDoApp = (p) => DBS_DO_APP.has(path.basename(p));

// ---- Lista recursiva dos bancos do app dentro de data/ ----
function listarDbsDoApp(dir, encontrados = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) listarDbsDoApp(full, encontrados);
    else if (ent.isFile() && ehDbDoApp(ent.name)) encontrados.push(full);
  }
  return encontrados;
}

function tamanhoLegivel(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Padrão do nome de arquivo de backup (usado também na validação anti-traversal
// da rota de download no servidor).
const NOME_RE = /^backup-\d{4}-\d{2}-\d{2}-\d{4}\.tar\.gz$/;

// Gera um backup e retorna { arquivo, tamanho (bytes), criadoEm (ISO) }.
// Chamável tanto pelo CLI (npm run backup) quanto pelo servidor (rota admin) —
// a lógica é a mesma, sem reescrita.
async function gerarBackup() {
  if (!fs.existsSync(DATA_DIR)) throw new Error("Pasta data/ não encontrada.");

  fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  const ts = carimbo();
  const staging = path.join(BACKUPS_DIR, `.staging-${ts}`);
  const saida = path.join(BACKUPS_DIR, `backup-${ts}.tar.gz`);

  // Limpa staging anterior eventualmente deixado por uma execução interrompida.
  if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });

  try {
    // 1) Espelha data/ → staging, copiando TUDO exceto os bancos do app
    //    (esses entram via snapshot consistente no passo 2). .db de terceiros
    //    (caches do Chromium nas pastas órfãs) são copiados crus normalmente.
    fs.cpSync(DATA_DIR, staging, {
      recursive: true,
      filter: (src) => !ehDbDoApp(src),
    });

    // 2) Para cada banco do app: snapshot consistente (Online Backup API).
    const dbs = listarDbsDoApp(DATA_DIR);
    for (const src of dbs) {
      const rel = path.relative(DATA_DIR, src);
      const dest = path.join(staging, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const db = new Database(src, { readonly: true });
      try {
        await db.backup(dest); // cópia consistente mesmo com o banco aberto
      } finally {
        db.close();
      }
    }

    // 3) Empacota o conteúdo do staging na raiz do tar (cwd = staging, "." ).
    await tar.create({ gzip: true, file: saida, cwd: staging }, ["."]);

    const stat = fs.statSync(saida);
    return { arquivo: path.basename(saida), tamanho: stat.size, criadoEm: stat.mtime.toISOString(), bancos: dbs.length };
  } finally {
    // 4) Sempre remove o staging.
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
  }
}

// Lista os backups existentes em backups/, mais recente primeiro.
function listarBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  return fs.readdirSync(BACKUPS_DIR)
    .filter((n) => NOME_RE.test(n))
    .map((n) => {
      const st = fs.statSync(path.join(BACKUPS_DIR, n));
      return { nome: n, tamanho: st.size, data: st.mtime.toISOString() };
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}

// ---- CLI: só roda quando executado direto (node scripts/backup.js) ----
if (require.main === module) {
  gerarBackup()
    .then(({ arquivo, tamanho, bancos }) => {
      console.log(`\n✅ Backup criado: backups/${arquivo}  (${tamanhoLegivel(tamanho)})`);
      console.log(`   ${bancos} banco(s) do app incluído(s) de forma consistente.`);
      console.log("\n⚠️  No Fly.io: backups/ é EFÊMERO (fora do volume). Baixe agora:");
      console.log(`   fly ssh sftp get /app/backups/${arquivo} ./`);
    })
    .catch((e) => {
      console.error("❌ Falha no backup:", e.message);
      process.exit(1);
    });
}

module.exports = { gerarBackup, listarBackups, tamanhoLegivel, BACKUPS_DIR, NOME_RE };
