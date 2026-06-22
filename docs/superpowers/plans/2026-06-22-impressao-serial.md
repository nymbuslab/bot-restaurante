# Impressão serial (Web Serial) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development ou executing-plans. Steps em checkbox (`- [ ]`).

**Goal:** Suportar impressora COM/serial (Web Serial + ESC/POS) além da USB/driver atual, escolhida por restaurante.

**Architecture:** Encoder ESC/POS puro (`serial-escpos.js`); módulo serial browser (`serial.js`); config `config.impressao.metodo/baud/semAcento`; `impressao.js` roteia serial × window.print.

**Tech Stack:** HTML/CSS/JS puro, Web Serial API (Chromium desktop), node:test.

## Global Constraints

- **Não remover o USB:** `metodo` default = `navegador` (window.print intacto).
- Web Serial só Chromium desktop; feature-detect + fallback p/ window.print.
- ESC/POS = bytes (não UTF-8): acentos via CP850 ou normalização ASCII.
- Sem migration (config jsonb). Ícones SVG. CSP estrita. pt-BR.

---

## Task 1: Encoder ESC/POS puro (TDD)

**Files:** Create `public/serial-escpos.js`, `test/serial-escpos.test.js`.

**Interfaces:** `montarEscPos(texto, opts) -> Uint8Array` — `opts.semAcento` (bool). Bytes: init `1B 40`; se `!semAcento`, codepage `1B 74 02`; texto (CP850 ou ASCII); avanço `0A 0A 0A`; corte `1D 56 00`.

- [ ] **Step 1: Testes (falham)** — `test/serial-escpos.test.js`:
```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { montarEscPos } = require("../public/serial-escpos");

function bytes(arr) { return Array.from(arr); }

test("montarEscPos: init + codepage CP850 + corte", () => {
  const b = bytes(montarEscPos("AB", {}));
  assert.deepEqual(b.slice(0, 5), [0x1B, 0x40, 0x1B, 0x74, 0x02]); // init + ESC t 2
  assert.equal(b[5], 0x41); // A
  assert.equal(b[6], 0x42); // B
  assert.deepEqual(b.slice(-4), [0x0A, 0x0A, 0x0A, 0x1D]); // ...feed + começo do corte? ver abaixo
});
test("montarEscPos: termina com corte GS V 0", () => {
  const b = bytes(montarEscPos("X", {}));
  assert.deepEqual(b.slice(-3), [0x1D, 0x56, 0x00]);
});
test("montarEscPos: acento mapeado em CP850 (ç=0x87, ã=0xC6)", () => {
  const b = bytes(montarEscPos("ç ã", {}));
  assert.ok(b.includes(0x87));
  assert.ok(b.includes(0xC6));
});
test("montarEscPos: semAcento normaliza (ç→c) e não emite codepage", () => {
  const b = bytes(montarEscPos("ção", { semAcento: true }));
  assert.deepEqual(b.slice(0, 2), [0x1B, 0x40]);     // init
  assert.notDeepEqual(b.slice(2, 4), [0x1B, 0x74]);  // sem ESC t
  assert.ok(b.includes(0x63)); // 'c'
  assert.ok(!b.includes(0x87)); // sem byte CP850
});
```
> Ajustar a 1ª asserção `slice(-4)` se necessário; o contrato firme é: **começa** com init(+codepage) e **termina** com `0A 0A 0A 1D 56 00`.

- [ ] **Step 2: Rodar e confirmar a falha** — `npm test` → FAIL.

- [ ] **Step 3: Implementar `public/serial-escpos.js`**
```js
// ESC/POS: monta os bytes de impressão a partir do texto da comanda (puro/testável).
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.SerialEscpos = api;
})(this, function () {
  // Mapa dos caracteres PT → byte CP850 (PC850).
  const CP850 = {
    "á":0xA0,"é":0x82,"í":0xA1,"ó":0xA2,"ú":0xA3,"à":0x85,"â":0x83,"ã":0xC6,"õ":0xE4,"ê":0x88,"ô":0x93,"ç":0x87,"ü":0x81,"ï":0x8B,"ñ":0xA4,
    "Á":0xB5,"É":0x90,"Í":0xD6,"Ó":0xE0,"Ú":0xE9,"À":0xB7,"Â":0xB6,"Ã":0xC7,"Õ":0xE5,"Ê":0xD2,"Ô":0xE2,"Ç":0x80,"Ü":0x9A,"Ñ":0xA5,
    "º":0xA7,"ª":0xA6
  };
  function semDiacritico(s) {
    return String(s).normalize("NFD").replace(/\p{Diacritic}/gu, "");
  }
  function montarEscPos(texto, opts) {
    opts = opts || {};
    const out = [0x1B, 0x40]; // ESC @ (init)
    const txt = opts.semAcento ? semDiacritico(texto || "") : String(texto || "");
    if (!opts.semAcento) out.push(0x1B, 0x74, 0x02); // ESC t 2 (CP850)
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      const code = txt.charCodeAt(i);
      if (code < 128) out.push(code);
      else if (!opts.semAcento && CP850[c] != null) out.push(CP850[c]);
      else out.push(0x3F); // "?" p/ desconhecido
    }
    out.push(0x0A, 0x0A, 0x0A);   // avanço de papel
    out.push(0x1D, 0x56, 0x00);   // GS V 0 (corte total)
    return new Uint8Array(out);
  }
  return { montarEscPos: montarEscPos };
});
```

- [ ] **Step 4: Rodar e confirmar que passa** — `npm test` → PASS.

- [ ] **Step 5: Commit**
```bash
git add public/serial-escpos.js test/serial-escpos.test.js
git commit -m "feat(impressao): encoder ESC/POS puro p/ impressao serial"
```

---

## Task 2: Módulo serial (browser)

**Files:** Create `public/serial.js`.

**Interfaces:** `window.Serial = { suportado, conectar(baud), imprimir(texto, opts), status() }`.

- [ ] **Step 1: Implementar `public/serial.js`**
```js
// Impressão via Web Serial (Chromium desktop). Usa o encoder ESC/POS.
(function (global) {
  let porta = null;
  function suportado() { return !!(global.navigator && navigator.serial); }
  async function _portaLembrada() {
    if (!suportado()) return null;
    const ps = await navigator.serial.getPorts();
    return ps && ps.length ? ps[0] : null;
  }
  async function _abrir(p, baud) {
    if (!p.readable) await p.open({ baudRate: baud || 9600, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none" });
    return p;
  }
  async function conectar(baud) {
    if (!suportado()) throw new Error("Este navegador não suporta impressão serial (use Chrome/Edge no PC).");
    porta = await navigator.serial.requestPort();
    await _abrir(porta, baud);
    return true;
  }
  async function imprimir(texto, opts) {
    if (!suportado()) throw new Error("Navegador sem suporte a impressão serial.");
    const baud = (opts && opts.baud) || 9600;
    if (!porta) porta = await _portaLembrada();
    if (!porta) throw new Error("Impressora serial não conectada. Conecte em Configurações → Impressora.");
    await _abrir(porta, baud);
    const dados = global.SerialEscpos.montarEscPos(texto, opts || {});
    const writer = porta.writable.getWriter();
    try { await writer.write(dados); } finally { writer.releaseLock(); }
  }
  function status() { return { suportado: suportado(), conectada: !!(porta && porta.readable) }; }
  global.Serial = { suportado, conectar, imprimir, status };
})(window);
```

- [ ] **Step 2: Sintaxe** — `npm run check` → OK.

- [ ] **Step 3: Commit**
```bash
git add public/serial.js
git commit -m "feat(impressao): modulo Web Serial (conectar/imprimir/suportado)"
```

---

## Task 3: Config na sub-aba Impressora

**Files:** Modify `public/admin.html` (`#impressoraConfig`), `public/app.js` (carregar config + `btnSalvarConfig` + listener Conectar), carregar scripts.

- [ ] **Step 1: Carregar os scripts (`admin.html`)** — antes de `impressao.js`:
```html
  <script src="serial-escpos.js"></script>
  <script src="serial.js"></script>
```

- [ ] **Step 2: Campos no card `#impressoraConfig`** — adicionar antes do `</div>` que fecha o card:
```html
            <div class="campo"><label for="cfgImprMetodo">Método de impressão</label>
              <select id="cfgImprMetodo"><option value="navegador">Navegador (USB / impressora com driver)</option><option value="serial">Porta serial (COM)</option></select>
            </div>
            <div id="cfgImprSerial" hidden>
              <div class="linha">
                <div class="campo"><label for="cfgImprBaud">Baud rate</label><input type="text" inputmode="numeric" id="cfgImprBaud" value="9600" /></div>
                <div class="campo toggle"><input type="checkbox" id="cfgImprSemAcento" /><label for="cfgImprSemAcento">Sem acento (se a impressora trocar os caracteres)</label></div>
              </div>
              <button type="button" class="secundario mini" id="cfgImprConectar">Conectar impressora</button>
              <span class="cfg-impr-status" id="cfgImprStatus"></span>
              <p class="editor-dica" id="cfgImprAviso" hidden>Este navegador não suporta impressão serial — use o Chrome ou Edge no computador.</p>
            </div>
```

- [ ] **Step 3: Carregar a config nos campos** — na função que popula o form a partir de `configAtual` (após o GET `/api/config`), adicionar:
```js
  const imp = configAtual.impressao || {};
  $("cfgImprMetodo").value = imp.metodo === "serial" ? "serial" : "navegador";
  $("cfgImprBaud").value = imp.baud || 9600;
  $("cfgImprSemAcento").checked = imp.semAcento === true;
  aplicarMetodoImpr();
```
> Identificar a função de popular (perto do `GET /api/config` ~1763, onde os outros `cfg*` recebem valor). Se a config for populada inline no handler, inserir lá.

- [ ] **Step 4: Mostrar/ocultar + status (`app.js`)** — funções + listeners fixos:
```js
function aplicarMetodoImpr() {
  const serial = $("cfgImprMetodo").value === "serial";
  $("cfgImprSerial").hidden = !serial;
  if (serial && window.Serial) {
    $("cfgImprAviso").hidden = window.Serial.suportado();
    const st = window.Serial.status();
    $("cfgImprStatus").textContent = st.conectada ? "Conectada" : "";
  }
}
$("cfgImprMetodo").addEventListener("change", aplicarMetodoImpr);
$("cfgImprConectar").addEventListener("click", async () => {
  try {
    await window.Serial.conectar(parseInt($("cfgImprBaud").value, 10) || 9600);
    $("cfgImprStatus").textContent = "Conectada ✓";
    toast("Impressora conectada.");
  } catch (e) {
    $("cfgImprStatus").textContent = "";
    toast(e.message || "Falha ao conectar.", "erro");
  }
});
```
> Sem emoji no código de produção: trocar "✓" por texto "Conectada" + classe de cor, ou um SVG check. Usar texto "Conectada" (sem o ✓).

- [ ] **Step 5: Salvar a config (`btnSalvarConfig`)** — junto das outras atribuições:
```js
  if (!configAtual.impressao) configAtual.impressao = {};
  configAtual.impressao.metodo = $("cfgImprMetodo").value === "serial" ? "serial" : "navegador";
  configAtual.impressao.baud = parseInt($("cfgImprBaud").value, 10) || 9600;
  configAtual.impressao.semAcento = $("cfgImprSemAcento").checked;
```

- [ ] **Step 6: Sintaxe** — `npm run check` → OK.

- [ ] **Step 7: Validação visual (harness)** — sub-aba Impressora: select Navegador↔Serial mostra/oculta os campos serial; sem Web Serial mostra o aviso. Screenshot. Remover.

- [ ] **Step 8: Commit**
```bash
git add public/admin.html public/app.js
git commit -m "feat(impressao): config de metodo serial (baud/conectar/sem acento)"
```

---

## Task 4: Roteamento serial × window.print (impressao.js) + helmet

**Files:** Modify `public/impressao.js`, `src/servidor.js` (só checar helmet).

- [ ] **Step 1: Guardar a config no `abrirPreview`** — em `impressao.js`, no topo do IIFE, uma var `impCfg = {}`; em `abrirPreview(pedido, config)` setar `impCfg = (config && config.impressao) || {}`.

- [ ] **Step 2: Rotear no `imprimirTexto`** — trocar:
```js
  function imprimirTexto(texto) {
    if (impCfg.metodo === "serial" && global.Serial && global.Serial.suportado()) {
      global.Serial.imprimir(texto, { semAcento: impCfg.semAcento === true, baud: impCfg.baud || 9600 })
        .catch(function (e) {
          if (global.toast) global.toast(e.message || "Falha na impressão serial — usando o navegador.", "erro");
          _imprimirNavegador(texto);
        });
      return;
    }
    _imprimirNavegador(texto);
  }
  function _imprimirNavegador(texto) {
    const area = document.getElementById("area-impressao");
    if (!area) return;
    const pre = document.createElement("pre");
    pre.className = "cupom-print";
    pre.textContent = texto;
    area.replaceChildren(pre);
    window.print();
  }
```
> `global.toast` pode não existir em `window` (é função do app.js). Conferir: se `toast` for global, usar; senão `console.warn` + seguir pro navegador. Manter o fallback robusto.

- [ ] **Step 3: Checar helmet (`src/servidor.js`)** — confirmar que não há `Permissions-Policy` bloqueando `serial`. Run:
```bash
grep -n "permissionsPolicy\|Permissions-Policy\|helmet(" src/servidor.js
```
Se houver uma policy explícita sem `serial`, **não** bloquear (helmet por padrão não emite Permissions-Policy → nada a fazer; só documentar a checagem).

- [ ] **Step 4: Sintaxe** — `npm run check` → OK.

- [ ] **Step 5: Commit**
```bash
git add public/impressao.js
git commit -m "feat(impressao): roteia serial x window.print conforme a config"
```

---

## Notas de execução

- **Validação real** da impressão serial exige a térmica COM física — declarar como teste do usuário. O encoder (Task 1) é testável; o `window.print()` (USB) segue inalterado.
- Ordem de scripts em `admin.html`: `...` → `serial-escpos.js` → `serial.js` → `impressao.js` → `app.js`.
- **PROGRESSO/CHANGELOG:** fechar via `concluir-tarefa` ao fim.
