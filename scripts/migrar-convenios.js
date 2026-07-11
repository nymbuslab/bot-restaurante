// ============================================================
// MIGRAÇÃO ONE-SHOT — dia_vencimento (legado) → Convênio. Idempotente.
// Para cada restaurante: agrupa clientes por dia_vencimento em uso; para cada dia
// N cria (se não existir) um convênio "Vence todo dia N" (1–31, fixo, dia N, mês 1)
// em config.convenios e liga os clientes daquele dia via convenio_id. Clientes sem
// dia_vencimento ficam sem convênio. Rodar uma vez no deploy: npm run migrar-convenios
// ============================================================
require("dotenv").config();
const db = require("./../src/db");
const store = require("./../src/store");
const convenios = require("./../public/convenios");

(async () => {
  const empresas = await db.query("SELECT id, slug FROM empresas");
  let ligados = 0, criados = 0;
  for (const emp of empresas.rows) {
    const dir = emp.slug; // basename = slug
    await store.ensure(dir);
    const cfg = store.getConfig(dir) || {};
    const lista = convenios.normalizarConvenios(cfg.convenios);
    const dias = await db.query(
      "SELECT DISTINCT dia_vencimento AS d FROM clientes WHERE empresa_id=$1 AND dia_vencimento IS NOT NULL AND (convenio_id = '' OR convenio_id IS NULL)",
      [emp.id]
    );
    let mudou = false;
    for (const row of dias.rows) {
      const n = Number(row.d);
      if (!(n >= 1 && n <= 31)) continue;
      let cv = lista.find((c) => c.nome === `Vence todo dia ${n}`);
      if (!cv) {
        cv = { id: `cv_todo_${n}`, nome: `Vence todo dia ${n}`, faixas: [{ de: 1, ate: 31, tipo: "fixo", valor: n, meses: 1 }] };
        lista.push(cv); criados++; mudou = true;
      }
      const r = await db.query(
        "UPDATE clientes SET convenio_id=$3 WHERE empresa_id=$1 AND dia_vencimento=$2 AND (convenio_id='' OR convenio_id IS NULL)",
        [emp.id, n, cv.id]
      );
      ligados += r.rowCount;
    }
    if (mudou) await store.setConfig(dir, Object.assign({}, cfg, { convenios: convenios.normalizarConvenios(lista) }));
  }
  console.log(`Convênios criados: ${criados} · clientes religados: ${ligados}`);
  await db.pool.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
