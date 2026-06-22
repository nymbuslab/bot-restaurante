# Arquivar / excluir item com vendas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Excluir item com vendas vira fluxo seguro: alerta + arquivar (soft delete) recomendado, com "Mostrar arquivados" e restaurar.

**Architecture:** Campo `arquivado` no item (jsonb). Servidor conta vendas por item (containment em `pedidos.itens`) e barra item arquivado na vitrine/pedido. Front troca a exclusão imediata por um fluxo: checa vendas → modal (simples sem vendas / 3 botões com vendas) → arquivar/excluir/cancelar, salvando na hora com rollback.

**Tech Stack:** Node.js CommonJS, Express, pg, HTML/CSS/JS puro, node:test, Playwright (harness).

## Global Constraints

- **Sem migration:** `arquivado` no `cardapio` jsonb. Ausente/false = ativo.
- **Servidor é a verdade:** item arquivado nunca vai pra vitrine nem pode ser pedido.
- **Salvar na hora** (arquivar/excluir/restaurar) via `PUT /api/cardapio`, com **rollback** se falhar.
- **Fail-safe:** se a checagem de vendas falhar, tratar como "com vendas" (mostra o alerta).
- **Ícones, nunca emoji.** CSP estrita (sem inline). pt-BR. Escape via `escapar()`.
- Preservar data-attrs/handlers do render (itDisp, data-edit-item, data-del-item, data-add-item, catNome, data-del-cat) + novo `data-restore-item`.

---

## File Structure

- `src/cardapio-web.js` (**mod**) — `projetarCardapio` e `recalcularItens` ignoram `arquivado`.
- `test/cardapio-web.test.js` (**mod**) — testes do arquivado.
- `src/pedidos.js` (**mod**) — `contarVendasDoItem` + export.
- `src/servidor.js` (**mod**) — rota `GET /api/cardapio/item/:id/vendas`.
- `public/admin.html` (**mod**) — modal `#item-del-overlay` + checkbox "Mostrar arquivados".
- `public/app.js` (**mod**) — fluxo de exclusão/arquivar/restaurar + estado mostrarArquivados + render.
- `public/style.css` (**mod**) — estilos do modal, tag "Arquivado", checkbox.

---

## Task 1: Item arquivado fora da vitrine e do pedido (TDD)

**Files:**
- Modify: `src/cardapio-web.js` (`projetarCardapio` ~38, `recalcularItens` ~61)
- Test: `test/cardapio-web.test.js`

- [ ] **Step 1: Testes (falham)** — adicionar:

```js
test("projetarCardapio: item arquivado fica fora da projeção", () => {
  const cru = { categorias: [ { nome: "P", itens: [
    { id: 1, nome: "A", preco: 10, disponivel: true },
    { id: 2, nome: "Arq", preco: 10, disponivel: true, arquivado: true },
  ] } ] };
  const itens = cw.projetarCardapio(cru).categorias[0].itens;
  assert.equal(itens.length, 1);
  assert.equal(itens[0].id, 1);
});
test("recalcularItens: item arquivado não é pedível", () => {
  const card = { categorias: [ { nome: "P", itens: [
    { id: 9, nome: "Arq", preco: 10, disponivel: true, arquivado: true },
  ] } ] };
  assert.throws(() => cw.recalcularItens(card, [{ id: 9, qtd: 1 }]), /indispon/i);
});
```

- [ ] **Step 2: Rodar e confirmar a falha** — `npm test` → FAIL.

- [ ] **Step 3: Implementar**

`projetarCardapio`, trocar a guarda:
```js
      if (!item || item.disponivel === false || item.arquivado === true) continue;
```
`recalcularItens`, trocar o filtro do mapa:
```js
      if (it && it.disponivel !== false && it.arquivado !== true) mapa[it.id] = it;
```

- [ ] **Step 4: Rodar e confirmar que passa** — `npm test` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/cardapio-web.js test/cardapio-web.test.js
git commit -m "feat(cardapio): item arquivado sai da vitrine e nao e pedivel"
```

---

## Task 2: Contagem de vendas por item (backend)

**Files:**
- Modify: `src/pedidos.js` (após `salvarPedido`; export ~173)
- Modify: `src/servidor.js` (nova rota, perto de `GET /api/cardapio/link` ~1314)

**Interfaces:**
- Produces: `pedidos.contarVendasDoItem(dir, itemId) -> Promise<number>`; rota `GET /api/cardapio/item/:id/vendas` → `{ vendas }`.

- [ ] **Step 1: `contarVendasDoItem` (`src/pedidos.js`)** — adicionar antes do `module.exports`:

```js
// Quantos pedidos da empresa contêm o item (por id) no jsonb `itens`.
async function contarVendasDoItem(dir, itemId) {
  const empId = await empresaId(dir);
  const r = await db.query(
    "SELECT count(*)::int AS n FROM pedidos WHERE empresa_id = $1 AND itens @> $2::jsonb",
    [empId, JSON.stringify([{ id: itemId }])]
  );
  return r.rows[0] ? r.rows[0].n : 0;
}
```

Atualizar o export, adicionando `contarVendasDoItem`:
```js
module.exports = { salvarPedido, lerTodos, ultimo, lerPorId, avisarPedido, contarNoMes, anonimizarAntigos, fecharConexao, esquecer, contarVendasDoItem };
```

- [ ] **Step 2: Rota (`src/servidor.js`)** — adicionar após o handler `GET /api/cardapio/link`:

```js
// Quantas vendas o item já teve (decide o modal de exclusão no painel).
app.get("/api/cardapio/item/:id/vendas", exigeAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ erro: "id inválido" });
    const vendas = await pedidos.contarVendasDoItem(req.tenantDir, id);
    res.json({ vendas });
  } catch (e) {
    console.error("GET item vendas:", e.message);
    res.status(500).json({ erro: "Falha ao checar vendas." });
  }
});
```

- [ ] **Step 3: Sintaxe** — `npm run check` → OK.

- [ ] **Step 4: Smoke da query (sem suíte de DB nova)** — com o app rodando e um tenant real, conferir manualmente que `GET /api/cardapio/item/<id>/vendas` devolve a contagem certa para um item já pedido (e 0 para um id sem pedidos). Documentar o resultado. (O formato do containment `itens @> [{ "id": N }]` precisa casar o jsonb real — validar aqui.)

- [ ] **Step 5: Commit**
```bash
git add src/pedidos.js src/servidor.js
git commit -m "feat(cardapio): conta vendas por item + rota /api/cardapio/item/:id/vendas"
```

---

## Task 3: Modal de exclusão + "Mostrar arquivados" (admin.html)

**Files:**
- Modify: `public/admin.html` (modal novo perto do `#editor-overlay`; checkbox na `.cardapio-busca` ~146-149)

- [ ] **Step 1: Checkbox "Mostrar arquivados"** — trocar o bloco `.cardapio-busca`:

```html
      <div class="cardapio-busca">
        <svg class="cardapio-busca-ico" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="cardapioBusca" type="search" placeholder="Buscar item…" aria-label="Buscar item no cardápio" autocomplete="off" />
        <label class="cardapio-arq-toggle"><input type="checkbox" id="cardapioMostrarArq" /> Mostrar arquivados</label>
      </div>
```

- [ ] **Step 2: Modal de item com vendas** — adicionar antes de `</body>` (ou junto dos outros overlays):

```html
  <div id="item-del-overlay" class="modal-overlay" style="display:none">
    <div class="modal-caixa">
      <h3 id="idel-titulo">Este item tem vendas</h3>
      <p class="modal-mensagem"><strong id="idel-nome"></strong> tem <strong id="idel-vendas"></strong> registrada(s). Excluir pode afetar relatórios e faturamento. Recomendamos <strong>arquivar</strong> — ele some do cardápio, mas o histórico e o estoque são preservados.</p>
      <div class="modal-acoes">
        <button class="secundario" id="idel-cancelar">Cancelar</button>
        <button class="perigo" id="idel-excluir">Excluir mesmo assim</button>
        <button id="idel-arquivar">Arquivar</button>
      </div>
    </div>
  </div>
```

> Conferir as classes reais do modal de confirmação (`#modal-overlay`) e espelhar a estrutura (`.modal-caixa`, `.modal-acoes` ou equivalente) para herdar a animação/estilo.

- [ ] **Step 3: Sintaxe** — `npm run check` → OK.

- [ ] **Step 4: Commit**
```bash
git add public/admin.html
git commit -m "feat(cardapio): markup do modal de exclusao e do 'mostrar arquivados'"
```

---

## Task 4: Fluxo de exclusão/arquivar/restaurar (app.js)

**Files:**
- Modify: `public/app.js` (estado + funções perto de `renderCardapio`; handler `data-del-item` em `ligarEventosCardapio` ~1003-1009)

**Interfaces:**
- Consumes: `api`, `confirmar`, `toast`, `cardapioAtual`, `renderCardapio`.
- Produces: `mostrarArquivados` (estado), `fluxoExcluirItem`, `excluirItem`, `arquivarItem`, `modalItemComVendas`.

- [ ] **Step 1: Estado + funções** — perto do estado do cardápio (após `let cardapioBusca = "";`):

```js
let mostrarArquivados = false;

// Modal de item COM vendas (3 botões) → resolve "arquivar" | "excluir" | null.
function modalItemComVendas(nome, vendas) {
  return new Promise((resolve) => {
    const overlay = $("item-del-overlay");
    $("idel-nome").textContent = nome || "(sem nome)";
    $("idel-vendas").textContent = vendas > 0 ? `${vendas} venda${vendas > 1 ? "s" : ""}` : "vendas";
    overlay.style.display = "flex";
    overlay.classList.remove("saindo");
    function fechar(r) {
      overlay.classList.add("saindo");
      overlay.addEventListener("animationend", () => { overlay.style.display = "none"; overlay.classList.remove("saindo"); }, { once: true });
      $("idel-cancelar").removeEventListener("click", onCancel);
      $("idel-excluir").removeEventListener("click", onExcluir);
      $("idel-arquivar").removeEventListener("click", onArquivar);
      resolve(r);
    }
    function onCancel() { fechar(null); }
    function onExcluir() { fechar("excluir"); }
    function onArquivar() { fechar("arquivar"); }
    $("idel-cancelar").addEventListener("click", onCancel);
    $("idel-excluir").addEventListener("click", onExcluir);
    $("idel-arquivar").addEventListener("click", onArquivar);
  });
}

async function salvarCardapioRemoto() {
  const r = await api("PUT", "/api/cardapio", cardapioAtual);
  return !!(r && r.ok);
}

async function excluirItem(ci, ii) {
  const removido = cardapioAtual.categorias[ci].itens.splice(ii, 1)[0];
  renderCardapio();
  if (await salvarCardapioRemoto()) toast("Item excluído.");
  else { cardapioAtual.categorias[ci].itens.splice(ii, 0, removido); renderCardapio(); toast("Erro ao excluir. Tente novamente.", "erro"); }
}

async function arquivarItem(ci, ii, valor) {
  const item = cardapioAtual.categorias[ci].itens[ii];
  const antes = item.arquivado;
  item.arquivado = valor;
  renderCardapio();
  if (await salvarCardapioRemoto()) toast(valor ? "Item arquivado." : "Item restaurado.");
  else { item.arquivado = antes; renderCardapio(); toast("Erro ao salvar. Tente novamente.", "erro"); }
}

async function fluxoExcluirItem(ci, ii) {
  const item = cardapioAtual.categorias[ci].itens[ii];
  let vendas = 0;
  if (item.id != null) {
    const r = await api("GET", `/api/cardapio/item/${item.id}/vendas`);
    if (r && r.ok) { const d = await r.json(); vendas = d.vendas || 0; }
    else vendas = -1; // falha → trata como "com vendas" (seguro)
  }
  if (vendas === 0) {
    const ok = await confirmar("Excluir item?", "Esta ação não pode ser desfeita.", "Excluir");
    if (ok) await excluirItem(ci, ii);
    return;
  }
  const escolha = await modalItemComVendas(item.nome, vendas);
  if (escolha === "arquivar") await arquivarItem(ci, ii, true);
  else if (escolha === "excluir") await excluirItem(ci, ii);
}
```

- [ ] **Step 2: Trocar o handler de `data-del-item`** (em `ligarEventosCardapio`) por:

```js
  document.querySelectorAll("[data-del-item]").forEach((el) =>
    el.addEventListener("click", (e) => {
      const [ci, ii] = e.currentTarget.dataset.delItem.split("-").map(Number);
      fluxoExcluirItem(ci, ii);
    })
  );
  document.querySelectorAll("[data-restore-item]").forEach((el) =>
    el.addEventListener("click", (e) => {
      const [ci, ii] = e.currentTarget.dataset.restoreItem.split("-").map(Number);
      arquivarItem(ci, ii, false);
    })
  );
```

- [ ] **Step 3: Listener do "Mostrar arquivados"** — junto dos listeners fixos (perto do `#cardapioBusca`):

```js
$("cardapioMostrarArq").addEventListener("change", (e) => {
  mostrarArquivados = e.target.checked;
  renderCardapio();
});
```

- [ ] **Step 4: Sintaxe** — `npm run check` → OK.

- [ ] **Step 5: Commit**
```bash
git add public/app.js
git commit -m "feat(cardapio): fluxo de excluir/arquivar/restaurar item com salvar imediato"
```

---

## Task 5: Render — filtrar arquivados + linha arquivada (app.js + style.css)

**Files:**
- Modify: `public/app.js` (`renderCardapio`: filtro + badge + linha arquivada)
- Modify: `public/style.css`

- [ ] **Step 1: Filtro e badge (`renderCardapio`)** — trocar o cálculo de `itensCat` e `badge`:

```js
    const ativos = cat.itens.filter((it) => !it.arquivado).length;
    const itensCat = cat.itens
      .map((item, ii) => ({ item, ii }))
      .filter(({ item }) => mostrarArquivados || !item.arquivado)
      .filter(({ item }) => Busca.itemCasaBusca(item.nome, termo));
    if (termo && itensCat.length === 0) return;
    if (!termo && itensCat.length === 0) return; // categoria vazia (tudo arquivado e oculto) some
    totalMostrado += itensCat.length;
    const n = ativos;
    const badge = n === 1 ? "1 item" : `${n} itens`;
```

> A 2ª guarda (`!termo && itensCat.length === 0`) some com a categoria quando todos os itens estão arquivados e o toggle está off. Sem busca, o "Adicionar item" da categoria ainda assim some — aceitável (categoria sem itens ativos). Se quiser manter a categoria visível para adicionar, remover esta guarda. **Decisão: manter a guarda** (categoria sem itens ativos não polui a lista).

- [ ] **Step 2: Linha arquivada** — no `itensCat.forEach`, após calcular `est`, montar a variação da linha quando `item.arquivado`:

A classe da linha:
```js
      linha.className = "il-grid item-linha" + (item.disponivel ? "" : " item-linha--indisp") + (item.arquivado ? " item-linha--arquivado" : "");
```
No `.il-nome`, após a tag "Só no local", a tag de arquivado:
```js
            <span class="il-nome">${escapar(item.nome) || "(sem nome)"}${item.apenasLocal ? ` <span class="il-tag-local">Só no local</span>` : ""}${item.arquivado ? ` <span class="il-tag-arq">Arquivado</span>` : ""}</span>
```
A coluna DISPONÍVEL com o toggle desabilitado quando arquivado:
```js
        <span class="il-disp il-cel" data-label="Disponível"><span class="toggle"><input type="checkbox" ${item.disponivel ? "checked" : ""} ${item.arquivado ? "disabled" : ""} class="itDisp" data-c="${ci}" data-i="${ii}" /></span></span>
```
A coluna AÇÕES — Restaurar no lugar de Editar quando arquivado:
```js
        <span class="il-acoes">
          ${item.arquivado
            ? `<button class="mini" data-restore-item="${ci}-${ii}" aria-label="Restaurar item" title="Restaurar"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button>`
            : `<button class="mini" data-edit-item="${ci}-${ii}" aria-label="Editar item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`}
          <button class="perigo mini" data-del-item="${ci}-${ii}" aria-label="Excluir item"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
        </span>
```

> O resto da linha (foto/preço/estoque/mínimo) é idêntico ao atual.

- [ ] **Step 3: Estilos (`style.css`)**

```css
.cardapio-arq-toggle { display: flex; align-items: center; gap: 6px; white-space: nowrap; font-size: 13px; color: var(--text-secondary); cursor: pointer; }
.cardapio-arq-toggle input { accent-color: var(--accent); cursor: pointer; }
.item-linha--arquivado { opacity: 0.5; }
.il-tag-arq { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 999px; color: var(--text-secondary); background: var(--bg-elevated); border: 1px solid var(--border); white-space: nowrap; }
/* modal de exclusão: 3 botões em linha, quebram no mobile (reusa .modal-acoes se existir) */
#item-del-overlay .modal-acoes { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
```

> Conferir se `.modal-acoes`/`.modal-caixa` já existem (modal de confirmação); reusar os estilos. Se o modal de confirmação usa outra classe para os botões, espelhar.

- [ ] **Step 4: Sintaxe** — `npm run check && npm test` → OK.

- [ ] **Step 5: Validação visual (harness)**

Harness `public/_harness-arquivar.html` (carrega `style.css`, `dinheiro.js`, `estoque.js`) que renderiza: (a) o modal `#item-del-overlay` visível; (b) a lista com um item normal e um **arquivado** (greyed + tag "Arquivado" + Restaurar). Servir, screenshot desktop. Conferir o modal de 3 botões e a linha arquivada. Remover harness + screenshot.

> O fluxo dinâmico (checar vendas → modal → arquivar/salvar) depende de sessão/DB; validar manualmente no painel logado, ou via o harness só para o visual do modal e da linha arquivada.

- [ ] **Step 6: Commit**
```bash
git add public/app.js public/style.css
git commit -m "feat(cardapio): lista esconde arquivados, 'mostrar arquivados' e Restaurar"
```

---

## Notas de execução

- Ordem de scripts em `admin.html` inalterada.
- `.playwright-mcp/` já está no `.gitignore`; remover `_harness-*`/screenshots antes de cada commit.
- **Validação dinâmica** (vendas → modal → salvar) exige sessão logada + DB; o harness cobre só o visual (modal e linha arquivada). Documentar o teste manual da rota de vendas (Task 2 Step 4).
- **PROGRESSO.md:** ao concluir, fechar via `concluir-tarefa`.
```
