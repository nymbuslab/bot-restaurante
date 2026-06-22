# Item "Apenas local" (entrega × só no local) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir marcar um item do cardápio como vendido **só no local** (sem entrega): toggle no modal, selo na vitrine e bloqueio de Entrega para esses itens (front + servidor).

**Architecture:** Novo booleano `apenasLocal` no item (jsonb, sem migration). Owner marca pelo modal; a projeção pública expõe o campo; a vitrine mostra o selo e desabilita Entrega quando há item só-local no carrinho; o servidor é a defesa real (rejeita pedido de Entrega com item só-local). A única lógica branchy do back vira helper puro testável (`itensSoLocal`).

**Tech Stack:** Node.js CommonJS, Express, HTML/CSS/JS puro (vitrine `cardapio.*`), `node:test`, Playwright (validação visual via harness).

## Global Constraints

- **Ícones, nunca emoji.** Toda iconografia nova é SVG inline (a vitrine `cardapio.js` ainda usa alguns emojis legados — **não** introduzir novos; o selo "Só no local" é texto/chip, sem emoji).
- **CSP estrita (helmet):** nada de `<script>`/handler inline; só `addEventListener` em `.js` externo.
- **Sem migration:** `apenasLocal` vive no `cardapio` jsonb.
- **Compatibilidade:** item sem o campo = `apenasLocal` ausente = entregável (comportamento atual). Nunca tratar ausente como só-local.
- **Servidor é a fonte de verdade:** o pedido nunca confia no cliente; a validação de Entrega × só-local roda no `POST /api/c/:slug/pedido`.
- **Não tocar:** preço/recálculo (`recalcularItens`), fluxo do bot, modelo da tabela `pedidos`.
- **Português (pt-BR)** em UI, comentários e mensagens.
- Escape de texto: `escapar()` no painel (`app.js`), `esc()` na vitrine (`cardapio.js`).

---

## File Structure

- `public/admin.html` (**modificar**) — toggle "Disponível para entrega" + dica no modal do item.
- `public/app.js` (**modificar**) — ler/gravar `apenasLocal` (modal) + tag "Só no local" na linha da lista.
- `public/style.css` (**modificar**) — `.editor-dica`, `.item-linha-titulo`, `.item-linha-tag`.
- `src/cardapio-web.js` (**modificar**) — `projetarCardapio` expõe `apenasLocal`; novo helper puro `itensSoLocal`; export.
- `test/cardapio-web.test.js` (**modificar**) — testes de `itensSoLocal` + projeção de `apenasLocal`.
- `src/servidor.js` (**modificar**) — validação Entrega × só-local no `POST /api/c/:slug/pedido`.
- `public/cardapio.js` (**modificar**) — selo "Só no local" no card; regra de checkout (desabilita Entrega).
- `public/cardapio.css` (**modificar**) — `.cd-card-local`, `.cd-tipo-off`, `.cd-tipo-nota`.

---

## Task 1: Campo `apenasLocal` + modal + tag na lista (painel do dono)

**Files:**
- Modify: `public/admin.html` (modal do item, após `editor-disponivel`, ~linha 872-875)
- Modify: `public/app.js` (`abrirEditorItem` ~1038-1055, `salvarEditorItem` ~1115-1124, `renderCardapio` corpo da linha ~933-936)
- Modify: `public/style.css`

**Interfaces:**
- Produces: item do cardápio passa a ter `apenasLocal: boolean` (gravado via `PUT /api/cardapio` existente, sem rota nova). `true` = só no local; ausente/`false` = entregável.

- [ ] **Step 1: Adicionar o toggle no modal (`admin.html`)**

Localizar o bloco do toggle "Disponível para pedidos":

```html
          <div class="campo toggle">
            <input type="checkbox" id="editor-disponivel" />
            <label for="editor-disponivel">Disponível para pedidos</label>
          </div>
```

Inserir logo **depois** dele:

```html
          <div class="campo toggle">
            <input type="checkbox" id="editor-entrega" />
            <label for="editor-entrega">Disponível para entrega</label>
          </div>
          <p class="editor-dica" id="editor-entrega-dica">Desligado: o item aparece no cardápio com o aviso "Só no local" e não pode ser pedido para entrega.</p>
```

- [ ] **Step 2: Ler o campo ao abrir o modal (`app.js` `abrirEditorItem`)**

No ramo de **novo item** (`if (ii === -1) {`), junto de `$("editor-disponivel").checked = true;`, adicionar:

```js
    $("editor-entrega").checked = true;
```

No ramo de **item existente** (`} else {`), junto de `$("editor-disponivel").checked = it.disponivel !== false;`, adicionar:

```js
    $("editor-entrega").checked = it.apenasLocal !== true;
```

- [ ] **Step 3: Gravar o campo ao salvar (`app.js` `salvarEditorItem`)**

No objeto `novoItem`, adicionar a chave (logo após `disponivel: $("editor-disponivel").checked,`):

```js
    apenasLocal: !$("editor-entrega").checked,
```

- [ ] **Step 4: Tag "Só no local" na linha da lista (`app.js` `renderCardapio`)**

No corpo da linha, trocar o bloco do nome:

```js
        <div class="item-linha-corpo">
          <span class="item-linha-nome">${escapar(item.nome) || "(sem nome)"}</span>
          ${item.desc ? `<span class="item-linha-desc">${escapar(item.desc)}</span>` : ""}
        </div>
```

por (envolve nome + tag numa linha flex):

```js
        <div class="item-linha-corpo">
          <span class="item-linha-titulo">
            <span class="item-linha-nome">${escapar(item.nome) || "(sem nome)"}</span>
            ${item.apenasLocal ? `<span class="item-linha-tag">Só no local</span>` : ""}
          </span>
          ${item.desc ? `<span class="item-linha-desc">${escapar(item.desc)}</span>` : ""}
        </div>
```

- [ ] **Step 5: Estilos (`style.css`)**

Acrescentar (perto dos estilos `.item-linha*` da etapa 1):

```css
.editor-dica { font-size: 12px; color: var(--text-secondary); margin: 6px 0 0; line-height: 1.4; }

.item-linha-titulo { display: flex; align-items: center; gap: 8px; min-width: 0; }
.item-linha-tag {
  flex: none; font-size: 11px; font-weight: 600; line-height: 1;
  padding: 3px 8px; border-radius: 999px;
  color: var(--accent-fg); background: var(--accent-subtle);
  border: 1px solid var(--border);
}
```

> `.item-linha-nome` já trunca com reticências; dentro do flex `.item-linha-titulo` ele continua encolhendo e a tag fica fixa à direita do nome.

- [ ] **Step 6: Validar sintaxe**

Run: `npm run check`
Expected: `OK: ... arquivos sem erro de sintaxe.`

- [ ] **Step 7: Validação visual (Playwright, via harness)**

Criar um harness em `public/_harness-entrega.html` que carregue `style.css` e renderize duas linhas (uma normal, uma com `apenasLocal: true`) usando o mesmo HTML do Step 4, e um trecho do modal com os dois toggles. Servir `public/` num http-server local (porta livre) e:
- Conferir a **tag "Só no local"** na linha do item marcado (e ausência na linha normal).
- Conferir o toggle "Disponível para entrega" + a dica no modal.
- Screenshot desktop. Remover o harness e o screenshot ao fim.

- [ ] **Step 8: Commit**

```bash
git add public/admin.html public/app.js public/style.css
git commit -m "feat(cardapio): item 'só no local' — toggle no modal e tag na lista"
```

---

## Task 2: Helper puro `itensSoLocal` + defesa no servidor

**Files:**
- Modify: `src/cardapio-web.js` (novo helper + export, após `recalcularItens` ~linha 88)
- Test: `test/cardapio-web.test.js`
- Modify: `src/servidor.js` (`POST /api/c/:slug/pedido`, após o recálculo ~linha 659)

**Interfaces:**
- Produces: `itensSoLocal(cardapio, itensPayload) -> string[]` — nomes (sem repetição) dos itens do payload cujo item base tem `apenasLocal === true`. Vazio se nenhum. Ignora id inexistente.
- Consumes (servidor): `cardapioWeb.itensSoLocal`, `store.getCardapio(dir)`, `tipoEntrega`, `b.itens`.

- [ ] **Step 1: Escrever os testes que falham (`test/cardapio-web.test.js`)**

Acrescentar ao fim do arquivo:

```js
// ---- itensSoLocal ----
const cardapioSoLocal = {
  categorias: [
    { nome: "Pratos", itens: [
      { id: 1, nome: "Marmitex P", preco: 18, apenasLocal: false },
      { id: 2, nome: "Buffet por kg", preco: 60, apenasLocal: true },
      { id: 3, nome: "Sobremesa local", preco: 9, apenasLocal: true },
    ] },
  ],
};

test("itensSoLocal: retorna os nomes dos itens só-local presentes no payload", () => {
  const r = cw.itensSoLocal(cardapioSoLocal, [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(r, ["Buffet por kg"]);
});

test("itensSoLocal: vazio quando o payload não tem item só-local", () => {
  assert.deepEqual(cw.itensSoLocal(cardapioSoLocal, [{ id: 1 }]), []);
});

test("itensSoLocal: ignora id inexistente e não repete nomes", () => {
  const r = cw.itensSoLocal(cardapioSoLocal, [{ id: 2 }, { id: 2 }, { id: 99 }, { id: 3 }]);
  assert.deepEqual(r, ["Buffet por kg", "Sobremesa local"]);
});

test("itensSoLocal: payload/cardápio vazios → []", () => {
  assert.deepEqual(cw.itensSoLocal(null, null), []);
  assert.deepEqual(cw.itensSoLocal(cardapioSoLocal, []), []);
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm test`
Expected: FAIL — `cw.itensSoLocal is not a function`.

- [ ] **Step 3: Implementar o helper (`src/cardapio-web.js`)**

Inserir após a função `recalcularItens` (antes do bloco `// ---- Token de link`):

```js
// Nomes (sem repetição) dos itens do payload que são "só no local" (apenasLocal).
// Usado pelo servidor para barrar pedido de Entrega com item só-local.
function itensSoLocal(cardapio, itensPayload) {
  const mapa = {};
  ((cardapio && cardapio.categorias) || []).forEach(function (c) {
    ((c && c.itens) || []).forEach(function (it) { if (it) mapa[it.id] = it; });
  });
  const nomes = [];
  (itensPayload || []).forEach(function (p) {
    const base = mapa[p && p.id];
    if (base && base.apenasLocal === true && nomes.indexOf(base.nome) === -1) {
      nomes.push(base.nome);
    }
  });
  return nomes;
}
```

Atualizar o `module.exports`:

```js
module.exports = { parseOpcionais, projetarCardapio, recalcularItens, itensSoLocal, assinarToken, verificarToken, TOKEN_TTL_MS };
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test`
Expected: PASS (incl. os 4 testes novos).

- [ ] **Step 5: Defesa no servidor (`src/servidor.js`)**

No handler `POST /api/c/:slug/pedido`, logo **após**:

```js
    if (!recalc.itens.length) return res.status(400).json({ erro: "Carrinho vazio." });
```

inserir:

```js
    // Item "só no local" não sai para entrega (defesa real — o front também barra).
    if (tipoEntrega === "Entrega") {
      const soLocal = cardapioWeb.itensSoLocal(store.getCardapio(dir), b.itens);
      if (soLocal.length) {
        return res.status(400).json({ erro: "Estes itens são vendidos só no local e não saem para entrega: " + soLocal.join(", ") + ". Troque para Retirada ou remova-os." });
      }
    }
```

- [ ] **Step 6: Validar sintaxe + testes**

Run: `npm run check && npm test`
Expected: PASS.

- [ ] **Step 7: Validação da rota (servidor local, sem tocar produção)**

Escrever um script `scripts/_smoke-solocal.js` (temporário) que: monta um `cardapio` com um item `apenasLocal:true` em memória, e chama diretamente `cardapioWeb.itensSoLocal` com payloads (Entrega com item só-local → nomes; só itens normais → vazio). Rodar com `node scripts/_smoke-solocal.js`, conferir a saída e **remover o script** ao fim.

> A rota completa depende de tenant/Supabase; o teste de unidade (Step 1) + este smoke do helper cobrem a regra. A integração real será coberta na validação visual do checkout (Task 4) + revisão do handler.

- [ ] **Step 8: Commit**

```bash
git add src/cardapio-web.js test/cardapio-web.test.js src/servidor.js
git commit -m "feat(cardapio): barra entrega de item só-local no servidor (itensSoLocal)"
```

---

## Task 3: Projeção pública + selo "Só no local" na vitrine

**Files:**
- Modify: `src/cardapio-web.js` (`projetarCardapio` ~linha 39-47)
- Test: `test/cardapio-web.test.js`
- Modify: `public/cardapio.js` (`cardItem` ~linha 149-168)
- Modify: `public/cardapio.css`

**Interfaces:**
- Consumes: projeção pública (`GET /api/c/:slug`) passa a trazer `apenasLocal` por item.
- Produces: `DADOS.cardapio.categorias[].itens[].apenasLocal` disponível na vitrine (usado também pela Task 4).

- [ ] **Step 1: Expor `apenasLocal` na projeção (`src/cardapio-web.js`)**

No objeto montado por `projetarCardapio`, adicionar a chave (após `opcionais: parseOpcionais(item.opcionais),`):

```js
        apenasLocal: item.apenasLocal === true,
```

- [ ] **Step 2: Teste da projeção (`test/cardapio-web.test.js`)**

Adicionar um teste curto:

```js
test("projetarCardapio: expõe apenasLocal normalizado", () => {
  const cru = { categorias: [ { nome: "P", itens: [
    { id: 1, nome: "A", preco: 10, disponivel: true, apenasLocal: true },
    { id: 2, nome: "B", preco: 10, disponivel: true },
  ] } ] };
  const itens = cw.projetarCardapio(cru).categorias[0].itens;
  assert.equal(itens[0].apenasLocal, true);
  assert.equal(itens[1].apenasLocal, false);
});
```

- [ ] **Step 3: Selo no card da vitrine (`public/cardapio.js` `cardItem`)**

No `card.innerHTML`, logo após o `<h3>` do nome:

```js
        '<h3 class="cd-card-nome">' + esc(it.nome) + "</h3>" +
        (it.apenasLocal ? '<span class="cd-card-local">Só no local</span>' : "") +
```

> Manter o resto do card igual. O card segue clicável (o item pode ser pedido como Retirada).

- [ ] **Step 4: Estilo do selo (`public/cardapio.css`)**

Acrescentar:

```css
.cd-card-local {
  display: inline-block; margin-top: 4px;
  font-size: 11px; font-weight: 600; line-height: 1;
  padding: 3px 8px; border-radius: 999px;
  color: #b45309; background: #fef3c7; border: 1px solid #fde68a;
}
```

> Conferir as cores com o tema da vitrine (`cardapio.css`); se a vitrine tiver tokens próprios para "aviso/alerta", usar os tokens em vez dos hex. Ajustar para um chip âmbar legível sobre o fundo do card.

- [ ] **Step 5: Validar sintaxe + testes**

Run: `npm run check && npm test`
Expected: PASS.

- [ ] **Step 6: Validação visual (Playwright, via harness)**

Criar `public/_harness-vitrine.html` que carregue `cardapio.css` e renderize dois `.cd-card` (um normal, um com o selo "Só no local") usando o HTML do Step 3. Servir e screenshotar (desktop + mobile). Conferir que o selo aparece só no item certo e fica legível. Remover harness + screenshots ao fim.

- [ ] **Step 7: Commit**

```bash
git add src/cardapio-web.js test/cardapio-web.test.js public/cardapio.js public/cardapio.css
git commit -m "feat(cardapio): vitrine mostra selo 'Só no local' (projeção + card)"
```

---

## Task 4: Regra no checkout — desabilita Entrega com item só-local

**Files:**
- Modify: `public/cardapio.js` (helper novo + render do checkout, bloco `cd-tipo` ~linha 379-382; listener `[data-tipo]` ~397-404)
- Modify: `public/cardapio.css`

**Interfaces:**
- Consumes: `DADOS.cardapio` (com `apenasLocal`, da Task 3), `carrinho` (linhas com `l.id`), `tipoEntrega` (global, ~linha 329).

- [ ] **Step 1: Helper "carrinho tem item só-local" (`public/cardapio.js`)**

Adicionar perto dos helpers do carrinho (ex.: após `subtotal()`):

```js
  function itemEhSoLocal(id) {
    var cats = (DADOS.cardapio && DADOS.cardapio.categorias) || [];
    for (var i = 0; i < cats.length; i++) {
      var its = cats[i].itens || [];
      for (var j = 0; j < its.length; j++) {
        if (its[j].id === id && its[j].apenasLocal) return true;
      }
    }
    return false;
  }
  function carrinhoTemSoLocal() {
    return carrinho.some(function (l) { return itemEhSoLocal(l.id); });
  }
```

- [ ] **Step 2: Ajustar o render do checkout (`public/cardapio.js`)**

Na função que monta `#cdViewCheckout`, **antes** de montar `v.innerHTML`, computar e forçar Retirada quando houver item só-local:

```js
    var soLocal = carrinhoTemSoLocal();
    if (soLocal) tipoEntrega = "Retirada";
```

Trocar o bloco `cd-tipo` atual:

```js
        '<div class="cd-tipo">' +
          '<button type="button" data-tipo="Entrega" class="ativo">Entrega</button>' +
          '<button type="button" data-tipo="Retirada">Retirada</button>' +
        "</div>" +
```

por:

```js
        '<div class="cd-tipo">' +
          '<button type="button" data-tipo="Entrega"' + (soLocal ? ' class="cd-tipo-off" disabled' : (tipoEntrega === "Entrega" ? ' class="ativo"' : '')) + '>Entrega</button>' +
          '<button type="button" data-tipo="Retirada"' + (tipoEntrega === "Retirada" ? ' class="ativo"' : '') + '>Retirada</button>' +
        "</div>" +
        (soLocal ? '<p class="cd-tipo-nota">Seu carrinho tem itens vendidos só no local — disponível apenas para <strong>Retirada</strong>.</p>' : '') +
```

- [ ] **Step 3: Blindar o listener `[data-tipo]` (`public/cardapio.js`)**

No listener de clique dos botões `[data-tipo]`, ignorar botão desabilitado (defensivo — botão `disabled` já não dispara click, mas mantém claro):

```js
      b.addEventListener("click", function () {
        if (b.disabled) return;
        tipoEntrega = b.getAttribute("data-tipo");
        v.querySelectorAll("[data-tipo]").forEach(function (x) { x.classList.toggle("ativo", x === b); });
        renderEndereco();
        atualizarTotais();
      });
```

- [ ] **Step 4: Estilos (`public/cardapio.css`)**

Acrescentar:

```css
.cd-tipo button.cd-tipo-off { opacity: 0.45; cursor: not-allowed; }
.cd-tipo-nota { font-size: 12px; color: var(--cd-muted, #6b7280); margin: 8px 0 0; line-height: 1.4; }
```

> Conferir o token de texto secundário usado na `cardapio.css` e usá-lo no lugar do fallback `#6b7280`.

- [ ] **Step 5: Validar sintaxe**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 6: Validação visual (Playwright, via harness)**

Criar `public/_harness-checkout.html` que carregue `cardapio.css` e reproduza o bloco `cd-tipo` + a nota nos dois estados, e uma simulação mínima da lógica: um `DADOS.cardapio` com item `apenasLocal`, um `carrinho` com esse item, e a função `carrinhoTemSoLocal` — render mostrando Entrega desabilitada + Retirada ativa + nota; e um segundo estado (carrinho só com item normal) mostrando Entrega ativa. Screenshot dos dois estados. Conferir:
- Com item só-local: Entrega aparece apagada/`disabled`, Retirada ativa, nota visível; clicar em Entrega não muda nada.
- Sem item só-local: Entrega ativa, sem nota.
Remover harness + screenshots ao fim.

- [ ] **Step 7: Commit**

```bash
git add public/cardapio.js public/cardapio.css
git commit -m "feat(cardapio): checkout desabilita Entrega quando há item só-local"
```

---

## Notas de execução

- **Servir estáticos para o Playwright:** subir `npx http-server` na pasta `public` em porta livre (rodar como processo de background que persiste) e navegar para `http://127.0.0.1:<porta>/...` — `file://` é bloqueado. Encerrar o servidor (TaskStop) ao fim e remover os arquivos `_harness-*.html` e screenshots antes de cada commit.
- **`.playwright-mcp/`** já está no `.gitignore` (não commitar).
- **Compatibilidade:** confirmar, ao validar o modal, que abrir um item **antigo** (sem `apenasLocal`) deixa o toggle "Disponível para entrega" **ligado** (porque `it.apenasLocal !== true` é `true`).
- **PROGRESSO.md:** ao concluir, mover o item para ✅ Concluído via skill `concluir-tarefa` (fora do escopo deste plano).
```
