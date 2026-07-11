# Convênios de vencimento (fiado) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o "dia de vencimento" simples do cliente por Convênios (regras de vencimento nomeadas, com faixas por dia da compra e dois tipos: dia fixo do mês com deslocamento de meses, ou N dias após a compra).

**Architecture:** Módulo puro `src/convenios.js` calcula/valida/normaliza. Convênios vivem em `config.convenios` (jsonb por restaurante); o cliente referencia por `clientes.convenio_id`. O vencimento é calculado na venda a prazo (`src/fiado.js`) e gravado como foto no `pedidos.vencimento`. Front na aba Pagamentos (seção Convênios) + seletor no cadastro do cliente. Telas novas via Stitch.

**Tech Stack:** Node.js CommonJS, `pg` (Postgres/Supabase), `node:test`, HTML/CSS/JS puro no front, Stitch MCP para telas.

## Global Constraints

- Idioma pt-BR em UI, comentários e mensagens; código em inglês onde for padrão da stack.
- Sem gate de plano (fiado vale Essencial e Completo) — rotas só `exigeAuth`.
- CSP estrita: JS do front sempre externo, sem `<script>`/handler inline; usar `addEventListener`.
- Dinheiro via `dinheiro.js` (não aplicável aqui, mas manter o padrão se surgir R$).
- Sem emoji na UI (ícones SVG). Copy segue a voz `copy-nymbus` (sem travessão-conector).
- Isolamento por tenant: todo acesso a dados usa `empresa_id`/`tenantDir`.
- `.env` local aponta para o banco de PRODUÇÃO: smokes usam o tenant de teste `nymbus-teste` e se autolimpam; migrações via `npx supabase db push` (idempotente).
- `npm run check` (node --check, cobre `public/` também) e `npm test` (`node:test`) verdes ao fim de cada task de código.
- Convenção de commit: `tipo(escopo): descrição` em pt-BR; terminar com `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Deploy segurado (decisão do dono): commits ficam locais; nada de `git push` neste plano.

---

## File Structure

- **Create `public/convenios.js`** — puro dual-mode (Node/browser): `calcularVencimentoConvenio`, `validarConvenio`, `normalizarConvenios`, `resumoFaixas`. Vive em `public/` (padrão dos puros dual-mode: `src/` e `test/` requerem via `../public/convenios`; o front carrega como `<script>`).
- **Create `test/convenios.test.js`** — testes do módulo puro.
- **Create `supabase/migrations/20260711120000_cliente_convenio.sql`** — `clientes.convenio_id`.
- **Create `scripts/migrar-convenios.js`** — migração one-shot do `dia_vencimento` legado.
- **Modify `src/clientes.js`** — `convenioId` em `normalizarDados`/`mapRow`.
- **Modify `src/servidor.js`** — normalizar/validar `config.convenios` no salvar; devolver no `GET /api/config`.
- **Modify `src/fiado.js`** — calcular vencimento pelo convênio em `venderAPrazo`/`fecharMesaAPrazo`.
- **Modify `public/admin.html`** — seção Convênios na aba Pagamentos; select no cadastro; cards de pagamento redesenhados.
- **Modify `public/app.js`** — render/editor de convênios; select do cadastro; wiring dos cards redesenhados.
- **Modify `public/style.css`** — estilos da seção Convênios + cards.
- **Modify `CLAUDE.md`, `docs/modelo-dados.md`** — documentação.

---

## Task 1: Módulo puro `src/convenios.js` (cálculo + validação + normalização)

**Files:**
- Create: `public/convenios.js` (puro dual-mode; `src/` e `test/` requerem via `../public/convenios`)
- Test: `test/convenios.test.js`

**Interfaces:**
- Produces:
  - `calcularVencimentoConvenio(dataCompraISO: string, convenio: object|null): string|null` — `'YYYY-MM-DD'` ou `null`.
  - `validarConvenio(convenio: object): string|null` — mensagem de erro (pt-BR) ou `null` se válido.
  - `normalizarConvenios(lista: any): object[]` — lista saneada só com convênios válidos, cada um `{ id, nome, faixas: [{de,ate,tipo,valor,meses}] }`.
  - `resumoFaixas(convenio: object): string` — texto curto legível das faixas (para a lista na UI, dual-mode).

- [ ] **Step 1: Write the failing test**

Create `test/convenios.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const {
  calcularVencimentoConvenio, validarConvenio, normalizarConvenios, resumoFaixas,
} = require("../public/convenios");

const cv = (faixas, nome = "C") => ({ id: "cv_x", nome, faixas });

// --- calcularVencimentoConvenio ---
test("fixo: dia 10 mês seguinte — compra dentro do mês vence no próximo (corrige o bug)", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", c), "2026-08-10");
});

test("fixo: meses 0 = mesmo mês", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "fixo", valor: 20, meses: 0 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", c), "2026-07-20");
});

test("fixo: meses 2 = dois meses à frente", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 2 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", c), "2026-09-10");
});

test("fixo: clamp em mês curto (dia 31, meses 1, jan → fevereiro)", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "fixo", valor: 31, meses: 1 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-01-15", c), "2026-02-28");
});

test("fixo: virada de ano (dezembro + meses 1 → janeiro do ano seguinte)", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "fixo", valor: 5, meses: 1 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-12-20", c), "2027-01-05");
});

test("dias: 30 dias após a compra (meses ignorado)", () => {
  const c = cv([{ de: 1, ate: 31, tipo: "dias", valor: 30, meses: 3 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", c), "2026-08-08");
});

test("split: dia 9 cai na 1ª faixa, dia 20 na 2ª", () => {
  const c = cv([
    { de: 1, ate: 15, tipo: "fixo", valor: 10, meses: 1 },
    { de: 16, ate: 31, tipo: "fixo", valor: 15, meses: 2 },
  ]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", c), "2026-08-10");
  assert.strictEqual(calcularVencimentoConvenio("2026-07-20", c), "2026-09-15");
});

test("sem convênio / sem faixas / dia fora das faixas → null", () => {
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", null), null);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-09", cv([])), null);
  const parcial = cv([{ de: 1, ate: 5, tipo: "fixo", valor: 10, meses: 1 }]);
  assert.strictEqual(calcularVencimentoConvenio("2026-07-20", parcial), null);
});

// --- validarConvenio ---
test("válido: faixas cobrem 1–31", () => {
  assert.strictEqual(validarConvenio(cv([{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }])), null);
});

test("inválido: sem nome", () => {
  assert.match(validarConvenio(cv([{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }], "")), /nome/i);
});

test("inválido: buraco na cobertura (1–15 e 17–31)", () => {
  const c = cv([
    { de: 1, ate: 15, tipo: "fixo", valor: 10, meses: 1 },
    { de: 17, ate: 31, tipo: "fixo", valor: 10, meses: 1 },
  ]);
  assert.match(validarConvenio(c), /1 a 31|cobrir/i);
});

test("inválido: sobreposição (1–20 e 15–31)", () => {
  const c = cv([
    { de: 1, ate: 20, tipo: "fixo", valor: 10, meses: 1 },
    { de: 15, ate: 31, tipo: "fixo", valor: 10, meses: 1 },
  ]);
  assert.notStrictEqual(validarConvenio(c), null);
});

test("inválido: fixo com valor fora de 1–31", () => {
  assert.notStrictEqual(validarConvenio(cv([{ de: 1, ate: 31, tipo: "fixo", valor: 40, meses: 0 }])), null);
});

test("inválido: dias com valor < 1", () => {
  assert.notStrictEqual(validarConvenio(cv([{ de: 1, ate: 31, tipo: "dias", valor: 0, meses: 0 }])), null);
});

// --- normalizarConvenios ---
test("normaliza: descarta inválidos, coage tipos, força meses=0 no tipo dias", () => {
  const entrada = [
    { id: "cv_a", nome: "Ok", faixas: [{ de: "1", ate: "31", tipo: "dias", valor: "30", meses: "5" }] },
    { id: "cv_b", nome: "", faixas: [] }, // inválido: sem nome/faixas
  ];
  const out = normalizarConvenios(entrada);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].faixas[0].meses, 0); // dias força meses 0
  assert.strictEqual(out[0].faixas[0].de, 1);    // coage p/ número
});

test("normaliza: gera id quando ausente", () => {
  const out = normalizarConvenios([{ nome: "Todo 10", faixas: [{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }] }]);
  assert.strictEqual(out.length, 1);
  assert.ok(out[0].id && typeof out[0].id === "string");
});

// --- resumoFaixas ---
test("resumoFaixas: texto legível", () => {
  const s = resumoFaixas(cv([{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }]));
  assert.match(s, /10/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/convenios.test.js`
Expected: FAIL (`Cannot find module '../src/convenios'`).

- [ ] **Step 3: Write minimal implementation**

Create `public/convenios.js`:

```js
// ============================================================
// CONVÊNIOS — regras de vencimento do fiado. Módulo PURO (sem I/O), testado em
// test/convenios.test.js. Um convênio tem faixas por dia da compra; cada faixa
// vence por dia fixo do mês (com deslocamento de meses) ou por N dias após a
// compra. Ficam em config.convenios (por restaurante); o cliente referencia por
// convenio_id. Ver docs/superpowers/specs/2026-07-11-convenios-vencimento-fiado-design.md
// ============================================================
const pad = (n) => String(n).padStart(2, "0");

// PURO: vencimento de uma venda a prazo pelo convênio. `dataCompraISO` = 'YYYY-MM-DD'
// (data BR). Retorna 'YYYY-MM-DD' ou null (sem convênio, sem faixas, ou dia sem faixa).
function calcularVencimentoConvenio(dataCompraISO, convenio) {
  if (!convenio || !Array.isArray(convenio.faixas) || !convenio.faixas.length) return null;
  const [ano, mes, dia] = String(dataCompraISO).split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  const faixa = convenio.faixas.find((f) => dia >= Number(f.de) && dia <= Number(f.ate));
  if (!faixa) return null;

  if (faixa.tipo === "dias") {
    // compra + N dias (UTC evita saltos de fuso). Meses ignorado.
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    d.setUTCDate(d.getUTCDate() + (Number(faixa.valor) || 0));
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  // tipo "fixo": dia fixo do mês (mês da compra + meses), clamp em mês curto.
  let alvoMes = mes + (Number(faixa.meses) || 0);
  let alvoAno = ano + Math.floor((alvoMes - 1) / 12);
  alvoMes = ((alvoMes - 1) % 12) + 1;
  const ultimoDia = new Date(Date.UTC(alvoAno, alvoMes, 0)).getUTCDate();
  const diaAlvo = Math.min(Number(faixa.valor) || 1, ultimoDia);
  return `${alvoAno}-${pad(alvoMes)}-${pad(diaAlvo)}`;
}

// PURO: valida o convênio p/ salvar. Retorna mensagem de erro (pt-BR) ou null.
// As faixas têm de cobrir 1..31 sem buraco nem sobreposição.
function validarConvenio(c) {
  if (!c || typeof c !== "object") return "Convênio inválido.";
  if (!String(c.nome || "").trim()) return "Dê um nome ao convênio.";
  const faixas = Array.isArray(c.faixas) ? c.faixas : [];
  if (!faixas.length) return "Adicione ao menos uma faixa de dias.";
  const ord = faixas.slice().sort((a, b) => Number(a.de) - Number(b.de));
  let esperado = 1;
  for (const f of ord) {
    const de = Number(f.de), ate = Number(f.ate), valor = Number(f.valor), meses = Number(f.meses);
    if (!Number.isInteger(de) || !Number.isInteger(ate) || de < 1 || ate > 31 || de > ate)
      return "Cada faixa deve ir de 1 a 31, com início menor ou igual ao fim.";
    if (de !== esperado) return "As faixas devem cobrir os dias 1 a 31 sem buraco nem sobreposição.";
    esperado = ate + 1;
    if (f.tipo !== "fixo" && f.tipo !== "dias") return "Tipo de faixa inválido.";
    if (f.tipo === "fixo" && (!Number.isInteger(valor) || valor < 1 || valor > 31))
      return "No tipo dia fixo, o valor deve ser um dia de 1 a 31.";
    if (f.tipo === "dias" && (!Number.isInteger(valor) || valor < 1))
      return "No tipo +dias, informe um número de dias (1 ou mais).";
    if (!Number.isInteger(meses) || meses < 0) return "O mês deve ser 0 ou mais.";
  }
  if (esperado !== 32) return "As faixas devem cobrir até o dia 31.";
  return null;
}

function _slug(nome) {
  return "cv_" + String(nome || "conv").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cv_conv";
}

// PURO: saneia a lista p/ persistir em config.convenios. Descarta inválidos, coage
// tipos, força meses=0 no tipo "dias", garante id.
function normalizarConvenios(lista) {
  const arr = Array.isArray(lista) ? lista : [];
  const out = [];
  const usados = new Set();
  for (const c of arr) {
    const faixas = (Array.isArray(c && c.faixas) ? c.faixas : []).map((f) => ({
      de: Number(f.de), ate: Number(f.ate),
      tipo: f.tipo === "dias" ? "dias" : "fixo",
      valor: Math.trunc(Number(f.valor) || 0),
      meses: f.tipo === "dias" ? 0 : Math.trunc(Number(f.meses) || 0),
    }));
    let id = String((c && c.id) || "").trim() || _slug(c && c.nome);
    while (usados.has(id)) id += "x";
    const norm = { id, nome: String((c && c.nome) || "").trim(), faixas };
    if (validarConvenio(norm) === null) { usados.add(id); out.push(norm); }
  }
  return out;
}

// PURO (dual-mode Node/browser): resumo legível das faixas p/ a lista na UI.
function resumoFaixas(convenio) {
  const faixas = (convenio && Array.isArray(convenio.faixas)) ? convenio.faixas : [];
  return faixas.map((f) => {
    const dias = `${f.de}–${f.ate}`;
    if (f.tipo === "dias") return `Dias ${dias}: ${f.valor} dias após a compra`;
    const quando = Number(f.meses) === 0 ? "no mês" : Number(f.meses) === 1 ? "no mês seguinte" : `em ${f.meses} meses`;
    return `Dias ${dias}: dia ${f.valor} ${quando}`;
  }).join(" · ");
}

const api = { calcularVencimentoConvenio, validarConvenio, normalizarConvenios, resumoFaixas };
if (typeof module !== "undefined" && module.exports) module.exports = api;
if (typeof window !== "undefined") window.Convenios = api;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/convenios.test.js`
Expected: PASS (todos os testes verdes).

- [ ] **Step 5: Run full check + suite**

Run: `npm run check && npm test`
Expected: `OK: N arquivos...` e `pass` sem `fail`.

- [ ] **Step 6: Commit**

```bash
git add public/convenios.js test/convenios.test.js
git commit -m "feat(convenios): modulo puro de vencimento (calculo/validacao/normalizacao)"
```

---

## Task 2: Migração `clientes.convenio_id`

**Files:**
- Create: `supabase/migrations/20260711120000_cliente_convenio.sql`

**Interfaces:**
- Produces: coluna `clientes.convenio_id text NOT NULL DEFAULT ''`.

- [ ] **Step 1: Criar a migração**

Create `supabase/migrations/20260711120000_cliente_convenio.sql`:

```sql
-- ============================================================
-- CLIENTES — vínculo com Convênio de vencimento (fiado).
--
-- O vencimento das vendas a prazo deixa de vir do dia_vencimento (dia fixo) e
-- passa a vir de um Convênio (config.convenios, jsonb por restaurante). O cliente
-- referencia o convênio por id (texto). Vazio = sem convênio = venda a prazo sem
-- vencimento. `dia_vencimento` permanece como legado (some da UI; usado só na
-- migração scripts/migrar-convenios.js). Aditivo, sem backfill.
-- ============================================================
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS convenio_id text NOT NULL DEFAULT '';
```

- [ ] **Step 2: Aplicar no banco**

Run: `npx supabase db push`
Expected: `Applying migration 20260711120000_cliente_convenio.sql...` / `Finished`.

- [ ] **Step 3: Conferir que aplicou**

Run: `npx supabase migration list`
Expected: `20260711120000` aparece nas colunas Local e Remote.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260711120000_cliente_convenio.sql
git commit -m "feat(db): coluna clientes.convenio_id (convenio de vencimento)"
```

---

## Task 3: `src/clientes.js` — `convenioId` no CRUD

**Files:**
- Modify: `src/clientes.js` (`normalizarDados`, `mapRow`, e o INSERT/UPDATE do `criar`/`atualizar`)

**Interfaces:**
- Consumes: nada novo.
- Produces: cliente com `convenioId` (string) no `mapRow`; `criar`/`atualizar` persistem `convenio_id`.

- [ ] **Step 1: `mapRow` expõe `convenioId`**

Em `src/clientes.js`, na função `mapRow`, adicionar após `diaVencimento`:

```js
    diaVencimento: r.dia_vencimento == null ? null : Number(r.dia_vencimento), // legado
    convenioId: r.convenio_id || "",
```

- [ ] **Step 2: `normalizarDados` aceita `convenioId`**

Em `normalizarDados`, trocar a linha do `diaVencimento` por (mantém o legado saindo do payload, adiciona convenioId):

```js
    diaVencimento: normalizarDiaVenc(d.diaVencimento), // legado (não vem mais da UI; fica null)
    convenioId: String(d.convenioId || "").trim().slice(0, 60),
    bloquearLimite: !!d.bloquearLimite,
```

- [ ] **Step 3: Persistir `convenio_id` no INSERT e UPDATE**

Localizar o INSERT de `criar` e o UPDATE de `atualizar` em `src/clientes.js`. Incluir a coluna `convenio_id` na lista de colunas/SET e o valor `dados.convenioId` no array de parâmetros (seguindo o padrão das colunas vizinhas já presentes, ex.: ao lado de `dia_vencimento`). Ver as consultas atuais com:

Run: `grep -n "dia_vencimento" src/clientes.js`

Adicionar `convenio_id` na mesma posição relativa (coluna + placeholder + valor `d.convenioId`).

- [ ] **Step 4: Smoke do CRUD com convenioId (tenant de teste)**

Create `scratchpad/smoke-cliente-convenio.js` (fora do repo, no scratchpad da sessão):

```js
const ROOT = "C:/Users/nymbu/Downloads/bot-restaurante/bot-restaurante";
require(ROOT + "/node_modules/dotenv").config({ path: ROOT + "/.env" });
const db = require(ROOT + "/src/db");
const clientes = require(ROOT + "/src/clientes");
const DIR = "nymbus-teste";
(async () => {
  let id;
  try {
    const c = await clientes.criar(DIR, { nome: "ZZ_SMOKE_CONV", convenioId: "cv_teste" });
    id = c.id;
    if (c.convenioId !== "cv_teste") throw new Error("convenioId nao persistiu no criar");
    const upd = await clientes.atualizar(DIR, id, { nome: "ZZ_SMOKE_CONV", convenioId: "cv_outro" });
    if (upd.convenioId !== "cv_outro") throw new Error("convenioId nao atualizou");
    console.log("SMOKE OK — convenioId persiste e atualiza");
  } finally {
    if (id) await db.query("DELETE FROM clientes WHERE id=$1", [id]);
    await db.pool.end();
  }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
```

Run: `node <caminho-scratchpad>/smoke-cliente-convenio.js`
Expected: `SMOKE OK — convenioId persiste e atualiza`.

- [ ] **Step 5: check + suite**

Run: `npm run check && npm test`
Expected: verdes.

- [ ] **Step 6: Commit**

```bash
git add src/clientes.js
git commit -m "feat(clientes): persiste convenio_id no CRUD (troca o dia fixo)"
```

---

## Task 4: `src/servidor.js` — validar/normalizar `config.convenios`

**Files:**
- Modify: `src/servidor.js` (`normalizarConfigServidor` ~1497; `require` do módulo)

**Interfaces:**
- Consumes: `convenios.normalizarConvenios` (Task 1).
- Produces: `config.convenios` saneado ao salvar; devolvido no `GET /api/config` (a config inteira já é devolvida).

- [ ] **Step 1: Importar o módulo**

No topo de `src/servidor.js`, junto dos outros `require`, adicionar:

```js
const convenios = require("../public/convenios");
```

- [ ] **Step 2: Normalizar `convenios` ao salvar a config**

Em `normalizarConfigServidor(body)`, onde a config é montada/saneada (mesmo lugar do whitelist de `pagamentos`), garantir:

```js
  body.convenios = convenios.normalizarConvenios(body.convenios);
```

(Se `normalizarConfigServidor` reconstrói um objeto novo em vez de mutar `body`, incluir `convenios: convenios.normalizarConvenios(body.convenios)` nesse objeto — seguir o padrão local do `pagamentos`.)

- [ ] **Step 3: Garantir `convenios` no `GET /api/config`**

Verificar a rota `GET /api/config` (~1487). Ela devolve `Object.assign({}, cfg, { pagamentos: ... })`. Acrescentar `convenios` normalizado para clientes antigos que não têm o campo:

```js
    res.json(Object.assign({}, cfg, {
      pagamentos: formasPag.normalizarFormasPagamento(cfg.pagamentos),
      convenios: convenios.normalizarConvenios(cfg.convenios),
    }));
```

- [ ] **Step 4: Smoke de salvar/ler convênio (tenant de teste)**

Create `scratchpad/smoke-config-convenio.js`:

```js
const ROOT = "C:/Users/nymbu/Downloads/bot-restaurante/bot-restaurante";
require(ROOT + "/node_modules/dotenv").config({ path: ROOT + "/.env" });
const db = require(ROOT + "/src/db");
const store = require(ROOT + "/src/store");
const convenios = require(ROOT + "/src/convenios");
const DIR = "nymbus-teste";
(async () => {
  try {
    await store.ensure(DIR);
    const cfg = store.getConfig(DIR) || {};
    const bkp = cfg.convenios;
    const lista = convenios.normalizarConvenios([
      { nome: "Todo 10", faixas: [{ de: 1, ate: 31, tipo: "fixo", valor: 10, meses: 1 }] },
      { nome: "Invalido", faixas: [] },
    ]);
    if (lista.length !== 1) throw new Error("normalizacao deveria descartar o invalido");
    await store.setConfig(DIR, Object.assign({}, cfg, { convenios: lista }));
    const relido = (store.getConfig(DIR) || {}).convenios || [];
    if (relido.length !== 1 || relido[0].nome !== "Todo 10") throw new Error("nao releu o convenio");
    console.log("SMOKE OK — convenio salva e relê pela config");
    await store.setConfig(DIR, Object.assign({}, store.getConfig(DIR), { convenios: bkp || [] })); // restaura
  } finally { await db.pool.end(); }
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
```

Run: `node <caminho-scratchpad>/smoke-config-convenio.js`
Expected: `SMOKE OK — convenio salva e relê pela config`.

- [ ] **Step 5: check + suite + commit**

Run: `npm run check && npm test` (verdes).

```bash
git add src/servidor.js
git commit -m "feat(config): valida e normaliza config.convenios ao salvar/ler"
```

---

## Task 5: `src/fiado.js` — vencimento pelo convênio na venda

**Files:**
- Modify: `src/fiado.js` (`venderAPrazo` e `fecharMesaAPrazo`; `require` do módulo e do `store`)

**Interfaces:**
- Consumes: `convenios.calcularVencimentoConvenio` (Task 1); `store.getConfig(dir)` (já usado no projeto).
- Produces: `pedidos.vencimento` calculado pelo convênio do cliente (ou `null`).

- [ ] **Step 1: Importar o módulo**

No topo de `src/fiado.js` (já tem `require("./store")`), adicionar:

```js
const convenios = require("../public/convenios");
```

- [ ] **Step 2: `venderAPrazo` usa o convênio**

Em `venderAPrazo`, o SELECT do cliente hoje traz `dia_vencimento`. Trocar por `convenio_id`:

- No SELECT `FROM clientes ... FOR UPDATE`, trocar `dia_vencimento` por `convenio_id`.
- Onde hoje faz `const vencimento = calcularVencimento(c.hoje, c.dia_vencimento);`, trocar por:

```js
    const cfg = store.getConfig(dir) || {};
    const convenio = (Array.isArray(cfg.convenios) ? cfg.convenios : []).find((v) => v.id === c.convenio_id) || null;
    const vencimento = convenios.calcularVencimentoConvenio(c.hoje, convenio);
```

- [ ] **Step 3: `fecharMesaAPrazo` usa o convênio**

Aplicar a mesma troca em `fecharMesaAPrazo` (SELECT do cliente traz `convenio_id`; `vencimento` calculado igual ao Step 2).

- [ ] **Step 4: Remover o uso de `calcularVencimento` legado**

`calcularVencimento(hoje, dia)` deixa de ser chamado. Removê-lo de `src/fiado.js` (função + do `module.exports`) e remover/adaptar seus testes em `test/fiado.test.js` (os cenários de dia fixo agora vivem em `test/convenios.test.js`). Rodar:

Run: `grep -rn "calcularVencimento\b" src/ test/`
Expected: sem ocorrências de `calcularVencimento` (só `calcularVencimentoConvenio`). Ajustar até zerar.

- [ ] **Step 5: Smoke da venda a prazo com convênio (tenant de teste, Essencial-path)**

Create `scratchpad/smoke-venda-convenio.js` — cria um convênio "Todo 10 (mês seguinte)" na config do tenant, um cliente ligado a ele, insere uma venda a prazo via `venderAPrazo` com itens simples e confere que `vencimento` = dia 10 do mês seguinte à data BR de hoje. Autolimpa (remove venda, cliente, restaura config). Estrutura igual aos smokes da Fase 4 (`require` por ROOT, `db.pool.end()` no finally, marca `ZZ_SMOKE`). Asserção central:

```js
// hoje BR
const hoje = (await db.query("SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date::text AS d")).rows[0].d;
const esperado = require(ROOT + "/src/convenios").calcularVencimentoConvenio(hoje, convenioTodo10);
// ... venderAPrazo ... depois:
assert(pedido.vencimento === esperado, "vencimento do pedido = " + esperado);
```

Run: `node <caminho-scratchpad>/smoke-venda-convenio.js`
Expected: `SMOKE OK`.

> Observação: `venderAPrazo` faz baixa de estoque atômica. Para o smoke, usar um item que exista no cardápio do `nymbus-teste` OU inserir o pedido a prazo direto por SQL com `cliente_id`/`convenio` e testar só o cálculo via `calcularVencimentoConvenio` + um item sem controle de estoque. Escolher o caminho que não suje o cardápio real.

- [ ] **Step 6: check + suite + commit**

Run: `npm run check && npm test` (verdes; `test/fiado.test.js` sem os testes do dia fixo antigo).

```bash
git add src/fiado.js test/fiado.test.js
git commit -m "feat(fiado): vencimento vem do convenio do cliente (remove dia fixo)"
```

---

## Task 6: Front — seção "Convênios" na aba Pagamentos (via Stitch)

**Files:**
- Modify: `public/admin.html` (seção Convênios abaixo dos cards de pagamento + modal/editor)
- Modify: `public/app.js` (render da lista + editor de faixas + persistência)
- Modify: `public/style.css` (estilos)

**Interfaces:**
- Consumes: `window.Convenios` (`resumoFaixas`, `validarConvenio`) de `src/convenios.js` carregado como script no `admin.html`; `configAtual.convenios`.
- Produces: edita `configAtual.convenios`; sobe no `PUT /api/config` existente.

- [ ] **Step 1: Carregar `convenios.js` no front**

`public/convenios.js` já existe (Task 1) com o rodapé dual-mode (`window.Convenios`/`module.exports`). Em `public/admin.html`, adicionar o script junto dos outros utilitários dual-mode (ex.: perto de `texto.js`):

```html
  <script src="convenios.js"></script>
```

Nada a mover: `src/` e `test/` já requerem `../public/convenios`; o browser usa `window.Convenios`.

- [ ] **Step 2: Mockup no Stitch**

Gerar no Stitch a seção "Convênios" (lista + botão Novo + editor com tabela de faixas `De | Até | Tipo +/= | Valor | Mês` e adicionar/remover linha; "Mês" desabilitado quando tipo `+`) e o **redesign dos cards de pagamento**, usando o projeto/DS Nymbus (ver memória `stitch-projeto-nymbus`). Apresentar os mockups ao dono e **aguardar aprovação** antes de aplicar (regra de 2 turnos).

- [ ] **Step 3: Markup no `admin.html`**

Após o `#pagamentosContainer` (cards), adicionar a seção Convênios (lista `#convenioLista` + botão `#btnNovoConvenio` + um modal/editor `#convenio-overlay` com input de nome, corpo de faixas `#convenioFaixas` e rodapé Salvar/Cancelar), no padrão visual aprovado no Stitch e coerente com `.cli-*`/`.cfg-*`. Sem handlers inline.

- [ ] **Step 4: Lógica no `app.js`**

Adicionar um módulo "CONVÊNIOS" em `public/app.js`:
- `renderConvenios()` — lista `configAtual.convenios` (nome + `Convenios.resumoFaixas(c)`), com editar/excluir; estado vazio orientando.
- `abrirConvenioModal(id|null)` — editor: nome + linhas de faixa; cada linha `{de, ate, tipo, valor, meses}`; botão adicionar/remover; ao trocar tipo para `dias`, desabilita o campo Mês.
- `salvarConvenio()` — monta o objeto, valida com `Convenios.validarConvenio` (erro inline em pt-BR), gera `id` novo com `crypto.randomUUID()` quando criando, grava em `configAtual.convenios` e persiste via a rotina de salvar config já existente (mesmo `PUT /api/config`).
- `excluirConvenio(id)` — remove de `configAtual.convenios` (confirmação via `confirmar()`), persiste. Clientes que apontavam ficam sem vencimento (tolerado).
- Wiring (IIFE, uma vez): botão Novo, submit, fechar (Esc/overlay), escopado a `#aba-... pagamentos`.
Chamar `renderConvenios()` dentro de `preencherConfig()`/`carregarConfig()` (onde `renderPagamentos()` é chamado).

- [ ] **Step 5: Estilos no `style.css`**

Adicionar `.conv-*` (lista, linha, editor, tabela de faixas) seguindo os tokens do design system e o mockup do Stitch. Garantir responsividade (tabela de faixas com `overflow-x:auto` se necessário; sem barra horizontal no corpo).

- [ ] **Step 6: Validação visual (harness estático + Playwright)**

Servir `public/` num http-server, renderizar um harness com a seção Convênios + editor (2 faixas) e o card redesenhado; screenshot; conferir layout e o toggle "Mês desabilitado no +dias". Limpar artefatos (`.playwright-mcp`, harness em `public/`) e parar o servidor. `npm run check` verde.

- [ ] **Step 7: Commit**

```bash
git add public/admin.html public/app.js public/style.css
git commit -m "feat(convenios): secao Convenios na aba Pagamentos + cards redesenhados (Stitch)"
```

---

## Task 7: Front — seletor de Convênio no cadastro do cliente

**Files:**
- Modify: `public/admin.html` (troca o campo "Dia venc." por um `<select id="cliConvenio">`)
- Modify: `public/app.js` (popular o select; ler/gravar `convenioId`; remover o uso de `cliDiaVenc`)

**Interfaces:**
- Consumes: `configAtual.convenios`; `cliente.convenioId` (Task 3).
- Produces: `salvarCliente` envia `convenioId`.

- [ ] **Step 1: Trocar o campo no `admin.html`**

No modal de cadastro (seção "Limite de crédito"), substituir o campo `cliDiaVenc` por:

```html
            <div class="campo"><label for="cliConvenio">Convênio de vencimento</label>
              <select id="cliConvenio"><option value="">Sem convênio</option></select>
            </div>
```

- [ ] **Step 2: Popular o select ao abrir o modal**

Em `public/app.js`, em `abrirClienteModal`, popular `#cliConvenio` a partir de `configAtual.convenios` (uma `<option>` por convênio: `value=id`, texto = nome). Selecionar `cliente.convenioId` quando editando. Remover as linhas que setavam/limpavam `cliDiaVenc`.

- [ ] **Step 3: Enviar `convenioId` no salvar**

Em `salvarCliente`, incluir `convenioId: $("cliConvenio").value` no payload; remover `diaVencimento` do payload. Remover o listener/máscara de `cliDiaVenc` no `wireClientes`.

- [ ] **Step 4: Verificar referências órfãs**

Run: `grep -n "cliDiaVenc\|diaVencimento" public/app.js public/admin.html`
Expected: sem referências a `cliDiaVenc`; `diaVencimento` só onde for legado inofensivo (idealmente zero no front).

- [ ] **Step 5: Validação visual + check**

Harness/Playwright: abrir o modal de cadastro com 1–2 convênios em `configAtual`, conferir o select populado e a seleção ao editar. Limpar artefatos. `npm run check` verde.

- [ ] **Step 6: Commit**

```bash
git add public/admin.html public/app.js
git commit -m "feat(clientes): seletor de Convenio no cadastro (troca o dia fixo)"
```

---

## Task 8: Migração one-shot `scripts/migrar-convenios.js`

**Files:**
- Create: `scripts/migrar-convenios.js`
- Modify: `package.json` (script `migrar-convenios`)

**Interfaces:**
- Consumes: `src/db`, `src/store`, `src/convenios` (`normalizarConvenios`).
- Produces: por restaurante, convênios "Vence todo dia N" a partir dos `dia_vencimento` em uso + `clientes.convenio_id` religado.

- [ ] **Step 1: Escrever o script**

Create `scripts/migrar-convenios.js`:

```js
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
```

- [ ] **Step 2: Registrar o script no `package.json`**

Em `scripts`, adicionar:

```json
    "migrar-convenios": "node scripts/migrar-convenios.js",
```

- [ ] **Step 3: check (não rodar contra produção agora)**

Run: `npm run check`
Expected: verde. **Não** executar `migrar-convenios` agora (mexe em dados reais; roda no deploy, junto do `normalizar-pagamentos`).

- [ ] **Step 4: Commit**

```bash
git add scripts/migrar-convenios.js package.json
git commit -m "chore(deploy): script one-shot migrar dia_vencimento -> Convenio"
```

---

## Task 9: Docs

**Files:**
- Modify: `CLAUDE.md` (índice: `src/convenios.js` + menção à seção Convênios)
- Modify: `docs/modelo-dados.md` (colunas/estrutura + regra de cálculo)

- [ ] **Step 1: `CLAUDE.md`**

Na árvore de `src/`, adicionar a linha do `convenios.js` (puro: cálculo/validação/normalização do vencimento; `config.convenios` + `clientes.convenio_id`). Na seção do fiado/Contas a Receber, mencionar que o vencimento vem do Convênio do cliente.

- [ ] **Step 2: `docs/modelo-dados.md`**

Na seção "Contas a Receber (fiado)", acrescentar: estrutura de `config.convenios` (faixas, tipos fixo/dias, meses), `clientes.convenio_id`, a regra de cálculo (com os exemplos) e a nota de que o vencimento é foto no pedido. Referenciar o spec.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/modelo-dados.md
git commit -m "docs(convenios): registra o modelo de convenios de vencimento"
```

---

## Self-Review (feito na escrita do plano)

- **Cobertura do spec:** cálculo (Task 1), validação 1–31 (Task 1), `config.convenios`+`convenio_id` (Tasks 2–4), vencimento na venda (Task 5), seção Convênios + cards Stitch (Task 6), seletor no cadastro (Task 7), migração (Task 8), docs (Task 9), fallback sem convênio (coberto pelo `null` em Task 1 e pelo caminho já existente de `vencimento` nulo no pedido). Todos mapeados.
- **Placeholders:** nenhum "TBD/TODO"; código completo nos steps de código; steps de Stitch descrevem o processo determinístico + wiring de dados (o HTML/CSS final depende do mockup aprovado, por isso descrito e não fixado).
- **Consistência de tipos:** `calcularVencimentoConvenio(dataCompraISO, convenio)`, `validarConvenio(convenio)`, `normalizarConvenios(lista)`, `resumoFaixas(convenio)` usados com as mesmas assinaturas nas Tasks 4/5/6/8. `convenio_id` (banco) / `convenioId` (app) consistentes via `mapRow`.

## Ordem e dependências

1 → 2 → 3 → 4 → 5 (backend completo e testável) → 6 → 7 (front) → 8 (migração) → 9 (docs).
Tasks 6 e 7 exigem mockup do Stitch aprovado antes de aplicar (2 turnos). Nada é pushado (deploy segurado).
