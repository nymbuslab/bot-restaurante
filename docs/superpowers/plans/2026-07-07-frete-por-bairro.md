# Frete por bairro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma 3ª modalidade de frete (por bairro cadastrado, valor fixo por bairro) ao Plano Completo, valendo no cardápio web e no PDV.

**Architecture:** Reusa toda a espinha do frete por raio: 3º valor de `config.frete.modo` (`"bairro"`), mesma política "fora da área" (`retirada`|`bloqueia`), mesmos endpoints `/frete`, mesmo gate de plano. O match do bairro é **puro** (`src/frete.js`); o servidor é a fonte de verdade do valor. Sem Geoapify (é lookup nome→valor) e sem migração (config é jsonb).

**Tech Stack:** Node.js CommonJS, `node:test` (testes puros), Express, front HTML/CSS/JS vanilla, `dinheiro.js` (máscara monetária).

## Global Constraints

- **Sem migração de banco** — `config.frete.bairro` vive no jsonb existente.
- **Gate:** feature do Plano Completo, via `empresas.temFreteRaio(emp)` (= acesso liberado + plano completo). O servidor força `modo:"fixo"` se não for completo.
- **Match:** igualdade **normalizada exata** (minúsculas + remove acento + colapsa espaços). Sem fuzzy/"contém".
- **Fora da área:** reusa `foraDaArea` (`"retirada"` | `"bloqueia"`), default `"retirada"`.
- **Bot fora de escopo** — só cardápio web e PDV.
- **Dinheiro** sempre via `window.Dinheiro` (máscara "centavos primeiro"); **nunca** `type=number`/`parseFloat` em campo de R$.
- **CSP estrita** — nada de `<script>`/handler inline; só `addEventListener` nos `.js` externos.
- **Ícones SVG**, nunca emojis, na UI de produto.

---

### Task 1: Núcleo puro do frete por bairro (`src/frete.js` + testes)

**Files:**
- Modify: `src/frete.js` (adicionar 3 funções + estender `freteDeConfig`; atualizar `module.exports`)
- Test: `test/frete.test.js` (append)

**Interfaces:**
- Consumes: `freteDeConfig(config)` já existente (será estendido).
- Produces:
  - `normalizarNome(s: string) => string`
  - `encontrarBairro(nomeCliente: string, faixas: Array<{nome,valor}>) => {nome: string, valor: number} | null`
  - `resolverFreteBairro(f, bairroCliente: string) => {entrega_disponivel: boolean, valor_frete: number|null, foraDaArea: "retirada"|"bloqueia", bairro: string|null}` — onde `f = freteDeConfig(config)`
  - `freteDeConfig(config).bairro => { faixas: Array<{nome: string, valor: number}>, foraDaArea: "retirada"|"bloqueia" }`

- [ ] **Step 1: Escrever os testes que falham**

Append ao final de `test/frete.test.js`, e adicionar os 3 nomes novos ao `require` do topo (linha 3-5), que passa a ser:

```js
const {
  calcularDistanciaKm, encontrarFaixa, montarEnderecoCompleto, freteDeConfig, calcularFreteRaio,
  normalizarNome, encontrarBairro, resolverFreteBairro,
} = require("../src/frete");
```

Testes (append):

```js
// ---- normalizarNome ----
test("normalizarNome: remove acento, caixa e espaços duplicados", () => {
  assert.equal(normalizarNome("  Jardim  AMÉRICA "), "jardim america");
  assert.equal(normalizarNome("São João"), "sao joao");
});

// ---- encontrarBairro ----
const BAIRROS = [{ nome: "Centro", valor: 5 }, { nome: "Jardim América", valor: 8 }];
test("encontrarBairro: match exato ignora acento/caixa/espaço", () => {
  assert.deepEqual(encontrarBairro("centro", BAIRROS), { nome: "Centro", valor: 5 });
  assert.deepEqual(encontrarBairro(" jardim  america ", BAIRROS), { nome: "Jardim América", valor: 8 });
});
test("encontrarBairro: sem match / vazio / lista vazia → null", () => {
  assert.equal(encontrarBairro("Vila Santa Rosa", BAIRROS), null);
  assert.equal(encontrarBairro("", BAIRROS), null);
  assert.equal(encontrarBairro("Centro", []), null);
  assert.equal(encontrarBairro("Centro", null), null);
});

// ---- resolverFreteBairro ----
test("resolverFreteBairro: casa → disponível + valor + foraDaArea da config", () => {
  const f = freteDeConfig({ frete: { modo: "bairro", bairro: { faixas: BAIRROS, foraDaArea: "bloqueia" } } });
  const r = resolverFreteBairro(f, "CENTRO");
  assert.equal(r.entrega_disponivel, true);
  assert.equal(r.valor_frete, 5);
  assert.equal(r.bairro, "Centro");
  assert.equal(r.foraDaArea, "bloqueia");
});
test("resolverFreteBairro: não casa → indisponível + foraDaArea default", () => {
  const f = freteDeConfig({ frete: { modo: "bairro", bairro: { faixas: BAIRROS } } });
  const r = resolverFreteBairro(f, "Outro Bairro");
  assert.equal(r.entrega_disponivel, false);
  assert.equal(r.valor_frete, null);
  assert.equal(r.foraDaArea, "retirada");
});

// ---- freteDeConfig: bloco bairro ----
test("freteDeConfig: bloco bairro normalizado (descarta linha sem nome)", () => {
  const f = freteDeConfig({ frete: { modo: "bairro", bairro: { faixas: [{ nome: "Centro", valor: 5 }, { valor: 9 }] } } });
  assert.equal(f.modo, "bairro");
  assert.equal(f.bairro.faixas.length, 1);
  assert.equal(f.bairro.faixas[0].nome, "Centro");
  assert.equal(f.bairro.foraDaArea, "retirada");
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test`
Expected: FAIL — `TypeError: normalizarNome is not a function` (e afins).

- [ ] **Step 3: Implementar as funções puras**

Em `src/frete.js`, adicionar logo após a função `normalizar` (linha ~53):

```js
// Normaliza NOME (bairro) p/ comparação: minúsculas + REMOVE ACENTO + colapsa
// espaços + trim. Distinta de `normalizar` (que não remove acento). Pura.
function normalizarNome(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

// Acha o bairro cadastrado que casa (igualdade normalizada EXATA) com o do
// cliente. `faixas`: [{ nome, valor }]. Retorna { nome, valor } ou null. Pura.
function encontrarBairro(nomeCliente, faixas) {
  if (!Array.isArray(faixas)) return null;
  const alvo = normalizarNome(nomeCliente);
  if (!alvo) return null;
  for (const f of faixas) {
    if (!f || !f.nome) continue;
    if (normalizarNome(f.nome) === alvo) return { nome: f.nome, valor: Number(f.valor) || 0 };
  }
  return null;
}

// Resolve o frete por bairro a partir da config normalizada + bairro do cliente.
// `f` = freteDeConfig(config). Retorna { entrega_disponivel, valor_frete,
// foraDaArea, bairro }. Pura.
function resolverFreteBairro(f, bairroCliente) {
  const bloco = (f && f.bairro) || {};
  const foraDaArea = bloco.foraDaArea === "bloqueia" ? "bloqueia" : "retirada";
  const faixas = Array.isArray(bloco.faixas) ? bloco.faixas : [];
  const m = encontrarBairro(bairroCliente, faixas);
  if (!m) return { entrega_disponivel: false, valor_frete: null, foraDaArea, bairro: null };
  return { entrega_disponivel: true, valor_frete: m.valor, foraDaArea, bairro: m.nome };
}
```

Estender `freteDeConfig` (linha ~57-74) para incluir o bloco `bairro`. Substituir a função inteira por:

```js
function freteDeConfig(config) {
  const c = config || {};
  const frete = c.frete || {};
  const modo = frete.modo === "raio" ? "raio" : frete.modo === "bairro" ? "bairro" : "fixo";
  const taxaLegado = (c.atendimento && c.atendimento.taxaEntrega) || 0;
  const taxaFixa = Number(frete.taxaFixa != null ? frete.taxaFixa : taxaLegado) || 0;
  const raio = frete.raio || {};
  const bairro = frete.bairro || {};
  return {
    modo,
    taxaFixa,
    raio: {
      coordEmpresa: raio.coordEmpresa || null,
      enderecoBase: raio.enderecoBase || "",
      faixas: Array.isArray(raio.faixas) ? raio.faixas : [],
      foraDaArea: raio.foraDaArea === "bloqueia" ? "bloqueia" : "retirada",
    },
    bairro: {
      faixas: Array.isArray(bairro.faixas)
        ? bairro.faixas.filter((b) => b && b.nome).map((b) => ({ nome: String(b.nome), valor: Number(b.valor) || 0 }))
        : [],
      foraDaArea: bairro.foraDaArea === "bloqueia" ? "bloqueia" : "retirada",
    },
  };
}
```

Atualizar o `module.exports` (linha ~132-135) para:

```js
module.exports = {
  calcularDistanciaKm, encontrarFaixa, montarEnderecoCompleto, normalizar,
  freteDeConfig, calcularFreteRaio, geocodificar,
  normalizarNome, encontrarBairro, resolverFreteBairro,
};
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: PASS — todos os testes de `frete.test.js` (antigos + novos) verdes.

- [ ] **Step 5: Commit**

```bash
git add src/frete.js test/frete.test.js
git commit -m "feat(frete): nucleo puro do frete por bairro (match normalizado + resolver)"
```

---

### Task 2: Servidor — endpoints e persistência do modo bairro (`src/servidor.js`)

**Files:**
- Modify: `src/servidor.js` (projeção, 2 endpoints `/frete`, `calcularFretePdv`, `/pedido`, `/vender`, `normalizarConfigServidor`, gate do `PUT /api/config`)

**Interfaces:**
- Consumes: `frete.freteDeConfig`, `frete.resolverFreteBairro`, `sanitizarEnderecoCampos` (retorna `{cep, logradouro, numero, complemento, bairro, cidade, uf}`), `empresas.temFreteRaio`.
- Produces (contratos de API consumidos pelas Tasks 4 e 5):
  - `POST /api/c/:slug/frete` no modo bairro: recebe `{ bairro }` → `{ entrega_disponivel, valor_frete, bairro, foraDaArea }` ou `{ entrega_disponivel:false, foraDaArea, mensagem }`.
  - `POST /api/pdv/frete`: recebe `{ cep, numero, bairro }` → `{ entrega_disponivel, valor_frete, foraDaArea, incompleto }`.
  - `GET /api/c/:slug` projeção `frete`: no modo bairro → `{ modo:"bairro", foraDaArea, configurado }`.

- [ ] **Step 1: Projeção do cardápio expõe o modo bairro**

Em `GET /api/c/:slug`, substituir o IIFE de `frete:` (linhas ~607-612) por:

```js
      frete: (function () {
        const f = frete.freteDeConfig(config);
        if (f.modo === "raio") return { modo: "raio", foraDaArea: f.raio.foraDaArea, configurado: !!(f.raio.coordEmpresa && f.raio.faixas.length) };
        if (f.modo === "bairro") return { modo: "bairro", foraDaArea: f.bairro.foraDaArea, configurado: f.bairro.faixas.length > 0 };
        return { modo: "fixo", taxaFixa: f.taxaFixa };
      })(),
```

- [ ] **Step 2: `POST /api/c/:slug/frete` — ramo bairro**

No handler (linha ~700), logo após `const f = frete.freteDeConfig(store.getConfig(dir));`, mover a leitura de `const b = req.body || {};` para antes e inserir o ramo bairro **antes** do check `if (f.modo !== "raio")`. O bloco resultante (substituindo as linhas ~706-720 até o início do cálculo de raio):

```js
    const f = frete.freteDeConfig(store.getConfig(dir));
    const b = req.body || {};

    // Modo BAIRRO: casa o bairro informado (sem geocodificar).
    if (f.modo === "bairro") {
      const r = frete.resolverFreteBairro(f, b.bairro);
      if (!r.entrega_disponivel) {
        return res.json({ entrega_disponivel: false, foraDaArea: r.foraDaArea, mensagem: "Não atendemos seu bairro." });
      }
      return res.json({ entrega_disponivel: true, valor_frete: r.valor_frete, bairro: r.bairro, foraDaArea: r.foraDaArea });
    }

    if (f.modo !== "raio") return res.status(400).json({ erro: "Cálculo de frete não está ativo." });
    if (!f.raio.coordEmpresa || !f.raio.faixas.length) {
      return res.json({ entrega_disponivel: false, foraDaArea: f.raio.foraDaArea, mensagem: "Entrega indisponível no momento." });
    }
    const cepDig = String(b.cep || "").replace(/\D/g, "");
    const numero = String(b.numero || "").trim().slice(0, 20);
```

(o restante do cálculo de raio — `if (cepDig.length !== 8) ...` em diante — permanece igual; apenas garantir que o antigo `const b = req.body || {};` interno ao raio foi removido, pois `b` já foi declarado acima.)

- [ ] **Step 3: `calcularFretePdv` — ramo bairro**

Substituir a função (linhas ~780-792) por:

```js
async function calcularFretePdv(dir, tipoEntrega, enderecoCampos) {
  if (tipoEntrega !== "Entrega") return { taxa: 0, entrega_disponivel: true };
  const f = frete.freteDeConfig(store.getConfig(dir));
  if (f.modo === "bairro") {
    const ec = sanitizarEnderecoCampos(enderecoCampos);
    const r = frete.resolverFreteBairro(f, ec.bairro);
    if (!r.entrega_disponivel) return { taxa: 0, entrega_disponivel: false, foraDaArea: true };
    return { taxa: Number(r.valor_frete) || 0, entrega_disponivel: true };
  }
  if (f.modo !== "raio") return { taxa: Number(f.taxaFixa) || 0, entrega_disponivel: true };
  if (!f.raio.coordEmpresa || !f.raio.faixas.length) return { taxa: 0, entrega_disponivel: false, foraDaArea: true };
  const ec = sanitizarEnderecoCampos(enderecoCampos);
  if (ec.cep.length !== 8 || !ec.numero) return { taxa: 0, entrega_disponivel: false, incompleto: true };
  const endCep = await cep.buscarCep(ec.cep);
  const coordCli = endCep ? await frete.geocodificar(frete.montarEnderecoCompleto(Object.assign({}, endCep, { numero: ec.numero }))) : null;
  const rr = frete.calcularFreteRaio(f.raio.coordEmpresa, coordCli, f.raio.faixas);
  if (!rr.entrega_disponivel) return { taxa: 0, entrega_disponivel: false, foraDaArea: true, distancia: rr.distancia_km };
  return { taxa: Number(rr.valor_frete) || 0, entrega_disponivel: true, distancia: rr.distancia_km };
}
```

- [ ] **Step 4: `POST /api/pdv/frete` envia o bairro ao helper**

Na rota (linha ~1912), trocar:

```js
    const r = await calcularFretePdv(req.tenantDir, "Entrega", { cep: b.cep, numero: b.numero });
```

por:

```js
    const r = await calcularFretePdv(req.tenantDir, "Entrega", { cep: b.cep, numero: b.numero, bairro: b.bairro });
```

- [ ] **Step 5: `POST /api/c/:slug/pedido` — recálculo do frete por bairro**

Substituir o bloco de frete (linhas ~842-857) por:

```js
    const f = frete.freteDeConfig(config);
    let taxaEntrega = 0;
    if (tipoEntrega === "Entrega") {
      if (f.modo === "bairro") {
        const ec = sanitizarEnderecoCampos(b.enderecoCampos);
        const r = frete.resolverFreteBairro(f, ec.bairro);
        if (!r.entrega_disponivel) return res.status(409).json({ erro: "Não atendemos seu bairro." });
        taxaEntrega = r.valor_frete;
      } else if (f.modo === "raio") {
        if (!f.raio.coordEmpresa || !f.raio.faixas.length) return res.status(409).json({ erro: "Entrega indisponível no momento." });
        const ec = sanitizarEnderecoCampos(b.enderecoCampos);
        if (ec.cep.length !== 8 || !ec.numero) return res.status(400).json({ erro: "Endereço incompleto para entrega (CEP e número)." });
        const endCep = await cep.buscarCep(ec.cep);
        const coordCli = endCep ? await frete.geocodificar(frete.montarEnderecoCompleto(Object.assign({}, endCep, { numero: ec.numero }))) : null;
        const rr = frete.calcularFreteRaio(f.raio.coordEmpresa, coordCli, f.raio.faixas);
        if (!rr.entrega_disponivel) return res.status(409).json({ erro: "Endereço fora da área de entrega." });
        taxaEntrega = rr.valor_frete;
      } else {
        taxaEntrega = f.taxaFixa;
      }
    }
```

- [ ] **Step 6: `normalizarConfigServidor` — clampa as faixas de bairro**

Em `normalizarConfigServidor` (após o bloco `body.frete.raio.faixas`, linha ~1447), adicionar:

```js
  if (body.frete && body.frete.bairro && Array.isArray(body.frete.bairro.faixas)) {
    body.frete.bairro.faixas = body.frete.bairro.faixas
      .filter((b) => b && typeof b === "object" && String(b.nome || "").trim())
      .map((b) => ({ nome: String(b.nome).trim().slice(0, 80), valor: nn(b.valor) }));
  }
```

- [ ] **Step 7: `PUT /api/config` — gate do modo bairro**

Trocar a condição do gate (linha ~1469) de:

```js
    if (body.frete && body.frete.modo === "raio") {
      const emp = await empresas.buscarPorSlug(req.slug);
      if (!empresas.temFreteRaio(emp)) {
        body.frete.modo = "fixo"; // sem Completo → não ativa o raio
      } else {
```

por (o bloco de geocodificação passa a rodar **só** no modo raio):

```js
    if (body.frete && (body.frete.modo === "raio" || body.frete.modo === "bairro")) {
      const emp = await empresas.buscarPorSlug(req.slug);
      if (!empresas.temFreteRaio(emp)) {
        body.frete.modo = "fixo"; // sem Completo → não ativa frete avançado (raio/bairro)
      } else if (body.frete.modo === "raio") {
```

(o corpo do `else if` — geocodificação da empresa — permanece igual; o modo bairro não precisa de nada extra aqui.)

- [ ] **Step 8: Validar sintaxe e testes puros**

Run: `npm run check`
Expected: sem erros de sintaxe.

Run: `npm test`
Expected: PASS — suíte completa verde (os testes da Task 1 provam o núcleo; o wiring do servidor não tem teste unitário, seguindo a convenção do projeto — será validado no browser nas Tasks 4-5).

- [ ] **Step 9: Commit**

```bash
git add src/servidor.js
git commit -m "feat(frete): servidor resolve frete por bairro (cardapio web + PDV) com gate Completo"
```

---

### Task 3: Aba Configurações → Entrega — cadastro de bairros (`public/admin.html` + `public/app.js`)

**Files:**
- Modify: `public/admin.html` (3º radio + painel do modo bairro)
- Modify: `public/app.js` (estado `bairrosFrete`, render/leitura da lista, persistência, gating `renderEntregaModo`)

**Interfaces:**
- Consumes: `planoAtual` (global), `window.Dinheiro`, `escapar`, `abrirUpsell`, `configAtual.frete`.
- Produces: `configAtual.frete.bairro = { faixas: [{nome, valor}], foraDaArea }` no `PUT /api/config`.

- [ ] **Step 1: HTML — 3º radio "Por bairro"**

Em `public/admin.html`, dentro de `<div class="cfg-frete-modos">`, após o `</label>` do `freteModoRaioLabel` (linha ~579), adicionar:

```html
              <label class="cfg-frete-modo" id="freteModoBairroLabel">
                <input type="radio" name="freteModo" value="bairro" id="freteModoBairro" />
                <span class="cfg-frete-modo-txt">
                  <strong>Frete por bairro</strong>
                  <span class="sub">Um valor fixo para cada bairro que você atende.</span>
                </span>
                <span class="cfg-frete-lock" id="freteBairroLock" hidden><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Plano Completo</span>
              </label>
```

- [ ] **Step 2: HTML — painel do modo bairro**

Após o fechamento do `<div class="cfg-frete-painel" id="fretePainelRaio">` (o `</div>` da linha ~613, imediatamente antes do `</div>` que fecha `.cfg-frete-card`), adicionar:

```html
            <!-- Painel: frete por bairro -->
            <div class="cfg-frete-painel" id="fretePainelBairro" hidden>
              <div class="cfg-frete-upsell" id="freteBairroUpsell" hidden>
                <p>O <strong>frete por bairro</strong> aplica um valor fixo para cada bairro que você atende. Disponível no <strong>Plano Completo</strong>.</p>
                <button type="button" class="mini" id="btnVerPlanosBairro">Ver planos</button>
              </div>
              <div class="cfg-frete-bairro-config" id="freteBairroConfig" hidden>
                <p class="sub">Cadastre os bairros que você atende e o valor do frete de cada um. O bairro do cliente é identificado pelo endereço informado no pedido.</p>
                <table class="cfg-faixas-tabela">
                  <thead><tr><th>Bairro</th><th>Valor (R$)</th><th></th></tr></thead>
                  <tbody id="freteBairrosBody"></tbody>
                </table>
                <button type="button" class="secundario mini" id="btnAddBairro">+ Adicionar bairro</button>
                <div class="campo cfg-fora-area">
                  <label for="freteBairroForaArea">Quando o cliente está fora da área de entrega</label>
                  <select id="freteBairroForaArea">
                    <option value="retirada">Oferecer retirada no local</option>
                    <option value="bloqueia">Bloquear entrega (não atende)</option>
                  </select>
                </div>
              </div>
            </div>
```

- [ ] **Step 3: app.js — estado + carregar a config na tela**

Em `public/app.js`, adicionar o estado ao lado de `faixasFrete` (linha ~2751):

```js
let bairrosFrete = []; // [{ nome, valor }]
```

Em `renderConfig`, logo antes da chamada `renderEntregaModo();` (linha ~1942), adicionar:

```js
  const bairroCfg = (c.frete && c.frete.bairro) || {};
  bairrosFrete = Array.isArray(bairroCfg.faixas)
    ? bairroCfg.faixas.map((b) => ({ nome: String(b.nome || ""), valor: Number(b.valor) || 0 }))
    : [];
  if ($("freteBairroForaArea")) $("freteBairroForaArea").value = bairroCfg.foraDaArea === "bloqueia" ? "bloqueia" : "retirada";
  renderBairros();
```

- [ ] **Step 4: app.js — render/leitura da lista de bairros**

Adicionar após o bloco do `btnAddFaixa` (linha ~2796):

```js
function lerBairrosDoDOM() {
  const linhas = [];
  document.querySelectorAll("#freteBairrosBody tr").forEach((tr) => {
    const nome = ((tr.querySelector(".fb-nome") || {}).value || "").trim();
    const valorId = (tr.querySelector(".fb-valor") || {}).id;
    const valor = (valorId && window.Dinheiro) ? Dinheiro.valor(valorId) : 0;
    if (nome) linhas.push({ nome, valor });
  });
  return linhas;
}

function renderBairros() {
  const body = $("freteBairrosBody");
  if (!body) return;
  body.innerHTML = bairrosFrete.map((b, i) =>
    "<tr>" +
      '<td><input type="text" class="fb-nome" placeholder="Ex.: Centro" value="' + escapar(b.nome || "") + '" /></td>' +
      '<td><input type="text" inputmode="numeric" class="fb-valor" id="fbValor' + i + '" /></td>' +
      '<td><button type="button" class="ff-remover" data-i="' + i + '" aria-label="Remover bairro">✕</button></td>' +
    "</tr>"
  ).join("");
  bairrosFrete.forEach((b, i) => {
    if (window.Dinheiro) { Dinheiro.mascarar("fbValor" + i); Dinheiro.setValor("fbValor" + i, Number(b.valor) || 0); }
  });
  body.querySelectorAll(".ff-remover").forEach((btn) => {
    btn.addEventListener("click", () => {
      bairrosFrete = lerBairrosDoDOM();
      bairrosFrete.splice(Number(btn.dataset.i), 1);
      renderBairros();
    });
  });
}

if ($("btnAddBairro")) {
  $("btnAddBairro").addEventListener("click", () => {
    bairrosFrete = lerBairrosDoDOM();
    bairrosFrete.push({ nome: "", valor: 0 });
    renderBairros();
  });
}

if ($("btnVerPlanosBairro")) {
  $("btnVerPlanosBairro").addEventListener("click", () => abrirUpsell("freteRaio"));
}
```

- [ ] **Step 5: app.js — persistir o modo bairro no salvar**

Substituir o bloco de leitura do modo (linhas ~2099-2106) por:

```js
  const modoSel = (document.querySelector('input[name="freteModo"]:checked') || {}).value || "fixo";
  if (!configAtual.frete) configAtual.frete = {};
  const modoPermitido = (planoAtual === "completo") ? modoSel : "fixo";
  configAtual.frete.modo = ["raio", "bairro"].includes(modoPermitido) ? modoPermitido : "fixo";
  if (configAtual.frete.modo === "raio") {
    if (!configAtual.frete.raio) configAtual.frete.raio = {};
    configAtual.frete.raio.faixas = lerFaixasDoDOM();           // coordEmpresa/enderecoBase: o servidor preenche
    configAtual.frete.raio.foraDaArea = (($("freteForaArea") || {}).value === "bloqueia") ? "bloqueia" : "retirada";
  } else if (configAtual.frete.modo === "bairro") {
    if (!configAtual.frete.bairro) configAtual.frete.bairro = {};
    configAtual.frete.bairro.faixas = lerBairrosDoDOM();
    configAtual.frete.bairro.foraDaArea = (($("freteBairroForaArea") || {}).value === "bloqueia") ? "bloqueia" : "retirada";
  }
```

- [ ] **Step 6: app.js — `renderEntregaModo` trata os 3 modos + gating**

Substituir a função inteira (linhas ~2146-2170) por:

```js
function renderEntregaModo() {
  const completo = planoAtual === "completo";
  // Cadeado nos dois modos avançados (raio e bairro).
  [["freteRaioLock", "freteModoRaioLabel"], ["freteBairroLock", "freteModoBairroLabel"]].forEach(([lockId, labelId]) => {
    const lock = $(lockId), label = $(labelId);
    if (lock) lock.hidden = completo;
    if (label) label.classList.toggle("bloqueado", !completo);
  });

  const modoVisual = (document.querySelector('input[name="freteModo"]:checked') || {}).value || "fixo";
  document.querySelectorAll(".cfg-frete-modo").forEach((el) => {
    const r = el.querySelector('input[name="freteModo"]');
    el.classList.toggle("selecionado", !!(r && r.checked));
  });
  const painelFixo = $("fretePainelFixo");
  const painelRaio = $("fretePainelRaio");
  const painelBairro = $("fretePainelBairro");
  if (painelFixo) painelFixo.hidden = modoVisual !== "fixo";
  if (painelRaio) painelRaio.hidden = modoVisual !== "raio";
  if (painelBairro) painelBairro.hidden = modoVisual !== "bairro";
  // Dentro de cada modo avançado: Completo vê a config; Essencial vê o upsell.
  if ($("freteUpsell")) $("freteUpsell").hidden = completo;
  if ($("freteRaioConfig")) $("freteRaioConfig").hidden = !completo;
  if ($("freteBairroUpsell")) $("freteBairroUpsell").hidden = completo;
  if ($("freteBairroConfig")) $("freteBairroConfig").hidden = !completo;
}
```

- [ ] **Step 7: app.js — clique no radio bloqueado (Essencial) abre upsell**

Após o bloco do `freteModoRaioLabel` (linhas ~2177-2181), adicionar:

```js
if ($("freteModoBairroLabel")) {
  $("freteModoBairroLabel").addEventListener("click", (e) => {
    if (planoAtual !== "completo") { e.preventDefault(); abrirUpsell("freteRaio"); }
  });
}
```

- [ ] **Step 8: Validar sintaxe**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 9: Validar no browser (harness fiel, logado num tenant Completo)**

- Aba Configurações → Entrega: o radio **"Por bairro"** aparece; num tenant **Completo** clicar mostra o editor de lista.
- Adicionar 2 bairros (ex.: "Centro" R$ 5,00, "Jardim América" R$ 8,00), escolher "Oferecer retirada", **Salvar** → recarregar a config e conferir que a lista persistiu e o modo ficou "bairro".
- Num tenant **Essencial** (ou com `planoAtual` forçado): o radio mostra o cadeado; clicar abre o upsell e não seleciona.
- Se o login em produção impedir, declarar "build/check OK, UI não validada no browser".

- [ ] **Step 10: Commit**

```bash
git add public/admin.html public/app.js
git commit -m "feat(frete): aba Entrega cadastra bairros (Plano Completo) com gate/upsell"
```

---

### Task 4: Cardápio web — cálculo do frete por bairro no checkout (`public/cardapio.js`)

**Files:**
- Modify: `public/cardapio.js` (estado `freteBairro`, `modoBairro`, `taxa`, `renderEndereco`, cálculo/status, validação no envio)

**Interfaces:**
- Consumes: `DADOS.frete = { modo, foraDaArea, configurado }` (projeção), `POST /api/c/:slug/frete { bairro }` (Task 2), `money`, `esc`, `IC`, `atualizarTotais`, `renderEndereco`.
- Produces: envia o pedido com `enderecoCampos.bairro` (já existente); frete recalculado no servidor.

- [ ] **Step 1: Estado + detector de modo**

Em `public/cardapio.js`, ao lado de `var freteRaio = null;` (linha ~740), adicionar:

```js
  var freteBairro = null; // resultado do POST .../frete no modo bairro: {entrega_disponivel, valor_frete, bairro, foraDaArea}
```

Após `function modoRaio() {...}` (linha ~752), adicionar:

```js
  function modoBairro() { return !!(DADOS.frete && DADOS.frete.modo === "bairro"); }
```

- [ ] **Step 2: `taxa()` considera o modo bairro**

Substituir a função `taxa` (linhas ~753-758) por:

```js
  function taxa() {
    if (!temEntrega()) return 0;
    if (modoRaio()) return (freteRaio && freteRaio.entrega_disponivel) ? (Number(freteRaio.valor_frete) || 0) : 0;
    if (modoBairro()) return (freteBairro && freteBairro.entrega_disponivel) ? (Number(freteBairro.valor_frete) || 0) : 0;
    var ff = DADOS.frete ? DADOS.frete.taxaFixa : undefined;
    return Number(ff != null ? ff : DADOS.taxaEntrega) || 0;
  }
```

- [ ] **Step 3: `renderEndereco` — status + gatilhos do modo bairro**

Na `renderEndereco`, trocar a linha que injeta o status (linha ~857):

```js
      (modoRaio() ? '<div class="cd-frete-status" id="cdFreteStatus"></div>' : "") +
```

por:

```js
      ((modoRaio() || modoBairro()) ? '<div class="cd-frete-status" id="cdFreteStatus"></div>' : "") +
```

E, após o bloco `if (modoRaio()) { ... }` que registra os listeners (termina na linha ~869), adicionar:

```js
    // Frete por bairro: recalcula ao editar o bairro (ou após o CEP autopreencher).
    if (modoBairro()) {
      freteBairro = null;
      var recalcBairro = function () { calcularFreteBairroFront(); };
      ["cdBairro", "cdNumero"].forEach(function (id) {
        $(id).addEventListener("blur", recalcBairro);
        $(id).addEventListener("change", recalcBairro);
      });
      // O ViaCEP preenche o bairro de forma assíncrona após o blur do CEP.
      $("cdCep").addEventListener("blur", function () { setTimeout(recalcBairro, 500); });
    }
```

- [ ] **Step 4: Funções de cálculo e status do frete por bairro**

Após `renderFreteStatus` (termina na linha ~908), adicionar:

```js
  // Modo bairro: chama o backend com o bairro informado e atualiza status/total.
  function calcularFreteBairroFront() {
    var st = $("cdFreteStatus");
    if (!st) return;
    var bairro = ($("cdBairro").value || "").trim();
    if (!bairro) { freteBairro = null; st.innerHTML = ""; atualizarTotais(); return; }
    st.innerHTML = '<span class="cd-frete-calc">Calculando frete…</span>';
    fetch("/api/c/" + encodeURIComponent(SLUG) + "/frete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bairro: bairro }),
    })
      .then(function (r) { return r.json(); })
      .then(function (j) { freteBairro = j; renderFreteBairroStatus(j); atualizarTotais(); })
      .catch(function () { freteBairro = null; st.innerHTML = '<span class="cd-frete-erro">Não foi possível calcular o frete. Tente de novo.</span>'; atualizarTotais(); });
  }

  function renderFreteBairroStatus(j) {
    var st = $("cdFreteStatus");
    if (!st) return;
    if (j && j.entrega_disponivel) {
      st.innerHTML = '<span class="cd-frete-ok">' + IC.check + " Entrega para " + esc(j.bairro || "seu bairro") + " · Frete " + money(Number(j.valor_frete) || 0) + "</span>";
      return;
    }
    var msg = (j && j.mensagem) || "Não atendemos seu bairro.";
    var extra = (j && j.foraDaArea === "retirada") ? ' <button type="button" class="cd-frete-retirar" id="cdBtnRetirar">Mudar para retirada</button>' : "";
    st.innerHTML = '<span class="cd-frete-fora">' + IC.alerta + " " + esc(msg) + "</span>" + extra;
    var br = $("cdBtnRetirar");
    if (br) br.addEventListener("click", function () {
      tipoEntrega = "Retirada";
      var v = $("cdViewCheckout");
      v.querySelectorAll("[data-tipo]").forEach(function (x) { x.classList.toggle("ativo", x.getAttribute("data-tipo") === "Retirada"); });
      renderEndereco();
      atualizarTotais();
    });
  }
```

- [ ] **Step 5: Validação no envio do pedido**

Em `enviarPedido`, logo após o bloco de validação do raio (linhas ~960-963), adicionar:

```js
      if (ok && modoBairro() && (!freteBairro || !freteBairro.entrega_disponivel)) {
        erro("cdErrEnd", "Não atendemos seu bairro. Confira o bairro informado ou escolha Retirada.");
        ok = false;
      }
```

- [ ] **Step 6: Validar sintaxe**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 7: Validar no browser (cardápio real de um tenant em modo bairro)**

- Modo bairro configurado com "Centro" R$ 5: no checkout, preencher endereço cujo bairro = "Centro" → aparece "Entrega para Centro · Frete R$ 5,00" e o Total soma o frete.
- Bairro não cadastrado + `foraDaArea="retirada"` → "Não atendemos seu bairro" + botão "Mudar para retirada"; com `"bloqueia"` → sem botão e o envio é barrado.
- Se o teste em produção impedir, declarar "check OK, UI não validada".

- [ ] **Step 8: Commit**

```bash
git add public/cardapio.js
git commit -m "feat(frete): checkout do cardapio web calcula frete por bairro"
```

---

### Task 5: PDV — frete por bairro no overlay de entrega (`public/app.js`)

**Files:**
- Modify: `public/app.js` (`pdvConfirmarEntrega` envia o bairro)

**Interfaces:**
- Consumes: `POST /api/pdv/frete { cep, numero, bairro }` (Task 2). A resposta já é tratada (`foraDaArea` → toast; `incompleto` só ocorre no raio; `valor_frete` entra na venda).

- [ ] **Step 1: Enviar o bairro no cálculo do frete do PDV**

Em `pdvConfirmarEntrega` (linha ~4859), trocar:

```js
  const r = await api("POST", "/api/pdv/frete", { cep: campos.cep, numero: campos.numero });
```

por:

```js
  const r = await api("POST", "/api/pdv/frete", { cep: campos.cep, numero: campos.numero, bairro: campos.bairro });
```

- [ ] **Step 2: Validar sintaxe**

Run: `npm run check`
Expected: sem erros.

- [ ] **Step 3: Validar no browser (PDV, tenant Completo com caixa aberto)**

- No PDV, venda tipo **Entrega**: abrir o overlay, preencher endereço com bairro cadastrado → "Confirmar endereço" traz o frete correto para o resumo.
- Bairro não cadastrado → toast "Endereço fora da área de entrega. Use Retirada/Balcão ou ajuste o endereço." (o overlay permanece aberto).
- O PDV exige **caixa aberto do dia**; se o tenant de teste não tiver, declarar "check OK, UI não validada no browser (exige caixa aberto)".

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat(frete): PDV calcula frete por bairro no overlay de entrega"
```

---

### Task 6: Docs, CHANGELOG, PROGRESSO e publicação

**Files:**
- Modify: `docs/planos-e-frete.md` (menção ao modo bairro)
- Modify: `CLAUDE.md` (linha de `frete.js` na árvore de arquivos)
- Modify: `CHANGELOG.md` (novo marco)
- Modify: `PROGRESSO.md` (mover para ✅ Concluído)

- [ ] **Step 1: Atualizar `docs/planos-e-frete.md`**

Na seção do frete (após a descrição do modo raio, perto da linha ~110 "Parte 3 — Frete por raio"), adicionar um parágrafo curto:

```markdown
### Modo por bairro (Plano Completo)

3ª modalidade de frete: o restaurante cadastra bairros com **valor fixo por bairro** (aba
Entrega). O bairro do cliente vem do endereço (CEP autopreenche ou o cliente digita) e casa por
**igualdade normalizada exata** (acento/maiúscula/espaço ignorados). Sem match → política
`foraDaArea` (`retirada`/`bloqueia`), igual ao raio. **Não usa Geoapify.** Vale no cardápio web e
no PDV. Puro em `src/frete.js` (`normalizarNome`/`encontrarBairro`/`resolverFreteBairro`);
`config.frete.bairro = { faixas: [{nome, valor}], foraDaArea }`.
```

- [ ] **Step 2: Atualizar a linha de `frete.js` no `CLAUDE.md`**

Na árvore de arquivos, na linha do `frete.js`, acrescentar a menção ao bairro. Trocar:

```
  frete.js            -> frete por raio (Plano Completo): Haversine + faixas (puros) + geocodificar() Geoapify c/ cache (tabela geo_cache)
```

por:

```
  frete.js            -> frete avançado (Plano Completo): por RAIO (Haversine + faixas + geocodificar() Geoapify c/ cache geo_cache) e por BAIRRO (normalizarNome/encontrarBairro/resolverFreteBairro — match exato normalizado, sem geocode). Puros
```

- [ ] **Step 3: Adicionar marco ao `CHANGELOG.md`**

No topo da lista de versões, adicionar (confirmar o número contra a versão atual do projeto; sucessor de 0.80.0 = **0.81.0**):

```markdown
## [0.81.0] — Frete por bairro (Plano Completo)

- Nova **modalidade de frete por bairro** no Plano Completo: em Configurações → Entrega, o
  restaurante cadastra os bairros que atende e um **valor fixo para cada um**. Quando o cliente
  informa o endereço, o bairro é identificado e o frete correspondente é aplicado.
- Se o bairro do cliente **não** estiver na lista, vale a mesma regra do frete por raio: **oferecer
  retirada** ou **bloquear a entrega** (à escolha do restaurante).
- Funciona **no cardápio web e no PDV** (venda no balcão em modo Entrega).
```

- [ ] **Step 4: Mover o item para ✅ Concluído no `PROGRESSO.md`**

No topo da seção `## ✅ Concluído`, adicionar:

```markdown
- [x] **Frete por bairro (Plano Completo)** — 3ª modalidade de frete: cadastro de bairro→valor fixo em Configurações → Entrega; o bairro do cliente (endereço/CEP) casa por match exato normalizado (acento/maiúscula/espaço ignorados); sem match → `foraDaArea` (retirada/bloqueia), igual ao raio. Vale no **cardápio web e no PDV**. Sem Geoapify, sem migração (jsonb). Núcleo puro em `src/frete.js` (`normalizarNome`/`encontrarBairro`/`resolverFreteBairro`) com testes; wiring em `src/servidor.js`, UI em `public/admin.html`+`app.js`+`cardapio.js`. Spec/plano em `docs/superpowers/`. CHANGELOG 0.81.0. — 2026-07-07
```

- [ ] **Step 5: Validação final + push**

Run: `npm run check && npm test`
Expected: sem erros; suíte verde.

```bash
git add docs/planos-e-frete.md CLAUDE.md CHANGELOG.md PROGRESSO.md
git commit -m "docs(frete): registra frete por bairro (CHANGELOG 0.81.0 + PROGRESSO + docs)"
git push origin main
```

---

## Notas de verificação (self-review do plano)

- **Cobertura do spec:** config (T1 `freteDeConfig`), match puro (T1), servidor cardápio/PDV/pedido/vender/projeção/gate (T2), UI cadastro (T3), UI cardápio (T4), UI PDV (T5), docs/changelog (T6). ✔
- **Sem Geoapify / sem migração:** confirmado — bairro é lookup puro; `config.frete.bairro` é jsonb. ✔
- **Consistência de nomes:** `normalizarNome`/`encontrarBairro`/`resolverFreteBairro`/`freteDeConfig(...).bairro` idênticos entre Tasks 1→5; IDs de DOM (`fretePainelBairro`, `freteBairrosBody`, `freteBairroForaArea`, `fb-nome`/`fb-valor`, `freteBairroLock`/`freteBairroUpsell`/`freteBairroConfig`) idênticos entre HTML (T3) e JS (T3). ✔
- **Gate:** `temFreteRaio` reusado (nome mantido = "frete avançado do Completo"); servidor força `fixo` fora do Completo. ✔
```
