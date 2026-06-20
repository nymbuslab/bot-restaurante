# Impressão de pedido em térmica (80mm) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a atendente imprima cada pedido em impressora térmica 80mm (2 vias: cozinha sem preços + cupom completo), pelo navegador, exclusivo do Plano Completo.

**Architecture:** Impressão pelo navegador (`window.print()` + CSS `@page 80mm`). A montagem do texto das vias é uma função pura testável (`public/comanda.js`, dual-mode Node/browser); a orquestração de impressão fica em `public/impressao.js`; o painel ganha botões "Imprimir comanda" (gated por plano) e uma sub-aba "Impressora" com o toggle de corte. Nada muda no backend de pedidos; o toggle persiste em `config.impressao` (jsonb) via a rota `PUT /api/config` já existente.

**Tech Stack:** Node.js CommonJS, `node:test` (sem deps), front HTML/CSS/JS vanilla, Playwright (validação visual via impressão para PDF).

## Global Constraints

- **Idioma:** pt-BR em UI, comentários e textos.
- **CSP estrita:** todo JS é externo; **nunca** `<script>` inline nem handler inline (`onclick=`). Ligar eventos via `addEventListener` em `.js`.
- **Gating de plano:** feature visível só quando `planoAtual === "completo"` (front). Sem recurso de servidor a proteger (impressão é ação local).
- **Sem dependência nova.** Sem migração de banco. `config.impressao` é jsonb flexível.
- **Dinheiro:** formatação BR "centavos primeiro" / vírgula decimal. Em `comanda.js`, usar helper próprio `fmtBR` (não há acesso ao `Dinheiro.js` no Node).
- **Testes existentes verdes:** `npm test` (`node --test`) e `npm run check` devem continuar passando.
- **Largura alvo:** 80mm, ~48 colunas, fonte monoespaçada.
- **Shape do pedido** (camelCase, vindo de `pedidos.mapRow`): `{ numero, status, cliente, telefone, tipoEntrega ("Entrega"|"Retirada"), endereco, pagamento, taxaEntrega (number), itens: [{ nome, preco (number), qtd (number), opcionais: [{ nome, preco, qtd }], observacao }], total (number), observacao (geral), criadoEm (ISO) }`.

---

### Task 1: Função pura `montarComanda` + testes (TDD)

Cria a lógica de montagem das duas vias como texto monoespaçado, testável no `node --test` e reutilizável no browser.

**Files:**
- Create: `public/comanda.js`
- Test: `test/comanda.test.js`

**Interfaces:**
- Produces:
  - `montarComanda(pedido, config)` → `{ cozinha: string, cupom: string }` (cada string com linhas separadas por `\n`).
  - Exposto como `window.Comanda` no browser e `module.exports` no Node (dual-mode).

- [ ] **Step 1: Escrever os testes (que falham)**

Criar `test/comanda.test.js`:

```js
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { montarComanda } = require("../public/comanda.js");

const config = { restaurante: { nome: "Pizzaria do João" } };

const pedidoBase = {
  numero: 123,
  criadoEm: "2026-06-20T17:35:00.000Z", // 14:35 BRT
  cliente: "João Silva",
  telefone: "11987654321",
  tipoEntrega: "Entrega",
  endereco: "Rua X, 42, apto 101",
  pagamento: "Pix",
  taxaEntrega: 5.5,
  total: 60.5,
  observacao: "entrega rápida",
  itens: [
    { nome: "Burger X", preco: 25, qtd: 2,
      opcionais: [{ nome: "Bacon", preco: 3, qtd: 1 }, { nome: "Queijo Extra", preco: 2.5, qtd: 2 }],
      observacao: "sem cebola" },
    { nome: "Refrigerante", preco: 5, qtd: 1, opcionais: [], observacao: "" },
  ],
};

test("via cozinha: tem cabeçalho, número, itens e observações — SEM preços", () => {
  const { cozinha } = montarComanda(pedidoBase, config);
  assert.match(cozinha, /PIZZARIA DO JOÃO/i);
  assert.match(cozinha, /COZINHA/i);
  assert.match(cozinha, /#123/);
  assert.match(cozinha, /2x Burger X/);
  assert.match(cozinha, /Bacon/);
  assert.match(cozinha, /2x Queijo Extra/);
  assert.match(cozinha, /sem cebola/);
  assert.match(cozinha, /entrega rápida/);
  assert.equal(/R\$/.test(cozinha), false, "via cozinha não deve ter preços");
});

test("via cupom: tem cliente, endereço, pagamento, taxa e total", () => {
  const { cupom } = montarComanda(pedidoBase, config);
  assert.match(cupom, /CUPOM/i);
  assert.match(cupom, /João Silva/);
  assert.match(cupom, /Rua X, 42/);
  assert.match(cupom, /Pix/);
  assert.match(cupom, /5,50/);   // taxa
  assert.match(cupom, /60,50/);  // total
});

test("retirada: via cozinha marca RETIRADA e cupom omite endereço", () => {
  const ped = { ...pedidoBase, tipoEntrega: "Retirada", endereco: "" };
  const { cozinha, cupom } = montarComanda(ped, config);
  assert.match(cozinha, /RETIRADA/i);
  assert.equal(/End:/.test(cupom), false);
});

test("taxa 0: cupom omite a linha de taxa mas mantém o total", () => {
  const ped = { ...pedidoBase, taxaEntrega: 0, total: 55 };
  const { cupom } = montarComanda(ped, config);
  assert.equal(/Taxa/i.test(cupom), false);
  assert.match(cupom, /55,00/);
});

test("item sem opcionais/observação: 1 linha, sem 'Obs'", () => {
  const ped = { ...pedidoBase, itens: [{ nome: "Coca", preco: 5, qtd: 1, opcionais: [], observacao: "" }] };
  const { cozinha } = montarComanda(ped, config);
  assert.match(cozinha, /1x Coca/);
  assert.equal(/Obs:/.test(cozinha), false);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npm test`
Expected: FAIL — `Cannot find module '../public/comanda.js'`.

- [ ] **Step 3: Implementar `public/comanda.js`**

Criar `public/comanda.js`:

```js
// Montagem PURA das vias de impressão (comanda da cozinha + cupom do pedido).
// Dual-mode: window.Comanda no browser; module.exports no node --test.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Comanda = api;
})(typeof self !== "undefined" ? self : this, function () {
  const LARGURA = 48;

  function fmtBR(n) {
    return (Number(n) || 0).toFixed(2).replace(".", ",");
  }
  function sep(ch) { return (ch || "-").repeat(LARGURA); }
  function centro(txt) {
    const t = String(txt || "");
    if (t.length >= LARGURA) return t.slice(0, LARGURA);
    const esq = Math.floor((LARGURA - t.length) / 2);
    return " ".repeat(esq) + t;
  }
  // "Rótulo" à esquerda + "valor" à direita, preenchendo a largura.
  function linhaValor(rotulo, valor) {
    const r = String(rotulo || "");
    const v = String(valor || "");
    const espaco = Math.max(1, LARGURA - r.length - v.length);
    return r + " ".repeat(espaco) + v;
  }
  function dataHoraBR(iso) {
    try {
      return new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    } catch (_) { return ""; }
  }
  function opcionaisLinhas(op) {
    return (op || []).map((o) => {
      const q = (o.qtd && o.qtd > 1) ? o.qtd + "x " : "";
      return "   + " + q + (o.nome || "");
    });
  }

  function montarCozinha(pedido, config) {
    const nome = (config && config.restaurante && config.restaurante.nome) || "Pedido";
    const linhas = [];
    linhas.push(centro("*" + nome.toUpperCase() + "*"));
    linhas.push(centro("COMANDA - COZINHA"));
    linhas.push(sep("="));
    linhas.push(linhaValor("Pedido #" + pedido.numero, dataHoraBR(pedido.criadoEm)));
    linhas.push("Tipo: " + (pedido.tipoEntrega || "").toUpperCase());
    linhas.push(sep("-"));
    (pedido.itens || []).forEach((i) => {
      linhas.push((i.qtd || 1) + "x " + (i.nome || ""));
      opcionaisLinhas(i.opcionais).forEach((l) => linhas.push(l));
      if (i.observacao && i.observacao.trim()) linhas.push("   Obs: " + i.observacao.trim());
      linhas.push("");
    });
    if (linhas[linhas.length - 1] === "") linhas.pop();
    linhas.push(sep("-"));
    if (pedido.observacao && pedido.observacao.trim()) {
      linhas.push("Obs. geral: " + pedido.observacao.trim());
    }
    linhas.push(sep("="));
    return linhas.join("\n");
  }

  function montarCupom(pedido, config) {
    const nome = (config && config.restaurante && config.restaurante.nome) || "Pedido";
    const extrasDe = (i) => (i.opcionais || []).reduce((s, o) => s + (o.preco || 0) * (o.qtd || 1), 0);
    const subtotal = (pedido.itens || []).reduce((acc, i) => acc + ((i.preco || 0) + extrasDe(i)) * (i.qtd || 1), 0);
    const taxa = Number(pedido.taxaEntrega) || 0;
    const linhas = [];
    linhas.push(centro(nome.toUpperCase()));
    linhas.push(centro("CUPOM DO PEDIDO"));
    linhas.push(sep("="));
    linhas.push(linhaValor("Pedido #" + pedido.numero, dataHoraBR(pedido.criadoEm)));
    if (pedido.cliente) linhas.push("Cliente: " + pedido.cliente);
    if (pedido.telefone) linhas.push("Tel: " + pedido.telefone);
    linhas.push("Tipo: " + (pedido.tipoEntrega || "").toUpperCase());
    if (pedido.tipoEntrega === "Entrega" && pedido.endereco && pedido.endereco.trim() && pedido.endereco !== "—") {
      linhas.push("End: " + pedido.endereco.trim());
    }
    linhas.push(sep("-"));
    (pedido.itens || []).forEach((i) => {
      const sub = ((i.preco || 0) + extrasDe(i)) * (i.qtd || 1);
      linhas.push(linhaValor((i.qtd || 1) + "x " + (i.nome || ""), fmtBR(sub)));
      const op = (i.opcionais || []).map((o) => (o.qtd > 1 ? o.qtd + "x " : "") + o.nome).join(" / ");
      if (op) linhas.push("   " + op);
    });
    linhas.push(sep("-"));
    linhas.push(linhaValor("Subtotal:", fmtBR(subtotal)));
    if (taxa > 0) linhas.push(linhaValor("Taxa entrega:", fmtBR(taxa)));
    linhas.push(linhaValor("TOTAL:", fmtBR(pedido.total)));
    if (pedido.pagamento) linhas.push("Pagamento: " + pedido.pagamento);
    linhas.push(sep("="));
    return linhas.join("\n");
  }

  function montarComanda(pedido, config) {
    return { cozinha: montarCozinha(pedido, config), cupom: montarCupom(pedido, config) };
  }

  return { montarComanda, montarCozinha, montarCupom, fmtBR };
});
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: PASS — os 5 testes novos verdes; suíte existente intacta.

- [ ] **Step 5: Checar sintaxe**

Run: `npm run check`
Expected: OK (sem erro de sintaxe).

- [ ] **Step 6: Commit**

```bash
git add public/comanda.js test/comanda.test.js
git commit -m "feat(impressao): função pura montarComanda (2 vias 80mm) + testes"
```

---

### Task 2: Orquestração de impressão + CSS 80mm

Adiciona o container oculto, o módulo que injeta o texto e chama `window.print()` (respeitando o toggle de corte), e o CSS de impressão.

**Files:**
- Create: `public/impressao.js`
- Modify: `public/admin.html` (container `#area-impressao` + `<script src>`)
- Modify: `public/style.css` (regras `@media print` + `@page`)

**Interfaces:**
- Consumes: `window.Comanda.montarComanda(pedido, config)` (Task 1).
- Produces: `window.Impressao.imprimir(pedido, config)` — efeito colateral: imprime.

- [ ] **Step 1: Criar `public/impressao.js`**

```js
// Orquestra a impressão térmica pelo navegador (window.print + container oculto).
(function (global) {
  function setArea(texto) {
    const area = document.getElementById("area-impressao");
    if (!area) return;
    const pre = document.createElement("pre");
    pre.className = "cupom-print";
    pre.textContent = texto;
    area.innerHTML = "";
    area.appendChild(pre);
  }

  function imprimirTexto(texto) {
    setArea(texto);
    window.print();
  }

  // Imprime as 2 vias. cortarEntreVias=false → 1 trabalho (vias juntas com tracejado).
  // cortarEntreVias=true → 2 trabalhos encadeados (guilhotina corta entre elas).
  function imprimir(pedido, config) {
    if (!global.Comanda) return;
    const { cozinha, cupom } = global.Comanda.montarComanda(pedido, config);
    const cortar = !!(config && config.impressao && config.impressao.cortarEntreVias);
    if (!cortar) {
      const tracejado = "\n\n   ✂- - - - - - - - - - - - - -\n\n";
      imprimirTexto(cozinha + tracejado + cupom);
      return;
    }
    // 2 trabalhos: imprime a cozinha; ao terminar, imprime o cupom.
    const aoTerminar = () => {
      window.removeEventListener("afterprint", aoTerminar);
      imprimirTexto(cupom);
    };
    window.addEventListener("afterprint", aoTerminar);
    imprimirTexto(cozinha);
  }

  global.Impressao = { imprimir };
})(window);
```

- [ ] **Step 2: Adicionar o container oculto no `admin.html`**

Logo antes de `</body>` (junto dos outros overlays/modais), inserir:

```html
<!-- Área usada só na impressão térmica (oculta na tela; visível no @media print) -->
<div id="area-impressao" aria-hidden="true"></div>
```

- [ ] **Step 3: Carregar os scripts no `admin.html`**

Junto aos outros `<script src>` do final do `admin.html` (depois de `dinheiro.js`/`endereco-cep.js`, antes de `app.js`), adicionar — nessa ordem (comanda antes de impressao):

```html
<script src="comanda.js"></script>
<script src="impressao.js"></script>
```

- [ ] **Step 4: Adicionar o CSS de impressão em `public/style.css`**

No fim do arquivo:

```css
/* ---- Impressão térmica (80mm) ---- */
#area-impressao { display: none; }
.cupom-print {
  font-family: "Courier New", monospace;
  font-size: 12px;
  line-height: 1.25;
  white-space: pre-wrap;
  margin: 0;
}
@media print {
  body > *:not(#area-impressao) { display: none !important; }
  #area-impressao { display: block; }
  .cupom-print { font-size: 12px; }
}
@page { size: 80mm auto; margin: 0; }
```

- [ ] **Step 5: Checar sintaxe**

Run: `npm run check`
Expected: OK.

- [ ] **Step 6: Commit**

```bash
git add public/impressao.js public/admin.html public/style.css
git commit -m "feat(impressao): orquestração window.print + container 80mm + CSS"
```

---

### Task 3: Botão "Imprimir comanda" nos modais (com gating)

Liga os botões nos dois modais (detalhe do pedido e novo pedido), só visíveis no Plano Completo.

**Files:**
- Modify: `public/admin.html` (botões nos dois modais)
- Modify: `public/app.js` (handlers + gating; resolver pedido completo no modal de novo pedido)

**Interfaces:**
- Consumes: `window.Impressao.imprimir(pedido, config)` (Task 2); `planoAtual`, `configAtual`, `pedidosCache`, `novoPedidoNumeroAtual`, `carregarPedidos()` (já existem em `app.js`).

- [ ] **Step 1: Botão no modal de detalhe do pedido (`admin.html`)**

No rodapé de ações do modal de pedido (onde fica o botão "Avisar cliente"/fechar), adicionar:

```html
<button type="button" id="btnImprimirPedido" class="btn-sec" hidden>🖨️ Imprimir comanda</button>
```

- [ ] **Step 2: Botão no modal de novo pedido (`admin.html`)**

No bloco de ações do `#novo-pedido-overlay` (junto de `np-visualizar`/`np-fechar`), adicionar:

```html
<button type="button" id="np-imprimir" class="btn-sec" hidden>🖨️ Imprimir comanda</button>
```

- [ ] **Step 3: Handler do botão no detalhe do pedido (`app.js`)**

Em `abrirModalPedido(p)` (≈ `app.js:2242`), guardar o pedido atual e mostrar/ocultar o botão conforme o plano. Adicionar, perto do início da função:

```js
  pedidoModalAtual = p;
  const btnImp = $("btnImprimirPedido");
  if (btnImp) btnImp.hidden = planoAtual !== "completo";
```

Declarar a variável de estado junto às outras globais do topo de `app.js` (perto de `let planoAtual`):

```js
let pedidoModalAtual = null; // pedido aberto no modal de detalhe (p/ impressão)
```

Ligar o clique (uma vez, perto dos outros `addEventListener` de pedido):

```js
if ($("btnImprimirPedido")) {
  $("btnImprimirPedido").addEventListener("click", () => {
    if (pedidoModalAtual && window.Impressao) window.Impressao.imprimir(pedidoModalAtual, configAtual);
  });
}
```

- [ ] **Step 4: Handler do botão no modal de novo pedido (`app.js`)**

O objeto do modal de novo pedido (`d` de `/api/pedidos/ultimo`) é **leve** (só nº/cliente/itens/total). Para imprimir o cupom completo, resolver o pedido inteiro a partir do `pedidosCache`. Em `abrirNovoPedido(d)` (≈ `app.js:265`), mostrar/ocultar o botão:

```js
  const btnNpImp = $("np-imprimir");
  if (btnNpImp) btnNpImp.hidden = planoAtual !== "completo";
```

Ligar o clique (perto de `np-fechar`/`np-visualizar`, ≈ `app.js:303`):

```js
if ($("np-imprimir")) {
  $("np-imprimir").addEventListener("click", async () => {
    await carregarPedidos();
    const p = pedidosCache.find((x) => x.numero === novoPedidoNumeroAtual);
    if (p && window.Impressao) window.Impressao.imprimir(p, configAtual);
  });
}
```

- [ ] **Step 5: Checar sintaxe**

Run: `npm run check`
Expected: OK.

- [ ] **Step 6: Commit**

```bash
git add public/admin.html public/app.js
git commit -m "feat(impressao): botão Imprimir comanda nos modais (gated por plano)"
```

---

### Task 4: Sub-aba "Impressora" em Configurações + persistência do toggle

Adiciona a 4ª sub-aba (gated), o toggle de corte e a leitura/escrita de `config.impressao.cortarEntreVias`.

**Files:**
- Modify: `public/admin.html` (botão da sub-nav + painel `cfg-sub-impressora`)
- Modify: `public/app.js` (gating + ler no save + preencher no load)

**Interfaces:**
- Consumes: handler genérico de sub-abas (`app.js:1685`), `planoAtual`, `configAtual`, `carregarConta()`, `preencherConfig()`, fluxo de `btnSalvarConfig`.

- [ ] **Step 1: Botão da sub-aba na `.cfg-subnav` (`admin.html`)**

Depois do botão `data-sub="entrega"` (≈ `admin.html:166`), adicionar:

```html
<button type="button" data-sub="impressora" role="tab">
  <span>Impressora</span>
</button>
```

- [ ] **Step 2: Painel da sub-aba (`admin.html`)**

Depois do fechamento de `#cfg-sub-entrega`, adicionar:

```html
<div class="cfg-sub" id="cfg-sub-impressora">
  <div class="cfg-card">
    <h3>Impressão de pedidos</h3>
    <p class="sub">Imprima a comanda do pedido numa impressora térmica 80mm (ex.: Elgin i7/i8, Epson T20x). Escolha a impressora na 1ª impressão — o navegador lembra depois.</p>

    <div id="impressoraLock" class="upsell" hidden>
      <p>🔒 A impressão de pedidos faz parte do <strong>Plano Completo</strong>.</p>
      <button type="button" id="btnVerPlanosImpressora" class="btn-sec">Ver planos</button>
    </div>

    <div id="impressoraConfig" hidden>
      <label class="cfg-toggle">
        <input type="checkbox" id="cfgCortarVias">
        <span>Cortar entre a via da cozinha e o cupom (sai em 2 cupons separados)</span>
      </label>
      <p class="sub">Desligado (padrão): as duas vias saem juntas, separadas por um tracejado para destacar à mão. Ligado: a guilhotina corta automaticamente entre elas (gera 2 caixas de impressão no modo manual).</p>
    </div>
  </div>
</div>
```

> Reuso de classes existentes: `.cfg-card`, `.sub`, `.upsell`, `.btn-sec`, `.cfg-toggle` (conferir os nomes reais no `admin.html`/`style.css` ao implementar; se `.cfg-toggle` não existir, usar o mesmo padrão de toggle já usado em "Comportamento do bot").

- [ ] **Step 3: Função de gating + ligação (`app.js`)**

Adicionar a função (perto de `renderEntregaModo`, ≈ `app.js:1697`):

```js
// Sub-aba Impressora: Completo vê a config; Essencial vê o cadeado/upsell.
function renderImpressoraGate() {
  const completo = planoAtual === "completo";
  const lock = $("impressoraLock");
  const cfg = $("impressoraConfig");
  if (lock) lock.hidden = completo;
  if (cfg) cfg.hidden = !completo;
}
```

Ligar o botão "Ver planos" da sub-aba (perto de `btnVerPlanos`, ≈ `app.js:1721`):

```js
if ($("btnVerPlanosImpressora")) {
  $("btnVerPlanosImpressora").addEventListener("click", () => {
    const btnAssin = document.querySelector('.sidebar [data-aba="assinatura"]');
    if (btnAssin) btnAssin.click();
  });
}
```

- [ ] **Step 4: Chamar o gating quando o plano é conhecido (`app.js`)**

Em `carregarConta()` (≈ `app.js:1785`), logo após `renderEntregaModo();`, adicionar:

```js
    renderImpressoraGate();
```

- [ ] **Step 5: Preencher o toggle ao carregar config (`app.js`)**

Em `preencherConfig()` (chamada por `carregarConfig`), setar o checkbox a partir de `configAtual.impressao`. Adicionar:

```js
  const cortar = $("cfgCortarVias");
  if (cortar) cortar.checked = !!(configAtual.impressao && configAtual.impressao.cortarEntreVias);
```

- [ ] **Step 6: Ler o toggle ao salvar config (`app.js`)**

No handler `btnSalvarConfig` (≈ `app.js:1661`, junto das outras atribuições em `configAtual`), adicionar:

```js
  if (!configAtual.impressao) configAtual.impressao = {};
  configAtual.impressao.cortarEntreVias = ($("cfgCortarVias") || {}).checked === true;
```

- [ ] **Step 7: Checar sintaxe**

Run: `npm run check`
Expected: OK.

- [ ] **Step 8: Commit**

```bash
git add public/admin.html public/app.js
git commit -m "feat(impressao): sub-aba Impressora + toggle de corte (config.impressao)"
```

---

### Task 5: Validação visual com Playwright (impressão para PDF)

Valida o golden path e o gating no navegador, imprimindo para PDF (sem hardware).

**Files:**
- (Sem arquivo de produção; validação manual roteirizada com Playwright/`webapp-testing`.)

- [ ] **Step 1: Subir o app local e logar com uma conta de teste no Plano Completo**

Abrir o painel, ir à aba Pedidos, abrir um pedido real (ou criar um pedido de teste pelo cardápio web).

- [ ] **Step 2: Validar o botão e a impressão (modo padrão — vias juntas)**

- Confirmar que "🖨️ Imprimir comanda" aparece no modal (conta Completo).
- Clicar e, via Playwright, capturar o PDF da impressão (`page.pdf()` ou interceptar o print) — conferir que o conteúdo tem: cabeçalho do restaurante, "COMANDA - COZINHA", itens/opcionais/observações **sem R$**, o tracejado `✂`, depois "CUPOM DO PEDIDO" com cliente/endereço/pagamento/total.
- Expected: 1 documento com as 2 vias.

- [ ] **Step 3: Validar o modo "cortar entre vias" (2 trabalhos)**

- Em Configurações → Impressora, ligar o toggle e salvar.
- Imprimir um pedido e confirmar **2 trabalhos** de impressão (cozinha, depois cupom).
- Expected: dois documentos separados.

- [ ] **Step 4: Validar o gating (Plano Essencial)**

- Com uma conta Essencial (ou simulando `planoAtual`), confirmar que o botão "Imprimir comanda" **não aparece** e que a sub-aba Impressora mostra o **cadeado/upsell** (sem o toggle).

- [ ] **Step 5: Registrar o resultado**

Anotar no PROGRESSO/checklist: "validado E2E (Playwright, impressão→PDF) nos 2 modos + gating". Se algum passo não puder rodar por falta de sessão, declarar explicitamente "build/sintaxe OK, UI não validada visualmente" (conforme a definição de tarefa concluída do projeto).

---

### Task 6: Documentação + marco

Atualiza as documentações (pedido explícito do usuário) e fecha o ciclo.

**Files:**
- Modify: `PROGRESSO.md`, `ROADMAP.md`, `CLAUDE.md`, `docs/planos-e-frete.md`, `CHANGELOG.md`

- [ ] **Step 1: `ROADMAP.md`** — na seção "Fase 3 — Os duros", atualizar o item de **Impressão**: marcar como **entregue parcialmente** pelo caminho navegador (comanda + cupom, 80mm, manual, Plano Completo); ESC/POS via QZ Tray (corte fino/silencioso, sem painel aberto) permanece como evolução futura.

- [ ] **Step 2: `docs/planos-e-frete.md`** — incluir **Impressão térmica** como 2º benefício do Plano Completo (ao lado do frete por raio): gating no front (`planoAtual === "completo"`), sub-aba Impressora + toggle de corte, e o passo a passo opcional do **kiosk-printing** (atalho `chrome.exe --kiosk-printing`) para impressão silenciosa/automática.

- [ ] **Step 3: `CLAUDE.md`** — citar a impressão térmica como benefício do Completo; adicionar `public/comanda.js` e `public/impressao.js` na árvore de arquivos; mencionar o campo `config.impressao`.

- [ ] **Step 4: `CHANGELOG.md`** — novo marco em linguagem observável (ex.: "Impressão de pedido na térmica 80mm — botão Imprimir comanda no painel, 2 vias (cozinha + cupom), exclusivo do Plano Completo; opção de cortar entre as vias").

- [ ] **Step 5: `PROGRESSO.md`** — mover o item para ✅ Concluído com a data e o resumo do que foi validado.

- [ ] **Step 6: Commit**

```bash
git add PROGRESSO.md ROADMAP.md CLAUDE.md docs/planos-e-frete.md CHANGELOG.md
git commit -m "docs(impressao): impressão térmica como benefício do Completo + marco"
```

---

## Self-Review

**Spec coverage:**
- Caminho navegador / window.print → Tasks 1–2. ✓
- Botão manual nos 2 modais + gating Completo → Task 3. ✓
- 2 vias (cozinha sem preços + cupom completo) → Task 1 (lógica) + Task 2 (montagem do documento). ✓
- Toggle "cortar entre vias" em `config.impressao` + sub-aba Impressora → Task 4. ✓
- Testes (node:test) → Task 1; validação visual Playwright → Task 5. ✓
- Casos de borda (retirada sem endereço, taxa 0, item sem opcionais) → Task 1 (testes cobrem). ✓
- Documentação → Task 6. ✓
- Sem migração / sem mudança no backend de pedidos → respeitado (só `config.impressao` via PUT existente). ✓

**Placeholder scan:** sem TBD/TODO; todo passo de código mostra o código. A única instrução "conferir nome real da classe" (Task 4 Step 2) é uma checagem de fidelidade ao CSS existente, não um placeholder de lógica.

**Type consistency:** `montarComanda(pedido, config) → { cozinha, cupom }` definido na Task 1 e consumido igual em `impressao.js` (Task 2) e nos handlers (Task 3). `window.Impressao.imprimir(pedido, config)` consistente entre Tasks 2–3. `config.impressao.cortarEntreVias` consistente entre Tasks 2 e 4.
