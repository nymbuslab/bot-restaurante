require("../integracao/ajuda/ambiente");
const { spawn } = require("node:child_process");
const app = require("../integracao/ajuda/app");
const harness = require("../integracao/ajuda/estoque-custos");
const db = require("../../src/db");
const auditoria = require("../../src/auditoria-operacional");

(async () => {
  try {
    const loja = (await harness.criarParDeTenants("equipe-visual")).primeiro;
    await db.query("update empresas set equipe_habilitada = true where slug = $1", [loja.slug]);
    const empresaId = (await db.query("select id from empresas where slug=$1", [loja.slug])).rows[0].id;
    for (let i = 0; i < 35; i++) await auditoria.registrar(db, { empresaId, evento: "dispositivo_autorizado", detalhe: {} });
    const { base } = await app.subir();
    const codigo = await new Promise((resolve, reject) => {
      const processo = spawn("python", ["test/visual/equipe-real.py"], {
        stdio: "inherit",
        env: { ...process.env, EQUIPE_TESTE_BASE: base, EQUIPE_TESTE_TOKEN: loja.token, EQUIPE_TESTE_SLUG: loja.slug },
      });
      processo.on("error", reject);
      processo.on("exit", resolve);
    });
    if (codigo !== 0) process.exitCode = 1;
  } catch (erro) {
    console.error("Falha no fluxo visual de equipe:", erro.message);
    process.exitCode = 1;
  } finally {
    await app.derrubar();
    await harness.limparTudo();
    await db.pool.end();
  }
})();
