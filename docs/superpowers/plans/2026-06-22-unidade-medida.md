# Unidade de medida (un/kg) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Item pode ser vendido por unidade (un) ou peso (kg). Item kg mostra "R$ X/kg", estoque em kg, é informativo na vitrine (não-adicionável) e nunca entra em pedido.

**Architecture:** Campo `unidade` no item (jsonb). Helpers puros de estoque passam a respeitar a unidade (decimal no kg) + formatador. Servidor rejeita kg no recálculo e expõe `unidade` na projeção. Modal ganha o seletor; lista e vitrine exibem a unidade dinâmica.

**Tech Stack:** Node.js CommonJS, HTML/CSS/JS puro, node:test, Playwright (harness).

## Global Constraints

- **Sem migration:** `unidade` no jsonb. Ausente/`'un'` = unidade (default). Gravar só quando kg.
- **kg não é pedível:** servidor rejeita item kg no recálculo; vitrine mostra não-adicionável.
- **kg não baixa estoque** (não entra em pedido) — estoque do kg é manual/informativo, decimal.
- **Ícones, nunca emoji.** CSP estrita. pt-BR. Escape: `escapar()` (painel), `esc()` (vitrine).
- Itens **un** seguem idênticos ao atual.

---

## File Structure

- `public/estoque.js` (**mod**) — `statusEstoque` respeita unidade + `formatarQtd`.
- `test/estoque.test.js` (**mod**) — testes (e atualizar deepEqual com `unidade`/`minimo`).
- `src/cardapio-web.js` (**mod**) — `recalcularItens` rejeita kg; `projetarCardapio` expõe `unidade`.
- `test/cardapio-web.test.js` (**mod**) — testes do kg.
- `public/admin.html` (**mod**) — seletor Unidade + microtexto kg.
- `public/app.js` (**mod**) — modal (abrir/salvar/troca de unidade) + células da lista dinâmicas.
- `public/cardapio.js` (**mod**) — vitrine: kg "/kg" + "Pesado no balcão" + não-adicionável.
- `public/cardapio.css` / `public/style.css` (**mod**) — chip "no balcão", sufixo "/kg".

---

## Task 1: Helpers de estoque respeitam unidade (TDD)

**Files:**
- Modify: `public/estoque.js` (`statusEstoque` + novo `formatarQtd` + export)
- Test: `test/estoque.test.js`

- [ ] **Step 1: Atualizar/escrever os testes**

Atualizar os deepEqual existentes de `statusEstoque` para incluir `minimo` e `unidade`:
```js
test("statusEstoque: esgotado / baixo / normal", () => {
  assert.deepEqual(E.statusEstoque({ estoque: 0, estoqueMinimo: 3 }), { controlado: true, esgotado: true, baixo: false, quantidade: 0, minimo: 3, unidade: "un" });
  assert.deepEqual(E.statusEstoque({ estoque: 2, estoqueMinimo: 3 }), { controlado: true, esgotado: false, baixo: true, quantidade: 2, minimo: 3, unidade: "un" });
  assert.deepEqual(E.statusEstoque({ estoque: 10, estoqueMinimo: 3 }), { controlado: true, esgotado: false, baixo: false, quantidade: 10, minimo: 3, unidade: "un" });
});
```
Adicionar testes novos:
```js
test("statusEstoque: kg parseia decimal e devolve unidade kg", () => {
  const s = E.statusEstoque({ estoque: "12,5", estoqueMinimo: "2", unidade: "kg" });
  assert.equal(s.unidade, "kg");
  assert.equal(s.quantidade, 12.5);
  assert.equal(s.minimo, 2);
  assert.equal(s.baixo, false);
});
test("formatarQtd: un inteiro, kg decimal BR", () => {
  assert.equal(E.formatarQtd(120, "un"), "120");
  assert.equal(E.formatarQtd(12.5, "kg"), "12,5");
  assert.equal(E.formatarQtd(12, "kg"), "12");
});
```

- [ ] **Step 2: Rodar e confirmar a falha** — `npm test` → FAIL (shape/`formatarQtd`).

- [ ] **Step 3: Implementar (`public/estoque.js`)**

Substituir `statusEstoque` e adicionar `formatarQtd`:
```js
  function statusEstoque(item) {
    if (!temControle(item)) return { controlado: false, esgotado: false, baixo: false, quantidade: null, minimo: 0, unidade: "un" };
    const ehKg = item.unidade === "kg";
    const num = function (v) {
      return ehKg ? (parseFloat(String(v).replace(",", ".")) || 0) : (parseInt(v, 10) || 0);
    };
    const q = Math.max(0, num(item.estoque));
    const min = Math.max(0, num(item.estoqueMinimo));
    return { controlado: true, esgotado: q === 0, baixo: q > 0 && q <= min, quantidade: q, minimo: min, unidade: ehKg ? "kg" : "un" };
  }
  function formatarQtd(q, unidade) {
    const n = Number(q) || 0;
    if (unidade === "kg") return n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
    return String(Math.round(n));
  }
```
Atualizar o `return` do módulo, adicionando `formatarQtd`:
```js
  return { temControle: temControle, statusEstoque: statusEstoque, formatarQtd: formatarQtd, validarEstoque: validarEstoque, aplicarBaixa: aplicarBaixa };
```

- [ ] **Step 4: Rodar e confirmar que passa** — `npm test` → PASS.

- [ ] **Step 5: Commit**
```bash
git add public/estoque.js test/estoque.test.js
git commit -m "feat(cardapio): estoque respeita unidade (decimal no kg) + formatarQtd"
```

---

## Task 2: kg não é pedível + projeção expõe unidade (TDD)

**Files:**
- Modify: `src/cardapio-web.js` (`recalcularItens` ~61, `projetarCardapio` ~39-48)
- Test: `test/cardapio-web.test.js`

- [ ] **Step 1: Testes (falham)** — adicionar:
```js
test("recalcularItens: item por kg não é pedível", () => {
  const card = { categorias: [ { nome: "P", itens: [
    { id: 7, nome: "Buffet", preco: 60, disponivel: true, unidade: "kg" },
  ] } ] };
  assert.throws(() => cw.recalcularItens(card, [{ id: 7, qtd: 1 }]), /indispon/i);
});
test("projetarCardapio: item kg fica na projeção e expõe unidade", () => {
  const cru = { categorias: [ { nome: "P", itens: [
    { id: 1, nome: "Kg", preco: 60, disponivel: true, unidade: "kg" },
    { id: 2, nome: "Un", preco: 10, disponivel: true },
  ] } ] };
  const itens = cw.projetarCardapio(cru).categorias[0].itens;
  assert.equal(itens.length, 2);
  assert.equal(itens[0].unidade, "kg");
  assert.equal(itens[1].unidade, "un");
});
```

- [ ] **Step 2: Rodar e confirmar a falha** — `npm test` → FAIL.

- [ ] **Step 3: Implementar**

`recalcularItens`, trocar o filtro do mapa:
```js
      if (it && it.disponivel !== false && it.arquivado !== true && it.unidade !== "kg") mapa[it.id] = it;
```
`projetarCardapio`, no objeto projetado, após `esgotado: ...`:
```js
        unidade: item.unidade === "kg" ? "kg" : "un",
```

> A projeção **não** exclui kg (continua visível); só `recalcularItens` o rejeita.

- [ ] **Step 4: Rodar e confirmar que passa** — `npm test` → PASS (atualizar o deepEqual de projeção da etapa 2/3a se ele comparar o objeto inteiro: agora os itens ganham `unidade`).

> O teste `projetarCardapio: só campos públicos...` faz `deepEqual` do item — adicionar `unidade: "un"` ao objeto esperado.

- [ ] **Step 5: Commit**
```bash
git add src/cardapio-web.js test/cardapio-web.test.js
git commit -m "feat(cardapio): item kg fica na vitrine mas nao e pedivel (projecao expoe unidade)"
```

---

## Task 3: Seletor de unidade no modal

**Files:**
- Modify: `public/admin.html` (na `.linha` de estoque ~887-890; microtexto)
- Modify: `public/app.js` (`abrirEditorItem` ~1136-1149, `salvarEditorItem` ~1225-1228, listener de troca)

- [ ] **Step 1: Markup (`admin.html`)** — trocar a `.linha` dos campos de estoque por uma com Unidade + Estoque + Mínimo, e adicionar o microtexto:
```html
          <div class="linha">
            <div class="campo"><label for="editor-unidade">Unidade</label><select id="editor-unidade"><option value="un">Unidade (un)</option><option value="kg">Peso (kg)</option></select></div>
            <div class="campo"><label for="editor-estoque">Estoque</label><input type="text" inputmode="decimal" id="editor-estoque" placeholder="ilimitado" /></div>
            <div class="campo"><label for="editor-estoque-min">Estoque mínimo</label><input type="text" inputmode="decimal" id="editor-estoque-min" placeholder="0" /></div>
          </div>
          <p class="editor-dica" id="editor-kg-dica" hidden>Item por kg: aparece no cardápio com o preço por kg e é vendido só no local (pesado no balcão) — não entra em pedido online.</p>
```

- [ ] **Step 2: Função de UI da unidade (`app.js`)** — adicionar perto do editor:
```js
function aplicarUnidadeEditor() {
  const kg = $("editor-unidade").value === "kg";
  $("editor-kg-dica").hidden = !kg;
  $("editor-entrega").disabled = kg; // item kg não é pedível → entrega não se aplica
}
```
Listener fixo (junto dos outros do editor):
```js
$("editor-unidade").addEventListener("change", aplicarUnidadeEditor);
```

- [ ] **Step 3: Ler ao abrir (`abrirEditorItem`)**
- Novo item (após `$("editor-estoque-min").value = "";`):
```js
    $("editor-unidade").value = "un";
```
- Item existente (após as duas linhas de estoque):
```js
    $("editor-unidade").value = it.unidade === "kg" ? "kg" : "un";
```
- Ao fim de `abrirEditorItem` (antes de abrir o overlay, junto de `renderEditor*`):
```js
  aplicarUnidadeEditor();
```

- [ ] **Step 4: Gravar ao salvar (`salvarEditorItem`)** — trocar o bloco de parse do estoque:
```js
  const unidade = $("editor-unidade").value === "kg" ? "kg" : "un";
  if (unidade === "kg") novoItem.unidade = "kg";
  const estoqueRaw = $("editor-estoque").value.trim();
  const estoqueMinRaw = $("editor-estoque-min").value.trim();
  const parseEst = (s) => unidade === "kg" ? (parseFloat(s.replace(",", ".")) || 0) : (parseInt(s, 10) || 0);
  if (estoqueRaw !== "") novoItem.estoque = Math.max(0, parseEst(estoqueRaw));
  if (estoqueMinRaw !== "") novoItem.estoqueMinimo = Math.max(0, parseEst(estoqueMinRaw));
```

- [ ] **Step 5: Sintaxe** — `npm run check` → OK.

- [ ] **Step 6: Commit**
```bash
git add public/admin.html public/app.js
git commit -m "feat(cardapio): seletor de unidade (un/kg) no modal do item"
```

---

## Task 4: Unidade dinâmica na lista

**Files:**
- Modify: `public/app.js` (`renderCardapio`: `celEst`/`celMin` ~1005-1010, preço ~1024)
- Modify: `public/style.css` (sufixo "/kg")

- [ ] **Step 1: Células dinâmicas (`renderCardapio`)** — trocar `celEst`/`celMin`:
```js
      const un = est.unidade;
      const celEst = !est.controlado
        ? `<span class="il-vazio">—</span>`
        : `<span class="il-est ${est.esgotado ? "il-est--zero" : est.baixo ? "il-est--baixo" : "il-est--ok"}">${Estoque.formatarQtd(est.quantidade, un)}<span class="un">${un}</span></span>${est.esgotado ? `<span class="il-chip il-chip--zero">Esgotado</span>` : est.baixo ? `<span class="il-chip il-chip--baixo">Baixo</span>` : ""}`;
      const celMin = !est.controlado
        ? `<span class="il-vazio">—</span>`
        : `<span class="il-min">${Estoque.formatarQtd(est.minimo, un)}<span class="un">${un}</span></span>`;
```

- [ ] **Step 2: Preço com /kg** — trocar a célula de preço:
```js
        <span class="il-preco il-cel" data-label="Preço"><span class="il-cel-val">R$ ${moedaBR(item.preco)}${item.unidade === "kg" ? `<span class="il-un-preco">/kg</span>` : ""}</span></span>
```

- [ ] **Step 3: Estilo (`style.css`)** — perto de `.il-preco`:
```css
.il-un-preco { font-weight: 500; color: var(--text-secondary); font-size: 12px; }
```

- [ ] **Step 4: Sintaxe** — `npm run check` → OK.

- [ ] **Step 5: Validação visual (harness)** — harness reusando `style.css`+`estoque.js` com um item un e um kg (preço "R$ 59,90/kg", estoque "12,5 kg"). Screenshot desktop. Remover ao fim.

- [ ] **Step 6: Commit**
```bash
git add public/app.js public/style.css
git commit -m "feat(cardapio): unidade dinamica (un/kg) na tabela de itens"
```

---

## Task 5: Vitrine — item kg informativo, não-adicionável

**Files:**
- Modify: `public/cardapio.js` (`cardItem` ~163-182)
- Modify: `public/cardapio.css`

- [ ] **Step 1: `cardItem` trata kg** — reescrever para `naoAdd = esgotado || kg`:
```js
  function cardItem(it) {
    var kg = it.unidade === "kg";
    var naoAdd = it.esgotado || kg;
    var card = document.createElement(naoAdd ? "div" : "button");
    if (!naoAdd) card.type = "button";
    card.className = "cd-card" + (it.esgotado ? " cd-card-esgotado" : "") + (kg && !it.esgotado ? " cd-card-kg" : "");
    var img = it.imagem
      ? '<img class="cd-card-img" src="' + esc(it.imagem) + '" alt="" loading="lazy" />'
      : '<div class="cd-card-img vazia" aria-hidden="true"></div>';
    var nota = it.esgotado
      ? '<span class="cd-card-esgotado-tag">Esgotado</span>'
      : (kg ? '<span class="cd-card-balcao-tag">Pesado no balcão</span>' : "");
    card.innerHTML =
      img +
      '<div class="cd-card-corpo">' +
        '<h3 class="cd-card-nome">' + esc(it.nome) + "</h3>" +
        nota +
        (it.apenasLocal ? '<span class="cd-card-local">Só no local</span>' : "") +
        (it.desc ? '<p class="cd-card-desc">' + esc(it.desc) + "</p>" : "") +
        '<div class="cd-card-rodape">' +
          '<span class="cd-card-preco">' + money(it.preco) + (kg ? "/kg" : "") + "</span>" +
          (naoAdd ? "" : '<span class="cd-add">+ Adicionar</span>') +
        "</div>" +
      "</div>";
    if (!naoAdd) card.addEventListener("click", function () { abrirModal(it); });
    return card;
  }
```

- [ ] **Step 2: Estilo (`cardapio.css`)** — perto de `.cd-card-esgotado-tag`:
```css
.cd-card-balcao-tag {
  align-self: flex-start; margin-top: 4px;
  font-size: 11px; font-weight: 600; line-height: 1;
  padding: 3px 8px; border-radius: 999px;
  color: var(--secondary); background: var(--secondary-subtle, rgba(115,210,230,0.14)); border: 1px solid rgba(115,210,230,0.30);
}
```

- [ ] **Step 3: Sintaxe + testes** — `npm run check && npm test` → OK.

- [ ] **Step 4: Validação visual (harness)** — harness com `cardapio.css`: um card un (adicionável) e um card kg ("R$ 59,90/kg", "Pesado no balcão", sem "+ Adicionar"). Screenshot. Remover ao fim.

- [ ] **Step 5: Commit**
```bash
git add public/cardapio.js public/cardapio.css
git commit -m "feat(cardapio): vitrine mostra item por kg (/kg, no balcao, nao adicionavel)"
```

---

## Notas de execução

- Servir estáticos p/ Playwright (background), remover `_harness-*`/screenshots antes de cada commit. `.playwright-mcp/` no `.gitignore`.
- `formatarQtd` no kg usa `toLocaleString("pt-BR")` — no Node, garantir ICU (Node moderno tem full-icu por padrão; se o teste de "12,5" falhar por locale, usar fallback `String(n).replace(".", ",")`).
- **PROGRESSO.md/CHANGELOG:** fechar via `concluir-tarefa` ao fim (fora do escopo do plano).
