require("./ajuda/ambiente");

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const db = require("../../src/db");
const harness = require("./ajuda/estoque-custos");

let primeiro;
let segundo;

before(async () => {
  const caminho = path.join(__dirname, "..", "..", "supabase", "migrations", "20260915090000_equipe_permissoes.sql");
  await db.query(fs.readFileSync(caminho, "utf8"));
  ({ primeiro, segundo } = await harness.criarParDeTenants("equipe-schema"));
});

after(async () => {
  await harness.limparTudo();
});

test("a migration aceita dois tenants e deixa os gates desligados", async () => {
  const resultado = await db.query(
    `select slug, equipe_habilitada, compras_habilitadas,
            confirmacao_compras_habilitada, ficha_tecnica_habilitada,
            baixa_insumos_habilitada
       from empresas
      where slug = any($1::text[])
      order by slug`,
    [[primeiro.slug, segundo.slug]]
  );

  assert.equal(resultado.rows.length, 2);
  for (const empresa of resultado.rows) {
    assert.deepEqual(Object.values(empresa).slice(1), [false, false, false, false, false]);
  }
});

test("FK composta recusa perfil de outro tenant", async () => {
  const empresas = await db.query("select id, slug from empresas where slug = any($1::text[])", [
    [primeiro.slug, segundo.slug],
  ]);
  const porSlug = Object.fromEntries(empresas.rows.map((empresa) => [empresa.slug, empresa.id]));
  const perfil = await db.query(
    "insert into equipe_perfis (empresa_id, codigo, nome) values ($1, 'gerente', 'Gerente') returning id",
    [porSlug[segundo.slug]]
  );

  await assert.rejects(
    db.query(
      "insert into equipe_funcionarios (empresa_id, perfil_id, nome, pin_hash) values ($1, $2, 'Cruzado', 'hash-seguro')",
      [porSlug[primeiro.slug], perfil.rows[0].id]
    ),
    /foreign key|equipe_funcionarios_perfil_fk/i
  );
});

test("perfis fora da lista aprovada e coluna de PIN puro são recusados", async () => {
  const empresa = await db.query("select id from empresas where slug = $1", [primeiro.slug]);
  await assert.rejects(
    db.query("insert into equipe_perfis (empresa_id, codigo, nome) values ($1, 'super-heroi', 'Inválido')", [
      empresa.rows[0].id,
    ]),
    /check|equipe_perfis_codigo_check/i
  );

  const colunas = await db.query(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'equipe_funcionarios'"
  );
  assert.equal(colunas.rows.some((coluna) => coluna.column_name === "pin"), false);
  assert.equal(colunas.rows.some((coluna) => coluna.column_name === "pin_hash"), true);
});
