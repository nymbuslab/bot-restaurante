# Caixa / Fechamento do dia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Caixa do dia (abrir com fundo de troco, recebimento por pedido, sangria/suprimento, fechamento com conferência de dinheiro físico e diferença), exclusivo do Plano Completo, reconciliando os pedidos que vêm do WhatsApp.

**Architecture:** Cálculos puros em `src/caixa-calc.js` (testáveis); orquestração de banco em `src/caixa.js` (padrão do `src/pedidos.js`: `empresaId(dir)` + `db.query`); gate de plano em `empresas.temCaixa` (front **e** backend); rotas `exigeAuth` em `servidor.js`; UI numa nova aba "Caixa" no painel (vanilla + CSP estrita). Migration nova com 2 tabelas + 1 coluna em `pedidos`.

**Tech Stack:** Node.js CommonJS, `pg` (Postgres/Supabase), `node:test`, Supabase CLI (migrations), front HTML/CSS/JS vanilla, Playwright.

## Global Constraints

- **Idioma:** pt-BR em UI, comentários e textos.
- **CSP estrita:** todo JS externo; **nunca** `<script>`/handler inline. Eventos via `addEventListener`.
- **Sem emojis na UI** — usar ícones SVG (preferência registrada). Em texto impresso, marcadores em texto.
- **Gate de plano (Completo):** `empresas.temCaixa(emp) = acessoLiberado(emp) && planoDe(emp) === "completo"`. Front oculta/cadeia; **backend retorna 403** (caixa é recurso de servidor).
- **Isolamento:** toda query filtra por `empresa_id` (padrão `empresaId(dir)` do `pedidos.js`).
- **Dinheiro:** campos monetários via `public/dinheiro.js` (centavos primeiro); no backend, `numeric(10,2)` e `Number(...)`.
- **Forma "Dinheiro":** identificada por nome case-insensitive (`forma.trim().toLowerCase() === "dinheiro"`); só ela entra na conferência física da gaveta.
- **1 caixa aberto por vez** por tenant (índice único parcial); **1 operador** (a conta do tenant).
- **Migrations:** versionadas em `supabase/migrations/`; aplicar com `npx supabase db push` (autorizado).
- **Testes existentes verdes:** `npm test` e `npm run check`.
- **Shape do pedido** (mapRow): camelCase; passa a incluir `recebidoEm` (de `recebido_em`).

---

### Task 1: Migration — schema do caixa

**Files:**
- Create: `supabase/migrations/20260620120000_caixa.sql`

**Interfaces:**
- Produces: tabelas `caixas`, `caixa_movimentos`; coluna `pedidos.recebido_em`.

- [ ] **Step 1: Criar a migration**

```sql
-- Caixa / Fechamento do dia (Plano Completo). Recebimento por pedido +
-- conferência de dinheiro físico. Isolado por empresa_id; RLS no padrão do projeto.

create table if not exists public.caixas (
  id               bigint generated always as identity primary key,
  empresa_id       uuid not null references public.empresas(id) on delete cascade,
  aberto_em        timestamptz not null default now(),
  fechado_em       timestamptz,
  fundo_troco      numeric(10,2) not null default 0,
  status           text not null default 'aberto',   -- 'aberto' | 'fechado'
  contado_dinheiro numeric(10,2),
  diferenca        numeric(10,2),
  observacao       text
);
-- No máximo 1 caixa aberto por empresa:
create unique index if not exists caixas_um_aberto_por_empresa
  on public.caixas (empresa_id) where (status = 'aberto');
create index if not exists idx_caixas_empresa on public.caixas (empresa_id);

create table if not exists public.caixa_movimentos (
  id              bigint generated always as identity primary key,
  caixa_id        bigint not null references public.caixas(id) on delete cascade,
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  tipo            text not null,                 -- 'recebimento' | 'sangria' | 'suprimento'
  forma_pagamento text,
  valor           numeric(10,2) not null,
  pedido_id       bigint references public.pedidos(id) on delete set null,
  descricao       text,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_caixa_mov_caixa on public.caixa_movimentos (caixa_id);

alter table public.pedidos add column if not exists recebido_em timestamptz;

-- Hardening (igual às demais tabelas): RLS on + sem grants p/ anon/authenticated.
alter table public.caixas enable row level security;
alter table public.caixa_movimentos enable row level security;
revoke all on public.caixas from anon, authenticated;
revoke all on public.caixa_movimentos from anon, authenticated;
comment on table public.caixas is 'Caixa do dia (Plano Completo) — abertura/fechamento';
comment on table public.caixa_movimentos is 'Movimentos do caixa: recebimento/sangria/suprimento';
```

- [ ] **Step 2: Aplicar a migration**

Run: `npx supabase db push`
Expected: aplica `20260620120000_caixa.sql` sem erro.

- [ ] **Step 3: Conferir o schema**

Run (psql/SQL editor): `select to_regclass('public.caixas'), to_regclass('public.caixa_movimentos');`
Expected: ambos não-nulos; `pedidos` tem a coluna `recebido_em`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260620120000_caixa.sql
git commit -m "feat(caixa): migration — caixas, caixa_movimentos, pedidos.recebido_em"
```

---

### Task 2: Cálculos puros `src/caixa-calc.js` + testes (TDD)

**Files:**
- Create: `src/caixa-calc.js`
- Test: `test/caixa-calc.test.js`

**Interfaces:**
- Produces:
  - `resumoCaixa(caixa, movimentos)` → `{ recebidoPorForma, totalRecebido, recebidoDinheiro, suprimentos, sangrias, esperadoEspecie }`
  - `calcularDiferenca(esperadoEspecie, contadoDinheiro)` → number
  - `ehDinheiro(forma)` → boolean

- [ ] **Step 1: Escrever os testes (que falham)**

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { resumoCaixa, calcularDiferenca, ehDinheiro } = require("../src/caixa-calc");

const caixa = { fundo_troco: 100 };
const movs = [
  { tipo: "recebimento", forma_pagamento: "Dinheiro", valor: 50 },
  { tipo: "recebimento", forma_pagamento: "dinheiro", valor: 30 }, // case-insensitive
  { tipo: "recebimento", forma_pagamento: "Pix", valor: 20 },
  { tipo: "suprimento", valor: 10 },
  { tipo: "sangria", valor: 25 },
];

test("resumoCaixa: agrega por forma, dinheiro e esperado em espécie", () => {
  const r = resumoCaixa(caixa, movs);
  assert.equal(r.totalRecebido, 100);
  assert.equal(r.recebidoDinheiro, 80);        // 50 + 30
  assert.equal(r.recebidoPorForma["Pix"], 20);
  assert.equal(r.suprimentos, 10);
  assert.equal(r.sangrias, 25);
  // fundo 100 + dinheiro 80 + suprimento 10 − sangria 25 = 165
  assert.equal(r.esperadoEspecie, 165);
});

test("resumoCaixa: caixa sem movimentos = só o fundo", () => {
  const r = resumoCaixa({ fundo_troco: 70 }, []);
  assert.equal(r.totalRecebido, 0);
  assert.equal(r.recebidoDinheiro, 0);
  assert.equal(r.esperadoEspecie, 70);
});

test("calcularDiferenca: sobra/falta/zero", () => {
  assert.equal(calcularDiferenca(165, 170), 5);   // sobra
  assert.equal(calcularDiferenca(165, 160), -5);  // falta
  assert.equal(calcularDiferenca(165, 165), 0);
});

test("ehDinheiro: case-insensitive, ignora espaços", () => {
  assert.equal(ehDinheiro(" Dinheiro "), true);
  assert.equal(ehDinheiro("DINHEIRO"), true);
  assert.equal(ehDinheiro("Pix"), false);
  assert.equal(ehDinheiro(null), false);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/caixa-calc'`.

- [ ] **Step 3: Implementar `src/caixa-calc.js`**

```js
// PURO: cálculos do caixa (sem banco). Testável isolado.
// "Dinheiro" é a única forma que entra na conferência física da gaveta.
function ehDinheiro(forma) {
  return String(forma || "").trim().toLowerCase() === "dinheiro";
}

function resumoCaixa(caixa, movimentos) {
  const recebidoPorForma = {};
  let totalRecebido = 0, recebidoDinheiro = 0, suprimentos = 0, sangrias = 0;
  for (const m of movimentos || []) {
    const v = Number(m.valor) || 0;
    if (m.tipo === "recebimento") {
      const forma = m.forma_pagamento || "Outros";
      recebidoPorForma[forma] = (recebidoPorForma[forma] || 0) + v;
      totalRecebido += v;
      if (ehDinheiro(forma)) recebidoDinheiro += v;
    } else if (m.tipo === "suprimento") {
      suprimentos += v;
    } else if (m.tipo === "sangria") {
      sangrias += v;
    }
  }
  const fundo = Number(caixa && caixa.fundo_troco) || 0;
  const esperadoEspecie = fundo + recebidoDinheiro + suprimentos - sangrias;
  return { recebidoPorForma, totalRecebido, recebidoDinheiro, suprimentos, sangrias, esperadoEspecie };
}

function calcularDiferenca(esperadoEspecie, contadoDinheiro) {
  return (Number(contadoDinheiro) || 0) - (Number(esperadoEspecie) || 0);
}

module.exports = { resumoCaixa, calcularDiferenca, ehDinheiro };
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `npm test` → todos passam. Depois `npm run check` → OK.

- [ ] **Step 5: Commit**

```bash
git add src/caixa-calc.js test/caixa-calc.test.js
git commit -m "feat(caixa): cálculos puros (resumo/diferença) + testes"
```

---

### Task 3: Módulo de banco `src/caixa.js` + `recebido_em` no pedido

**Files:**
- Create: `src/caixa.js`
- Modify: `src/pedidos.js` (adicionar `recebidoEm` ao `mapRow`)

**Interfaces:**
- Consumes: `src/db.js` (`db.query`), `src/caixa-calc.js`.
- Produces (todas async, recebem `dir` = tenantDir):
  - `caixaAberto(dir)` → row do caixa aberto ou `null`
  - `abrirCaixa(dir, { fundoTroco })` → caixa criado; lança `Error("Já existe um caixa aberto.")` se houver
  - `receberPedido(dir, pedidoId, { forma, valor })` → `{ ok: true }`; lança se sem caixa aberto / pedido já recebido / pedido inexistente
  - `estornarRecebimento(dir, pedidoId)` → `{ ok: true }`
  - `registrarMovimento(dir, { tipo, valor, descricao })` → movimento criado (`tipo` em `sangria|suprimento`)
  - `resumo(dir)` → `{ caixa, resumo, aReceber: [...pedidos], recebidos: [...pedidos] }` ou `{ caixa: null }`
  - `fecharCaixa(dir, { contadoDinheiro, observacao })` → `{ diferenca, esperadoEspecie }`
  - `listarCaixas(dir)` → array de caixas fechados (resumo)
  - `detalheCaixa(dir, id)` → `{ caixa, movimentos }`

- [ ] **Step 1: Adicionar `recebidoEm` ao `mapRow` de `pedidos.js`**

Em `src/pedidos.js`, no `mapRow` (após `avisadoEm`, ~linha 42):

```js
    recebidoEm: r.recebido_em ? new Date(r.recebido_em).toISOString() : null,
```

- [ ] **Step 2: Implementar `src/caixa.js`**

```js
// ============================================================
// CAIXA — abertura/fechamento + recebimento por pedido + sangria/
// suprimento. Isolado por empresa_id (padrão do pedidos.js).
// Cálculos puros ficam em caixa-calc.js.
// ============================================================
const path = require("path");
const db = require("./db");
const calc = require("./caixa-calc");

const slugDe = (dir) => path.basename(dir);
const idCache = {};

async function empresaId(dir) {
  const slug = slugDe(dir);
  if (idCache[slug]) return idCache[slug];
  const r = await db.query("SELECT id FROM empresas WHERE slug = $1", [slug]);
  if (!r.rows[0]) throw new Error("Tenant não encontrado: " + slug);
  idCache[slug] = r.rows[0].id;
  return idCache[slug];
}

async function caixaAberto(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT * FROM caixas WHERE empresa_id = $1 AND status = 'aberto' ORDER BY id DESC LIMIT 1",
    [empId]
  );
  return r.rows[0] || null;
}

async function abrirCaixa(dir, { fundoTroco }) {
  const empId = await empresaId(dir);
  const aberto = await caixaAberto(dir);
  if (aberto) throw new Error("Já existe um caixa aberto.");
  const r = await db.query(
    "INSERT INTO caixas (empresa_id, fundo_troco) VALUES ($1, $2) RETURNING *",
    [empId, Number(fundoTroco) || 0]
  );
  return r.rows[0];
}

async function receberPedido(dir, pedidoId, { forma, valor }) {
  const empId = await empresaId(dir);
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Abra o caixa antes de receber.");
  const ped = await db.query(
    "SELECT id, recebido_em FROM pedidos WHERE empresa_id = $1 AND id = $2",
    [empId, pedidoId]
  );
  if (!ped.rows[0]) throw new Error("Pedido não encontrado.");
  if (ped.rows[0].recebido_em) throw new Error("Pedido já recebido.");
  await db.query(
    `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, forma_pagamento, valor, pedido_id)
     VALUES ($1, $2, 'recebimento', $3, $4, $5)`,
    [caixa.id, empId, forma || "Outros", Number(valor) || 0, pedidoId]
  );
  await db.query(
    "UPDATE pedidos SET recebido_em = now() WHERE empresa_id = $1 AND id = $2",
    [empId, pedidoId]
  );
  return { ok: true };
}

async function estornarRecebimento(dir, pedidoId) {
  const empId = await empresaId(dir);
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Sem caixa aberto para estornar.");
  await db.query(
    "DELETE FROM caixa_movimentos WHERE caixa_id = $1 AND pedido_id = $2 AND tipo = 'recebimento'",
    [caixa.id, pedidoId]
  );
  await db.query(
    "UPDATE pedidos SET recebido_em = NULL WHERE empresa_id = $1 AND id = $2",
    [empId, pedidoId]
  );
  return { ok: true };
}

async function registrarMovimento(dir, { tipo, valor, descricao }) {
  const empId = await empresaId(dir);
  if (tipo !== "sangria" && tipo !== "suprimento") throw new Error("Tipo inválido.");
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Abra o caixa primeiro.");
  const r = await db.query(
    `INSERT INTO caixa_movimentos (caixa_id, empresa_id, tipo, valor, descricao)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [caixa.id, empId, tipo, Number(valor) || 0, descricao || ""]
  );
  return r.rows[0];
}

async function _movimentos(caixaId) {
  const r = await db.query(
    "SELECT * FROM caixa_movimentos WHERE caixa_id = $1 ORDER BY id ASC",
    [caixaId]
  );
  return r.rows;
}

// Pedidos do tenant com/sem recebimento (para as listas da aba).
async function _pedidosCaixa(empId) {
  const r = await db.query(
    `SELECT id, numero, cliente, pagamento, total, recebido_em
       FROM pedidos WHERE empresa_id = $1 ORDER BY id DESC LIMIT 200`,
    [empId]
  );
  return r.rows.map((p) => ({
    id: p.id, numero: p.numero, cliente: p.cliente, pagamento: p.pagamento,
    total: p.total == null ? 0 : Number(p.total),
    recebidoEm: p.recebido_em ? new Date(p.recebido_em).toISOString() : null,
  }));
}

async function resumo(dir) {
  const empId = await empresaId(dir);
  const caixa = await caixaAberto(dir);
  if (!caixa) return { caixa: null };
  const movimentos = await _movimentos(caixa.id);
  const peds = await _pedidosCaixa(empId);
  return {
    caixa: {
      id: caixa.id,
      abertoEm: new Date(caixa.aberto_em).toISOString(),
      fundoTroco: Number(caixa.fundo_troco) || 0,
    },
    resumo: calc.resumoCaixa(caixa, movimentos),
    aReceber: peds.filter((p) => !p.recebidoEm),
    recebidos: peds.filter((p) => p.recebidoEm),
  };
}

async function fecharCaixa(dir, { contadoDinheiro, observacao }) {
  const caixa = await caixaAberto(dir);
  if (!caixa) throw new Error("Não há caixa aberto.");
  const movimentos = await _movimentos(caixa.id);
  const { esperadoEspecie } = calc.resumoCaixa(caixa, movimentos);
  const diferenca = calc.calcularDiferenca(esperadoEspecie, contadoDinheiro);
  await db.query(
    `UPDATE caixas SET status='fechado', fechado_em=now(),
            contado_dinheiro=$2, diferenca=$3, observacao=$4
       WHERE id=$1`,
    [caixa.id, Number(contadoDinheiro) || 0, diferenca, observacao || ""]
  );
  return { diferenca, esperadoEspecie };
}

async function listarCaixas(dir) {
  const empId = await empresaId(dir);
  const r = await db.query(
    `SELECT id, aberto_em, fechado_em, fundo_troco, contado_dinheiro, diferenca
       FROM caixas WHERE empresa_id = $1 AND status='fechado'
       ORDER BY id DESC LIMIT 50`,
    [empId]
  );
  return r.rows.map((c) => ({
    id: c.id,
    abertoEm: new Date(c.aberto_em).toISOString(),
    fechadoEm: c.fechado_em ? new Date(c.fechado_em).toISOString() : null,
    fundoTroco: Number(c.fundo_troco) || 0,
    contadoDinheiro: c.contado_dinheiro == null ? null : Number(c.contado_dinheiro),
    diferenca: c.diferenca == null ? null : Number(c.diferenca),
  }));
}

async function detalheCaixa(dir, id) {
  const empId = await empresaId(dir);
  const c = await db.query("SELECT * FROM caixas WHERE empresa_id = $1 AND id = $2", [empId, id]);
  if (!c.rows[0]) return null;
  const movimentos = await _movimentos(id);
  return {
    caixa: { ...c.rows[0], resumo: calc.resumoCaixa(c.rows[0], movimentos) },
    movimentos,
  };
}

function esquecer(slug) { delete idCache[slug]; }

module.exports = {
  caixaAberto, abrirCaixa, receberPedido, estornarRecebimento, registrarMovimento,
  resumo, fecharCaixa, listarCaixas, detalheCaixa, esquecer,
};
```

> **Nota de consistência:** `receberPedido` faz 2 queries (insert + update) sem transação explícita,
> seguindo o padrão simples do `pedidos.js` e a premissa de **instância única**. Risco residual
> (insert ok, update falha) é mínimo e o erro sobe pra rota (500). Aceito no v1.

- [ ] **Step 3: Checar sintaxe**

Run: `npm run check`
Expected: OK (inclui `src/caixa.js` e `src/caixa-calc.js`).

- [ ] **Step 4: Commit**

```bash
git add src/caixa.js src/pedidos.js
git commit -m "feat(caixa): módulo de banco (abrir/receber/sangria/fechar) + recebidoEm no pedido"
```

---

### Task 4: Gate de plano (`temCaixa`) + rotas no servidor

**Files:**
- Modify: `src/empresas.js` (adicionar `temCaixa` + export)
- Modify: `src/servidor.js` (importar `caixa` + 8 rotas com gate)

**Interfaces:**
- Consumes: `src/caixa.js`, `empresas.buscarPorSlug`, `empresas.temCaixa`.
- Produces: rotas REST do caixa (todas `exigeAuth` + 403 sem Completo).

- [ ] **Step 1: Adicionar `temCaixa` em `src/empresas.js`**

Logo após `temFreteRaio` (~linha 332):

```js
// Porteiro do Caixa (feature do Plano Completo). Mesma regra do frete por raio.
function temCaixa(emp) {
  return acessoLiberado(emp) && planoDe(emp) === "completo";
}
```

E no `module.exports` (linha 419), adicionar `temCaixa` junto de `temFreteRaio`:

```js
  atualizarAssinatura, podeLogar, acessoLiberado, planoDe, temFreteRaio, temCaixa,
```

- [ ] **Step 2: Importar o módulo `caixa` no `servidor.js`**

Junto dos outros `require` do topo do `servidor.js` (onde estão `pedidos`, `empresas`, etc.):

```js
const caixa = require("./caixa");
```

- [ ] **Step 3: Adicionar as rotas do caixa (com gate)**

Num bloco próprio do `servidor.js` (perto das rotas de `/api/pedidos`). O helper de gate é inline:

```js
// ---- Caixa (Plano Completo) ----
async function exigeCaixa(req, res) {
  const emp = await empresas.buscarPorSlug(req.slug);
  if (!empresas.temCaixa(emp)) { res.status(403).json({ erro: "Recurso do Plano Completo." }); return false; }
  return true;
}

app.get("/api/caixa", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.resumo(req.tenantDir)); }
  catch (e) { res.status(500).json({ erro: "Falha ao ler o caixa." }); }
});

app.post("/api/caixa/abrir", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.abrirCaixa(req.tenantDir, { fundoTroco: req.body.fundoTroco })); }
  catch (e) { res.status(400).json({ erro: e.message }); }
});

app.post("/api/caixa/receber/:pedidoId", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.receberPedido(req.tenantDir, Number(req.params.pedidoId), { forma: req.body.forma, valor: req.body.valor })); }
  catch (e) { res.status(400).json({ erro: e.message }); }
});

app.post("/api/caixa/estornar/:pedidoId", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.estornarRecebimento(req.tenantDir, Number(req.params.pedidoId))); }
  catch (e) { res.status(400).json({ erro: e.message }); }
});

app.post("/api/caixa/movimento", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.registrarMovimento(req.tenantDir, { tipo: req.body.tipo, valor: req.body.valor, descricao: req.body.descricao })); }
  catch (e) { res.status(400).json({ erro: e.message }); }
});

app.post("/api/caixa/fechar", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.fecharCaixa(req.tenantDir, { contadoDinheiro: req.body.contadoDinheiro, observacao: req.body.observacao })); }
  catch (e) { res.status(400).json({ erro: e.message }); }
});

app.get("/api/caixa/historico", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.listarCaixas(req.tenantDir)); }
  catch (e) { res.status(500).json({ erro: "Falha ao listar caixas." }); }
});

app.get("/api/caixa/:id", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try {
    const d = await caixa.detalheCaixa(req.tenantDir, Number(req.params.id));
    if (!d) return res.status(404).json({ erro: "Caixa não encontrado." });
    res.json(d);
  } catch (e) { res.status(500).json({ erro: "Falha ao ler o caixa." }); }
});
```

> **Atenção à ordem das rotas:** `GET /api/caixa/historico` precisa ser declarada **antes** de
> `GET /api/caixa/:id` (senão "historico" cai no `:id`). Manter a ordem acima.

- [ ] **Step 4: Checar sintaxe + carregar o servidor**

Run: `npm run check` → OK. Depois `node -e "require('./src/servidor')"` não deve lançar (carrega o módulo).

- [ ] **Step 5: Commit**

```bash
git add src/empresas.js src/servidor.js
git commit -m "feat(caixa): gate temCaixa (403) + rotas REST do caixa"
```

---

### Task 5: UI — aba Caixa (estrutura, gate e abrir caixa)

**Files:**
- Modify: `public/admin.html` (item na sidebar + `<section class="aba" id="aba-caixa">`)
- Modify: `public/app.js` (loader `carregarCaixa` + gate + abrir)
- Modify: `public/style.css` (estilos da aba)

**Interfaces:**
- Consumes: `api()`, `planoAtual`, `Dinheiro`, `toast`, `escapar` (já existem em `app.js`).
- Produces: `carregarCaixa()` (chamada na troca de aba), `renderCaixa(data)`.

- [ ] **Step 1: Item na sidebar (`admin.html`)**

Após o botão `data-aba="pedidos"` (linha ~33), adicionar o item Caixa (ícone SVG de carteira/caixa):

```html
        <button data-aba="caixa">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/></svg>
          <span>Caixa</span>
        </button>
```

- [ ] **Step 2: Seção da aba (`admin.html`)**

Após o fechamento da `<section class="aba" id="aba-pedidos">` (antes da próxima aba), adicionar:

```html
    <!-- CAIXA (Plano Completo) -->
    <section class="aba" id="aba-caixa">
      <div class="caixa-lock" id="caixaLock" hidden>
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <h3>Caixa é do Plano Completo</h3>
        <p class="sub">Abra e feche o caixa do dia, registre recebimentos e confira o dinheiro. Disponível no Plano Completo.</p>
        <button type="button" class="secundario" id="btnVerPlanosCaixa">Ver planos</button>
      </div>
      <div id="caixaConteudo" hidden></div>
    </section>
```

- [ ] **Step 3: Loader + gate + render no `app.js`**

No handler de troca de aba (linha ~190, junto dos `if (btn.dataset.aba === ...)`):

```js
    if (btn.dataset.aba === "caixa") carregarCaixa();
```

E adicionar as funções (perto das outras de render):

```js
// ---- Caixa (Plano Completo) ----
async function carregarCaixa() {
  const completo = planoAtual === "completo";
  $("caixaLock").hidden = completo;
  $("caixaConteudo").hidden = !completo;
  if (!completo) return;
  const r = await api("GET", "/api/caixa");
  if (!r || !r.ok) { $("caixaConteudo").innerHTML = "<p class='sub'>Falha ao carregar o caixa.</p>"; return; }
  renderCaixa(await r.json());
}

function renderCaixa(data) {
  const cont = $("caixaConteudo");
  if (!data.caixa) {
    cont.innerHTML = `
      <div class="caixa-card">
        <h3>Abrir caixa</h3>
        <p class="sub">Informe o fundo de troco (dinheiro inicial na gaveta).</p>
        <div class="campo"><label for="caixaFundo">Fundo de troco</label>
          <input id="caixaFundo" inputmode="numeric" value="0,00"></div>
        <button id="btnAbrirCaixa">Abrir caixa</button>
      </div>`;
    if (window.Dinheiro) Dinheiro.mascarar("caixaFundo");
    $("btnAbrirCaixa").addEventListener("click", abrirCaixa);
    return;
  }
  // caixa aberto → render do painel (Task 6)
  renderCaixaAberto(data);
}

async function abrirCaixa() {
  const fundo = window.Dinheiro ? Dinheiro.valor("caixaFundo") : 0;
  const r = await api("POST", "/api/caixa/abrir", { fundoTroco: fundo });
  if (r && r.ok) { toast("✓ Caixa aberto!"); carregarCaixa(); }
  else { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Falha ao abrir caixa."); }
}

if ($("btnVerPlanosCaixa")) {
  $("btnVerPlanosCaixa").addEventListener("click", () => {
    const b = document.querySelector('.sidebar [data-aba="assinatura"]'); if (b) b.click();
  });
}
```

> `renderCaixaAberto` é stub nesta task (pode só mostrar "Caixa aberto"); a Task 6 implementa o painel
> completo. Para esta task fechar verde, defina um `renderCaixaAberto` mínimo que mostre o resumo cru.

- [ ] **Step 4: CSS mínimo (`public/style.css`)**

```css
/* ---- Caixa ---- */
.caixa-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; max-width: 420px; }
.caixa-lock { text-align: center; padding: 40px 16px; }
```

- [ ] **Step 5: Sintaxe + commit**

Run: `node --check public/app.js` → OK.

```bash
git add public/admin.html public/app.js public/style.css
git commit -m "feat(caixa): aba Caixa com gate de plano + abrir caixa"
```

---

### Task 6: UI — painel do caixa aberto (receber, sangria/suprimento, fechar, histórico)

**Files:**
- Modify: `public/app.js` (`renderCaixaAberto` completo + ações), `public/admin.html` (botão "Receber" no modal de pedido), `public/style.css`.

**Interfaces:**
- Consumes: `/api/caixa/*` (Task 4), `montarAcoes` do modal de pedido (linha ~2403).

- [ ] **Step 1: `renderCaixaAberto(data)` no `app.js`** (substitui o stub da Task 5)

```js
function fmtBRn(n) { return (Number(n) || 0).toFixed(2).replace(".", ","); }

function renderCaixaAberto(data) {
  const cont = $("caixaConteudo");
  const r = data.resumo;
  const formas = Object.keys(r.recebidoPorForma);
  const linhasForma = formas.length
    ? formas.map((f) => `<div class="caixa-linha"><span>${escapar(f)}</span><span>R$ ${fmtBRn(r.recebidoPorForma[f])}</span></div>`).join("")
    : "<p class='sub'>Nenhum recebimento ainda.</p>";
  const aReceber = data.aReceber.map((p) =>
    `<div class="caixa-ped"><span>#${p.numero} · ${escapar(p.cliente || "")} · ${escapar(p.pagamento || "")}</span>
      <button class="secundario mini caixa-receber" data-id="${p.id}" data-forma="${escapar(p.pagamento || "")}" data-valor="${p.total}">Receber R$ ${fmtBRn(p.total)}</button></div>`).join("") || "<p class='sub'>Tudo recebido.</p>";
  const recebidos = data.recebidos.map((p) =>
    `<div class="caixa-ped"><span>#${p.numero} · ${escapar(p.cliente || "")}</span>
      <button class="secundario mini caixa-estornar" data-id="${p.id}">Estornar</button></div>`).join("") || "";

  cont.innerHTML = `
    <div class="caixa-topo">
      <div><h3>Caixa aberto</h3><span class="sub">Fundo de troco: R$ ${fmtBRn(data.caixa.fundoTroco)}</span></div>
      <div class="caixa-acoes">
        <button class="secundario" id="btnSangria">Sangria</button>
        <button class="secundario" id="btnSuprimento">Suprimento</button>
        <button id="btnFecharCaixa">Fechar caixa</button>
      </div>
    </div>
    <div class="caixa-resumo">
      ${linhasForma}
      <div class="caixa-linha"><span>Suprimentos</span><span>R$ ${fmtBRn(r.suprimentos)}</span></div>
      <div class="caixa-linha"><span>Sangrias</span><span>− R$ ${fmtBRn(r.sangrias)}</span></div>
      <div class="caixa-linha caixa-total"><span>Esperado em dinheiro</span><span>R$ ${fmtBRn(r.esperadoEspecie)}</span></div>
    </div>
    <h4>A receber</h4><div class="caixa-lista">${aReceber}</div>
    <h4>Recebidos</h4><div class="caixa-lista">${recebidos}</div>`;

  cont.querySelectorAll(".caixa-receber").forEach((b) =>
    b.addEventListener("click", () => receberPedidoCaixa(b.dataset.id, b.dataset.forma, Number(b.dataset.valor))));
  cont.querySelectorAll(".caixa-estornar").forEach((b) =>
    b.addEventListener("click", () => estornarCaixa(b.dataset.id)));
  $("btnSangria").addEventListener("click", () => movimentoCaixa("sangria"));
  $("btnSuprimento").addEventListener("click", () => movimentoCaixa("suprimento"));
  $("btnFecharCaixa").addEventListener("click", () => fecharCaixaUI(r.esperadoEspecie));
}

async function receberPedidoCaixa(id, forma, valor) {
  const r = await api("POST", "/api/caixa/receber/" + id, { forma, valor });
  if (r && r.ok) { toast("✓ Recebido!"); carregarCaixa(); }
  else { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Falha ao receber."); }
}

async function estornarCaixa(id) {
  const r = await api("POST", "/api/caixa/estornar/" + id, {});
  if (r && r.ok) { toast("Estornado."); carregarCaixa(); }
}

async function movimentoCaixa(tipo) {
  const titulo = tipo === "sangria" ? "Sangria (retirar dinheiro)" : "Suprimento (reforçar dinheiro)";
  const valorStr = window.prompt(titulo + "\nValor (ex.: 50,00):", "");
  if (valorStr == null) return;
  const valor = parseFloat(valorStr.replace(".", "").replace(",", ".")) || 0;
  if (valor <= 0) { toast("Valor inválido."); return; }
  const descricao = window.prompt("Motivo (opcional):", "") || "";
  const r = await api("POST", "/api/caixa/movimento", { tipo, valor, descricao });
  if (r && r.ok) { toast("✓ Registrado."); carregarCaixa(); }
  else { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Falha."); }
}

async function fecharCaixaUI(esperado) {
  const contadoStr = window.prompt(
    "Fechar caixa\nEsperado em dinheiro: R$ " + fmtBRn(esperado) + "\n\nConte a gaveta e informe o valor (ex.: 165,00):", "");
  if (contadoStr == null) return;
  const contado = parseFloat(contadoStr.replace(".", "").replace(",", ".")) || 0;
  const r = await api("POST", "/api/caixa/fechar", { contadoDinheiro: contado, observacao: "" });
  if (r && r.ok) {
    const d = await r.json();
    const dif = d.diferenca;
    toast(dif === 0 ? "✓ Caixa fechado, bateu certinho!" : (dif > 0 ? "Caixa fechado. Sobra de R$ " + fmtBRn(dif) : "Caixa fechado. Falta de R$ " + fmtBRn(-dif)));
    carregarCaixa();
  } else { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Falha ao fechar."); }
}
```

> **Nota:** `window.prompt` é usado por simplicidade no v1 para sangria/suprimento/fechamento. Se quiser
> modais no padrão do projeto (acessíveis), isso pode evoluir depois — mas `prompt` mantém a CSP e
> entrega a função. (Decisão consciente de YAGNI no v1; trocar por modal é melhoria futura.)

- [ ] **Step 2: Botão "Receber pagamento" no modal de pedido (`app.js`)**

Em `montarAcoes(p)` (linha ~2403), antes do `return`, acrescentar o botão de receber quando Completo e ainda não recebido. Substituir o corpo final da função para incluir:

```js
  // Recebimento no caixa (Plano Completo): só se ainda não recebido.
  if (planoAtual === "completo" && !p.recebidoEm) {
    const extra = document.createElement("button");
    extra.className = "secundario";
    extra.textContent = "Receber pagamento (R$ " + fmtBRn(p.total) + ")";
    extra.addEventListener("click", async () => {
      const r = await api("POST", "/api/caixa/receber/" + p.id, { forma: p.pagamento || "Outros", valor: p.total });
      if (r && r.ok) { p.recebidoEm = new Date().toISOString(); toast("✓ Recebido no caixa!"); montarAcoes(p); }
      else { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Abra o caixa primeiro."); }
    });
    cont.appendChild(extra);
  }
```

> `cont` é `$("pedido-acoes")` já existente na função. Mantém o botão "Avisar" e adiciona "Receber".

- [ ] **Step 3: Histórico (append no `renderCaixaAberto` e no "sem caixa")** — adicionar um botão "Ver histórico" que busca `/api/caixa/historico` e lista. Implementação:

```js
async function verHistoricoCaixa() {
  const r = await api("GET", "/api/caixa/historico");
  if (!r || !r.ok) return;
  const lista = await r.json();
  const html = lista.length
    ? lista.map((c) => `<div class="caixa-linha"><span>${new Date(c.fechadoEm).toLocaleString("pt-BR")}</span><span>${c.diferenca === 0 ? "ok" : (c.diferenca > 0 ? "sobra R$ " + fmtBRn(c.diferenca) : "falta R$ " + fmtBRn(-c.diferenca))}</span></div>`).join("")
    : "<p class='sub'>Nenhum caixa fechado ainda.</p>";
  toast("Histórico carregado.");
  const box = $("caixaConteudo");
  const sec = document.createElement("div");
  sec.className = "caixa-resumo";
  sec.innerHTML = "<h4>Histórico</h4>" + html;
  box.appendChild(sec);
}
```

Ligar um botão "Histórico" no `renderCaixaAberto` (adicionar em `.caixa-acoes`: `<button class="secundario" id="btnHistCaixa">Histórico</button>` e `$("btnHistCaixa").addEventListener("click", verHistoricoCaixa);`).

- [ ] **Step 4: CSS das listas/linhas (`public/style.css`)**

```css
.caixa-topo { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
.caixa-acoes { display:flex; gap:8px; flex-wrap:wrap; }
.caixa-resumo { background: var(--bg-elevated); border:1px solid var(--border); border-radius: var(--radius); padding:14px; margin-bottom:16px; }
.caixa-linha { display:flex; justify-content:space-between; padding:4px 0; }
.caixa-linha.caixa-total { border-top:1px solid var(--border); margin-top:6px; padding-top:8px; font-weight:700; }
.caixa-lista { display:flex; flex-direction:column; gap:6px; margin-bottom:16px; }
.caixa-ped { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 0; }
```

- [ ] **Step 5: Sintaxe + commit**

Run: `node --check public/app.js` → OK; `npm test` (suíte intacta) → verde.

```bash
git add public/app.js public/admin.html public/style.css
git commit -m "feat(caixa): painel do caixa (receber/sangria/suprimento/fechar/histórico) + botão no pedido"
```

---

### Task 7: Validação E2E (Playwright) — conta Completo

**Files:** (sem produção; roteiro de validação)

- [ ] **Step 1: Subir o app local** (lembrando que o bot vai brigar com produção pela sessão WhatsApp — encerrar logo após) e logar com conta **Plano Completo**.

- [ ] **Step 2: Fluxo golden path**
- Aba Caixa → "Abrir caixa" com fundo 100,00.
- Receber 2 pedidos (um "Dinheiro", um "Pix") pela aba e/ou pelo modal do pedido.
- Suprimento 10,00; Sangria 25,00.
- Conferir o "Esperado em dinheiro" = 100 + (dinheiro recebido) + 10 − 25.
- Fechar informando o contado → conferir a diferença (sobra/falta) na mensagem.
- Conferir Histórico lista o caixa fechado.

- [ ] **Step 3: Gate** — com conta **Essencial** (ou simulando `planoAtual`), a aba mostra o cadeado; chamada direta a `GET /api/caixa` → **403**.

- [ ] **Step 4: Registrar resultado** no PROGRESSO ("validado E2E" ou "build/sintaxe OK, UI não validada visualmente" se faltar conta Completo, conforme a regra do projeto).

---

### Task 8: Documentação + marco

**Files:** `PROGRESSO.md`, `ROADMAP.md`, `CLAUDE.md`, `docs/planos-e-frete.md`, `docs/modelo-dados.md`, `CHANGELOG.md`

- [ ] **Step 1: `ROADMAP.md`** — Fase 1 "Caixa / fechamento" → marcar entregue (resumo + ref CHANGELOG).
- [ ] **Step 2: `docs/planos-e-frete.md`** — Caixa como **3º benefício do Completo** (gate `temCaixa`, recebimento por pedido, fechamento com conferência).
- [ ] **Step 3: `CLAUDE.md`** — adicionar `src/caixa.js` e `src/caixa-calc.js` na árvore; citar tabelas `caixas`/`caixa_movimentos` + `pedidos.recebido_em` + gate `temCaixa`.
- [ ] **Step 4: `docs/modelo-dados.md`** — schema das 2 tabelas + a coluna nova.
- [ ] **Step 5: `CHANGELOG.md`** — marco observável (Caixa do dia no Plano Completo: abrir/receber/sangria/fechar/conferência).
- [ ] **Step 6: `PROGRESSO.md`** — mover p/ ✅ Concluído com a data e o que foi validado.
- [ ] **Step 7: Commit**

```bash
git add PROGRESSO.md ROADMAP.md CLAUDE.md docs/planos-e-frete.md docs/modelo-dados.md CHANGELOG.md
git commit -m "docs(caixa): caixa do dia como benefício do Completo + marco"
```

---

## Self-Review

**Spec coverage:**
- Migration (caixas/caixa_movimentos/recebido_em) → Task 1. ✓
- Recebimento por pedido (explícito, estornável) → Task 3 (`receberPedido`/`estornarRecebimento`) + UI Task 6. ✓
- Abrir + fundo de troco → Task 3/5. ✓
- Sangria/suprimento → Task 3/6. ✓
- Fechamento c/ esperado em espécie + diferença → Task 2 (puro) + 3 (`fecharCaixa`) + 6 (UI). ✓
- Histórico → Task 3 (`listarCaixas`/`detalheCaixa`) + 6. ✓
- Gate Completo front+back → Task 4 (`temCaixa` + 403) + Task 5 (front gate/cadeado). ✓
- "Dinheiro" case-insensitive → Task 2 (`ehDinheiro`). ✓
- 1 caixa aberto por vez → Task 1 (índice único) + Task 3 (checagem). ✓
- Testes (node:test + Playwright) → Task 2 + Task 7. ✓
- Docs → Task 8. ✓

**Placeholder scan:** sem TBD/TODO de lógica. Notas explícitas (transação simples, `prompt` no v1, SVG de cadeado) são decisões conscientes documentadas, não lacunas. O `renderCaixaAberto` é stub na Task 5 e **implementado por completo na Task 6** (sequência explícita).

**Type consistency:** `resumoCaixa`/`calcularDiferenca`/`ehDinheiro` (Task 2) consumidos igual em `caixa.js` (Task 3). `caixa.resumo()` retorna `{ caixa, resumo, aReceber, recebidos }`, consumido em `renderCaixa`/`renderCaixaAberto` (Tasks 5–6). Rotas (Task 4) batem com as chamadas `api()` do front (Tasks 5–6): `/api/caixa`, `/abrir`, `/receber/:id`, `/estornar/:id`, `/movimento`, `/fechar`, `/historico`. `pedidos.mapRow` ganha `recebidoEm` (Task 3) usado no botão do modal (Task 6).
