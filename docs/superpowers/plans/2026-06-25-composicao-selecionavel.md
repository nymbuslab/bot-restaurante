# Composição selecionável (regras por subgrupo) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a composição do item (hoje texto só-exibição) em subgrupos selecionáveis pelo cliente, com regras por subgrupo (obrigatório, mín, máx), no cadastro, cardápio web, PDV e comanda; o servidor valida as escolhas.

**Architecture:** A composição do item passa de string para array estruturado `[{nome, obrigatorio, min, max, itens:[string]}]`. Um módulo PURO dual-mode (`public/grupos.js`, no padrão de `estoque.js`/`comanda.js`) centraliza a normalização e a validação das escolhas, consumido pelo servidor (recálculo) e pelo browser (habilitar o botão). Os opcionais (pagos) ficam **inalterados**. Composição não altera preço.

**Tech Stack:** Node.js CommonJS, Express, front HTML/CSS/JS puro (sem framework), testes `node:test` (`npm test`) + `npm run check`. CSP estrita (JS sempre externo, sem handler inline).

## Global Constraints

- Banco de produção **vazio** → **sem migração de dados**; remover o caminho de texto antigo da composição.
- Composição é **grátis**: não soma ao preço. Preço vem só dos opcionais (lógica atual intacta).
- **máx = 1** → escolha única (radio). **máx > 1** → múltipla (checkbox). Cada item conta 1 (sem quantidade por item na composição).
- `obrigatorio = true` ⇒ `min` efetivo ≥ 1.
- Servidor é a **fonte de verdade**: revalida as escolhas e rejeita pedido/venda inválidos.
- **Opcionais inalterados** (campo, lógica, steppers de quantidade, preço).
- Bloco de cadastro: **não rework do layout** — apenas adicionar os controles obrigatório/mín/máx por subgrupo.
- CSP estrita: nada de `<script>`/handler inline; eventos via `addEventListener`.
- Textos/comentários em pt-BR. Sem emojis na UI (ícones SVG).
- Forma normalizada das escolhas no pedido: `composicao: [{ grupo: string, itens: [string] }]`.

---

### Task 1: Módulo puro `public/grupos.js` + testes

**Files:**
- Create: `public/grupos.js`
- Test: `test/grupos.test.js`

**Interfaces:**
- Produces:
  - `normalizarGrupos(composicao)` → `[{ nome:string, obrigatorio:boolean, min:number, max:number, itens:string[] }]` (descarta subgrupos sem itens; coage tipos).
  - `avaliarComposicao(base, escolhas)` → `{ valido:boolean, selecoes:[{grupo,itens:string[]}], pendencias:string[] }`. `base` é o item do cardápio (usa `base.composicao`); `escolhas` é `[{grupo, itens:[nome]}]` vindo do cliente. Mantém só itens que existem no subgrupo; aplica mín/máx/obrigatório.
- Consome: nada.

- [ ] **Step 1: Escrever os testes (falhando)**

Crie `test/grupos.test.js`:

```javascript
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizarGrupos, avaliarComposicao } = require("../public/grupos");

const base = {
  composicao: [
    { nome: "Proteínas", obrigatorio: true, min: 1, max: 1, itens: ["Frango", "Carne"] },
    { nome: "Principais", obrigatorio: true, min: 1, max: 3, itens: ["Arroz", "Feijão", "Sem Feijão"] },
    { nome: "Adicionais", obrigatorio: false, min: 0, max: 2, itens: ["Farofa", "Vinagrete"] },
  ],
};

test("normalizarGrupos: coage tipos e descarta subgrupo sem itens", () => {
  const g = normalizarGrupos([
    { nome: " X ", obrigatorio: 1, min: "2", max: "4", itens: [" a ", "", "b"] },
    { nome: "Vazio", itens: [] },
    "lixo",
  ]);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0], { nome: "X", obrigatorio: true, min: 2, max: 4, itens: ["a", "b"] });
});

test("normalizarGrupos: não-array vira []", () => {
  assert.deepEqual(normalizarGrupos("Principal:\n* Arroz"), []);
  assert.deepEqual(normalizarGrupos(undefined), []);
});

test("avaliarComposicao: seleção válida normaliza e não acusa pendência", () => {
  const r = avaliarComposicao(base, [
    { grupo: "Proteínas", itens: ["Frango"] },
    { grupo: "Principais", itens: ["Arroz", "Feijão"] },
  ]);
  assert.equal(r.valido, true);
  assert.deepEqual(r.pendencias, []);
  assert.deepEqual(r.selecoes, [
    { grupo: "Proteínas", itens: ["Frango"] },
    { grupo: "Principais", itens: ["Arroz", "Feijão"] },
  ]);
});

test("avaliarComposicao: obrigatório sem escolha → inválido", () => {
  const r = avaliarComposicao(base, [{ grupo: "Principais", itens: ["Arroz"] }]);
  assert.equal(r.valido, false);
  assert.match(r.pendencias.join(" "), /Proteínas/);
});

test("avaliarComposicao: acima do máx → inválido", () => {
  const r = avaliarComposicao(base, [
    { grupo: "Proteínas", itens: ["Frango"] },
    { grupo: "Principais", itens: ["Arroz", "Feijão", "Sem Feijão"] },
    { grupo: "Adicionais", itens: ["Farofa", "Vinagrete"] }, // permitido (máx 2)
  ]);
  // Proteínas máx 1, Principais máx 3 → tudo ok aqui
  assert.equal(r.valido, true);
  const r2 = avaliarComposicao(base, [
    { grupo: "Proteínas", itens: ["Frango", "Carne"] }, // máx 1 → estoura
    { grupo: "Principais", itens: ["Arroz"] },
  ]);
  assert.equal(r2.valido, false);
  assert.match(r2.pendencias.join(" "), /Proteínas/);
});

test("avaliarComposicao: item fora do subgrupo é descartado (não conta)", () => {
  const r = avaliarComposicao(base, [
    { grupo: "Proteínas", itens: ["Fantasma"] }, // não existe → vira 0 escolhas
    { grupo: "Principais", itens: ["Arroz"] },
  ]);
  assert.equal(r.valido, false); // Proteínas obrigatória ficou vazia
  assert.match(r.pendencias.join(" "), /Proteínas/);
});

test("avaliarComposicao: dedup e respeita item duplicado uma vez", () => {
  const r = avaliarComposicao(base, [
    { grupo: "Proteínas", itens: ["Frango"] },
    { grupo: "Principais", itens: ["Arroz", "Arroz", "Feijão"] },
  ]);
  assert.equal(r.valido, true);
  assert.deepEqual(r.selecoes.find((s) => s.grupo === "Principais").itens, ["Arroz", "Feijão"]);
});

test("avaliarComposicao: item sem composição → válido e selecoes vazias", () => {
  const r = avaliarComposicao({ nome: "Refri" }, undefined);
  assert.deepEqual(r, { valido: true, selecoes: [], pendencias: [] });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Cannot find module '../public/grupos'`.

- [ ] **Step 3: Implementar `public/grupos.js`**

Crie `public/grupos.js` (dual-mode, mesmo wrapper UMD de `public/comanda.js`):

```javascript
// Helpers PUROS dos grupos de opções (composição selecionável do item).
// Dual-mode: window.Grupos no browser; module.exports no node --test.
// Composição estruturada: [{ nome, obrigatorio, min, max, itens:[string] }].
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Grupos = api;
})(typeof self !== "undefined" ? self : this, function () {
  // Normaliza a composição (whitelist + coação de tipos). Subgrupo sem itens é
  // descartado. Não-array vira [] (defesa contra o formato de texto antigo).
  function normalizarGrupos(composicao) {
    if (!Array.isArray(composicao)) return [];
    const out = [];
    composicao.forEach((g) => {
      if (!g || typeof g !== "object") return;
      const itens = Array.isArray(g.itens)
        ? g.itens.map((x) => String(x == null ? "" : x).trim()).filter(Boolean)
        : [];
      if (!itens.length) return;
      out.push({
        nome: String(g.nome == null ? "" : g.nome).trim(),
        obrigatorio: !!g.obrigatorio,
        min: Math.max(0, parseInt(g.min, 10) || 0),
        max: Math.max(0, parseInt(g.max, 10) || 0),
        itens: itens,
      });
    });
    return out;
  }

  // Avalia as escolhas do cliente contra as regras do item-base.
  // `escolhas` = [{ grupo, itens:[nome] }]. Mantém só itens existentes no subgrupo,
  // dedupe, e aplica mín/máx/obrigatório. Retorna { valido, selecoes, pendencias }.
  function avaliarComposicao(base, escolhas) {
    const grupos = normalizarGrupos(base && base.composicao);
    const porGrupo = {};
    (Array.isArray(escolhas) ? escolhas : []).forEach((e) => {
      if (e && e.grupo != null) porGrupo[String(e.grupo)] = Array.isArray(e.itens) ? e.itens : [];
    });
    const selecoes = [];
    const pendencias = [];
    grupos.forEach((g) => {
      const escolhidos = porGrupo[g.nome] || [];
      const validos = [];
      escolhidos.forEach((nome) => {
        const n = String(nome == null ? "" : nome).trim();
        if (g.itens.indexOf(n) !== -1 && validos.indexOf(n) === -1) validos.push(n);
      });
      const min = g.obrigatorio ? Math.max(1, g.min) : g.min;
      const max = g.max > 0 ? g.max : g.itens.length;
      if (validos.length < min) {
        pendencias.push(g.nome + ": escolha " + (min === 1 ? "1 opção" : "ao menos " + min + " opções"));
      } else if (validos.length > max) {
        pendencias.push(g.nome + ": escolha no máximo " + max);
      }
      if (validos.length) selecoes.push({ grupo: g.nome, itens: validos.slice(0, max) });
    });
    return { valido: pendencias.length === 0, selecoes: selecoes, pendencias: pendencias };
  }

  return { normalizarGrupos: normalizarGrupos, avaliarComposicao: avaliarComposicao };
});
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS (todos os testes de `grupos`).

- [ ] **Step 5: Commit**

```bash
git add public/grupos.js test/grupos.test.js
git commit -m "feat(cardapio): modulo puro de grupos de opcoes (normalizacao + validacao)"
```

---

### Task 2: Cadastro — controles obrigatório/mín/máx por subgrupo

**Files:**
- Modify: `public/app.js` (estado/`abrirEditorItem`/`renderEditorComposicao`/`salvarEditorItem`/handler do "+ Adicionar subgrupo")
- Modify: `public/style.css` (estilo da linha de regras, perto de `.comp-subgrupo-cabeca:2954`)

**Interfaces:**
- Consome: nada de tasks anteriores (UI independente).
- Produces: itens salvos com `composicao` = array `[{nome, obrigatorio, min, max, itens:[string]}]`.

- [ ] **Step 1: Carregar composição estruturada no editor**

Em `public/app.js`, dentro de `abrirEditorItem` (linha ~1180), troque:

```javascript
    editorComposicao = parsearComposicao(it.composicao || "");
```
por:
```javascript
    editorComposicao = (typeof Grupos !== "undefined" ? Grupos.normalizarGrupos(it.composicao) : (Array.isArray(it.composicao) ? it.composicao : []));
```

(O ramo "novo item" já faz `editorComposicao = []` — manter.)

- [ ] **Step 2: Default do novo subgrupo com regras**

Troque o handler do botão (linha ~1369):

```javascript
$("editor-comp-add-subgrupo").addEventListener("click", () => {
  editorComposicao.push({ nome: "", itens: [] });
  renderEditorComposicao();
});
```
por:
```javascript
$("editor-comp-add-subgrupo").addEventListener("click", () => {
  editorComposicao.push({ nome: "", obrigatorio: false, min: 0, max: 0, itens: [] });
  renderEditorComposicao();
});
```

- [ ] **Step 3: Renderizar a linha de regras + listeners**

Em `renderEditorComposicao` (linha ~1466), adicione a linha de regras logo após `.comp-subgrupo-cabeca`. Substitua o template literal `div.innerHTML = ...` por (note a nova `<div class="comp-sg-regras">`):

```javascript
    div.innerHTML = `
      <div class="comp-subgrupo-cabeca">
        <input class="comp-sg-nome" value="${escapar(sg.nome)}" placeholder="Nome do subgrupo" data-sg="${si}" />
        <button type="button" class="perigo mini comp-sg-del" data-sg="${si}" aria-label="Remover subgrupo">×</button>
      </div>
      <div class="comp-sg-regras">
        <label class="comp-sg-obrig-lbl"><input type="checkbox" class="comp-sg-obrig" data-sg="${si}" ${sg.obrigatorio ? "checked" : ""} /> Obrigatório</label>
        <label class="comp-sg-num">mín <input type="number" min="0" class="comp-sg-min" data-sg="${si}" value="${Number(sg.min) || 0}" /></label>
        <label class="comp-sg-num">máx <input type="number" min="0" class="comp-sg-max" data-sg="${si}" value="${Number(sg.max) || 0}" /></label>
      </div>
      <div class="comp-chips">${chipsHtml}</div>
      <div class="comp-add-ing">
        <input class="comp-ing-input" placeholder="Adicionar ingrediente..." data-sg="${si}" />
        <button type="button" class="secundario mini comp-ing-btn" data-sg="${si}">Adicionar</button>
      </div>
    `;
```

Em seguida, logo após o bloco de listeners de `.comp-sg-nome` (linha ~1497), adicione os listeners das regras:

```javascript
  container.querySelectorAll(".comp-sg-obrig").forEach((el) =>
    el.addEventListener("change", (e) => {
      editorComposicao[+e.target.dataset.sg].obrigatorio = e.target.checked;
    })
  );
  container.querySelectorAll(".comp-sg-min").forEach((el) =>
    el.addEventListener("input", (e) => {
      editorComposicao[+e.target.dataset.sg].min = Math.max(0, parseInt(e.target.value, 10) || 0);
    })
  );
  container.querySelectorAll(".comp-sg-max").forEach((el) =>
    el.addEventListener("input", (e) => {
      editorComposicao[+e.target.dataset.sg].max = Math.max(0, parseInt(e.target.value, 10) || 0);
    })
  );
```

- [ ] **Step 4: Salvar composição como array (não texto)**

Em `salvarEditorItem` (linha ~1257), troque:

```javascript
    composicao:  serializarComposicao(editorComposicao),
```
por:
```javascript
    composicao:  (typeof Grupos !== "undefined" ? Grupos.normalizarGrupos(editorComposicao) : editorComposicao),
```

(Mantém `opcionais: serializarOpcionais(editorOpcionais)` inalterado.)

- [ ] **Step 5: Remover funções de texto da composição (mortas)**

`parsearComposicao` (linha ~1437) e `serializarComposicao` (linha ~1455) ficam sem uso. Confirme com busca e remova ambas:

Run: `grep -rn "parsearComposicao\|serializarComposicao" public/ src/`
Expected: nenhum uso restante além das próprias definições → apague as duas funções.

- [ ] **Step 6: Garantir que `Grupos` carrega antes de `app.js`**

Confirme em `public/admin.html` que `<script src="grupos.js"></script>` aparece **antes** de `app.js` (junto dos outros utils como `dinheiro.js`/`estoque.js`). Se não houver, adicione na mesma área dos utils.

Run: `grep -n "grupos.js\|app.js\|estoque.js" public/admin.html`
Expected: `grupos.js` listado antes de `app.js`.

- [ ] **Step 7: Estilo da linha de regras**

Em `public/style.css`, após a regra `.comp-subgrupo-cabeca { ... }` (linha ~2954), adicione:

```css
.comp-sg-regras {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  font-size: 0.85rem;
  color: var(--texto-suave);
}
.comp-sg-obrig-lbl { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.comp-sg-num { display: inline-flex; align-items: center; gap: 6px; }
.comp-sg-num input { width: 56px; }
```

(Se `--texto-suave` não existir no projeto, use a variável de texto secundário já usada nas dicas do editor — confira com `grep -n "color: var(--" public/style.css | head`.)

- [ ] **Step 8: Verificar sintaxe e validar UI**

Run: `npm run check`
Expected: sem erros de sintaxe.

Validação visual (Playwright MCP ou manual): abrir o painel → Cardápio → Novo item; cada subgrupo da composição mostra checkbox **Obrigatório** + **mín**/**máx**; adicionar ingredientes funciona como antes; salvar e reabrir o item preserva nome/obrigatório/mín/máx/itens. Se sem ferramenta, declarar "check OK, UI não validada".

- [ ] **Step 9: Commit**

```bash
git add public/app.js public/style.css public/admin.html
git commit -m "feat(cardapio): cadastro de obrigatorio/min/max por subgrupo da composicao"
```

---

### Task 3: Projeção pública expõe composição estruturada

**Files:**
- Modify: `src/cardapio-web.js` (`projetarCardapio:34`)
- Test: `test/cardapio-web.test.js`

**Interfaces:**
- Consome: `Grupos.normalizarGrupos` (Task 1) via `require("../public/grupos")`.
- Produces: cada item projetado tem `composicao` = array normalizado (em vez de string).

- [ ] **Step 1: Teste de projeção (falhando)**

Em `test/cardapio-web.test.js`, adicione:

```javascript
test("projetarCardapio: composicao vai estruturada (array normalizado)", () => {
  const cardapio = { categorias: [{ nome: "Marmitas", itens: [
    { id: 1, nome: "Marmitex", preco: 18, composicao: [
      { nome: "Proteínas", obrigatorio: true, min: 1, max: 1, itens: ["Frango", "Carne"] },
      { nome: "Lixo", itens: [] },
    ], opcionais: "Bacon | 3.50" },
  ] }] };
  const p = cardapioWeb.projetarCardapio(cardapio);
  const it = p.categorias[0].itens[0];
  assert.ok(Array.isArray(it.composicao));
  assert.equal(it.composicao.length, 1); // subgrupo vazio descartado
  assert.equal(it.composicao[0].nome, "Proteínas");
  assert.deepEqual(it.opcionais, [{ nome: "Bacon", preco: 3.5 }]); // opcionais inalterado
});
```

(Confirme no topo de `test/cardapio-web.test.js` que existe `const cardapioWeb = require("../src/cardapio-web");` — senão, ajuste a referência ao nome já importado.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/cardapio-web.test.js`
Expected: FAIL — `composicao` ainda é string.

- [ ] **Step 3: Implementar**

Em `src/cardapio-web.js`, no topo (após linha 9), adicione:

```javascript
const grupos = require("../public/grupos"); // normalização da composição (dual-mode)
```

Em `projetarCardapio` (linha ~46), troque:

```javascript
        composicao: item.composicao || "",
```
por:
```javascript
        composicao: grupos.normalizarGrupos(item.composicao),
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/cardapio-web.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cardapio-web.js test/cardapio-web.test.js
git commit -m "feat(cardapio): projecao publica expoe composicao estruturada"
```

---

### Task 4: Recálculo + validação no servidor (web + PDV)

**Files:**
- Modify: `src/cardapio-web.js` (`recalcularItens:62`)
- Modify: `src/pdv.js` (`recalcularVenda:29`)
- Test: `test/cardapio-web.test.js`, `test/pdv.test.js`

**Interfaces:**
- Consome: `grupos.avaliarComposicao(base, escolhas)` (Task 1).
- Produces: cada item normalizado do recálculo ganha `composicao: [{grupo, itens:[nome]}]`. Payload do cliente passa a aceitar `p.composicao = [{grupo, itens:[nome]}]`. Lança `Error` se a composição violar as regras.

- [ ] **Step 1: Testes (falhando) — web**

Em `test/cardapio-web.test.js`, adicione um cardápio com composição e testes:

```javascript
const cardComp = { categorias: [{ nome: "M", itens: [
  { id: 7, nome: "Marmitex", preco: 18, opcionais: "Bacon | 3.50", composicao: [
    { nome: "Proteínas", obrigatorio: true, min: 1, max: 1, itens: ["Frango", "Carne"] },
    { nome: "Principais", obrigatorio: true, min: 1, max: 3, itens: ["Arroz", "Feijão"] },
  ] },
] }] };

test("recalcularItens: escolhas válidas vão para o item (composicao não muda preço)", () => {
  const r = cardapioWeb.recalcularItens(cardComp, [
    { id: 7, qtd: 1, composicao: [
      { grupo: "Proteínas", itens: ["Frango"] },
      { grupo: "Principais", itens: ["Arroz", "Feijão"] },
    ], opcionais: [{ nome: "Bacon", qtd: 1 }] },
  ]);
  assert.equal(r.subtotal, 18 + 3.5); // só o opcional soma
  assert.deepEqual(r.itens[0].composicao, [
    { grupo: "Proteínas", itens: ["Frango"] },
    { grupo: "Principais", itens: ["Arroz", "Feijão"] },
  ]);
});

test("recalcularItens: composição obrigatória ausente lança erro", () => {
  assert.throws(() => cardapioWeb.recalcularItens(cardComp, [
    { id: 7, qtd: 1, composicao: [{ grupo: "Principais", itens: ["Arroz"] }] },
  ]), /Proteínas/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/cardapio-web.test.js`
Expected: FAIL — `composicao` indefinida no item e nenhum erro lançado.

- [ ] **Step 3: Implementar — web**

Em `src/cardapio-web.js`, `recalcularItens` (linha ~84-90), após montar `opcionais` e antes/junto ao `itens.push`, adicione a validação e o campo. Substitua o trecho:

```javascript
    const precoBase = Number(base.preco) || 0;
    const addUnit = opcionais.reduce(function (s, o) { return s + o.preco * o.qtd; }, 0);
    subtotal += (precoBase + addUnit) * qtd;
    itens.push({
      id: base.id, nome: base.nome, preco: precoBase, qtd: qtd,
      opcionais: opcionais, observacao: String((p && p.observacao) || "").slice(0, 200),
    });
```
por:
```javascript
    const aval = grupos.avaliarComposicao(base, p && p.composicao);
    if (!aval.valido) throw new Error(aval.pendencias[0] || ("Composição inválida em " + base.nome + "."));
    const precoBase = Number(base.preco) || 0;
    const addUnit = opcionais.reduce(function (s, o) { return s + o.preco * o.qtd; }, 0);
    subtotal += (precoBase + addUnit) * qtd; // composição é grátis (não soma)
    itens.push({
      id: base.id, nome: base.nome, preco: precoBase, qtd: qtd,
      composicao: aval.selecoes,
      opcionais: opcionais, observacao: String((p && p.observacao) || "").slice(0, 200),
    });
```

- [ ] **Step 4: Testes (falhando) — PDV**

Em `test/pdv.test.js`, adicione ao `cardapio` de teste um item com composição e um teste. Acrescente ao array `itens` da categoria "Espetos":

```javascript
        { id: "m1", nome: "Marmitex", preco: 18, unidade: "un", opcionais: "Bacon | 3.50", composicao: [
          { nome: "Proteínas", obrigatorio: true, min: 1, max: 1, itens: ["Frango", "Carne"] },
        ] },
```

E os testes:

```javascript
test("recalcularVenda: composição válida vai no item, não soma preço", () => {
  const r = recalcularVenda(cardapio, [
    { id: "m1", qtd: 1, composicao: [{ grupo: "Proteínas", itens: ["Frango"] }] },
  ]);
  assert.equal(r.subtotal, 18);
  assert.deepEqual(r.itens[0].composicao, [{ grupo: "Proteínas", itens: ["Frango"] }]);
});

test("recalcularVenda: composição obrigatória ausente lança erro", () => {
  assert.throws(() => recalcularVenda(cardapio, [{ id: "m1", qtd: 1 }]), /Proteínas/);
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `node --test test/pdv.test.js`
Expected: FAIL.

- [ ] **Step 6: Implementar — PDV**

Em `src/pdv.js`, no topo (após linha 9) adicione:

```javascript
const grupos = require("../public/grupos"); // validação da composição
```

Em `recalcularVenda` (linha ~54-61), substitua:

```javascript
    const precoBase = Number(base.preco) || 0;
    const addUnit = opcionais.reduce((s, o) => s + o.preco * o.qtd, 0);
    subtotal += (precoBase + addUnit) * qtd;
    itens.push({
      id: base.id, nome: base.nome, preco: precoBase, qtd,
      unidade: ehKg ? "kg" : "un",
      opcionais, observacao: String((p && p.observacao) || "").slice(0, 200),
    });
```
por:
```javascript
    const aval = grupos.avaliarComposicao(base, p && p.composicao);
    if (!aval.valido) throw new Error(aval.pendencias[0] || ("Composição inválida em " + base.nome + "."));
    const precoBase = Number(base.preco) || 0;
    const addUnit = opcionais.reduce((s, o) => s + o.preco * o.qtd, 0);
    subtotal += (precoBase + addUnit) * qtd; // composição é grátis
    itens.push({
      id: base.id, nome: base.nome, preco: precoBase, qtd,
      unidade: ehKg ? "kg" : "un",
      composicao: aval.selecoes,
      opcionais, observacao: String((p && p.observacao) || "").slice(0, 200),
    });
```

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS (todos). Confirma que os testes antigos (sem composição) seguem passando — itens sem `composicao` resultam em `aval.valido === true` e `composicao: []`.

- [ ] **Step 8: Commit**

```bash
git add src/cardapio-web.js src/pdv.js test/cardapio-web.test.js test/pdv.test.js
git commit -m "feat(cardapio): servidor valida escolhas da composicao (web + pdv)"
```

---

### Task 5: Cardápio web — composição selecionável

**Files:**
- Modify: `public/cardapio.js` (`assinatura:40`, `abrirModal:356`, `confirmarModal:422`, `formatComp:439` → remove, `renderSheet:466`, `renderCheckout:539`, payload `:756`)
- Modify: `public/cardapio.css` (estilos da composição selecionável; remover/ajustar `.cd-modal-comp`)
- Modify: `public/cardapio.html` (incluir `grupos.js` antes de `cardapio.js`, se ausente)

**Interfaces:**
- Consome: `window.Grupos.normalizarGrupos`/`avaliarComposicao` (Task 1); `it.composicao` estruturado (Task 3).
- Produces: linha do carrinho com `composicao: [{grupo, itens}]`; payload do pedido inclui `composicao` por item.

- [ ] **Step 1: Incluir grupos.js**

Em `public/cardapio.html`, garanta `<script src="grupos.js"></script>` antes de `cardapio.js`.

Run: `grep -n "grupos.js\|cardapio.js" public/cardapio.html`
Expected: `grupos.js` antes de `cardapio.js`. (Se faltar, adicionar.)

- [ ] **Step 2: Estado do modal + render dos grupos**

Em `public/cardapio.js`, no bloco do modal (linha ~354), adicione um estado para as escolhas:

```javascript
  var modalItem = null, modalQtd = 1, modalOps = [], modalEscolhas = {}; // modalEscolhas[grupo] = [nome]
```

Em `abrirModal` (linha ~356), inicialize e renderize os grupos. Troque a linha que usa `formatComp`:

```javascript
      (it.composicao ? '<div class="cd-modal-comp">' + esc(formatComp(it.composicao)) + "</div>" : "");
```
por:
```javascript
      "";
    modalEscolhas = {};
    var grps = (window.Grupos ? window.Grupos.normalizarGrupos(it.composicao) : []);
    grps.forEach(function (g) {
      var unico = (g.max === 1);
      var regra = g.obrigatorio
        ? (unico ? "Escolha 1" : "Escolha ao menos " + Math.max(1, g.min))
        : (g.max > 1 ? "Até " + g.max : "Opcional");
      html += '<div class="cd-grp" data-grupo="' + esc(g.nome) + '">' +
        '<div class="cd-grp-cab"><span class="cd-grp-nome">' + esc(g.nome) + '</span>' +
        '<span class="cd-grp-regra' + (g.obrigatorio ? " obrig" : "") + '">' + esc(regra) + '</span></div>';
      g.itens.forEach(function (nome, i) {
        var tipo = unico ? "radio" : "checkbox";
        var id = "grp_" + esc(g.nome).replace(/\W/g, "") + "_" + i;
        html += '<label class="cd-grp-opt"><input type="' + tipo + '" name="' + esc(g.nome) + '" value="' + esc(nome) + '" data-grupo="' + esc(g.nome) + '" data-max="' + g.max + '" /> <span>' + esc(nome) + '</span></label>';
      });
      html += '</div>';
    });
```

(Mantém o bloco de opcionais logo abaixo, inalterado.)

- [ ] **Step 3: Wiring da seleção (após `caixa.innerHTML = html;` ~392)**

Adicione, junto aos outros `querySelectorAll`:

```javascript
    caixa.querySelectorAll(".cd-grp input").forEach(function (inp) {
      inp.addEventListener("change", function () { onEscolhaGrupo(inp); });
    });
```

E crie as funções (perto de `mudarOp`):

```javascript
  function onEscolhaGrupo(inp) {
    var grupo = inp.getAttribute("data-grupo");
    var max = parseInt(inp.getAttribute("data-max"), 10) || 0;
    var caixa = $("cdModalCaixa");
    var marcados = Array.prototype.slice.call(caixa.querySelectorAll('input[data-grupo="' + cssEsc(grupo) + '"]:checked'));
    // checkbox: trava no máx desmarcando o que excede (radio já é único)
    if (inp.type === "checkbox" && max > 1 && marcados.length > max) {
      inp.checked = false;
      marcados = marcados.filter(function (m) { return m !== inp; });
    }
    modalEscolhas[grupo] = marcados.map(function (m) { return m.value; });
    atualizarPrecoModal();
  }
  function cssEsc(s) { return String(s).replace(/"/g, '\\"'); }
```

- [ ] **Step 4: Habilitar/bloquear o botão Adicionar**

Em `atualizarPrecoModal` (linha ~415), no fim, adicione a checagem de validade:

```javascript
  function atualizarPrecoModal() {
    if (!modalItem) return;
    var ops = modalItem.opcionais || [];
    var add = ops.reduce(function (s, o, i) { return s + (Number(o.preco) || 0) * (modalOps[i] || 0); }, 0);
    var btn = $("cdModalAdd");
    btn.textContent = "Adicionar · " + money(((Number(modalItem.preco) || 0) + add) * modalQtd);
    var esc2 = Object.keys(modalEscolhas).map(function (g) { return { grupo: g, itens: modalEscolhas[g] }; });
    var aval = window.Grupos ? window.Grupos.avaliarComposicao(modalItem, esc2) : { valido: true };
    btn.disabled = !aval.valido;
    btn.title = aval.valido ? "" : (aval.pendencias[0] || "");
  }
```

- [ ] **Step 5: Gravar as escolhas na linha do carrinho**

Em `confirmarModal` (linha ~422), inclua a composição:

```javascript
  function confirmarModal() {
    var ops = modalItem.opcionais || [];
    var escolhidos = [];
    ops.forEach(function (o, i) {
      if (modalOps[i] > 0) escolhidos.push({ nome: o.nome, preco: Number(o.preco) || 0, qtd: modalOps[i] });
    });
    var comp = Object.keys(modalEscolhas)
      .map(function (g) { return { grupo: g, itens: modalEscolhas[g] }; })
      .filter(function (c) { return c.itens && c.itens.length; });
    addLinha({
      id: modalItem.id,
      nome: modalItem.nome,
      preco: Number(modalItem.preco) || 0,
      composicao: comp,
      opcionais: escolhidos,
      observacao: ($("cdModalObs").value || "").trim(),
      qtd: modalQtd,
    });
    fechar("modal");
  }
```

- [ ] **Step 6: Assinatura da linha inclui a composição**

Em `assinatura` (linha ~40), para que escolhas diferentes virem linhas diferentes:

```javascript
  function assinatura(l) {
    var comp = (l.composicao || []).map(function (c) { return c.grupo + ":" + (c.itens || []).slice().sort().join("+"); }).sort().join(",");
    return l.id + "|" + comp + "|" + (l.opcionais || []).map(function (o) { return o.nome + ":" + (o.qtd || 1); }).sort().join(",") + "|" + (l.observacao || "");
  }
```

- [ ] **Step 7: Mostrar escolhas no carrinho e no resumo**

Em `renderSheet` (linha ~469), antes da linha de `ops`, adicione a composição:

```javascript
      var comp = (l.composicao || []).length ? '<p class="cd-linha-comp">' + esc(l.composicao.map(function (c) { return c.itens.join(", "); }).join(" · ")) + "</p>" : "";
```
e inclua `comp` no `div.innerHTML` logo após `cd-linha-nome` (antes de `ops`):

```javascript
          '<p class="cd-linha-nome">' + esc(l.nome) + "</p>" + comp + ops + obs +
```

Em `renderCheckout` (linha ~539), dentro do `.map`, antes do bloco de opcionais, acrescente:

```javascript
      if ((l.composicao || []).length) {
        sub += l.composicao.map(function (c) { return '<div class="cd-resumo-add">' + esc(c.grupo) + ": " + esc(c.itens.join(", ")) + "</div>"; }).join("");
      }
```

- [ ] **Step 8: Enviar composição no payload do pedido**

No payload (linha ~756), inclua `composicao`:

```javascript
      itens: carrinho.map(function (l) {
        return { id: l.id, qtd: l.qtd, composicao: (l.composicao || []), opcionais: (l.opcionais || []).map(function (o) { return { nome: o.nome, qtd: o.qtd || 1 }; }), observacao: l.observacao || "" };
      }),
```

- [ ] **Step 9: Remover `formatComp` (morto)**

`formatComp` (linha ~439) não é mais usada. Confirme e remova:

Run: `grep -n "formatComp" public/cardapio.js`
Expected: nenhuma chamada → apagar a função.

- [ ] **Step 10: Estilos da composição selecionável**

Em `public/cardapio.css`, remova/ajuste `.cd-modal-comp` (não há mais composição como texto) e adicione:

```css
.cd-grp { margin: 14px 0; }
.cd-grp-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.cd-grp-nome { font-weight: 600; }
.cd-grp-regra { font-size: 0.78rem; color: var(--cd-muted, #888); }
.cd-grp-regra.obrig { color: var(--cd-accent, #c0392b); }
.cd-grp-opt { display: flex; align-items: center; gap: 10px; padding: 8px 0; cursor: pointer; }
.cd-grp-opt input { width: 18px; height: 18px; }
.cd-linha-comp { font-size: 0.82rem; color: var(--cd-muted, #777); }
```

(Use as variáveis de cor já presentes no `cardapio.css` — confira com `grep -n "\-\-cd-" public/cardapio.css | head`; ajuste os fallbacks se houver nomes próprios.)

- [ ] **Step 11: Verificar sintaxe + validar fluxo**

Run: `npm run check`
Expected: sem erros.

Validação (Playwright MCP/manual no `/c/:slug`): item com composição abre o modal com radio (máx=1) e checkbox (máx>1); checkbox trava no máx; botão **Adicionar** fica desabilitado até os obrigatórios; carrinho/resumo mostram as escolhas; pedido envia e confirma. Sem ferramenta → declarar "check OK, UI não validada".

- [ ] **Step 12: Commit**

```bash
git add public/cardapio.js public/cardapio.css public/cardapio.html
git commit -m "feat(cardapio): cliente seleciona a composicao no cardapio web"
```

---

### Task 6: PDV — composição selecionável no modal de item

**Files:**
- Modify: `public/app.js` (`pdvTileClick:3522`, `abrirPdvItemModal:3537`, `_pdvLerModalItem:3591`, `pdvConfirmarItem:3614`, `renderPdvCarrinho:3625`, payload `:4045`)
- Modify: `public/style.css` (estilos `.pdv-grp*`, perto de `.pdv-ops`)

**Interfaces:**
- Consome: `window.Grupos` (Task 1); `item.composicao` estruturado vindo de `GET /api/cardapio` (o cadastro grava estruturado — Task 2).
- Produces: linha do PDV com `composicao: [{grupo, itens}]`; payload `POST /api/pdv/vender` inclui `composicao`.

- [ ] **Step 1: Abrir modal quando houver composição**

Em `pdvTileClick` (linha ~3522), inclua composição no gatilho de modal:

```javascript
function pdvTileClick(item) {
  const ops = pdvParseOpcionais(item.opcionais);
  const grps = (window.Grupos ? window.Grupos.normalizarGrupos(item.composicao) : []);
  const ehKg = item.unidade === "kg";
  if (ops.length || grps.length || ehKg) { abrirPdvItemModal(item, null); return; }
  const ex = pdvCart.find((l) => l.id === item.id && !l.opcionais.length && !l.observacao && !(l.composicao && l.composicao.length));
  if (ex) ex.qtd += 1;
  else pdvCart.push({ uid: pdvUidSeq++, id: item.id, nome: item.nome, preco: Number(item.preco) || 0, unidade: "un", qtd: 1, composicao: [], opcionais: [], observacao: "" });
  renderPdvCarrinho();
  toast("✓ " + item.nome);
}
```

- [ ] **Step 2: Render dos grupos no modal**

Em `abrirPdvItemModal` (linha ~3537): após `const ops = ...`, adicione `const grps = (window.Grupos ? window.Grupos.normalizarGrupos(item.composicao) : []);` e guarde em `pdvItemCtx`. Troque a atribuição de `pdvItemCtx`:

```javascript
  pdvItemCtx = { item, ops, grps, uid: uid != null ? uid : null, ehKg };
```

Pré-marque escolhas se editando uma linha (após `const opsQtd = ...`):

```javascript
  const escIni = {};
  (linha && Array.isArray(linha.composicao) ? linha.composicao : []).forEach((c) => { escIni[c.grupo] = c.itens || []; });
```

Antes do bloco de opcionais (`if (ops.length) {`), insira o render dos grupos:

```javascript
  grps.forEach((g) => {
    const unico = g.max === 1;
    const regra = g.obrigatorio ? (unico ? "Escolha 1" : "Escolha ao menos " + Math.max(1, g.min)) : (g.max > 1 ? "Até " + g.max : "Opcional");
    html += '<div class="pdv-grp" data-grupo="' + pdvEsc(g.nome) + '"><div class="pdv-grp-cab"><span class="pdv-grp-nome">' + pdvEsc(g.nome) + '</span><span class="pdv-grp-regra' + (g.obrigatorio ? " obrig" : "") + '">' + pdvEsc(regra) + '</span></div>';
    g.itens.forEach((nome) => {
      const marcado = (escIni[g.nome] || []).indexOf(nome) !== -1 ? " checked" : "";
      const tipo = unico ? "radio" : "checkbox";
      html += '<label class="pdv-grp-opt"><input type="' + tipo + '" name="pgrp_' + pdvEsc(g.nome) + '" value="' + pdvEsc(nome) + '" data-grupo="' + pdvEsc(g.nome) + '" data-max="' + g.max + '"' + marcado + ' /> <span>' + pdvEsc(nome) + '</span></label>';
    });
    html += '</div>';
  });
```

No wiring (após `$("pdvItemCaixa").innerHTML = html;` ~3568), adicione:

```javascript
  $("pdvItemCaixa").querySelectorAll(".pdv-grp input").forEach((inp) => inp.addEventListener("change", () => {
    if (inp.type === "checkbox") {
      const max = parseInt(inp.dataset.max, 10) || 0;
      const marc = $("pdvItemCaixa").querySelectorAll('.pdv-grp input[data-grupo="' + inp.dataset.grupo.replace(/"/g, '\\"') + '"]:checked');
      if (max > 1 && marc.length > max) inp.checked = false;
    }
    pdvItemRecalc();
  }));
```

- [ ] **Step 3: Ler as escolhas do modal**

Em `_pdvLerModalItem` (linha ~3591), antes do `return`, leia a composição e inclua no retorno:

```javascript
  const composicao = [];
  ($("pdvItemCaixa").querySelectorAll(".pdv-grp")).forEach((box) => {
    const grupo = box.getAttribute("data-grupo");
    const itens = Array.prototype.slice.call(box.querySelectorAll('input:checked')).map((c) => c.value);
    if (itens.length) composicao.push({ grupo, itens });
  });
  return { item, qtd, composicao, opcionais, observacao, ehKg };
```

- [ ] **Step 4: Validar no confirmar + gravar na linha**

Em `pdvConfirmarItem` (linha ~3614):

```javascript
function pdvConfirmarItem() {
  const { item, qtd, composicao, opcionais, observacao, ehKg } = _pdvLerModalItem();
  if (ehKg && !(qtd > 0)) { toast("Informe o peso.", "erro"); return; }
  const aval = window.Grupos ? window.Grupos.avaliarComposicao(item, composicao) : { valido: true };
  if (!aval.valido) { toast(aval.pendencias[0] || "Complete a composição.", "erro"); return; }
  const linha = { uid: pdvItemCtx.uid != null ? pdvItemCtx.uid : pdvUidSeq++, id: item.id, nome: item.nome, preco: Number(item.preco) || 0, unidade: ehKg ? "kg" : "un", qtd, composicao: aval.selecoes, opcionais, observacao };
  const idx = pdvItemCtx.uid != null ? pdvCart.findIndex((l) => l.uid === pdvItemCtx.uid) : -1;
  if (idx >= 0) pdvCart[idx] = linha; else pdvCart.push(linha);
  fecharPdvItemModal();
  renderPdvCarrinho();
}
```

- [ ] **Step 5: Mostrar escolhas no carrinho do PDV**

Em `renderPdvCarrinho` (linha ~3634), após `opsTxt`, adicione:

```javascript
      const compTxt = (l.composicao || []).map((c) => c.itens.join(", ")).filter(Boolean).join(" · ");
```
e inclua no `div.innerHTML` antes da linha de `opsTxt`:

```javascript
        (compTxt ? '<span class="pdv-linha-ops">' + pdvEsc(compTxt) + "</span>" : "") +
```

- [ ] **Step 6: Enviar composição no payload da venda**

No body do `POST /api/pdv/vender` (linha ~4045):

```javascript
    itens: pdvCart.map((l) => ({ id: l.id, qtd: l.qtd, composicao: (l.composicao || []), opcionais: (l.opcionais || []).map((o) => ({ nome: o.nome, qtd: o.qtd })), observacao: l.observacao })),
```

- [ ] **Step 7: Estilos**

Em `public/style.css`, perto das regras `.pdv-ops`/`.pdv-op`, adicione:

```css
.pdv-grp { margin: 10px 0; }
.pdv-grp-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.pdv-grp-nome { font-weight: 600; }
.pdv-grp-regra { font-size: 0.78rem; color: var(--texto-suave); }
.pdv-grp-regra.obrig { color: var(--perigo, #c0392b); }
.pdv-grp-opt { display: flex; align-items: center; gap: 10px; padding: 6px 0; cursor: pointer; }
.pdv-grp-opt input { width: 18px; height: 18px; }
```

- [ ] **Step 8: Verificar sintaxe + validar**

Run: `npm run check`
Expected: sem erros.

Validação (manual/Playwright na aba PDV, caixa aberto): produto com composição abre modal com seleção; trava de máx; bloqueia confirmar sem obrigatório; venda conclui e o pedido aparece em Pedidos com as escolhas. Sem ferramenta → "check OK, UI não validada".

- [ ] **Step 9: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat(pdv): selecao da composicao no modal de item do PDV"
```

---

### Task 7: Comanda da cozinha imprime as escolhas

**Files:**
- Modify: `public/comanda.js` (`montarCozinha:68`)
- Test: `test/comanda.test.js`

**Interfaces:**
- Consome: item do pedido com `composicao: [{grupo, itens:[nome]}]` (Tasks 4-6).
- Produces: linhas agrupadas por subgrupo na via da cozinha.

- [ ] **Step 1: Teste (falhando)**

Em `test/comanda.test.js`, adicione (use o helper de montagem já presente no arquivo; ajuste o nome do pedido conforme o padrão do teste):

```javascript
test("montarCozinha: imprime as escolhas da composição agrupadas", () => {
  const pedido = { numero: 1, criadoEm: "2026-06-25T12:00:00Z", tipoEntrega: "Retirada", itens: [
    { nome: "Marmitex", qtd: 1, composicao: [
      { grupo: "Proteínas", itens: ["Frango"] },
      { grupo: "Principais", itens: ["Arroz", "Feijão"] },
    ], opcionais: [{ nome: "Bacon", qtd: 1 }] },
  ] };
  const out = Comanda.montarCozinha(pedido, { restaurante: { nome: "X" } });
  assert.match(out, /Proteínas: Frango/);
  assert.match(out, /Principais: Arroz, Feijão/);
  assert.match(out, /\+ Bacon/); // opcional segue como hoje
});
```

(No topo de `test/comanda.test.js`, confirme `const Comanda = require("../public/comanda");`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/comanda.test.js`
Expected: FAIL — composição não é impressa.

- [ ] **Step 3: Implementar**

Em `public/comanda.js`, dentro de `montarCozinha`, no loop dos itens (linha ~79-84), adicione a impressão da composição entre o nome e os opcionais:

```javascript
    itensCoz.forEach((i) => {
      linhas.push((i.qtd || 1) + "x " + (i.nome || ""));
      (i.composicao || []).forEach((c) => {
        if (c && c.itens && c.itens.length) linhas.push("   " + (c.grupo ? c.grupo + ": " : "") + c.itens.join(", "));
      });
      opcionaisLinhas(i.opcionais).forEach((l) => linhas.push(l));
      if (i.observacao && i.observacao.trim()) linhas.push("   Obs: " + i.observacao.trim());
      linhas.push("");
    });
```

(O cupom — `montarCupom` — fica inalterado: composição é grátis e não soma valor.)

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/comanda.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add public/comanda.js test/comanda.test.js
git commit -m "feat(cardapio): comanda da cozinha imprime as escolhas da composicao"
```

---

### Task 8: Documentação

**Files:**
- Modify: `docs/modelo-dados.md`
- Modify: `CLAUDE.md` (só se a menção atual à composição ficar falsa)

**Interfaces:** nenhuma (doc).

- [ ] **Step 1: Atualizar `docs/modelo-dados.md`**

Localize a descrição do item do cardápio (campo `composicao`/`opcionais`) e substitua a descrição de `composicao` como "texto" pelo novo formato estruturado:

```jsonc
"composicao": [
  { "nome": "Proteínas", "obrigatorio": true, "min": 1, "max": 1, "itens": ["Frango", "Carne"] }
]
```
Documente: máx=1 → escolha única; máx>1 → múltipla; `obrigatorio` ⇒ mín ≥ 1; composição é **grátis** (não soma preço); `opcionais` segue como texto `Nome | preço` (inalterado). Documente também o formato das escolhas na linha do pedido: `composicao: [{ grupo, itens:[nome] }]`, e que o servidor valida via `public/grupos.js`.

Run: `grep -n "composicao\|composição" docs/modelo-dados.md`
Expected: as menções refletem o novo formato (sem descrever como "texto/lista de texto").

- [ ] **Step 2: Conferir `CLAUDE.md`**

Run: `grep -n "composi" CLAUDE.md`
Expected: se houver descrição que diga que composição é texto, ajustar para "composição estruturada (subgrupos selecionáveis com regras), helper puro `public/grupos.js`". Se não houver menção desatualizada, não tocar.

- [ ] **Step 3: Commit**

```bash
git add docs/modelo-dados.md CLAUDE.md
git commit -m "docs(cardapio): atualiza modelo de dados da composicao selecionavel"
```

---

## Self-Review

**Cobertura da spec:**
- Cadastro (obrigatório/mín/máx, layout intacto) → Task 2 ✓
- Modelo de dados (composição estruturada; opcionais inalterado; sem migração) → Tasks 1-2 ✓
- Cardápio web selecionável (radio/checkbox, trava máx, botão bloqueado) → Task 5 ✓
- PDV selecionável → Task 6 ✓
- Servidor valida (web + PDV), preço só dos opcionais → Task 4 ✓
- Projeção estruturada → Task 3 ✓
- Pedido guarda escolhas → flui via recalc.itens (Task 4) + `pedidos.salvarPedido` grava `itens` as-is (verificado, sem mudança) ✓
- Comanda cozinha agrupada → Task 7 ✓
- Validação de payload (`validacao.js`) → sem mudança: o limite é por bytes e o array cabe; nenhum novo limite exigido pela spec ✓
- Testes (`test/grupos.test.js` + ajustes) → Tasks 1, 3, 4, 7 ✓
- Docs → Task 8 ✓

**Placeholders:** nenhum "TBD/TODO"; todo passo tem código real.

**Consistência de tipos:** `avaliarComposicao(base, escolhas) → {valido, selecoes, pendencias}` e `normalizarGrupos(composicao) → [{nome,obrigatorio,min,max,itens}]` usados igual em Tasks 3-7. Forma das escolhas `{grupo, itens:[nome]}` consistente em cliente (Tasks 5-6), servidor (Task 4), pedido e comanda (Task 7).

**Nota de ordem:** Tasks 1→4 são a base testável; 5-6 dependem de 1 e 3; 7 depende da forma de saída de 4. Recomendado executar na ordem.
