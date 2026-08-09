// ============================================================
// CONVERTER-COMPLEMENTOS — migração dos complementos para a biblioteca.
//
// Cada tenant guardava as opções dentro do item (`composicao` estruturada +
// `opcionais` em texto). Agora existe a biblioteca `cardapio.grupos`, com
// opção de id estável, e o item guarda só o vínculo (`item.grupos`).
// Este script lê o cardápio de cada empresa e monta a biblioteca:
//   npm run converter-complementos              (SIMULAÇÃO, só lê)
//   npm run converter-complementos -- --aplicar (grava)
//
// REVERSÍVEL: `composicao` e `opcionais` NÃO são apagados. Idempotente:
// tenant que já tem biblioteca é pulado. Direto no jsonb `cardapio` da
// tabela `empresas` (não passa pelo cache do store — o servidor lê fresco
// no próximo boot/cache miss).
// ============================================================

require("dotenv").config();
const crypto = require("crypto");
const db = require("../src/db");
const { converterCardapio } = require("../public/grupos");

const APLICAR = process.argv.includes("--aplicar");
const novoId = (p) => p + crypto.randomBytes(5).toString("hex");

(async () => {
  const { rows } = await db.query("SELECT id, slug, cardapio FROM empresas ORDER BY slug");
  let totalGrupos = 0, totalItens = 0, tenantsTocados = 0;

  for (const emp of rows) {
    const cardapio = emp.cardapio || {};
    if (Array.isArray(cardapio.grupos) && cardapio.grupos.length) {
      console.log(`=  ${emp.slug}: já tem biblioteca (${cardapio.grupos.length} grupo(s)), pulando`);
      continue;
    }
    const r = converterCardapio(cardapio, novoId);
    if (!r.grupos.length) {
      console.log(`=  ${emp.slug}: nada a converter`);
      continue;
    }

    const vinculados = r.itens.filter((i) => i && Array.isArray(i.grupos)).length;
    console.log(
      `✓  ${emp.slug}: ${r.criados} grupo(s) criado(s), ${r.reusados} vínculo(s) reusado(s), ` +
      `${r.sufixados} sufixado(s), ${vinculados} item(ns) vinculado(s)`
    );
    r.grupos.forEach((g) => {
      const regra = g.padrao.obrigatorio
        ? `obrigatório, ${g.padrao.min}-${g.padrao.max || "sem limite"}`
        : `opcional, até ${g.padrao.max || "sem limite"}`;
      const opcoes = g.opcoes.map((o) => o.nome + (o.preco > 0 ? " +" + o.preco.toFixed(2) : "")).join(", ");
      console.log(`     · ${g.nome} (${regra}): ${opcoes}`);
    });
    totalGrupos += r.criados;
    totalItens += vinculados;
    tenantsTocados++;

    if (APLICAR) {
      // Cardápio real guarda os itens dentro das categorias; a lista plana é o
      // caso de borda. Grava só o formato que o tenant já usa.
      const estrutura = r.categorias ? { categorias: r.categorias } : { itens: r.itens };
      const novo = Object.assign({}, cardapio, { grupos: r.grupos }, estrutura);
      await db.query("UPDATE empresas SET cardapio = $1 WHERE id = $2", [novo, emp.id]);
    }
  }

  console.log(`\n${APLICAR ? "APLICADO" : "SIMULAÇÃO"}: ${tenantsTocados} tenant(s), ${totalGrupos} grupo(s), ${totalItens} item(ns).`);
  if (!APLICAR) console.log("Nada foi gravado. Rode com -- --aplicar para valer.");
  await db.pool.end();
  process.exit(0);
})().catch((e) => { console.error("❌ Falha:", e.message); process.exit(1); });
