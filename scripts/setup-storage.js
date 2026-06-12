// ============================================================
// SETUP-STORAGE — cria (idempotente) o bucket público de imagens do
// cardápio no Supabase Storage. Rode uma vez por projeto novo:
//   npm run setup-storage
// (Complementa o schema: `npx supabase db push`.)
// ============================================================

require("dotenv").config();
const { supabaseAdmin } = require("../src/supabase");

const BUCKET = "cardapio";

(async () => {
  const { data: buckets, error: e1 } = await supabaseAdmin.storage.listBuckets();
  if (e1) { console.error("❌ Falha ao listar buckets:", e1.message); process.exit(1); }

  if ((buckets || []).some((b) => b.name === BUCKET)) {
    console.log(`ℹ️  Bucket "${BUCKET}" já existe.`);
    process.exit(0);
  }

  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: "2MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error) { console.error("❌ Falha ao criar bucket:", error.message); process.exit(1); }

  console.log(`✅ Bucket público "${BUCKET}" criado.`);
  process.exit(0);
})();
