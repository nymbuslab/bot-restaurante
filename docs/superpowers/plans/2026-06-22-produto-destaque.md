# Produto em destaque — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Marcar item como destaque no cadastro e refletir na vitrine (seção "Destaques" no topo + selo no card).

**Architecture:** Campo `destaque` no item (jsonb). Projeção expõe; vitrine prepõe um grupo "Destaques" na aba Todos e mostra selo estrela; painel mostra o checkbox e um selo na tabela.

**Tech Stack:** HTML/CSS/JS puro, node:test, Playwright (harness).

## Global Constraints

- Sem migration (`destaque` no jsonb; ausente = false). Ícones SVG, nunca emoji. CSP estrita. pt-BR.
- Não muda pedido/etapas anteriores. Escape: `escapar()` (painel), `esc()` (vitrine).

---

## Task 1: Projeção expõe `destaque` (TDD)

**Files:** Modify `src/cardapio-web.js`; `test/cardapio-web.test.js`.

- [ ] **Step 1: Atualizar o `deepEqual` da projeção** (item ganha `destaque: false`) e adicionar asserção:
```js
    opcionais: [{ nome: "Bacon", preco: 3 }], apenasLocal: false, esgotado: false, unidade: "un", destaque: false,
```
Adicionar teste:
```js
test("projetarCardapio: expõe destaque", () => {
  const cru = { categorias: [ { nome: "P", itens: [
    { id: 1, nome: "A", preco: 10, disponivel: true, destaque: true },
    { id: 2, nome: "B", preco: 10, disponivel: true },
  ] } ] };
  const itens = cw.projetarCardapio(cru).categorias[0].itens;
  assert.equal(itens[0].destaque, true);
  assert.equal(itens[1].destaque, false);
});
```

- [ ] **Step 2: Rodar e confirmar a falha** — `npm test` → FAIL.

- [ ] **Step 3: Implementar** — em `projetarCardapio`, após `unidade: ...`:
```js
        destaque: item.destaque === true,
```

- [ ] **Step 4: Rodar e confirmar que passa** — `npm test` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/cardapio-web.js test/cardapio-web.test.js
git commit -m "feat(cardapio): projecao expoe destaque do item"
```

---

## Task 2: Checkbox no modal + selo na tabela do painel

**Files:** Modify `public/admin.html`, `public/app.js`, `public/style.css`.

- [ ] **Step 1: Checkbox no modal (`admin.html`)** — adicionar um 3º `.campo.toggle` na `.linha` dos toggles (após o de entrega):
```html
            <div class="campo toggle">
              <input type="checkbox" id="editor-destaque" />
              <label for="editor-destaque">Destaque no cardápio</label>
            </div>
```

- [ ] **Step 2: Ler ao abrir (`app.js` `abrirEditorItem`)**
- Novo item (após `$("editor-unidade").value = "un";`):
```js
    $("editor-destaque").checked = false;
```
- Item existente (após `$("editor-unidade").value = ...;`):
```js
    $("editor-destaque").checked = it.destaque === true;
```

- [ ] **Step 3: Gravar ao salvar (`app.js` `salvarEditorItem`)** — após `if (unidade === "kg") novoItem.unidade = "kg";`:
```js
  if ($("editor-destaque").checked) novoItem.destaque = true;
```

- [ ] **Step 4: Selo na tabela (`app.js` `renderCardapio`)** — no `.il-nome`, após a tag de arquivado, adicionar a de destaque:
```js
            <span class="il-nome">${escapar(item.nome) || "(sem nome)"}${item.apenasLocal ? ` <span class="il-tag-local">Só no local</span>` : ""}${item.arquivado ? ` <span class="il-tag-arq">Arquivado</span>` : ""}${item.destaque ? ` <span class="il-tag-destaque">${SVG_ESTRELA}Destaque</span>` : ""}</span>
```
> `SVG_ESTRELA` = uma constante perto do topo do `app.js` (junto de outros helpers de render), para não repetir o SVG:
```js
const SVG_ESTRELA = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> `;
```

- [ ] **Step 5: Estilo (`style.css`)** — perto de `.il-tag-arq`:
```css
.il-tag-destaque {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 999px;
  color: var(--accent-fg); background: var(--accent-subtle); border: 1px solid var(--border);
  white-space: nowrap;
}