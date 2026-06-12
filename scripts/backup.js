// ============================================================
// BACKUP MANUAL — gera um arquivo único de data/
//
// Empacota a pasta data/ (sessões do WhatsApp em baileys-*/ e imagens
// do cardápio em tenants/{slug}/uploads/) num backup-AAAA-MM-DD-HHmm.tar.gz
// dentro de backups/ (gitignored).
//
// NOTA: os dados de pedidos/config/cardápio e as contas agora vivem no
// Supabase (Postgres) — o backup deles é GERENCIADO pelo Supabase
// (point-in-time recovery). Este backup cobre só o que ainda mora em
// disco: sessões e imagens.
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

const RAIZ = path.join(__dirname, "..");
const DATA_DIR = path.join(RAIZ, "data");
const BACKUPS_DIR = path.join(RAIZ, "backups");

// ---- Timestamp local AAAA-MM-DD-HHmm ----
function carimbo() {
  const d = new Date();
  const z = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
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
// Chamável pelo CLI (npm run backup) e pelo servidor (rota admin).
async function gerarBackup() {
  if (!fs.existsSync(DATA_DIR)) throw new Error("Pasta data/ não encontrada.");

  fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  const ts = carimbo();
  const saida = path.join(BACKUPS_DIR, `backup-${ts}.tar.gz`);

  // Empacota TODA a data/ (sessões baileys-*/ + imagens). cwd = DATA_DIR para
  // a raiz do tar ser o conteúdo de data/. backups/ fica fora de data/, sem
  // risco de auto-recursão.
  await tar.create({ gzip: true, file: saida, cwd: DATA_DIR }, ["."]);

  const stat = fs.statSync(saida);
  return { arquivo: path.basename(saida), tamanho: stat.size, criadoEm: stat.mtime.toISOString() };
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
    .then(({ arquivo, tamanho }) => {
      console.log(`\n✅ Backup criado: backups/${arquivo}  (${tamanhoLegivel(tamanho)})`);
      console.log("   Cobre sessões do WhatsApp + imagens (os dados do banco ficam no Supabase).");
      console.log("\n⚠️  No Fly.io: backups/ é EFÊMERO (fora do volume). Baixe agora:");
      console.log(`   fly ssh sftp get /app/backups/${arquivo} ./`);
    })
    .catch((e) => {
      console.error("❌ Falha no backup:", e.message);
      process.exit(1);
    });
}

module.exports = { gerarBackup, listarBackups, tamanhoLegivel, BACKUPS_DIR, NOME_RE };
