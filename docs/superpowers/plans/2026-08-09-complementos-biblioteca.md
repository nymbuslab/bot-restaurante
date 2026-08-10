# Biblioteca de Complementos (parte 1) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer complementos e composições virarem uma biblioteca de grupos reutilizáveis por tenant, com vínculo vivo, regra por item e conversão reversível dos dados atuais.

**Architecture:** Tudo dentro do jsonb `empresas.cardapio` (padrão de Categorias), sem tabela nova. `cardapio.grupos` guarda a biblioteca (opções com id estável e preço); `item.grupos` guarda o vínculo (regra efetiva + ordem). Toda a lógica nova é pura em `public/grupos.js` (dual-mode Node/browser), consumida por `src/cardapio-web.js` e `src/pdv.js`. Os campos legados `item.composicao` e `item.opcionais` permanecem gravados e intactos para permitir desfazer.

**Tech Stack:** Node.js CommonJS, `node:test` (runner nativo), front HTML/CSS/JS puro sem framework, Postgres via `pg`.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-08-09-complementos-biblioteca-design.md`. Branch: `feat/complementos-biblioteca`.
- **Compatibilidade de saída do pedido (decisão que reduz risco):** a unificação é só no **cadastro**. O pedido gravado continua saindo nos dois campos de hoje: opções com `preco === 0` vão para `composicao: [{ grupo, itens: [nome] }]` e opções com `preco > 0` vão para `opcionais: [{ nome, preco, qtd }]`. **Nada muda em `comanda.js`, relatórios, `itens_venda` ou pedidos históricos.**
- `item.composicao` e `item.opcionais` **nunca são apagados** por esta entrega.
- Leitura no servidor: se `Array.isArray(item.grupos)` e houver ao menos um vínculo resolvido, usa a biblioteca e **ignora** os campos legados. Caso contrário, caminho legado atual, inalterado.
- `opcao.id` e `grupo.id` são **estáveis**: renomear jamais gera id novo (âncora da ficha técnica de Insumos).
- Dinheiro: `dinheiro.js` (`Dinheiro.mascarar`/`valor`/`formatar`), inputs `type=text inputmode=numeric`. Nunca `type=number` nem `parseFloat`.
- CSP estrita: zero `<script>` inline, zero `onclick=`. Só `addEventListener` em `.js` externo.
- Textos em pt-BR, voz `copy-nymbus`, sem travessão como conector, sem emoji. Ícones SVG inline.
- Nomes passam por `Texto.tituloPt` no blur e no save.
- `npm test` e `npm run check` verdes ao fim de cada tarefa.

---

### Task 1: Normalizar a biblioteca e resolver o vínculo do item

**Files:**
- Modify: `public/grupos.js` (adicionar ao objeto retornado; **não remover** `normalizarGrupos` nem `avaliarComposicao`)
- Test: `test/grupos.test.js` (adicionar ao fim)

**Interfaces:**
- Consumes: nada
- Produces:
  - `normalizarBiblioteca(lista) -> [{ id, nome, padrao: { obrigatorio, min, max }, opcoes: [{ id, nome, preco }] }]`
  - `resolverGrupos(item, biblioteca) -> [{ id, nome, obrigatorio, min, max, opcoes: [{ id, nome, preco }] }]`

- [ ] **Step 1: Write the failing test**

Adicionar em `test/grupos.test.js`:

```js
const { normalizarBiblioteca, resolverGrupos } = require("../public/grupos");

const biblio = [
  { id: "g1", nome: "Guarnições", padrao: { obrigatorio: true, min: 1, max: 1 },
    opcoes: [{ id: "o1", nome: "Farofa", preco: 0 }, { id: "o2", nome: "Vinagrete", preco: 0 }] },
  { id: "g2", nome: "Adicionais", padrao: { obrigatorio: false, min: 0, max: 0 },
    opcoes: [{ id: "o3", nome: "Bacon", preco: 3 }] },
];

test("normalizarBiblioteca: coage tipos e descarta grupo sem id, sem opções ou não-objeto", () => {
  const b = normalizarBiblioteca([
    { id: "g1", nome: " X ", padrao: { obrigatorio: 1, min: "2", max: "4" },
      opcoes: [{ id: "o1", nome: " a ", preco: "3.5" }, { id: "", nome: "sem id", preco: 1 }, { id: "o2", nome: "", preco: 1 }] },
    { id: "g2", nome: "Vazio", opcoes: [] },
    { nome: "Sem id", opcoes: [{ id: "o9", nome: "x", preco: 0 }] },
    "lixo",
  ]);
  assert.equal(b.length, 1);
  assert.deepEqual(b[0], {
    id: "g1", nome: "X",
    padrao: { obrigatorio: true, min: 2, max: 4 },
    opcoes: [{ id: "o1", nome: "a", preco: 3.5 }],
  });
});

test("normalizarBiblioteca: não-array vira []", () => {
  assert.deepEqual(normalizarBiblioteca(undefined), []);
  assert.deepEqual(normalizarBiblioteca("x"), []);
});

test("normalizarBiblioteca: max < min sobe para o mínimo", () => {
  const b = normalizarBiblioteca([{ id: "g", nome: "G", padrao: { min: 3, max: 1 }, opcoes: [{ id: "o", nome: "a", preco: 0 }] }]);
  assert.equal(b[0].padrao.min, 3);
  assert.equal(b[0].padrao.max, 3);
});

test("resolverGrupos: aplica a regra do item por cima do padrão do grupo, na ordem do item", () => {
  const item = { grupos: [{ id: "g2" }, { id: "g1", obrigatorio: true, min: 3, max: 3 }] };
  const r = resolverGrupos(item, biblio);
  assert.equal(r.length, 2);
  assert.equal(r[0].id, "g2");                       // ordem do array do item
  assert.equal(r[0].min, 0);                         // herdou o padrão
  assert.equal(r[1].id, "g1");
  assert.deepEqual([r[1].obrigatorio, r[1].min, r[1].max], [true, 3, 3]);
  assert.equal(r[1].opcoes.length, 2);               // opções sempre vêm da biblioteca
});

test("resolverGrupos: vínculo órfão é ignorado sem quebrar", () => {
  const r = resolverGrupos({ grupos: [{ id: "nao-existe" }, { id: "g1" }] }, biblio);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, "g1");
});

test("resolverGrupos: item sem grupos vira []", () => {
  assert.deepEqual(resolverGrupos({}, biblio), []);
  assert.deepEqual(resolverGrupos({ grupos: "x" }, biblio), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL com `normalizarBiblioteca is not a function`.

- [ ] **Step 3: Write minimal implementation**

Em `public/grupos.js`, dentro da factory, antes do `return`:

```js
  // ---- Biblioteca de grupos (cardapio.grupos) ----
  // Grupo: { id, nome, padrao:{obrigatorio,min,max}, opcoes:[{id,nome,preco}] }.
  // O id é ESTÁVEL: renomear não gera id novo (âncora da ficha técnica futura).
  function normalizarRegra(r) {
    const o = r && typeof r === "object" ? r : {};
    const min = Math.max(0, parseInt(o.min, 10) || 0);
    let max = Math.max(0, parseInt(o.max, 10) || 0);
    if (max > 0 && max < min) max = min; // regra impossível sobe ao mínimo
    return { obrigatorio: !!o.obrigatorio, min: min, max: max };
  }

  function normalizarBiblioteca(lista) {
    if (!Array.isArray(lista)) return [];
    const out = [];
    lista.forEach(function (g) {
      if (!g || typeof g !== "object") return;
      const id = String(g.id == null ? "" : g.id).trim();
      if (!id) return;
      const opcoes = [];
      (Array.isArray(g.opcoes) ? g.opcoes : []).forEach(function (o) {
        if (!o || typeof o !== "object") return;
        const oid = String(o.id == null ? "" : o.id).trim();
        const nome = String(o.nome == null ? "" : o.nome).trim();
        if (!oid || !nome) return;
        const preco = Math.max(0, Number(o.preco) || 0);
        opcoes.push({ id: oid, nome: nome, preco: preco });
      });
      if (!opcoes.length) return; // grupo sem opção não existe
      out.push({
        id: id,
        nome: String(g.nome == null ? "" : g.nome).trim(),
        padrao: normalizarRegra(g.padrao),
        opcoes: opcoes,
      });
    });
    return out;
  }

  // Expande item.grupos ([{id, obrigatorio?, min?, max?}]) na forma concreta.
  // As OPÇÕES vêm sempre da biblioteca; a REGRA vem do item (padrão do grupo
  // quando o item não define). Vínculo órfão é ignorado. Ordem = ordem do item.
  function resolverGrupos(item, biblioteca) {
    const bib = normalizarBiblioteca(biblioteca);
    const porId = {};
    bib.forEach(function (g) { porId[g.id] = g; });
    const vinculos = item && Array.isArray(item.grupos) ? item.grupos : [];
    const out = [];
    vinculos.forEach(function (v) {
      if (!v || typeof v !== "object") return;
      const g = porId[String(v.id == null ? "" : v.id).trim()];
      if (!g) return;
      const temRegra = v.min != null || v.max != null || v.obrigatorio != null;
      const regra = temRegra ? normalizarRegra(v) : g.padrao;
      out.push({
        id: g.id, nome: g.nome,
        obrigatorio: regra.obrigatorio, min: regra.min, max: regra.max,
        opcoes: g.opcoes,
      });
    });
    return out;
  }
```

E no `return`: `normalizarBiblioteca: normalizarBiblioteca, resolverGrupos: resolverGrupos,`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` → PASS. Depois `npm run check` → sem erro de sintaxe.

- [ ] **Step 5: Commit**

```bash
git add public/grupos.js test/grupos.test.js
git commit -m "feat(grupos): normalizar biblioteca e resolver vinculo do item"
```

---

### Task 2: Avaliar escolhas com preço, devolvendo nos campos legados

**Files:**
- Modify: `public/grupos.js`
- Test: `test/grupos.test.js`

**Interfaces:**
- Consumes: `resolverGrupos` (Task 1)
- Produces: `avaliarEscolhas(resolvidos, escolhas) -> { valido, pendencias: [string], addUnit: number, composicao: [{ grupo, itens: [nome] }], opcionais: [{ nome, preco, qtd }] }`
  - `escolhas` = `[{ grupo: <grupoId>, opcoes: [<opcaoId>] }]`

- [ ] **Step 1: Write the failing test**

```js
const { avaliarEscolhas } = require("../public/grupos");

const resolvidos = [
  { id: "g1", nome: "Guarnições", obrigatorio: true, min: 2, max: 2,
    opcoes: [{ id: "o1", nome: "Farofa", preco: 0 }, { id: "o2", nome: "Vinagrete", preco: 0 }, { id: "o3", nome: "Purê", preco: 0 }] },
  { id: "g2", nome: "Adicionais", obrigatorio: false, min: 0, max: 0,
    opcoes: [{ id: "o4", nome: "Bacon", preco: 3 }, { id: "o5", nome: "Ovo", preco: 2 }] },
];

test("avaliarEscolhas: separa sem custo em composicao e pago em opcionais", () => {
  const r = avaliarEscolhas(resolvidos, [
    { grupo: "g1", opcoes: ["o1", "o2"] },
    { grupo: "g2", opcoes: ["o4"] },
  ]);
  assert.equal(r.valido, true);
  assert.equal(r.addUnit, 3);
  assert.deepEqual(r.composicao, [{ grupo: "Guarnições", itens: ["Farofa", "Vinagrete"] }]);
  assert.deepEqual(r.opcionais, [{ nome: "Bacon", preco: 3, qtd: 1 }]);
});

test("avaliarEscolhas: abaixo do mínimo gera pendência e invalida", () => {
  const r = avaliarEscolhas(resolvidos, [{ grupo: "g1", opcoes: ["o1"] }]);
  assert.equal(r.valido, false);
  assert.match(r.pendencias[0], /Guarnições/);
});

test("avaliarEscolhas: acima do máximo invalida", () => {
  const r = avaliarEscolhas(resolvidos, [{ grupo: "g1", opcoes: ["o1", "o2", "o3"] }]);
  assert.equal(r.valido, false);
  assert.match(r.pendencias[0], /no máximo 2/);
});

test("avaliarEscolhas: max 0 significa sem limite", () => {
  const r = avaliarEscolhas(resolvidos, [
    { grupo: "g1", opcoes: ["o1", "o2"] },
    { grupo: "g2", opcoes: ["o4", "o5"] },
  ]);
  assert.equal(r.valido, true);
  assert.equal(r.addUnit, 5);
});

test("avaliarEscolhas: opção de outro grupo, id inexistente e duplicata são descartados", () => {
  const r = avaliarEscolhas(resolvidos, [
    { grupo: "g1", opcoes: ["o1", "o1", "o4", "xx", "o2"] },
  ]);
  assert.equal(r.valido, true);
  assert.deepEqual(r.composicao, [{ grupo: "Guarnições", itens: ["Farofa", "Vinagrete"] }]);
  assert.equal(r.addUnit, 0);
});

test("avaliarEscolhas: grupo opcional sem escolha não entra na saída", () => {
  const r = avaliarEscolhas(resolvidos, [{ grupo: "g1", opcoes: ["o1", "o2"] }]);
  assert.equal(r.valido, true);
  assert.deepEqual(r.opcionais, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` → FAIL com `avaliarEscolhas is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
  // Avalia as escolhas do cliente contra os grupos JÁ RESOLVIDOS.
  // Saída no formato LEGADO do pedido de propósito: opção sem custo vira
  // composicao, opção paga vira opcional. Comanda, relatórios e itens_venda
  // seguem inalterados.
  function avaliarEscolhas(resolvidos, escolhas) {
    const grupos = Array.isArray(resolvidos) ? resolvidos : [];
    const porGrupo = {};
    (Array.isArray(escolhas) ? escolhas : []).forEach(function (e) {
      if (e && e.grupo != null) porGrupo[String(e.grupo)] = Array.isArray(e.opcoes) ? e.opcoes : [];
    });
    const composicao = [];
    const opcionais = [];
    const pendencias = [];
    let addUnit = 0;
    grupos.forEach(function (g) {
      const porOpcao = {};
      g.opcoes.forEach(function (o) { porOpcao[o.id] = o; });
      const escolhidas = porGrupo[g.id] || [];
      const validas = [];
      const vistos = {};
      escolhidas.forEach(function (oid) {
        const k = String(oid == null ? "" : oid).trim();
        if (!porOpcao[k] || vistos[k]) return; // id de outro grupo, inexistente ou repetido
        vistos[k] = true;
        validas.push(porOpcao[k]);
      });
      const min = g.obrigatorio ? Math.max(1, g.min) : g.min;
      const max = g.max > 0 ? g.max : g.opcoes.length;
      if (validas.length < min) {
        pendencias.push(g.nome + ": escolha " + (min === 1 ? "1 opção" : "ao menos " + min + " opções"));
        return;
      }
      if (validas.length > max) {
        pendencias.push(g.nome + ": escolha no máximo " + max);
        return;
      }
      const semCusto = [];
      validas.forEach(function (o) {
        if (o.preco > 0) { opcionais.push({ nome: o.nome, preco: o.preco, qtd: 1 }); addUnit += o.preco; }
        else semCusto.push(o.nome);
      });
      if (semCusto.length) composicao.push({ grupo: g.nome, itens: semCusto });
    });
    return {
      valido: pendencias.length === 0,
      pendencias: pendencias,
      addUnit: addUnit,
      composicao: composicao,
      opcionais: opcionais,
    };
  }
```

E no `return`: `avaliarEscolhas: avaliarEscolhas,`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` → PASS. `npm run check` → limpo.

- [ ] **Step 5: Commit**

```bash
git add public/grupos.js test/grupos.test.js
git commit -m "feat(grupos): avaliar escolhas com preco por opcao"
```

---

### Task 3: Conversão pura do formato legado para a biblioteca

**Files:**
- Modify: `public/grupos.js`
- Test: `test/grupos.test.js`

**Interfaces:**
- Consumes: `normalizarGrupos` (já existente), `normalizarRegra` (Task 1)
- Produces:
  - `chaveGrupo(nome, padrao, opcoes) -> string`
  - `converterCardapio(cardapio, novoId) -> { grupos, itens, criados, reusados, sufixados }`
    - `novoId(prefixo)` é injetado para o teste ser determinístico
    - `itens` é o array de itens já com `grupos` preenchido; `composicao` e `opcionais` intactos

- [ ] **Step 1: Write the failing test**

```js
const { converterCardapio } = require("../public/grupos");

const idFake = () => { let n = 0; return (p) => p + (++n); };

test("converterCardapio: junta o idêntico e separa o divergente com sufixo", () => {
  const cardapio = { itens: [
    { id: 1, nome: "X-Salada", opcionais: "Bacon | 3.00" },
    { id: 2, nome: "X-Bacon",  opcionais: "Bacon | 3.00" },
    { id: 3, nome: "X-Especial", opcionais: "Bacon | 4.00" },
  ] };
  const r = converterCardapio(cardapio, idFake());
  assert.equal(r.grupos.length, 2);
  assert.equal(r.criados, 2);
  assert.equal(r.reusados, 1);
  assert.equal(r.grupos[0].nome, "Complementos");
  assert.equal(r.grupos[1].nome, "Complementos 2");   // sufixo por divergência
  assert.equal(r.grupos[0].opcoes[0].preco, 3);
  assert.equal(r.grupos[1].opcoes[0].preco, 4);       // nenhum preço foi alterado
  assert.equal(r.itens[0].grupos[0].id, r.itens[1].grupos[0].id);
  assert.notEqual(r.itens[0].grupos[0].id, r.itens[2].grupos[0].id);
});

test("converterCardapio: composicao vira grupo com preço 0 e regra preservada", () => {
  const cardapio = { itens: [
    { id: 1, nome: "Marmitex", composicao: [
      { nome: "Guarnições", obrigatorio: true, min: 2, max: 2, itens: ["Farofa", "Vinagrete"] },
    ], opcionais: "Ovo | 3.00" },
  ] };
  const r = converterCardapio(cardapio, idFake());
  assert.equal(r.grupos.length, 2);
  assert.equal(r.grupos[0].nome, "Guarnições");
  assert.equal(r.grupos[0].opcoes[0].preco, 0);
  assert.deepEqual(r.grupos[0].padrao, { obrigatorio: true, min: 2, max: 2 });
  // ordem: composições antes dos complementos, como aparece hoje no cardápio
  assert.deepEqual(r.itens[0].grupos.map((g) => g.id), [r.grupos[0].id, r.grupos[1].id]);
  assert.deepEqual(r.itens[0].grupos[0], { id: r.grupos[0].id, obrigatorio: true, min: 2, max: 2 });
});

test("converterCardapio: preserva os campos legados e ignora item já convertido", () => {
  const cardapio = { itens: [
    { id: 1, nome: "A", opcionais: "Bacon | 3.00" },
    { id: 2, nome: "B", opcionais: "Queijo | 1.00", grupos: [{ id: "ja-existe" }] },
  ] };
  const r = converterCardapio(cardapio, idFake());
  assert.equal(r.itens[0].opcionais, "Bacon | 3.00");        // legado intacto
  assert.deepEqual(r.itens[1].grupos, [{ id: "ja-existe" }]); // não remexe
  assert.equal(r.grupos.length, 1);
});

test("converterCardapio: item sem composicao e sem opcionais não gera vínculo", () => {
  const r = converterCardapio({ itens: [{ id: 1, nome: "Refri" }] }, idFake());
  assert.equal(r.grupos.length, 0);
  assert.equal(r.itens[0].grupos, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` → FAIL com `converterCardapio is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
  // ---- Conversão do formato legado para a biblioteca ----
  function normalizarChave(s) {
    return String(s == null ? "" : s).trim().toLowerCase();
  }

  // Identidade de um grupo: nome + regra + opções (nome|preço) na ordem.
  function chaveGrupo(nome, padrao, opcoes) {
    const r = normalizarRegra(padrao);
    return [
      normalizarChave(nome),
      r.obrigatorio ? "1" : "0", r.min, r.max,
      opcoes.map(function (o) { return normalizarChave(o.nome) + "|" + (Number(o.preco) || 0).toFixed(2); }).join(","),
    ].join("::");
  }

  // Lê o texto legado de opcionais ("Nome | 3.00\n...").
  function lerOpcionaisLegado(texto) {
    if (!texto || !String(texto).trim()) return [];
    const lista = [];
    String(texto).split("\n").forEach(function (linha) {
      const l = linha.trim().replace(/^[*\-•]\s*/, "");
      if (!l) return;
      const partes = l.split("|");
      const nome = partes[0].trim();
      let preco = 0;
      if (partes.length >= 2) preco = parseFloat(partes[1].replace(",", ".").replace(/[^\d.]/g, "")) || 0;
      if (nome) lista.push({ nome: nome, preco: preco });
    });
    return lista;
  }

  // Converte o cardápio inteiro de um tenant. `novoId(prefixo)` gera ids.
  // NÃO apaga composicao nem opcionais.
  function converterCardapio(cardapio, novoId) {
    const itens = cardapio && Array.isArray(cardapio.itens) ? cardapio.itens : [];
    const grupos = [];
    const porChave = {};
    const nomesUsados = {};
    let criados = 0, reusados = 0, sufixados = 0;

    function obterGrupo(nome, padrao, opcoes) {
      const chave = chaveGrupo(nome, padrao, opcoes);
      if (porChave[chave]) { reusados++; return porChave[chave]; }
      let nomeFinal = String(nome == null ? "" : nome).trim() || "Grupo";
      const base = normalizarChave(nomeFinal);
      if (nomesUsados[base]) { nomesUsados[base]++; nomeFinal = nomeFinal + " " + nomesUsados[base]; sufixados++; }
      else nomesUsados[base] = 1;
      const g = {
        id: novoId("g_"),
        nome: nomeFinal,
        padrao: normalizarRegra(padrao),
        opcoes: opcoes.map(function (o) { return { id: novoId("o_"), nome: o.nome, preco: Number(o.preco) || 0 }; }),
      };
      grupos.push(g);
      porChave[chave] = g;
      criados++;
      return g;
    }

    const saida = itens.map(function (item) {
      if (!item || typeof item !== "object") return item;
      if (Array.isArray(item.grupos)) return item; // já convertido, não remexe
      const vinculos = [];
      normalizarGrupos(item.composicao).forEach(function (c) {
        const opcoes = c.itens.map(function (n) { return { nome: n, preco: 0 }; });
        const padrao = { obrigatorio: c.obrigatorio, min: c.min, max: c.max };
        const g = obterGrupo(c.nome, padrao, opcoes);
        vinculos.push({ id: g.id, obrigatorio: g.padrao.obrigatorio, min: g.padrao.min, max: g.padrao.max });
      });
      const ops = lerOpcionaisLegado(item.opcionais);
      if (ops.length) {
        const g = obterGrupo("Complementos", { obrigatorio: false, min: 0, max: 0 }, ops);
        vinculos.push({ id: g.id, obrigatorio: false, min: 0, max: 0 });
      }
      if (!vinculos.length) return item;
      const novo = {};
      Object.keys(item).forEach(function (k) { novo[k] = item[k]; }); // legado preservado
      novo.grupos = vinculos;
      return novo;
    });

    return { grupos: grupos, itens: saida, criados: criados, reusados: reusados, sufixados: sufixados };
  }
```

E no `return`: `chaveGrupo: chaveGrupo, converterCardapio: converterCardapio,`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` → PASS. `npm run check` → limpo.

- [ ] **Step 5: Commit**

```bash
git add public/grupos.js test/grupos.test.js
git commit -m "feat(grupos): conversao pura do formato legado para a biblioteca"
```

---

### Task 4: Script de conversão com dry-run

**Files:**
- Create: `scripts/converter-complementos.js`
- Modify: `package.json` (script `converter-complementos`)

**Interfaces:**
- Consumes: `converterCardapio` (Task 3), `src/db.js`
- Produces: CLI. Sem `--aplicar` é somente leitura.

Leia antes `scripts/migrar-convenios.js` e `scripts/normalizar-pagamentos.js` e siga o mesmo formato de saída e de conexão ao banco.

- [ ] **Step 1: Escrever o script**

```js
// Converte composicao/opcionais de cada tenant para a biblioteca cardapio.grupos.
// NÃO apaga os campos legados. Sem --aplicar, só imprime o que faria.
const crypto = require("crypto");
const db = require("../src/db");
const { converterCardapio } = require("../public/grupos");

const APLICAR = process.argv.includes("--aplicar");
const novoId = (p) => p + crypto.randomBytes(5).toString("hex");

(async () => {
  const { rows } = await db.query("select id, slug, cardapio from empresas order by slug");
  let totalGrupos = 0, totalItens = 0, tenantsTocados = 0;

  for (const emp of rows) {
    const cardapio = emp.cardapio || {};
    if (Array.isArray(cardapio.grupos) && cardapio.grupos.length) {
      console.log(`- ${emp.slug}: já tem biblioteca (${cardapio.grupos.length} grupos), pulando`);
      continue;
    }
    const r = converterCardapio(cardapio, novoId);
    if (!r.grupos.length) { console.log(`- ${emp.slug}: nada a converter`); continue; }

    const vinculados = r.itens.filter((i) => i && Array.isArray(i.grupos)).length;
    console.log(`- ${emp.slug}: ${r.criados} grupos criados, ${r.reusados} vinculos reusados, ${r.sufixados} sufixados, ${vinculados} itens vinculados`);
    totalGrupos += r.criados; totalItens += vinculados; tenantsTocados++;

    if (APLICAR) {
      const novo = Object.assign({}, cardapio, { grupos: r.grupos, itens: r.itens });
      await db.query("update empresas set cardapio = $1 where id = $2", [novo, emp.id]);
    }
  }

  console.log(`\n${APLICAR ? "APLICADO" : "SIMULACAO"}: ${tenantsTocados} tenants, ${totalGrupos} grupos, ${totalItens} itens.`);
  if (!APLICAR) console.log("Nada foi gravado. Rode com --aplicar para valer.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
```

Em `package.json`, adicionar: `"converter-complementos": "node scripts/converter-complementos.js"`

- [ ] **Step 2: Rodar a simulação**

Run: `npm run converter-complementos`
Expected: relatório por tenant terminando em "SIMULACAO ... Nada foi gravado."
**Parar aqui e mostrar o relatório ao dono.** O `.env` local aponta para o banco de produção; `--aplicar` só com autorização explícita.

- [ ] **Step 3: Commit (sem aplicar)**

```bash
git add scripts/converter-complementos.js package.json
git commit -m "feat(complementos): script de conversao com dry-run"
```

---

### Task 5: Cardápio web (backend) lê a biblioteca

**Files:**
- Modify: `src/cardapio-web.js` (projeção por volta das linhas 45-60; recálculo por volta das linhas 84-108)
- Test: `test/cardapio-web.test.js` (adicionar casos; se não existir, criar seguindo o formato de `test/grupos.test.js`)

**Interfaces:**
- Consumes: `resolverGrupos`, `avaliarEscolhas` (Tasks 1 e 2)
- Produces: campo `grupos` na projeção pública; recálculo aceitando `p.grupos = [{ grupo, opcoes }]`

- [ ] **Step 1: Escrever o teste**

```js
const cardapioComBiblioteca = {
  grupos: [{ id: "g1", nome: "Adicionais", padrao: { obrigatorio: false, min: 0, max: 0 },
             opcoes: [{ id: "o1", nome: "Bacon", preco: 3 }] }],
  categorias: [{ nome: "Lanches" }],
  itens: [{ id: 1, nome: "X", preco: 10, categoria: "Lanches", disponivel: true, grupos: [{ id: "g1" }] }],
};

test("projetarCardapio: item com biblioteca expõe os grupos resolvidos", () => {
  const p = projetarCardapio(cardapioComBiblioteca);
  assert.equal(p.itens[0].grupos.length, 1);
  assert.equal(p.itens[0].grupos[0].opcoes[0].nome, "Bacon");
});

test("recalcular: soma o preço da opção escolhida pela biblioteca", () => {
  const r = recalcular(cardapioComBiblioteca, { itens: [{ id: 1, qtd: 1, grupos: [{ grupo: "g1", opcoes: ["o1"] }] }] });
  assert.equal(r.subtotal, 13);
  assert.deepEqual(r.itens[0].opcionais, [{ nome: "Bacon", preco: 3, qtd: 1 }]);
});

test("recalcular: item sem grupos segue pelo caminho legado", () => {
  const legado = { categorias: [{ nome: "L" }],
    itens: [{ id: 1, nome: "X", preco: 10, categoria: "L", disponivel: true, opcionais: "Bacon | 3.00" }] };
  const r = recalcular(legado, { itens: [{ id: 1, qtd: 1, opcionais: [{ nome: "Bacon", qtd: 1 }] }] });
  assert.equal(r.subtotal, 13);
});
```

Ajustar os nomes `projetarCardapio` e `recalcular` aos exports reais de `src/cardapio-web.js`.

- [ ] **Step 2: Rodar e ver falhar** — `npm test` → FAIL.

- [ ] **Step 3: Implementar**

Na projeção do item, acrescentar:

```js
        grupos: grupos.resolverGrupos(item, cardapio.grupos),
```

No recálculo, bifurcar antes do `opsMap` atual:

```js
    const resolvidos = grupos.resolverGrupos(base, cardapio.grupos);
    let composicaoSel, opcionaisSel, addUnit;
    if (resolvidos.length) {
      const av = grupos.avaliarEscolhas(resolvidos, p && p.grupos);
      if (!av.valido) throw new Error(av.pendencias[0] || ("Escolha inválida em " + base.nome + "."));
      composicaoSel = av.composicao; opcionaisSel = av.opcionais; addUnit = av.addUnit;
    } else {
      // caminho legado, exatamente como está hoje (opsMap + avaliarComposicao)
    }
```

Usar `composicaoSel`, `opcionaisSel` e `addUnit` na montagem do item e no subtotal. O bloco de variações fica inalterado.

- [ ] **Step 4: Rodar** — `npm test` → PASS; `npm run check` limpo.

- [ ] **Step 5: Commit**

```bash
git add src/cardapio-web.js test/cardapio-web.test.js
git commit -m "feat(cardapio-web): projetar e recalcular pela biblioteca de grupos"
```

---

### Task 6: PDV (backend) lê a biblioteca

**Files:**
- Modify: `src/pdv.js`
- Test: `test/pdv.test.js`

**Interfaces:**
- Consumes: `resolverGrupos`, `avaliarEscolhas`
- Produces: recálculo da venda aceitando `grupos` na linha do carrinho

- [ ] **Step 1: Escrever o teste** — espelhar os casos da Task 5 no formato de `test/pdv.test.js`: venda com opção paga soma no total da linha; item sem `grupos` segue pelo caminho legado com o mesmo resultado de antes.
- [ ] **Step 2: Rodar e ver falhar** — `npm test` → FAIL.
- [ ] **Step 3: Implementar** — mesma bifurcação da Task 5: `resolverGrupos(item, cardapio.grupos)`; se vier vazio, caminho legado inalterado.
- [ ] **Step 4: Rodar** — `npm test` → PASS; `npm run check` limpo.
- [ ] **Step 5: Commit**

```bash
git add src/pdv.js test/pdv.test.js
git commit -m "feat(pdv): recalcular venda pela biblioteca de grupos"
```

---

### Task 7: Tela Complementos (lista e gaveta)

**Files:**
- Modify: `public/admin.html` (nav em `:77-81`, trocar o `nav-breve` "Complementos" por `data-aba="complementos"`; criar `<div id="aba-complementos">` espelhando `#aba-categorias`)
- Modify: `public/app.js` (`carregarComplementos`, `renderComplementos`, gaveta de edição)
- Modify: `public/style.css` (reusar as classes de Categorias; criar classe nova só onde não houver equivalente)

**Interfaces:**
- Consumes: `normalizarBiblioteca` (Task 1), `salvarCardapioRemoto()` (existente)
- Produces: `cardapio.grupos` editável pelo painel

Leia `#aba-categorias` no HTML e `carregarCategorias`/`renderCategorias` no `app.js` antes de escrever. Esta tela é irmã dela e segue o mesmo esqueleto, os mesmos nomes e o mesmo caminho de salvamento.

- [ ] **Step 1: Nav e casca da tela**

Trocar o item "Em breve" por botão real com `data-aba="complementos"`, mantendo o SVG atual. Criar a aba com cabeçalho ("Complementos" e a linha "Grupos de opções que você cria uma vez e usa em vários produtos."), botão "Novo grupo", campo de busca, filtros Todos, Em uso e Sem uso, e o contêiner da grade. Registrar a aba em `abrirGrupoDaAba` para o F5 abrir Cadastros e Produtos, como Categorias já faz.

- [ ] **Step 2: Renderizar a grade**

Cada card mostra: nome; regra padrão em texto ("Obrigatório, escolha 1" quando `min === max === 1`, "Opcional, até N" quando `max > 0`, "Opcional, sem limite" quando `max === 0`); até 4 chips de opção (`Nome +R$ X` se `preco > 0`, só `Nome` se 0) e `+N` no excedente; linha de uso ("Usado em N produtos" ou "Nenhum produto usa este grupo"); botões ícone de editar e excluir. Uso = quantidade de itens do cardápio cujo `grupos` contém o id.

- [ ] **Step 3: Gaveta de edição**

Campos: nome; segmentado Obrigatório e Opcional; Mínimo e Máximo; lista de opções (nome, preço com `Dinheiro.mascarar`, lixeira); "+ Adicionar opção"; rodapé com Cancelar e Salvar grupo. Esc e clique fora fecham, foco preso dentro, foco volta ao card de origem. Reusar o padrão do drawer da Mesa. Preço vazio vale R$ 0,00. Ao salvar, **ids existentes são preservados**; só opção nova ganha id (`crypto.randomUUID?.()` com fallback para `Date.now()` mais aleatório).

- [ ] **Step 4: Excluir com trava**

Grupo em uso não pode ser excluído: modal de aviso informando em quantos produtos está ligado. Grupo sem uso pede confirmação. Mesmo padrão de Categorias com itens vinculados.

- [ ] **Step 5: Validar no navegador**

Criar grupo, editar preço, conferir a contagem de uso, tentar excluir um grupo em uso, dar F5 e confirmar que a aba abre no lugar certo.

- [ ] **Step 6: Commit**

```bash
git add public/admin.html public/app.js public/style.css
git commit -m "feat(complementos): tela de biblioteca de grupos"
```

---

### Task 8: Editor do item com aba única

**Files:**
- Modify: `public/admin.html:1489-1577` (nav de abas e painéis Composições e Complementos)
- Modify: `public/app.js:1454, 1543, 1858-1906` (carregar, salvar e render dos opcionais)

**Interfaces:**
- Consumes: biblioteca da Task 7, `resolverGrupos` (Task 1)
- Produces: `item.grupos` gravado pelo save do item

- [ ] **Step 1: Unificar as abas**

Remover o botão `data-tab="composicoes"` e o painel `#panel-composicoes`. O painel `#panel-opcionais` passa a listar os grupos vinculados. Principal e Variações ficam intactas.

- [ ] **Step 2: Renderizar os vínculos**

Cada linha: posição, nome do grupo, resumo ("5 opções com preço" ou "3 opções sem custo"), link "editar na biblioteca" (abre a tela Complementos com o grupo aberto), selo com a regra efetiva e botão de remover o vínculo. Ordenar por arraste, com botões de subir e descer como alternativa acessível pelo teclado.

- [ ] **Step 3: Editar a regra efetiva**

Clicar no selo abre um popover com Obrigatório e Opcional, Mínimo e Máximo, gravando **só** no vínculo do item. Dica explícita: "Vale só neste produto. As opções vêm da biblioteca."

- [ ] **Step 4: Vincular grupos**

"Usar grupo da biblioteca" abre modal com busca e lista, marcando os já vinculados. "Criar grupo novo" abre a mesma gaveta da Task 7 e já vincula ao item ao salvar.

- [ ] **Step 5: Salvar**

Incluir `grupos: editorGrupos` no payload do save do item. **Não** enviar `composicao` nem `opcionais` quando o item já tem `grupos`, e **não** removê-los do objeto que veio do servidor.

- [ ] **Step 6: Validar no navegador**

Abrir um item convertido, conferir os grupos herdados na ordem certa, alterar a regra de um vínculo e confirmar que outro item que usa o mesmo grupo **não** mudou.

- [ ] **Step 7: Commit**

```bash
git add public/admin.html public/app.js
git commit -m "feat(itens): aba unica de complementos com grupos vinculados"
```

---

### Task 9: Cardápio público e PDV do front

**Files:**
- Modify: `public/cardapio.js` (render das escolhas do item)
- Modify: `public/app.js` (modal de item do PDV, linhas 4506-4740, e o carrinho da mesa)

**Interfaces:**
- Consumes: campo `grupos` da projeção (Task 5)
- Produces: payload `grupos: [{ grupo, opcoes }]` no pedido e na venda

- [ ] **Step 1: Cardápio público**

Se o item vier com `grupos` não vazio, renderizar por grupo: título, selo da regra, rádio quando `max === 1`, checkbox nos demais, preço à direita quando `preco > 0`, e travar a seleção no máximo. Enviar `grupos: [{ grupo: id, opcoes: [id] }]` no pedido. Item sem `grupos` cai no render atual, inalterado.

- [ ] **Step 2: PDV e mesas**

Mesma bifurcação no modal de item. A linha do carrinho passa a carregar `grupos`, enviados em `POST /api/pdv/vender`.

- [ ] **Step 3: Validar no navegador**

Fazer um pedido pelo cardápio com um grupo obrigatório e um pago, conferindo o total; repetir a venda pelo PDV; conferir que a comanda sai igual à de antes.

- [ ] **Step 4: Commit**

```bash
git add public/cardapio.js public/app.js
git commit -m "feat(cardapio,pdv): escolher opcoes pelos grupos da biblioteca"
```

---

### Task 10: Documentação e fechamento

**Files:**
- Modify: `CLAUDE.md` (linha de `grupos.js` na árvore de arquitetura)
- Modify: `docs/modelo-dados.md` (`cardapio.grupos` e `item.grupos`)
- Modify: `PROGRESSO.md`, `CHANGELOG.md`

- [ ] **Step 1: Atualizar a documentação** com o modelo novo, a regra de leitura (`grupos` ganha do legado), a saída do pedido nos campos antigos e a existência do script de conversão.
- [ ] **Step 2: Rodar tudo** — `npm test` e `npm run check`.
- [ ] **Step 3: Fechar o ciclo** — mover o item para ✅ Concluído no `PROGRESSO.md` e registrar o marco no `CHANGELOG.md`.
- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/modelo-dados.md PROGRESSO.md CHANGELOG.md
git commit -m "docs(complementos): biblioteca de grupos no modelo de dados e progresso"
```

---

## Ordem de execução e ponto de parada

Tasks 1 a 4 são puras e não tocam em nada de produção. **Parada obrigatória depois da Task 4**, com o relatório do dry-run na mão, para o dono aprovar antes de qualquer `--aplicar`.

Tasks 5 a 9 só entregam valor com a conversão aplicada, mas todas preservam o caminho legado para itens sem `grupos`, então podem ser implementadas e testadas antes disso.
