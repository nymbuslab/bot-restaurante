# Cardápio em lista com busca — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a grade de cards da "Gestão de Itens" (painel do dono) por uma lista agrupada por categoria com busca por nome no topo.

**Architecture:** Mudança só de front-end. A única lógica com ramificações (normalização de busca sem acento) vira um módulo puro dual-mode (`public/busca.js`) coberto por `node:test`. A renderização de linhas e a barra de busca ficam em `public/app.js` (`renderCardapio`) + estilos em `public/style.css`. Sem backend, sem migration, sem mudança no `cardapio` jsonb nem no fluxo de pedido.

**Tech Stack:** HTML/CSS/JS puro (sem framework), `node:test` (runner nativo), Playwright MCP para validação visual.

## Global Constraints

- **Ícones, nunca emoji.** Toda iconografia é SVG inline. Reusar os SVGs já presentes no `renderCardapio` atual (lápis = editar, lixeira = excluir, placeholder de foto). Os glifos em mockups são só rascunho.
- **CSP estrita (helmet):** nenhum `<script>` inline, nenhum handler inline (`onclick=`/`onsubmit=`). Só `addEventListener` em `.js` externo. Script novo é same-origin (permitido).
- **Não tocar:** modal de cadastro/edição, vitrine pública (`public/cardapio.*`), `recalcularItens`, `projetarCardapio`, fluxo de pedido, `cardapio` jsonb.
- **Sem novos campos de dados.** Estoque/unidade/flags são etapas futuras.
- **Português (pt-BR)** em UI, comentários e mensagens.
- **Preservar seletores/data-attrs** consumidos por `ligarEventosCardapio()`: `itDisp` (+ `data-c`/`data-i`), `data-edit-item="ci-ii"`, `data-del-item="ci-ii"`, `data-del-cat`, `data-add-item`, `catNome` (+ `data-cat`).
- Campo de dinheiro sempre via `moedaBR(v)` (= `Dinheiro.formatar`). Escape de texto sempre via `escapar()`.

---

## File Structure

- `public/busca.js` (**criar**) — módulo puro dual-mode: `normalizarTexto(s)` e `itemCasaBusca(nome, termo)`. Exposto como `window.Busca` no browser e `module.exports` no Node.
- `test/busca.test.js` (**criar**) — testes `node:test` do módulo acima.
- `public/admin.html` (**modificar**) — adicionar `<script src="busca.js">` antes de `app.js`; adicionar o campo de busca estático na aba Cardápio (acima de `#cardapioContainer`).
- `public/app.js` (**modificar**) — reescrever `renderCardapio()` (linhas no lugar de cards + filtro de busca + estado vazio); variável de módulo `cardapioBusca`; listener único do campo de busca.
- `public/style.css` (**modificar**) — estilos `.cardapio-busca*`, `.item-linha*`, `.item-add-linha`, `.cardapio-vazio-busca`; remover, ao final e com grep, as classes de card que ficarem sem uso.

---

## Task 1: Módulo puro de busca (`busca.js`) + testes

**Files:**
- Create: `public/busca.js`
- Test: `test/busca.test.js`

**Interfaces:**
- Produces:
  - `normalizarTexto(s: string) -> string` — minúsculas, sem acento (NFD + remoção de diacríticos), `trim`. Entrada `null`/`undefined` → `""`.
  - `itemCasaBusca(nome: string, termo: string) -> boolean` — `true` se `normalizarTexto(nome)` contém `normalizarTexto(termo)`. Termo vazio → `true`. `nome` vazio/null com termo não-vazio → `false`.
  - Browser: `window.Busca = { normalizarTexto, itemCasaBusca }`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/busca.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { normalizarTexto, itemCasaBusca } = require("../public/busca");

test("normalizarTexto: minúsculas, sem acento e com trim", () => {
  assert.equal(normalizarTexto("Café"), "cafe");
  assert.equal(normalizarTexto("  MARMITA  "), "marmita");
  assert.equal(normalizarTexto("Açaí"), "acai");
});

test("normalizarTexto: entrada nula vira string vazia", () => {
  assert.equal(normalizarTexto(null), "");
  assert.equal(normalizarTexto(undefined), "");
});

test("itemCasaBusca: substring sem acento e case-insensitive", () => {
  assert.equal(itemCasaBusca("Café com leite", "cafe"), true);
  assert.equal(itemCasaBusca("Marmitex P", "MAR"), true);
  assert.equal(itemCasaBusca("Coca lata", "pizza"), false);
});

test("itemCasaBusca: termo vazio casa com tudo", () => {
  assert.equal(itemCasaBusca("Pizza", ""), true);
});

test("itemCasaBusca: nome vazio/nulo não casa com termo não-vazio", () => {
  assert.equal(itemCasaBusca("", "x"), false);
  assert.equal(itemCasaBusca(null, "x"), false);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Cannot find module '../public/busca'`.

- [ ] **Step 3: Implementar o módulo mínimo**

Criar `public/busca.js`:

```js
// ============================================================
// Busca do cardápio (painel do dono) — helpers puros e testáveis.
// normalizarTexto: minúsculas, sem acento, sem espaços nas pontas.
// itemCasaBusca: o nome do item contém o termo digitado?
// Dual-mode: window.Busca no browser, module.exports no Node (testes).
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.Busca = api;
})(this, function () {
  function normalizarTexto(s) {
    return String(s == null ? "" : s)
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "") // remove acentos (marcas diacríticas)
      .toLowerCase()
      .trim();
  }

  function itemCasaBusca(nome, termo) {
    const t = normalizarTexto(termo);
    if (t === "") return true;
    return normalizarTexto(nome).includes(t);
  }

  return { normalizarTexto, itemCasaBusca };
});
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npm test`
Expected: PASS — os 5 testes novos passam; a suíte existente continua passando.

- [ ] **Step 5: Commit**

```bash
git add public/busca.js test/busca.test.js
git commit -m "feat(cardapio): helper puro de busca (sem acento) + testes"
```

---

## Task 2: Cards → linhas na Gestão de Itens

Substitui a grade de cards por linhas agrupadas por categoria. **Sem busca ainda** (entra na Task 3). Mantém todos os seletores/handlers.

**Files:**
- Modify: `public/app.js` — função `renderCardapio()` (atual linhas 897-969), bloco do item (920-957) e o "+ Adicionar" (959-966).
- Modify: `public/style.css` — adicionar estilos `.itens-lista`, `.item-linha*`, `.item-add-linha`.

**Interfaces:**
- Consumes: `escapar()`, `moedaBR()`, `$()`, `cardapioAtual.categorias[].itens[]` (formato `{ id, nome, preco, desc, disponivel, composicao, opcionais, imagem }`), `ligarEventosCardapio()`.
- Produces: DOM com `.item-linha` por item; container `.itens-lista` por categoria; botão de adicionar `.item-add-linha` com `data-add-item="ci"`. Mantém intactos os data-attrs `itDisp`/`data-c`/`data-i`, `data-edit-item`, `data-del-item`, `data-del-cat`, `data-add-item`, `catNome`.

- [ ] **Step 1: Reescrever o corpo do `forEach` de itens em `renderCardapio()`**

Em `public/app.js`, dentro de `renderCardapio()`, trocar o `div.innerHTML` da categoria para usar `itens-lista` no lugar de `cards-grid`:

Substituir (atual linha 915):
```js
      <div class="cards-grid" data-itens="${ci}"></div>
```
por:
```js
      <div class="itens-lista" data-itens="${ci}"></div>
```

Substituir o bloco que cria o card de cada item (atual linhas 919-957) por linhas:

```js
    cat.itens.forEach((item, ii) => {
      const linha = document.createElement("div");
      linha.className = "item-linha" + (item.disponivel ? "" : " item-linha--indisp");
      const temFoto = item.imagem && item.imagem !== "";
      const dispTxt = item.disponivel ? "Disp." : "Indisp.";
      linha.innerHTML = `
        <div class="item-linha-foto">
          ${temFoto
            ? `<img src="${escapar(item.imagem)}" alt="${escapar(item.nome)}" loading="lazy" />`
            : `<span class="item-linha-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </span>`
          }
        </div>
        <div class="item-linha-corpo">
          <span class="item-linha-nome">${escapar(item.nome) || "(sem nome)"}</span>
          ${item.desc ? `<span class="item-linha-desc">${escapar(item.desc)}</span>` : ""}
        </div>
        <span class="item-linha-preco">R$ ${moedaBR(item.preco)}</span>
        <label class="item-linha-disp">
          <span class="toggle"><input type="checkbox" ${item.disponivel ? "checked" : ""} class="itDisp" data-c="${ci}" data-i="${ii}" /></span>
          <span class="item-linha-disp-txt">${dispTxt}</span>
        </label>
        <div class="item-linha-acoes">
          <button class="mini" data-edit-item="${ci}-${ii}" aria-label="Editar item">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="perigo mini" data-del-item="${ci}-${ii}" aria-label="Excluir item">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      `;
      grid.appendChild(linha);
    });
```

> `grid` continua sendo `div.querySelector('[data-itens="${ci}"]')` (já existe acima, atual linha 918) — agora aponta para `.itens-lista`. Não renomear a variável para não tocar código fora do bloco.

- [ ] **Step 2: Trocar o botão "+ Adicionar item" de card para linha**

Substituir o bloco do `addCard` (atual linhas 959-966) por:

```js
    const addLinha = document.createElement("button");
    addLinha.className = "item-add-linha";
    addLinha.setAttribute("data-add-item", ci);
    addLinha.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      <span>Adicionar item nesta categoria</span>
    `;
    grid.appendChild(addLinha);
```

- [ ] **Step 3: Adicionar os estilos das linhas em `style.css`**

Acrescentar ao fim de `public/style.css` (ajustar tokens se o arquivo usar nomes diferentes — conferir um bloco vizinho como `.metrica-card`):

```css
/* Cardápio — lista de itens (Gestão de Itens) */
.itens-lista { display: flex; flex-direction: column; gap: 8px; }

.item-linha {
  display: grid;
  grid-template-columns: 44px 1fr auto auto auto;
  align-items: center;
  gap: 14px;
  padding: 8px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--borda, rgba(255,255,255,.08));
  border-radius: var(--radius, 12px);
}
.item-linha--indisp { opacity: .55; }

.item-linha-foto {
  width: 44px; height: 44px; border-radius: 8px; overflow: hidden;
  background: var(--bg-elevated); display: flex; align-items: center; justify-content: center;
  flex: none;
}
.item-linha-foto img { width: 100%; height: 100%; object-fit: cover; }
.item-linha-placeholder { color: var(--texto-fraco, #888); display: flex; }

.item-linha-corpo { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.item-linha-nome { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-linha-desc {
  font-size: .82rem; color: var(--texto-fraco, #888);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.item-linha-preco { font-weight: 700; white-space: nowrap; }

.item-linha-disp { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
.item-linha-disp-txt { font-size: .82rem; color: var(--texto-fraco, #888); }

.item-linha-acoes { display: flex; gap: 6px; }

.item-add-linha {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 10px; margin-top: 2px;
  background: transparent; color: var(--accent, #6344BC);
  border: 1px dashed var(--accent, #6344BC); border-radius: var(--radius, 12px);
  cursor: pointer; font-weight: 600;
}
.item-add-linha:hover { background: rgba(99,68,188,.08); }

@media (max-width: 640px) {
  .item-linha {
    grid-template-columns: 44px 1fr auto;
    grid-template-areas:
      "foto corpo preco"
      "foto disp  acoes";
    row-gap: 6px;
  }
  .item-linha-foto  { grid-area: foto; }
  .item-linha-corpo { grid-area: corpo; }
  .item-linha-preco { grid-area: preco; text-align: right; }
  .item-linha-disp  { grid-area: disp; }
  .item-linha-acoes { grid-area: acoes; justify-content: flex-end; }
}
```

- [ ] **Step 4: Validar sintaxe**

Run: `npm run check`
Expected: PASS (sem erros de sintaxe).

- [ ] **Step 5: Validação visual (Playwright)**

Servir os estáticos localmente e abrir o painel logado (Plano Completo já existe na sessão de teste). Conferir:
- A aba Cardápio mostra **linhas** (não cards), agrupadas por categoria, cada uma com miniatura/nome/preço/toggle/editar/excluir.
- Item indisponível aparece esmaecido.
- Clicar no toggle alterna disponível; "Editar" abre o modal no item certo; "Excluir" remove o item certo.
- "Adicionar item nesta categoria" abre o modal de novo item na categoria certa.
- Mobile (resize ~390px): linha empilha, sem scroll horizontal.

Registrar o resultado. Se algum handler não disparar, conferir que os data-attrs ficaram idênticos ao original.

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat(cardapio): itens em lista no lugar de cards"
```

---

## Task 3: Barra de busca por nome

Adiciona o campo de busca estático (fora do container re-renderizado, para não perder o foco) e o filtro na renderização, com estado vazio.

**Files:**
- Modify: `public/admin.html` — campo de busca na aba Cardápio (acima de `#cardapioContainer`, dentro de `#aba-cardapio`) + `<script src="busca.js">` antes de `app.js`.
- Modify: `public/app.js` — variável `cardapioBusca`; filtro em `renderCardapio()`; estado vazio; listener único do campo.
- Modify: `public/style.css` — `.cardapio-busca*`, `.cardapio-vazio-busca`.

**Interfaces:**
- Consumes: `window.Busca.itemCasaBusca` (Task 1); `renderCardapio()` (Task 2); `$()`, `escapar()`.
- Produces: `let cardapioBusca` (estado de view, não persistido); `#cardapioBusca` (input estático).

- [ ] **Step 1: Adicionar o `<script>` do módulo de busca em `admin.html`**

Localizar a linha que carrega `dinheiro.js` em `public/admin.html` (`<script src="dinheiro.js"></script>`) e adicionar logo abaixo:

```html
    <script src="busca.js"></script>
```

(Garantir que vem **antes** de `<script src="app.js"></script>`.)

- [ ] **Step 2: Adicionar o campo de busca estático na aba Cardápio**

Em `public/admin.html`, dentro de `<section class="aba" id="aba-cardapio">`, imediatamente **acima** de `<div id="cardapioContainer"></div>` (atual linha 146), inserir:

```html
      <div class="cardapio-busca">
        <svg class="cardapio-busca-ico" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="cardapioBusca" type="search" placeholder="Buscar item…" aria-label="Buscar item no cardápio" autocomplete="off" />
      </div>
```

- [ ] **Step 3: Adicionar o estado e o filtro em `app.js`**

Perto do topo do bloco do cardápio em `public/app.js` (antes de `renderCardapio`, ex.: logo após `function moedaBR(...)` na linha 868), declarar o estado:

```js
let cardapioBusca = "";
```

Em `renderCardapio()`, logo após `c.innerHTML = "";` (atual linha 900), calcular o termo e um acumulador, e filtrar por categoria. Trocar o `cardapioAtual.categorias.forEach((cat, ci) => {` para a versão com filtro:

```js
  const termo = cardapioBusca.trim();
  let totalMostrado = 0;
  cardapioAtual.categorias.forEach((cat, ci) => {
    const itensCat = cat.itens
      .map((item, ii) => ({ item, ii }))
      .filter(({ item }) => Busca.itemCasaBusca(item.nome, termo));
    if (termo && itensCat.length === 0) return; // categoria sem match some na busca
    totalMostrado += itensCat.length;
```

Dentro do loop, **o badge continua usando o total real** `cat.itens.length` (não filtrar o badge). E o loop interno de itens passa a iterar `itensCat` usando o índice real `ii`:

```js
    itensCat.forEach(({ item, ii }) => {
      const linha = document.createElement("div");
      // ... (mesmo corpo da linha da Task 2, usando item e ii) ...
      grid.appendChild(linha);
    });
```

Após fechar o `forEach` das categorias, antes de `ligarEventosCardapio();`, adicionar o estado vazio:

```js
  if (termo && totalMostrado === 0) {
    c.innerHTML = `<p class="cardapio-vazio-busca">Nenhum item encontrado para "<strong>${escapar(termo)}</strong>".</p>`;
  }
```

> Observação: o `forEach` de itens da Task 2 iterava `cat.itens.forEach((item, ii) => ...)`. Agora ele itera `itensCat.forEach(({ item, ii }) => ...)`. O corpo interno (HTML da linha) é idêntico — só muda a fonte da iteração. O botão "+ Adicionar item nesta categoria" continua sendo adicionado normalmente em cada categoria renderizada.

- [ ] **Step 4: Ligar o listener único do campo de busca**

Em `public/app.js`, junto dos listeners fixos do editor (atual linha ~1154, `$("editor-fechar").addEventListener(...)`), adicionar:

```js
$("cardapioBusca").addEventListener("input", (e) => {
  cardapioBusca = e.target.value;
  renderCardapio();
});
$("cardapioBusca").addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.target.value = "";
    cardapioBusca = "";
    renderCardapio();
  }
});
```

> Este listener é fixo (o `#cardapioBusca` é estático no HTML, fora do `#cardapioContainer` re-renderizado) — por isso o foco do campo **não se perde** ao digitar.

- [ ] **Step 5: Estilos da busca em `style.css`**

Acrescentar:

```css
/* Cardápio — barra de busca */
.cardapio-busca {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-surface); border: 1px solid var(--borda, rgba(255,255,255,.08));
  border-radius: var(--radius, 12px); padding: 8px 12px; margin-bottom: 14px;
}
.cardapio-busca-ico { color: var(--texto-fraco, #888); flex: none; }
.cardapio-busca input {
  flex: 1; background: transparent; border: 0; outline: none;
  color: inherit; font-size: .95rem;
}
.cardapio-vazio-busca {
  text-align: center; color: var(--texto-fraco, #888); padding: 28px 12px;
}
```

- [ ] **Step 6: Validar sintaxe e testes**

Run: `npm run check && npm test`
Expected: PASS (sintaxe ok; suíte, incluindo `busca.test.js`, passa).

- [ ] **Step 7: Validação visual (Playwright)**

No painel logado, aba Cardápio:
- Digitar parte de um nome filtra as linhas em tempo real; o foco do campo **permanece** enquanto digita.
- Busca com acento e sem acento encontra o mesmo item (ex.: "cafe" acha "Café").
- Categoria sem nenhum match desaparece; o badge das categorias visíveis mantém o total real.
- Termo sem resultado mostra "Nenhum item encontrado para …".
- `Esc` no campo limpa e volta a lista completa.
- Com busca ativa, "Editar"/"Excluir"/toggle agem no item certo (índice real preservado).

- [ ] **Step 8: Commit**

```bash
git add public/admin.html public/app.js public/style.css
git commit -m "feat(cardapio): busca por nome na lista de itens"
```

---

## Task 4: Limpeza de CSS morto + validação final

Remove com segurança as classes de card que ficaram sem uso e fecha a etapa.

**Files:**
- Modify: `public/style.css` — remover blocos `.cards-grid`, `.item-card`, `.item-card-*`, `.item-card-add` se confirmadamente sem uso.

**Interfaces:**
- Consumes: nada novo.
- Produces: nada novo.

- [ ] **Step 1: Verificar uso das classes de card no projeto**

Run (grep em todo o front, fora de `style.css`):
```bash
grep -rn -e "cards-grid" -e "item-card" -e "item-indisp" public --include=*.js --include=*.html
```
Expected: **sem resultados** (a Task 2 já removeu todos os usos). Se aparecer algum uso legítimo em outra tela, **não remover** a classe correspondente — pular.

- [ ] **Step 2: Remover do `style.css` apenas os blocos confirmadamente órfãos**

Apagar de `public/style.css` os seletores que o Step 1 confirmou sem uso: `.cards-grid`, `.item-card`, `.item-card-foto`, `.item-card-placeholder`, `.item-card-info`, `.item-card-meta`, `.item-card-linha1`, `.item-card-nome`, `.item-card-preco`, `.item-card-desc`, `.item-card-bottom`, `.item-card-disp`, `.item-card-disp-txt`, `.item-card-acoes`, `.item-card-add`, `.item-indisp` (e regras responsivas que só os referenciam).

> Conferir antes de apagar cada um: buscar o seletor no `style.css` e confirmar que o Step 1 não achou uso em JS/HTML. Em dúvida sobre um seletor específico, deixá-lo (CSS morto é inofensivo; remover errado quebra outra tela).

- [ ] **Step 3: Validação final**

Run: `npm run check && npm test`
Expected: PASS.

Validação visual rápida (Playwright): reabrir a aba Cardápio e confirmar que a lista e a busca continuam idênticas (nada quebrou ao remover o CSS).

- [ ] **Step 4: Commit**

```bash
git add public/style.css
git commit -m "chore(cardapio): remove CSS dos cards antigos do cardápio"
```

---

## Notas de execução

- **Servir estáticos para o Playwright:** subir um servidor HTTP local na pasta `public` (ex.: `node` com um static server simples) em porta livre e navegar para `http://localhost:<porta>` — `file://` é bloqueado. Encerrar o servidor ao fim.
- **Sessão de teste:** usar uma conta Plano Completo já existente; a aba Cardápio não depende de plano, mas o login é necessário para `cardapioAtual` carregar.
- **Ordem de carga dos scripts** em `admin.html`: `dinheiro.js` → `busca.js` → `app.js`. `Busca` precisa existir antes de `renderCardapio` rodar.
- **PROGRESSO.md:** ao concluir, mover o item para ✅ Concluído via skill `concluir-tarefa` (fora do escopo deste plano).
