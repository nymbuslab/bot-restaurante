# Estoque ativo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Controle de estoque ativo por item (estoque + mínimo): baixa automática no pedido, "Esgotado" na vitrine, alerta na lista do painel.

**Architecture:** A lógica pura de estoque (status, validação, baixa) vive num módulo dual-mode `public/estoque.js` (window.Estoque no browser, module.exports no Node), usado pelo painel (lista), pelo servidor (validar + baixar) e pelos testes. Campos no `cardapio` jsonb (sem migration). O servidor é a fonte de verdade: valida antes de salvar, desconta depois.

**Tech Stack:** Node.js CommonJS, Express, HTML/CSS/JS puro, `node:test`, Playwright (validação visual via harness).

## Global Constraints

- **Sem migration:** `estoque`/`estoqueMinimo` no `cardapio` jsonb.
- **Compatibilidade:** `estoque` ausente/null/`""` = item **não controlado** (ilimitado, comportamento atual). Nunca tratar ausente como 0/controlado.
- **Servidor é a fonte de verdade:** validação de over-order/esgotado e baixa rodam no `POST /api/c/:slug/pedido` (único ponto que grava pedido — confirmado: `salvarPedido` só é chamado lá).
- **Não vazar contagem:** a projeção pública expõe só `esgotado` (boolean), nunca o número do estoque.
- **Ícones, nunca emoji.** Selos são chips de texto.
- **CSP estrita:** sem `<script>`/handler inline; só `addEventListener`.
- **Não tocar:** preço/recálculo, fluxo do bot, modelo de `pedidos`, unidade un/kg (etapa 3b).
- **pt-BR** em UI, comentários e mensagens. Escape: `escapar()` no painel, `esc()` na vitrine.

---

## File Structure

- `public/estoque.js` (**criar**) — dual-mode: `temControle`, `statusEstoque`, `validarEstoque`, `aplicarBaixa`.
- `test/estoque.test.js` (**criar**) — testes `node:test`.
- `public/admin.html` (**modificar**) — `<script src="estoque.js">` + campos Estoque/Estoque mínimo no modal.
- `public/app.js` (**modificar**) — ler/gravar os campos + selos na lista.
- `public/style.css` (**modificar**) — `.tag-esgotado`, `.tag-baixo`, `.item-linha-est`.
- `src/cardapio-web.js` (**modificar**) — `projetarCardapio` expõe `esgotado` (via `estoque.statusEstoque`).
- `test/cardapio-web.test.js` (**modificar**) — teste do `esgotado` na projeção.
- `public/cardapio.js` (**modificar**) — card "Esgotado" não adicionável.
- `public/cardapio.css` (**modificar**) — `.cd-card-esgotado*`.
- `src/servidor.js` (**modificar**) — validar + baixar no `POST /api/c/:slug/pedido`.

---

## Task 1: Módulo puro `estoque.js` + testes (TDD)

**Files:**
- Create: `public/estoque.js`
- Test: `test/estoque.test.js`

**Interfaces:**
- Produces:
  - `temControle(item) -> boolean` — `estoque` é número finito (inclui 0); ausente/null/`""` → false.
  - `statusEstoque(item) -> { controlado, esgotado, baixo, quantidade }` — `quantidade` null se não controlado.
  - `validarEstoque(cardapio, itensPayload) -> { ok, erro }` — agrega qtd por id; item controlado: esgotado (0) ou soma > estoque → `{ok:false, erro}`; senão `{ok:true, erro:""}`.
  - `aplicarBaixa(cardapio, itensPayload) -> cardapio` — cópia com `estoque` descontado (trava em 0) dos itens controlados; não muta o original.
  - Browser: `window.Estoque`.

- [ ] **Step 1: Escrever os testes (falham)**

Criar `test/estoque.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../public/estoque");

const card = { categorias: [ { nome: "P", itens: [
  { id: 1, nome: "Livre", preco: 10 },                       // não controlado
  { id: 2, nome: "Cheio", preco: 10, estoque: 10, estoqueMinimo: 3 },
  { id: 3, nome: "Baixo", preco: 10, estoque: 2, estoqueMinimo: 3 },
  { id: 4, nome: "Zerado", preco: 10, estoque: 0, estoqueMinimo: 3 },
] } ] };

test("statusEstoque: não controlado quando estoque ausente/vazio", () => {
  assert.equal(E.statusEstoque({ id: 1 }).controlado, false);
  assert.equal(E.statusEstoque({ id: 1, estoque: "" }).controlado, false);
  assert.equal(E.statusEstoque({ id: 1, estoque: null }).controlado, false);
});
test("statusEstoque: esgotado / baixo / normal", () => {
  assert.deepEqual(E.statusEstoque({ estoque: 0, estoqueMinimo: 3 }), { controlado: true, esgotado: true, baixo: false, quantidade: 0 });
  assert.deepEqual(E.statusEstoque({ estoque: 2, estoqueMinimo: 3 }), { controlado: true, esgotado: false, baixo: true, quantidade: 2 });
  assert.deepEqual(E.statusEstoque({ estoque: 10, estoqueMinimo: 3 }), { controlado: true, esgotado: false, baixo: false, quantidade: 10 });
});
test("validarEstoque: esgotado e over-order rejeitam; agrega linhas", () => {
  assert.equal(E.validarEstoque(card, [{ id: 4, qtd: 1 }]).ok, false);          // esgotado
  assert.match(E.validarEstoque(card, [{ id: 4, qtd: 1 }]).erro, /esgotado/i);
  assert.equal(E.validarEstoque(card, [{ id: 3, qtd: 3 }]).ok, false);          // 3 > 2
  assert.match(E.validarEstoque(card, [{ id: 3, qtd: 3 }]).erro, /Restam só 2/);
  assert.equal(E.validarEstoque(card, [{ id: 2, qtd: 6 }, { id: 2, qtd: 6 }]).ok, false); // 12 > 10 agregado
});
test("validarEstoque: item não controlado e pedido válido passam", () => {
  assert.equal(E.validarEstoque(card, [{ id: 1, qtd: 999 }]).ok, true);
  assert.equal(E.validarEstoque(card, [{ id: 2, qtd: 10 }]).ok, true);
});
test("aplicarBaixa: desconta, trava em 0, agrega, não muta o original e ignora não controlado", () => {
  const out = E.aplicarBaixa(card, [{ id: 2, qtd: 4 }, { id: 3, qtd: 5 }, { id: 1, qtd: 2 }]);
  const itens = out.categorias[0].itens;
  assert.equal(itens[1].estoque, 6);   // 10 - 4
  assert.equal(itens[2].estoque, 0);   // 2 - 5 → trava em 0
  assert.equal(itens[0].estoque, undefined); // não controlado intacto
  assert.equal(card.categorias[0].itens[1].estoque, 10); // original não mutado
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — `Cannot find module '../public/estoque'`.

- [ ] **Step 3: Implementar `public/estoque.js`**

```js
// ============================================================
// Estoque do cardápio — lógica pura e testável.
// temControle: o item tem estoque finito (inclui 0)? ausente/""/null = ilimitado.
// statusEstoque: { controlado, esgotado, baixo, quantidade } para selos do painel.
// validarEstoque: o pedido cabe no estoque? (servidor — fonte de verdade)
// aplicarBaixa: desconta o estoque do cardápio após o pedido (cópia, não muta).
// Dual-mode: window.Estoque no browser, module.exports no Node.
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.Estoque = api;
})(this, function () {
  function temControle(item) {
    return !!item && item.estoque !== undefined && item.estoque !== null && item.estoque !== "";
  }
  function statusEstoque(item) {
    if (!temControle(item)) return { controlado: false, esgotado: false, baixo: false, quantidade: null };
    const q = Math.max(0, parseInt(item.estoque, 10) || 0);
    const min = Math.max(0, parseInt(item.estoqueMinimo, 10) || 0);
    return { controlado: true, esgotado: q === 0, baixo: q > 0 && q <= min, quantidade: q };
  }
  // Soma a quantidade pedida por id (mesmo item em linhas diferentes do carrinho).
  function _agregar(itensPayload) {
    const ped = {};
    (itensPayload || []).forEach(function (p) {
      if (p && p.id != null) ped[p.id] = (ped[p.id] || 0) + Math.max(1, parseInt(p.qtd, 10) || 1);
    });
    return ped;
  }
  function _mapaItens(cardapio) {
    const mapa = {};
    ((cardapio && cardapio.categorias) || []).forEach(function (c) {
      ((c && c.itens) || []).forEach(function (it) { if (it) mapa[it.id] = it; });
    });
    return mapa;
  }
  function validarEstoque(cardapio, itensPayload) {
    const mapa = _mapaItens(cardapio);
    const ped = _agregar(itensPayload);
    for (const id in ped) {
      const base = mapa[id];
      if (!base) continue;
      const st = statusEstoque(base);
      if (!st.controlado) continue;
      if (st.quantidade === 0) return { ok: false, erro: base.nome + " está esgotado." };
      if (ped[id] > st.quantidade) return { ok: false, erro: "Restam só " + st.quantidade + " unidades de " + base.nome + "." };
    }
    return { ok: true, erro: "" };
  }
  function aplicarBaixa(cardapio, itensPayload) {
    const ped = _agregar(itensPayload);
    const categorias = ((cardapio && cardapio.categorias) || []).map(function (c) {
      return Object.assign({}, c, {
        itens: ((c && c.itens) || []).map(function (it) {
          if (!it || !temControle(it) || !ped[it.id]) return it;
          const q = Math.max(0, parseInt(it.estoque, 10) || 0);
          return Object.assign({}, it, { estoque: Math.max(0, q - ped[it.id]) });
        }),
      });
    });
    return Object.assign({}, cardapio, { categorias: categorias });
  }
  return { temControle: temControle, statusEstoque: statusEstoque, validarEstoque: validarEstoque, aplicarBaixa: aplicarBaixa };
});
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS (todos os testes novos + a suíte existente).

- [ ] **Step 5: Commit**

```bash
git add public/estoque.js test/estoque.test.js
git commit -m "feat(cardapio): modulo puro de estoque (status/validar/baixar) + testes"
```

---

## Task 2: Campos de estoque no modal do item

**Files:**
- Modify: `public/admin.html` (script tag + campos no modal, após a `.linha` dos toggles ~linha 885-886)
- Modify: `public/app.js` (`abrirEditorItem` ~1048-1066, `salvarEditorItem` ~1127-1137)

**Interfaces:**
- Consumes: nada novo (campos opcionais gravados no jsonb via `PUT /api/cardapio`).
- Produces: item passa a ter `estoque`/`estoqueMinimo` (números) quando preenchidos; omitidos quando vazios.

- [ ] **Step 1: Carregar `estoque.js` no `admin.html`**

Localizar `<script src="busca.js"></script>` e adicionar logo abaixo:

```html
  <script src="estoque.js"></script>
```

(Antes de `app.js`.)

- [ ] **Step 2: Campos no modal (`admin.html`)**

Após o parágrafo `<p class="editor-dica" id="editor-entrega-dica">...</p>` (linha 886), inserir:

```html
          <div class="linha">
            <div class="campo"><label for="editor-estoque">Estoque</label><input type="text" inputmode="numeric" id="editor-estoque" placeholder="ilimitado" /></div>
            <div class="campo"><label for="editor-estoque-min">Estoque mínimo</label><input type="text" inputmode="numeric" id="editor-estoque-min" placeholder="0" /></div>
          </div>
```

- [ ] **Step 3: Ler os campos ao abrir (`app.js` `abrirEditorItem`)**

No ramo **novo item** (após `$("editor-entrega").checked = true;`):

```js
    $("editor-estoque").value = "";
    $("editor-estoque-min").value = "";
```

No ramo **item existente** (após `$("editor-entrega").checked = it.apenasLocal !== true;`):

```js
    $("editor-estoque").value = it.estoque != null ? it.estoque : "";
    $("editor-estoque-min").value = it.estoqueMinimo != null ? it.estoqueMinimo : "";
```

- [ ] **Step 4: Gravar os campos ao salvar (`app.js` `salvarEditorItem`)**

Logo **após** o objeto `novoItem` ser montado (após o `};` que fecha `const novoItem = {...}`), adicionar:

```js
  const estoqueRaw = $("editor-estoque").value.trim();
  const estoqueMinRaw = $("editor-estoque-min").value.trim();
  if (estoqueRaw !== "") novoItem.estoque = Math.max(0, parseInt(estoqueRaw, 10) || 0);
  if (estoqueMinRaw !== "") novoItem.estoqueMinimo = Math.max(0, parseInt(estoqueMinRaw, 10) || 0);
```

> Campo vazio = omite a chave → item volta a "não controlado". `novoItem` é montado do zero a cada save, então limpar o campo realmente remove o controle.

- [ ] **Step 5: Validar sintaxe**

Run: `npm run check`
Expected: `OK: ... arquivos sem erro de sintaxe.`

- [ ] **Step 6: Commit**

```bash
git add public/admin.html public/app.js
git commit -m "feat(cardapio): campos Estoque e Estoque minimo no modal do item"
```

---

## Task 3: Selos de estoque na lista

**Files:**
- Modify: `public/app.js` (`renderCardapio`, corpo da linha ~943-949)
- Modify: `public/style.css`

**Interfaces:**
- Consumes: `window.Estoque.statusEstoque` (Task 1).

- [ ] **Step 1: Calcular e renderizar o selo (`app.js` `renderCardapio`)**

Dentro do `cat.itens.forEach`/`itensCat.forEach`, **antes** de `linha.innerHTML = \`...\``, adicionar o cálculo (perto de `const dispTxt = ...`):

```js
      const est = Estoque.statusEstoque(item);
      const estTag = !est.controlado ? ""
        : est.esgotado ? `<span class="item-linha-tag tag-esgotado">Esgotado</span>`
        : est.baixo ? `<span class="item-linha-tag tag-baixo">Baixo</span>`
        : `<span class="item-linha-est">Est. ${est.quantidade}</span>`;
```

No `.item-linha-titulo`, após a tag de `apenasLocal`:

```js
          <span class="item-linha-titulo">
            <span class="item-linha-nome">${escapar(item.nome) || "(sem nome)"}</span>
            ${item.apenasLocal ? `<span class="item-linha-tag">Só no local</span>` : ""}
            ${estTag}
          </span>
```

- [ ] **Step 2: Estilos (`style.css`)** — perto de `.item-linha-tag`:

```css
.item-linha-tag.tag-esgotado { color: var(--error); background: var(--error-subtle, rgba(239,68,68,0.12)); border-color: rgba(239,68,68,0.30); }
.item-linha-tag.tag-baixo { color: var(--warning, #EAB308); background: rgba(234,179,8,0.12); border-color: rgba(234,179,8,0.30); }
.item-linha-est { flex: none; font-size: 11px; font-weight: 600; color: var(--text-secondary); }
```

- [ ] **Step 3: Validar sintaxe**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 4: Validação visual (harness)**

Criar `public/_harness-estoque.html` (carrega `style.css`, `dinheiro.js`, `estoque.js`) que renderiza 4 linhas (não controlado / normal "Est. 10" / baixo / esgotado) com o HTML do Step 1. Servir e screenshotar (desktop). Conferir os 3 selos + "Est. N" + linha sem selo. Remover harness + screenshot ao fim.

- [ ] **Step 5: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat(cardapio): selos Esgotado/Baixo/Est. N na lista de itens"
```

---

## Task 4: Projeção `esgotado` + "Esgotado" na vitrine

**Files:**
- Modify: `src/cardapio-web.js` (`projetarCardapio` ~39-48; require do módulo)
- Test: `test/cardapio-web.test.js`
- Modify: `public/cardapio.js` (`cardItem` ~163-182)
- Modify: `public/cardapio.css`

**Interfaces:**
- Consumes: `estoque.statusEstoque` (Task 1) no servidor; `it.esgotado` na vitrine.
- Produces: projeção pública com `esgotado` (boolean), sem o número do estoque.

- [ ] **Step 1: Require do módulo em `cardapio-web.js`**

No topo (junto dos outros `require`), adicionar:

```js
const estoque = require("../public/estoque");
```

- [ ] **Step 2: Expor `esgotado` na projeção (`projetarCardapio`)**

No objeto projetado, após `apenasLocal: item.apenasLocal === true,`:

```js
        esgotado: estoque.statusEstoque(item).esgotado,
```

- [ ] **Step 3: Teste da projeção (`test/cardapio-web.test.js`)** — adicionar:

```js
test("projetarCardapio: expõe esgotado e NÃO expõe a contagem de estoque", () => {
  const cru = { categorias: [ { nome: "P", itens: [
    { id: 1, nome: "Z", preco: 10, disponivel: true, estoque: 0 },
    { id: 2, nome: "C", preco: 10, disponivel: true, estoque: 5 },
    { id: 3, nome: "L", preco: 10, disponivel: true },
  ] } ] };
  const itens = cw.projetarCardapio(cru).categorias[0].itens;
  assert.equal(itens[0].esgotado, true);
  assert.equal(itens[1].esgotado, false);
  assert.equal(itens[2].esgotado, false);
  assert.equal("estoque" in itens[0], false); // não vaza a contagem
});
```

- [ ] **Step 4: Card "Esgotado" não adicionável (`public/cardapio.js` `cardItem`)**

Reescrever `cardItem` para tratar `it.esgotado`:

```js
  function cardItem(it) {
    var card = document.createElement(it.esgotado ? "div" : "button");
    if (!it.esgotado) card.type = "button";
    card.className = "cd-card" + (it.esgotado ? " cd-card-esgotado" : "");
    var img = it.imagem
      ? '<img class="cd-card-img" src="' + esc(it.imagem) + '" alt="" loading="lazy" />'
      : '<div class="cd-card-img vazia" aria-hidden="true"></div>';
    card.innerHTML =
      img +
      '<div class="cd-card-corpo">' +
        '<h3 class="cd-card-nome">' + esc(it.nome) + "</h3>" +
        (it.esgotado ? '<span class="cd-card-esgotado-tag">Esgotado</span>' : "") +
        (it.apenasLocal ? '<span class="cd-card-local">Só no local</span>' : "") +
        (it.desc ? '<p class="cd-card-desc">' + esc(it.desc) + "</p>" : "") +
        '<div class="cd-card-rodape">' +
          '<span class="cd-card-preco">' + money(it.preco) + "</span>" +
          (it.esgotado ? "" : '<span class="cd-add">+ Adicionar</span>') +
        "</div>" +
      "</div>";
    if (!it.esgotado) card.addEventListener("click", function () { abrirModal(it); });
    return card;
  }
```

> O placeholder de imagem vazia perdeu o emoji 🍽 (regra: sem emoji). Mantém só o `div.cd-card-img.vazia`.

- [ ] **Step 5: Estilos (`public/cardapio.css`)** — perto de `.cd-card-local`:

```css
.cd-card-esgotado { opacity: 0.55; cursor: default; }
.cd-card-esgotado-tag {
  align-self: flex-start; margin-top: 4px;
  font-size: 11px; font-weight: 600; line-height: 1;
  padding: 3px 8px; border-radius: 999px;
  color: var(--error); background: var(--error-subtle); border: 1px solid rgba(239,68,68,0.30);
}
```

- [ ] **Step 6: Validar sintaxe + testes**

Run: `npm run check && npm test`
Expected: PASS.

- [ ] **Step 7: Validação visual (harness)**

Criar `public/_harness-vitrine-estoque.html` (carrega `cardapio.css`) com dois `.cd-card`: um normal e um `cd-card-esgotado` (com selo "Esgotado", sem "+ Adicionar"). Servir + screenshot. Conferir card esgotado acinzentado/sem adicionar. Remover ao fim.

- [ ] **Step 8: Commit**

```bash
git add src/cardapio-web.js test/cardapio-web.test.js public/cardapio.js public/cardapio.css
git commit -m "feat(cardapio): vitrine mostra Esgotado e bloqueia adicionar"
```

---

## Task 5: Validação + baixa no servidor

**Files:**
- Modify: `src/servidor.js` (require ~29; `POST /api/c/:slug/pedido`: validação após só-local ~667, baixa após salvar ~693)

**Interfaces:**
- Consumes: `estoque.validarEstoque`, `estoque.aplicarBaixa` (Task 1); `store.getCardapio` (sync), `store.setCardapio` (async).

- [ ] **Step 1: Require do módulo (`servidor.js`)**

Verificar que não há identificador `estoque` em conflito:
Run: `grep -nE "\b(const|let|var)\s+estoque\b" src/servidor.js` → Expected: nenhum resultado.

Adicionar após `const cardapioWeb = require("./cardapio-web");` (linha 29):

```js
const estoque = require("../public/estoque");
```

- [ ] **Step 2: Validar estoque antes de salvar**

No `POST /api/c/:slug/pedido`, logo **após** o bloco do só-local (a chave `}` que fecha o `if (tipoEntrega === "Entrega")` da etapa 2, ~linha 667), inserir:

```js
    // Estoque ativo: rejeita esgotado / pedido maior que o disponível (fonte de verdade).
    const estCheck = estoque.validarEstoque(store.getCardapio(dir), b.itens);
    if (!estCheck.ok) return res.status(400).json({ erro: estCheck.erro });
```

- [ ] **Step 3: Dar baixa após salvar**

Logo **após** `const pedido = await pedidos.salvarPedido(dir, {...});` (a linha que fecha esse `await`, ~693), inserir (best-effort — o pedido já está salvo):

```js
    // Baixa de estoque (best-effort: relê o cardápio fresco, desconta e persiste).
    try {
      await store.setCardapio(dir, estoque.aplicarBaixa(store.getCardapio(dir), b.itens));
    } catch (e) { console.error("baixa de estoque:", e.message); }
```

- [ ] **Step 4: Validar sintaxe + testes**

Run: `npm run check && npm test`
Expected: PASS.

- [ ] **Step 5: Validação da regra (servidor local, sem tocar produção)**

Os testes de unidade da Task 1 já cobrem `validarEstoque`/`aplicarBaixa`. Smoke opcional: `node -e` chamando `require('./public/estoque').validarEstoque(...)` com um cardápio em memória (esgotado → ok:false; normal → ok:true). Não criar arquivo permanente.

- [ ] **Step 6: Commit**

```bash
git add src/servidor.js
git commit -m "feat(cardapio): servidor valida e baixa estoque no pedido do cardapio web"
```

---

## Notas de execução

- **Ordem de scripts** em `admin.html`: `dinheiro.js` → `busca.js` → `estoque.js` → `app.js`. `Estoque` precisa existir antes de `renderCardapio`.
- **Servir estáticos p/ Playwright:** `npx http-server` na pasta `public` (background que persista), navegar `http://127.0.0.1:<porta>/...`. Encerrar (TaskStop) e remover `_harness-*.html`/screenshots antes de cada commit. `.playwright-mcp/` já está no `.gitignore`.
- **Compatibilidade:** ao validar o modal, abrir um item **antigo** (sem `estoque`) deve deixar os campos **vazios** (não controlado), e a lista/vitrine não mostram selo de estoque.
- **PROGRESSO.md:** ao concluir, fechar via `concluir-tarefa` (fora do escopo deste plano).
```
