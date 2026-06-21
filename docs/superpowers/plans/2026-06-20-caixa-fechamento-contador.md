# Fechamento de Caixa — contador de cédulas + relatório — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o fechamento de caixa (modal de 1 campo) por uma tela de conferência com contador de cédulas + lançamentos de cartão/Pix, e imprimir um relatório de fechamento agregado (térmica 80mm).

**Architecture:** Cálculos puros novos em `src/caixa-calc.js` (backend/Node, testados). Montagem do relatório num módulo puro dual-mode `public/relatorio-caixa.js` (browser+Node, testado). A tela de fechamento vive em `public/app.js` (substitui `fecharCaixaUI`), reaproveitando `dinheiro.js` (R$) e o pipeline de impressão de `public/impressao.js`. Backend `src/caixa.js` recalcula e persiste totais + snapshot jsonb.

**Tech Stack:** Node CommonJS, `node:test`, `pg`/Supabase (Postgres), front HTML/CSS/JS puro (sem framework), impressão via `window.print()` + CSS `@page 80mm`.

## Global Constraints

- Idioma pt-BR em UI, comentários e textos.
- Gate **Plano Completo** (`temCaixa`) já aplicado nas rotas/aba do Caixa — não afrouxar.
- Campos de **R$** sempre via `dinheiro.js` (centavos-primeiro); **quantidade** de cédula é inteiro simples.
- CSP estrita: nada de `<script>`/handler inline; só `addEventListener` em `.js` externo.
- Denominações BRL fixas (centavos): `20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5`.
- Formas eletrônicas vêm de `config.pagamentos` menos a forma de dinheiro (detecção via `ehDinheiro`).
- Fechar com diferença ≠ 0 **não bloqueia**.
- Commits pequenos, mensagens pt-BR `tipo(escopo): descrição`. Não usar `--no-verify`.

---

### Task 1: Cálculos puros do fechamento (`caixa-calc.js`)

**Files:**
- Modify: `src/caixa-calc.js`
- Test: `test/caixa-calc.test.js`

**Interfaces:**
- Consumes: nada novo (usa o `resumo` que `resumoCaixa` já devolve).
- Produces:
  - `totalContagem(contagem) -> number` — `contagem` = `{ "20000": qtd, ... }` (chave = centavos), retorna reais.
  - `esperadoEletronico(resumo) -> number` = `resumo.totalRecebido - resumo.recebidoDinheiro`.
  - `totalEmCaixa(caixa, resumo) -> number` = `fundo_troco + suprimentos + totalRecebido - sangrias`.

- [ ] **Step 1: Write the failing tests**

Adicionar ao fim de `test/caixa-calc.test.js` (antes não existem esses casos):

```js
test("totalContagem: soma cédulas×qtd (centavos→reais), sem erro de float", () => {
  const c = { "10000": 1, "2000": 2, "100": 3, "5": 3 }; // 100 + 40 + 3 + 0,15
  assert.strictEqual(calc.totalContagem(c), 143.15);
});
test("totalContagem: vazio/sem qtd = 0", () => {
  assert.strictEqual(calc.totalContagem({}), 0);
  assert.strictEqual(calc.totalContagem({ "10000": 0 }), 0);
});
test("esperadoEletronico: total recebido menos o que entrou em dinheiro", () => {
  assert.strictEqual(calc.esperadoEletronico({ totalRecebido: 180, recebidoDinheiro: 100 }), 80);
});
test("totalEmCaixa: fundo + suprimento + vendas - sangria", () => {
  const caixa = { fundo_troco: 50 };
  const resumo = { totalRecebido: 180, suprimentos: 20, sangrias: 10 };
  assert.strictEqual(calc.totalEmCaixa(caixa, resumo), 240);
});
```

Verificar no topo do arquivo que já há `const calc = require("../src/caixa-calc");` (ou nome equivalente) e `const assert = require("node:assert")` / `test` de `node:test`. Se o import do módulo usar outro nome de variável, adaptar as chamadas acima a esse nome.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `calc.totalContagem is not a function` (e as demais).

- [ ] **Step 3: Implement the pure functions**

Em `src/caixa-calc.js`, antes do `module.exports`, adicionar:

```js
// Total contado em cédulas/moedas. `contagem`: { "<centavos>": quantidade }.
// Soma em centavos inteiros p/ evitar imprecisão de ponto flutuante.
function totalContagem(contagem) {
  let centavos = 0;
  for (const chave in contagem || {}) {
    centavos += (Number(chave) || 0) * (Number(contagem[chave]) || 0);
  }
  return centavos / 100;
}

// Esperado em cartão/pix = tudo que foi recebido menos o que entrou em dinheiro.
function esperadoEletronico(resumo) {
  const r = resumo || {};
  return (Number(r.totalRecebido) || 0) - (Number(r.recebidoDinheiro) || 0);
}

// Total que deveria estar no caixa (espécie + eletrônico):
// saldo inicial + suprimento + vendas (todas as formas) - sangria.
function totalEmCaixa(caixa, resumo) {
  const fundo = Number(caixa && caixa.fundo_troco) || 0;
  const r = resumo || {};
  return fundo + (Number(r.suprimentos) || 0) + (Number(r.totalRecebido) || 0) - (Number(r.sangrias) || 0);
}
```

E incluir no `module.exports`: `totalContagem, esperadoEletronico, totalEmCaixa`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (todos, incluindo os 4 novos).

- [ ] **Step 5: Commit**

```bash
git add src/caixa-calc.js test/caixa-calc.test.js
git commit -m "feat(caixa): cálculos puros do fechamento (contagem, esperado eletrônico, total em caixa)"
```

---

### Task 2: Módulo do relatório de fechamento (`relatorio-caixa.js`)

**Files:**
- Create: `public/relatorio-caixa.js`
- Test: `test/relatorio-caixa.test.js`

**Interfaces:**
- Consumes: nada de outras tasks (módulo autocontido; helpers de 48 colunas duplicados localmente — espelham `public/comanda.js`, que segue intacto).
- Produces (browser `window.Relatorio` / Node `module.exports`):
  - `montarRelatorioFechamento(dados) -> string`, onde `dados`:
    ```
    {
      restaurante, abertoEm, fechadoEm, operador,
      formaDinheiro,            // rótulo da forma de dinheiro (ex "Dinheiro")
      formas,                   // formas eletrônicas, ordem de exibição (ex ["Cartão","Pix"])
      recebidoPorForma,         // { "Dinheiro":100, "Cartão":50, "Pix":30, ... }
      fundoTroco, suprimentos, sangrias,
      contadoDinheiro,          // número (operador contou nas cédulas)
      eletronicoPorForma,       // { "Cartão":50, "Pix":30 } (operador informou)
    }
    ```

- [ ] **Step 1: Write the failing test**

Create `test/relatorio-caixa.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert");
const Relatorio = require("../public/relatorio-caixa");

function dadosBase() {
  return {
    restaurante: "Meu Restaurante",
    abertoEm: "2026-06-20T17:02:00.000Z",
    fechadoEm: "2026-06-20T22:15:00.000Z",
    operador: "Ricardo Silva",
    formaDinheiro: "Dinheiro",
    formas: ["Cartão", "Pix"],
    recebidoPorForma: { Dinheiro: 100, Cartão: 50, Pix: 30 },
    fundoTroco: 50, suprimentos: 20, sangrias: 10,
    contadoDinheiro: 160,
    eletronicoPorForma: { Cartão: 50, Pix: 30 },
  };
}

test("relatório: seções, vendas por forma e totais agregados", () => {
  const txt = Relatorio.montarRelatorioFechamento(dadosBase());
  assert.match(txt, /FECHAMENTO DE CAIXA/);
  assert.match(txt, /Operador: Ricardo Silva/);
  assert.match(txt, /VENDAS/);
  assert.match(txt, /Dinheiro\s+100,00/);
  assert.match(txt, /Cartão\s+50,00/);
  assert.match(txt, /Pix\s+30,00/);
  assert.match(txt, /Saldo Inicial\s+50,00/);
  assert.match(txt, /Suprimento\s+20,00/);
  assert.match(txt, /Retirada\s+10,00/);
  assert.match(txt, /Total de Vendas\s+180,00/);
  assert.match(txt, /Total em Caixa\s+240,00/);
  assert.match(txt, /FECHAMENTO OPERADOR/);
  assert.match(txt, /Total\s+240,00/);
  assert.match(txt, /bateu|Diferença\s+0,00/i);
});

test("relatório: SOBROU quando operador conta a mais", () => {
  const d = dadosBase(); d.contadoDinheiro = 170; // +10
  const txt = Relatorio.montarRelatorioFechamento(d);
  assert.match(txt, /SOBROU/);
  assert.match(txt, /Diferença\s+\+?\s*10,00/);
});

test("relatório: FALTOU quando operador conta a menos", () => {
  const d = dadosBase(); d.contadoDinheiro = 150; // -10
  const txt = Relatorio.montarRelatorioFechamento(d);
  assert.match(txt, /FALTOU/);
  assert.match(txt, /Diferença\s+-\s*10,00/);
});

test("relatório: forma configurada sem venda aparece como 0,00", () => {
  const d = dadosBase();
  d.formas = ["Cartão", "Pix", "Vale"]; // Vale sem venda
  const txt = Relatorio.montarRelatorioFechamento(d);
  assert.match(txt, /Vale\s+0,00/);
});

test("relatório: recebimento de forma fora da lista vira 'Outros'", () => {
  const d = dadosBase();
  d.recebidoPorForma = { Dinheiro: 100, Cartão: 50, Pix: 30, Cheque: 5 };
  const txt = Relatorio.montarRelatorioFechamento(d);
  assert.match(txt, /Outros\s+5,00/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/relatorio-caixa.test.js`
Expected: FAIL — `Cannot find module '../public/relatorio-caixa'`.

- [ ] **Step 3: Implement the module**

Create `public/relatorio-caixa.js`:

```js
// Montagem PURA do relatório de fechamento de caixa (térmica 80mm, 48 colunas).
// Dual-mode: window.Relatorio no browser; module.exports no node --test.
// Helpers de formatação espelham public/comanda.js (duplicados de propósito p/
// não acoplar os dois módulos de impressão; comanda.js segue intacto).
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Relatorio = api;
})(typeof self !== "undefined" ? self : this, function () {
  const LARGURA = 48;
  function fmtBR(n) { return (Number(n) || 0).toFixed(2).replace(".", ","); }
  function sep(ch) { return (ch || "-").repeat(LARGURA); }
  function centro(txt) {
    const t = String(txt || "");
    if (t.length >= LARGURA) return t.slice(0, LARGURA);
    return " ".repeat(Math.floor((LARGURA - t.length) / 2)) + t;
  }
  function linhaValor(rotulo, valor) {
    let r = String(rotulo || "");
    const v = String(valor || "");
    const maxR = Math.max(1, LARGURA - v.length - 1);
    if (r.length > maxR) r = r.slice(0, maxR);
    return r + " ".repeat(Math.max(1, LARGURA - r.length - v.length)) + v;
  }
  function dataHoraBR(iso) {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    } catch (_) { return ""; }
  }

  function montarRelatorioFechamento(d) {
    d = d || {};
    const recebido = d.recebidoPorForma || {};
    const formas = d.formas || [];
    const formaDin = d.formaDinheiro || "Dinheiro";
    const L = [];

    L.push(centro("*" + String(d.restaurante || "Caixa").toUpperCase() + "*"));
    L.push(centro("FECHAMENTO DE CAIXA"));
    L.push(centro(dataHoraBR(d.abertoEm) + "  ->  " + dataHoraBR(d.fechadoEm)));
    if (d.operador) L.push(centro("Operador: " + d.operador));
    L.push(sep("="));

    // VENDAS — dinheiro + cada forma eletrônica configurada + "Outros" (legado)
    L.push("VENDAS");
    L.push(linhaValor(formaDin, "R$ " + fmtBR(recebido[formaDin] || 0)));
    const contadas = new Set([formaDin]);
    formas.forEach((f) => {
      L.push(linhaValor(f, "R$ " + fmtBR(recebido[f] || 0)));
      contadas.add(f);
    });
    let outros = 0;
    for (const k in recebido) if (!contadas.has(k)) outros += Number(recebido[k]) || 0;
    if (outros > 0) L.push(linhaValor("Outros", "R$ " + fmtBR(outros)));
    L.push(sep("-"));

    // Movimentos
    L.push(linhaValor("Saldo Inicial", "R$ " + fmtBR(d.fundoTroco)));
    L.push(linhaValor("Suprimento", "R$ " + fmtBR(d.suprimentos)));
    L.push(linhaValor("Retirada", "- R$ " + fmtBR(d.sangrias)));
    L.push(sep("-"));

    let totalVendas = 0;
    for (const k in recebido) totalVendas += Number(recebido[k]) || 0;
    const totalCaixa = (Number(d.fundoTroco) || 0) + (Number(d.suprimentos) || 0) + totalVendas - (Number(d.sangrias) || 0);
    L.push(linhaValor("Total de Vendas", "R$ " + fmtBR(totalVendas)));
    L.push(linhaValor("Total em Caixa", "R$ " + fmtBR(totalCaixa)));
    L.push(sep("="));

    // FECHAMENTO OPERADOR — dinheiro contado + eletrônico informado
    L.push("FECHAMENTO OPERADOR");
    const elet = d.eletronicoPorForma || {};
    L.push(linhaValor(formaDin, "R$ " + fmtBR(d.contadoDinheiro)));
    let totalElet = 0;
    formas.forEach((f) => {
      const v = Number(elet[f]) || 0; totalElet += v;
      L.push(linhaValor(f, "R$ " + fmtBR(v)));
    });
    L.push(sep("-"));
    const totalOperador = (Number(d.contadoDinheiro) || 0) + totalElet;
    const dif = totalOperador - totalCaixa;
    L.push(linhaValor("Total", "R$ " + fmtBR(totalOperador)));
    const estado = dif === 0 ? "CONFERIDO" : (dif > 0 ? "SOBROU" : "FALTOU");
    L.push(centro(estado));
    const sinal = dif > 0 ? "+ R$ " : (dif < 0 ? "- R$ " : "R$ ");
    L.push(linhaValor("Diferença", sinal + fmtBR(Math.abs(dif))));
    L.push(sep("="));

    return L.join("\n");
  }

  return { montarRelatorioFechamento, fmtBR };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/relatorio-caixa.test.js`
Expected: PASS (5 casos).

- [ ] **Step 5: Run full suite + syntax check**

Run: `npm run check && npm test`
Expected: OK (sintaxe) + todos os testes passam.

- [ ] **Step 6: Commit**

```bash
git add public/relatorio-caixa.js test/relatorio-caixa.test.js
git commit -m "feat(caixa): módulo puro do relatório de fechamento (80mm) + testes"
```

---

### Task 3: Migration — colunas de fechamento

**Files:**
- Create: `supabase/migrations/20260620140000_caixa_fechamento_detalhe.sql`

**Interfaces:**
- Produces: colunas `contado_eletronico numeric(10,2)` e `detalhe_fechamento jsonb` em `caixas`. `diferenca` passa a guardar a diferença GLOBAL.

- [ ] **Step 1: Create the migration**

```sql
-- Fechamento de caixa: conferência de cartão/pix + snapshot do detalhamento.
-- Complementa 20260620120000_caixa.sql. `diferenca` (já existente) passa a guardar
-- a diferença GLOBAL (espécie + eletrônico); linhas antigas (só dinheiro) seguem válidas.
alter table public.caixas add column if not exists contado_eletronico numeric(10,2);
alter table public.caixas add column if not exists detalhe_fechamento  jsonb;
```

- [ ] **Step 2: Apply**

Run: `npx supabase db push`
Expected: `Applying migration 20260620140000_caixa_fechamento_detalhe.sql... Finished`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260620140000_caixa_fechamento_detalhe.sql
git commit -m "feat(caixa): migration p/ conferência eletrônica + detalhe do fechamento"
```

---

### Task 4: Backend — `fecharCaixa` recalcula/persiste + rotas

**Files:**
- Modify: `src/caixa.js` (`fecharCaixa`)
- Modify: `src/servidor.js` (rota `GET /api/caixa` enriquece com formas+restaurante; rota `POST /api/caixa/fechar` repassa o novo payload)

**Interfaces:**
- Consumes: `calc.totalContagem`, `calc.totalEmCaixa`, `calc.resumoCaixa` (Task 1).
- Produces:
  - `fecharCaixa(dir, { contagem, eletronico })` → `{ diferenca, totalEmCaixa, contadoDinheiro, contadoEletronico }`.
  - `GET /api/caixa` agora inclui `formasPagamento: string[]` e `restaurante: string` no JSON.

- [ ] **Step 1: Reescrever `fecharCaixa` em `src/caixa.js`**

Substituir a função `fecharCaixa` atual por:

```js
// eletronico: [{ forma, valor }] informado pelo operador.
async function fecharCaixa(dir, { contagem, eletronico }) {
  const caixaAtual = await caixaAberto(dir);
  if (!caixaAtual) throw new Error("Não há caixa aberto.");
  const movimentos = await _movimentos(caixaAtual.id);
  const resumo = calc.resumoCaixa(caixaAtual, movimentos);

  const contadoDinheiro = calc.totalContagem(contagem || {});
  const lancs = Array.isArray(eletronico) ? eletronico : [];
  const contadoEletronico = lancs.reduce((s, l) => s + (Number(l && l.valor) || 0), 0);
  const totalCaixa = calc.totalEmCaixa(caixaAtual, resumo);
  const diferenca = (contadoDinheiro + contadoEletronico) - totalCaixa;

  // Agrega lançamentos por forma p/ o snapshot.
  const eletronicoPorForma = {};
  for (const l of lancs) {
    const f = (l && l.forma) || "Outros";
    eletronicoPorForma[f] = (eletronicoPorForma[f] || 0) + (Number(l.valor) || 0);
  }
  const detalhe = {
    cedulas: contagem || {},
    eletronico: lancs,
    eletronicoPorForma,
    esperado: { totalEmCaixa: totalCaixa, especie: resumo.esperadoEspecie, eletronico: calc.esperadoEletronico(resumo) },
    contado: { dinheiro: contadoDinheiro, eletronico: contadoEletronico },
  };

  await db.query(
    `UPDATE caixas SET status='fechado', fechado_em=now(),
            contado_dinheiro=$2, contado_eletronico=$3, diferenca=$4, detalhe_fechamento=$5
       WHERE id=$1`,
    [caixaAtual.id, contadoDinheiro, contadoEletronico, diferenca, JSON.stringify(detalhe)]
  );
  return { diferenca, totalEmCaixa: totalCaixa, contadoDinheiro, contadoEletronico };
}
```

(Remove o uso antigo de `contadoDinheiro`/`observacao` na assinatura; a coluna `observacao` segue existindo e fica nula no fechamento — sem regressão.)

- [ ] **Step 2: Atualizar `GET /api/caixa` em `src/servidor.js`**

Localizar o handler `app.get("/api/caixa", ...)` e trocar o corpo por:

```js
app.get("/api/caixa", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try {
    const data = await caixa.resumo(req.tenantDir);
    await store.ensure(req.tenantDir);
    const cfg = store.getConfig(req.tenantDir) || {};
    data.formasPagamento = Array.isArray(cfg.pagamentos) ? cfg.pagamentos : [];
    data.restaurante = (cfg.restaurante && cfg.restaurante.nome) || "";
    res.json(data);
  } catch (e) { res.status(500).json({ erro: "Falha ao ler o caixa." }); }
});
```

Confirmar no topo de `src/servidor.js` que `store` já está requerido (`const store = require("./store")` ou nome equivalente). Se não estiver, adicionar o require seguindo o padrão dos outros módulos do arquivo.

- [ ] **Step 3: Atualizar `POST /api/caixa/fechar` em `src/servidor.js`**

```js
app.post("/api/caixa/fechar", exigeAuth, async (req, res) => {
  if (!(await exigeCaixa(req, res))) return;
  try { res.json(await caixa.fecharCaixa(req.tenantDir, { contagem: req.body.contagem, eletronico: req.body.eletronico })); }
  catch (e) { res.status(400).json({ erro: e.message }); }
});
```

- [ ] **Step 4: Syntax check**

Run: `npm run check`
Expected: `OK: ... arquivos sem erro de sintaxe.`

- [ ] **Step 5: Commit**

```bash
git add src/caixa.js src/servidor.js
git commit -m "feat(caixa): fechamento recalcula totais/diferença e persiste detalhe; GET /api/caixa expõe formas"
```

---

### Task 5: Front — tela de fechamento (contador + lançamentos)

**Files:**
- Modify: `public/app.js` (substitui `fecharCaixaUI`; ajusta o handler do botão "Fechar caixa")

**Interfaces:**
- Consumes: `data` do `renderCaixaAberto` (tem `data.resumo`, `data.caixa`, e agora `data.formasPagamento`, `data.restaurante`); `window.Dinheiro`; `window.Relatorio` (Task 2); `window.Impressao.abrirRelatorio` (Task 6).
- Produces: `renderFechamentoCaixa(data)`.

- [ ] **Step 1: Trocar o handler do botão "Fechar caixa"**

Em `renderCaixaAberto`, localizar:
```js
$("btnFecharCaixa").addEventListener("click", () => fecharCaixaUI(r.esperadoEspecie));
```
e trocar por:
```js
$("btnFecharCaixa").addEventListener("click", () => renderFechamentoCaixa(data));
```

- [ ] **Step 2: Substituir `fecharCaixaUI` por `renderFechamentoCaixa`**

Remover a função `fecharCaixaUI` inteira e colocar no lugar:

```js
const DENOMINACOES = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5]; // centavos

function ehFormaDinheiro(f) { return /dinheiro/i.test(String(f || "")); }

function renderFechamentoCaixa(data) {
  const cont = $("caixaConteudo");
  const resumo = data.resumo || {};
  const esperadoEspecie = Number(resumo.esperadoEspecie) || 0;
  const esperadoElet = (Number(resumo.totalRecebido) || 0) - (Number(resumo.recebidoDinheiro) || 0);
  const formas = (data.formasPagamento || []);
  const formaDin = formas.find(ehFormaDinheiro) || "Dinheiro";
  const eletronicas = formas.filter((f) => !ehFormaDinheiro(f));
  const lancamentos = []; // { forma, valor }

  const linhasCedula = DENOMINACOES.map((c) => `
    <tr>
      <td class="fc-ced">R$ ${fmtBRn(c / 100)}</td>
      <td><input class="fc-qtd" inputmode="numeric" data-cent="${c}" value=""></td>
      <td class="fc-tot" data-cent="${c}">R$ 0,00</td>
    </tr>`).join("");

  const opcoesForma = eletronicas.length
    ? eletronicas.map((f) => `<option value="${escapar(f)}">${escapar(f)}</option>`).join("")
    : `<option value="Cartão">Cartão</option>`;

  cont.innerHTML = `
    <div class="fc-wrap">
      <div class="fc-cab">
        <h3>Fechamento de Caixa</h3>
        <span class="sub">Confira o dinheiro da gaveta e os recebimentos eletrônicos do dia${data.caixa && data.caixa.operador ? " · Operador: " + escapar(data.caixa.operador) : ""}</span>
      </div>
      <div class="fc-cols">
        <section class="fc-col">
          <h4>Dinheiro (contagem da gaveta)</h4>
          <table class="fc-tabela"><thead><tr><th>Cédula/Moeda</th><th>Qtd</th><th>Total</th></tr></thead>
            <tbody>${linhasCedula}</tbody></table>
          <div class="fc-rodape">
            <div class="caixa-linha"><span>Contado</span><span id="fcContadoDin">R$ 0,00</span></div>
            <div class="caixa-linha"><span>Esperado</span><span>R$ ${fmtBRn(esperadoEspecie)}</span></div>
            <div class="caixa-linha caixa-total"><span>Diferença</span><span id="fcDifDin" class="fc-dif">R$ 0,00</span></div>
          </div>
        </section>
        <section class="fc-col">
          <h4>Cartões / Pix</h4>
          <div class="fc-add">
            <select id="fcForma">${opcoesForma}</select>
            <input id="fcValor" inputmode="numeric" value="0,00">
            <button type="button" id="fcAdd" class="secundario">+ Adicionar</button>
          </div>
          <div id="fcLista" class="fc-lista"></div>
          <div class="fc-rodape">
            <div class="caixa-linha"><span>Informado</span><span id="fcInformado">R$ 0,00</span></div>
            <div class="caixa-linha"><span>Esperado</span><span>R$ ${fmtBRn(esperadoElet)}</span></div>
            <div class="caixa-linha caixa-total"><span>Diferença</span><span id="fcDifElet" class="fc-dif">R$ 0,00</span></div>
          </div>
        </section>
      </div>
      <div class="fc-acoes">
        <button class="secundario" id="fcCancelar">Cancelar</button>
        <button id="fcFechar">Fechar caixa e imprimir →</button>
      </div>
    </div>`;

  if (window.Dinheiro) Dinheiro.mascarar("fcValor");

  function fmtDif(el, dif) {
    el.classList.remove("fc-sobra", "fc-falta");
    if (dif > 0) { el.textContent = "+R$ " + fmtBRn(dif) + " ▲ sobrou"; el.classList.add("fc-sobra"); }
    else if (dif < 0) { el.textContent = "−R$ " + fmtBRn(-dif) + " ▼ faltou"; el.classList.add("fc-falta"); }
    else { el.textContent = "R$ 0,00 ✓ bateu"; }
  }
  function contagemAtual() {
    const c = {};
    cont.querySelectorAll(".fc-qtd").forEach((i) => {
      const cent = i.dataset.cent; const q = parseInt(i.value, 10) || 0;
      if (q > 0) c[cent] = q;
    });
    return c;
  }
  function recalcDinheiro() {
    let total = 0;
    cont.querySelectorAll(".fc-qtd").forEach((i) => {
      const cent = Number(i.dataset.cent); const q = parseInt(i.value, 10) || 0;
      const linha = q * cent / 100; total += linha;
      const td = cont.querySelector(`.fc-tot[data-cent="${cent}"]`);
      if (td) td.textContent = "R$ " + fmtBRn(linha);
    });
    $("fcContadoDin").textContent = "R$ " + fmtBRn(total);
    fmtDif($("fcDifDin"), total - esperadoEspecie);
  }
  function recalcEletronico() {
    const total = lancamentos.reduce((s, l) => s + l.valor, 0);
    $("fcInformado").textContent = "R$ " + fmtBRn(total);
    fmtDif($("fcDifElet"), total - esperadoElet);
  }
  function renderLista() {
    $("fcLista").innerHTML = lancamentos.length
      ? lancamentos.map((l, i) => `<div class="fc-lanc"><span>${escapar(l.forma)}</span><span>R$ ${fmtBRn(l.valor)}</span><button type="button" class="fc-del" data-i="${i}" aria-label="Remover">✕</button></div>`).join("")
      : "<p class='sub'>Nenhum lançamento ainda.</p>";
    $("fcLista").querySelectorAll(".fc-del").forEach((b) =>
      b.addEventListener("click", () => { lancamentos.splice(+b.dataset.i, 1); renderLista(); recalcEletronico(); }));
  }

  cont.querySelectorAll(".fc-qtd").forEach((i) => i.addEventListener("input", recalcDinheiro));
  $("fcAdd").addEventListener("click", () => {
    const forma = $("fcForma").value;
    const valor = window.Dinheiro ? Dinheiro.valor("fcValor") : 0;
    if (valor <= 0) { toast("Informe um valor maior que zero."); return; }
    lancamentos.push({ forma, valor });
    if (window.Dinheiro) Dinheiro.zerar ? Dinheiro.zerar("fcValor") : ($("fcValor").value = "0,00");
    renderLista(); recalcEletronico();
  });
  $("fcCancelar").addEventListener("click", () => carregarCaixa());
  $("fcFechar").addEventListener("click", () => fecharCaixaFinal(data, contagemAtual, lancamentos, formaDin, eletronicas));

  renderLista(); recalcDinheiro(); recalcEletronico();
}

async function fecharCaixaFinal(data, contagemAtual, lancamentos, formaDin, eletronicas) {
  const contagem = contagemAtual();
  const r = await api("POST", "/api/caixa/fechar", { contagem, eletronico: lancamentos });
  if (!r || !r.ok) { const d = r ? await r.json().catch(() => ({})) : {}; toast(d.erro || "Falha ao fechar."); return; }
  const res = await r.json();
  const dif = res.diferenca;
  toast(dif === 0 ? "✓ Caixa fechado, bateu certinho!" : (dif > 0 ? "Caixa fechado. Sobra de R$ " + fmtBRn(dif) : "Caixa fechado. Falta de R$ " + fmtBRn(-dif)));

  // Monta o relatório com os dados conferidos e abre a prévia de impressão.
  const resumo = data.resumo || {};
  const eletronicoPorForma = {};
  lancamentos.forEach((l) => { eletronicoPorForma[l.forma] = (eletronicoPorForma[l.forma] || 0) + l.valor; });
  let contado = 0;
  for (const cent in contagem) contado += Number(cent) * contagem[cent] / 100;
  const dados = {
    restaurante: data.restaurante || painelNome,
    abertoEm: data.caixa && data.caixa.abertoEm,
    fechadoEm: new Date().toISOString(),
    operador: (data.caixa && data.caixa.operador) || "",
    formaDinheiro: formaDin,
    formas: eletronicas,
    recebidoPorForma: resumo.recebidoPorForma || {},
    fundoTroco: (data.caixa && data.caixa.fundoTroco) || 0,
    suprimentos: resumo.suprimentos || 0,
    sangrias: resumo.sangrias || 0,
    contadoDinheiro: contado,
    eletronicoPorForma,
  };
  if (window.Relatorio && window.Impressao && window.Impressao.abrirRelatorio) {
    window.Impressao.abrirRelatorio("Relatório de fechamento", window.Relatorio.montarRelatorioFechamento(dados));
  }
  carregarCaixa();
}
```

> Nota: o `recebidoPorForma` do resumo usa as chaves de forma exatamente como gravadas no recebimento; o relatório casa pelos rótulos de `config.pagamentos`. Se um tenant tiver rótulo divergente entre o cadastro do pagamento e o gravado no pedido, a venda cai em "Outros" — comportamento aceitável p/ a v1 (a normalização de formas é a feature futura do ROADMAP).

- [ ] **Step 3: Conferir o util `Dinheiro`**

Ler `public/dinheiro.js` e confirmar a API: `mascarar(id)`, `valor(id)`. Se **não** existir `zerar(id)`, o código acima já cai no fallback `$("fcValor").value = "0,00"` — mas confirmar que após setar "0,00" a máscara continua funcionando (se a máscara guardar estado interno, ajustar o reset conforme o que `dinheiro.js` expõe). Ajustar o reset ao que o módulo realmente oferece.

- [ ] **Step 4: Syntax check**

Run: `npm run check`
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat(caixa): tela de fechamento com contador de cédulas e lançamentos de cartão/pix"
```

---

### Task 6: Pipeline de impressão do relatório (documento único)

**Files:**
- Modify: `public/admin.html` (novo overlay `#relatorio-overlay`)
- Modify: `public/impressao.js` (expor `abrirRelatorio`)
- Modify: `public/style.css` (reaproveita estilos do `#impressao-overlay`; só garantir o novo id)

**Interfaces:**
- Consumes: `#area-impressao` e `window.print()` já existentes.
- Produces: `window.Impressao.abrirRelatorio(titulo, texto)`.

- [ ] **Step 1: Adicionar o overlay em `public/admin.html`**

Logo após o fechamento do `#impressao-overlay` (linha ~725), inserir:

```html
  <div id="relatorio-overlay" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="relatorio-titulo">
    <div class="modal-caixa impressao-caixa">
      <h3 id="relatorio-titulo">Relatório de fechamento</h3>
      <p class="sub">Confira o relatório e imprima na térmica 80mm.</p>
      <div class="impressao-previews">
        <div class="impressao-via">
          <pre class="cupom-preview" id="relatorio-prev"></pre>
        </div>
      </div>
      <div class="modal-acoes">
        <button class="secundario" id="relatorio-fechar">Fechar</button>
        <button id="relatorio-imprimir">Imprimir</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: Expor `abrirRelatorio` em `public/impressao.js`**

Dentro do IIFE, antes de `global.Impressao = ...`, adicionar:

```js
  function abrirRelatorio(titulo, texto) {
    const overlay = document.getElementById("relatorio-overlay");
    const tEl = document.getElementById("relatorio-titulo");
    const prev = document.getElementById("relatorio-prev");
    if (tEl && titulo) tEl.textContent = titulo;
    if (prev) prev.textContent = texto || "";
    if (overlay) overlay.style.display = "flex";
  }
  function fecharRelatorio() {
    const o = document.getElementById("relatorio-overlay");
    if (o) o.style.display = "none";
  }
```

Dentro de `ligar()`, adicionar os listeners:

```js
    const rImp = document.getElementById("relatorio-imprimir");
    const rX = document.getElementById("relatorio-fechar");
    const rOv = document.getElementById("relatorio-overlay");
    const rPrev = document.getElementById("relatorio-prev");
    if (rImp) rImp.addEventListener("click", () => imprimirTexto(rPrev ? rPrev.textContent : ""));
    if (rX) rX.addEventListener("click", fecharRelatorio);
    if (rOv) rOv.addEventListener("mousedown", (e) => { if (e.target === rOv) fecharRelatorio(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && rOv && rOv.style.display === "flex") fecharRelatorio();
    });
```

E trocar a linha final para: `global.Impressao = { abrirPreview, abrirRelatorio };`

- [ ] **Step 3: Carregar `relatorio-caixa.js` no painel**

Em `public/admin.html`, onde `comanda.js`/`impressao.js` são carregados (`<script src=...>`), adicionar `relatorio-caixa.js` **antes** de `app.js` (e antes ou junto de `impressao.js`):

```html
  <script src="relatorio-caixa.js"></script>
```

Confirmar a ordem: `dinheiro.js` → `comanda.js` → `relatorio-caixa.js` → `impressao.js` → `app.js`.

- [ ] **Step 4: Syntax check**

Run: `npm run check`
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add public/admin.html public/impressao.js
git commit -m "feat(caixa): prévia de impressão do relatório de fechamento (documento único)"
```

---

### Task 7: CSS da tela de fechamento

**Files:**
- Modify: `public/style.css` (seção Caixa)

**Interfaces:**
- Consumes: tokens existentes (`--bg-surface`, `--border`, `--success`, `--error`, `--radius`).
- Produces: estilos `.fc-*`.

- [ ] **Step 1: Adicionar os estilos**

Na seção `/* ---- Caixa (Plano Completo) ---- */` de `public/style.css`, adicionar:

```css
/* Fechamento de caixa — contador + lançamentos */
.fc-wrap { max-width: 920px; }
.fc-cab { margin-bottom: 16px; }
.fc-cab h3 { margin: 0 0 4px; }
.fc-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.fc-col { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.fc-col h4 { margin: 0 0 12px; }
.fc-tabela { width: 100%; border-collapse: collapse; }
.fc-tabela th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-secondary); padding-bottom: 6px; }
.fc-tabela th:nth-child(2), .fc-tabela th:nth-child(3), .fc-tabela .fc-tot { text-align: right; }
.fc-tabela td { padding: 3px 0; }
.fc-ced { white-space: nowrap; }
.fc-qtd { width: 72px; text-align: right; padding: 6px 8px; }
.fc-tot { white-space: nowrap; color: var(--text-secondary); padding-left: 10px; }
.fc-add { display: flex; gap: 8px; margin-bottom: 12px; }
.fc-add select { flex: 0 0 40%; }
.fc-add input { flex: 1; min-width: 0; }
.fc-lista { display: flex; flex-direction: column; gap: 6px; min-height: 40px; margin-bottom: 12px; }
.fc-lanc { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.fc-lanc span:first-child { flex: 1; }
.fc-del { background: none; border: none; color: var(--text-secondary); cursor: pointer; padding: 2px 6px; width: auto; }
.fc-del:hover { color: var(--error); }
.fc-rodape { margin-top: 12px; border-top: 1px solid var(--border); padding-top: 10px; }
.fc-dif.fc-sobra { color: var(--success); }
.fc-dif.fc-falta { color: var(--error); }
.fc-acoes { display: flex; justify-content: space-between; gap: 12px; margin-top: 18px; }
@media (max-width: 720px) { .fc-cols { grid-template-columns: 1fr; } }
```

- [ ] **Step 2: Commit**

```bash
git add public/style.css
git commit -m "feat(caixa): estilos da tela de fechamento (contador + lançamentos)"
```

---

### Task 8: Validação final + verificação manual

**Files:** nenhum (validação)

- [ ] **Step 1: Suíte completa + sintaxe**

Run: `npm run check && npm test`
Expected: `OK: ... sem erro de sintaxe.` + todos os testes passam (incluindo `caixa-calc` e `relatorio-caixa`).

- [ ] **Step 2: Conferência manual do relatório (sanity, sem UI)**

Run:
```bash
node -e "const R=require('./public/relatorio-caixa');console.log(R.montarRelatorioFechamento({restaurante:'Meu Restaurante',abertoEm:'2026-06-20T17:02:00Z',fechadoEm:'2026-06-20T22:15:00Z',operador:'Ricardo Silva',formaDinheiro:'Dinheiro',formas:['Cartão','Pix'],recebidoPorForma:{Dinheiro:100,Cartão:50,Pix:30},fundoTroco:50,suprimentos:20,sangrias:10,contadoDinheiro:160,eletronicoPorForma:{Cartão:50,Pix:30}}))"
```
Expected: relatório alinhado em 48 colunas, "Total em Caixa R$ 240,00", "CONFERIDO", "Diferença R$ 0,00".

- [ ] **Step 3: Ressalva de UI**

A tela do painel (aba Caixa → Fechar) exige sessão Plano Completo + Supabase; **não validada visualmente** por ferramenta automática. Declarar isso no fechamento da tarefa (PROGRESSO.md / commit), conforme a definição de "tarefa concluída".

- [ ] **Step 4: Atualizar PROGRESSO.md**

Mover o item para ✅ Concluído com resumo (contador de cédulas, lançamentos de cartão/pix, relatório 80mm, migration, ressalva de UI).

- [ ] **Step 5: Commit + push**

```bash
git add PROGRESSO.md
git commit -m "docs: marco do fechamento de caixa com contador de cédulas + relatório"
git push
```

---

## Self-Review (preenchido)

- **Cobertura da spec:** tela de fechamento (Task 5), contador 12 cédulas (Task 5 + CSS Task 7), lançamentos cartão/pix dirigidos por `config.pagamentos` (Task 4 GET + Task 5), cálculos puros (Task 1), relatório agregado 80mm (Task 2), impressão prévia documento único (Task 6), backend recalcula+persiste (Task 4) + migration (Task 3). Não-objetivos (Crédito/Débito, taxas, reimpressão) ficam fora. ✔
- **Placeholders:** nenhum "TBD"/"TODO"; todo passo tem código real. ✔
- **Consistência de tipos:** `contagem` = `{centavos: qtd}` em Task 1/4/5; `eletronico` = `[{forma,valor}]` em Task 4/5; `montarRelatorioFechamento(dados)` com o mesmo shape em Task 2 e Task 5. ✔
- **Riscos conhecidos:** (a) `Dinheiro.zerar` pode não existir → fallback no Step 3 da Task 5; (b) ordem dos `<script>` em admin.html (Task 6 Step 3) — conferir; (c) rótulo de forma divergente entre cadastro e pedido → cai em "Outros" (aceito na v1).
