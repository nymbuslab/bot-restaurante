# Agente de Impressão Desktop (Electron) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o app desktop Windows (Electron) que loga com a conta do painel, faz polling dos pedidos novos do cardápio web e os imprime automaticamente, em silêncio, via ESC/POS cru (USB/Rede/Serial).

**Architecture:** App Electron na subpasta `agente-impressora/` do monorepo. O **main process** (Node) cuida de auth (login/refresh contra `/api/agente/*` + refresh no cofre do SO via `safeStorage`), polling, montagem dos bytes (reusando os módulos puros `public/comanda.js` + `public/serial-escpos.js`) e dos transportes (TCP 9100, Serial COM, USB raw). O **renderer** é a UI (HTML/CSS/JS puro) espelhando o iMenu Impressora. A lógica pura (schema de config, seleção de transporte, montagem do job de impressão, backoff/idempotência) é isolada em módulos testáveis com `node:test`.

**Tech Stack:** Electron, electron-builder (NSIS, instalador `.exe`), electron-updater (auto-update), serialport (COM), `net` (TCP 9100 nativo), `node:test` (testes puros). Reuso de `public/comanda.js` e `public/serial-escpos.js` (UMD dual-mode → `require` no Node).

## Global Constraints

- **Plataforma v1: Windows.** macOS/Linux fora de escopo.
- **Sem Bluetooth nativo** (BT pareado vira porta COM, coberto pelo Serial).
- **Impressão é SEMPRE bytes ESC/POS crus** — NUNCA `webContents.print()` (rasterizaria e sairia apagado, o bug que motivou o projeto).
- **Fonte única do cupom/ESC/POS:** reusar `public/comanda.js` e `public/serial-escpos.js` por `require` relativo (`../../public/...`). NÃO copiar/reescrever esses módulos.
- **Idioma pt-BR** em UI, comentários e textos. **Sem emojis na UI — ícones SVG.**
- **Refresh token no cofre do SO** (`safeStorage`), nunca a senha; access token só em memória.
- **Escopo de auto-impressão:** só pedidos do cardápio web (o backend já filtra `impresso_em IS NULL AND recebido_em IS NULL`, `LIMIT 50`). O agente NÃO decide isso — confia no `/api/agente/pendentes`.
- **Idempotência:** marcar impresso (`POST /api/agente/pedidos/:numero/impresso`) só após sucesso da impressão; erro de impressão → NÃO marca, retenta com backoff.
- **Testes puros no padrão do projeto:** `node:test` + `node --test`, sem deps de teste novas. Lógica de I/O (rede/serial/USB), o shell Electron e a UI são validados MANUALMENTE (declarar a ressalva — não fingir teste de hardware).
- **Base da API configurável** via campo na UI (default `https://bot-restaurante.fly.dev`), guardada na config.

---

## Estrutura de arquivos

```
agente-impressora/
  package.json            -> deps (electron, electron-builder, electron-updater, serialport) + scripts
  .gitignore              -> node_modules, dist
  electron-builder.yml    -> config do instalador NSIS + feed do auto-update
  main/
    main.js               -> entry do Electron: cria BrowserWindow, tray, liga IPC, inicia poller
    auth.js               -> login/refresh contra /api/agente/* + safeStorage (refresh token)
    api.js                -> wrapper fetch com Bearer + retry-on-401 (renova e repete)
    poller.js             -> loop de polling: busca pendentes, imprime, marca impresso, backoff
    config.js             -> persiste/valida config (impressora, base da API) em userData
    print-job.js          -> PURO: monta a lista de buffers ESC/POS (vias × cópias) p/ um pedido
    transporte.js         -> PURO: valida/normaliza alvo do transporte + roteia p/ enviar
    impressora/
      rede.js             -> envia bytes p/ IP:9100 (net.Socket)
      serial.js           -> lista portas COM + envia bytes (serialport)
      usb.js              -> envia bytes RAW pra fila de impressão do Windows
    ipc.js                -> handlers IPC (login, salvar config, detectar impressoras, teste, status)
  renderer/
    index.html            -> janela única (cabeçalho, cards Restaurante/Status/Impressora/Registros)
    app.js                -> lógica da UI (via window.api exposto pelo preload)
    style.css             -> estilos (dark, espelha o iMenu)
    preload.js            -> contextBridge: expõe window.api (invoca IPC)
  shared/
    (sem arquivos próprios — os módulos puros vêm de ../../public via require)
  test/
    print-job.test.js     -> testa a montagem dos buffers (vias/cópias/corte/semAcento)
    transporte.test.js    -> testa validação/normalização e roteamento do transporte
    config.test.js        -> testa o schema/normalização da config
    backoff.test.js       -> testa o cálculo de backoff do poller
```

Mudança no app principal (1 linha, Task 9): `public/admin.html` — trocar o link "Baixar (em breve)" pelo link real do `.exe` e remover o estado desabilitado.

---

## Task 1: Scaffold do app Electron (janela vazia abre)

**Files:**
- Create: `agente-impressora/package.json`
- Create: `agente-impressora/.gitignore`
- Create: `agente-impressora/main/main.js`
- Create: `agente-impressora/renderer/index.html`
- Create: `agente-impressora/renderer/preload.js`

**Interfaces:**
- Produces: app Electron que abre uma `BrowserWindow` carregando `renderer/index.html`. `npm start` (dentro de `agente-impressora/`) abre a janela.

- [ ] **Step 1: Criar `agente-impressora/package.json`**

```json
{
  "name": "nymbus-impressora",
  "version": "0.1.0",
  "description": "Agente de impressao automatica de pedidos (Nymbus)",
  "main": "main/main.js",
  "scripts": {
    "start": "electron .",
    "test": "node --test test/",
    "dist": "electron-builder"
  },
  "author": "Nymbus",
  "license": "UNLICENSED",
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-builder": "^24.13.3"
  },
  "dependencies": {
    "electron-updater": "^6.2.1",
    "serialport": "^12.0.0"
  }
}
```

- [ ] **Step 2: Criar `agente-impressora/.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 3: Criar `agente-impressora/main/main.js` (janela mínima)**

```js
const { app, BrowserWindow } = require("electron");
const path = require("path");

let janela = null;

function criarJanela() {
  janela = new BrowserWindow({
    width: 480,
    height: 760,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "..", "renderer", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  janela.removeMenu();
  janela.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(criarJanela);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) criarJanela(); });
```

- [ ] **Step 4: Criar `agente-impressora/renderer/preload.js` (vazio por ora)**

```js
// contextBridge será preenchido na Task 7 (IPC). Por ora, só existe pra o preload carregar.
```

- [ ] **Step 5: Criar `agente-impressora/renderer/index.html` (placeholder)**

```html
<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8" /><title>Nymbus Impressora</title></head>
<body><h1>Nymbus Impressora</h1><p>Scaffold OK.</p></body>
</html>
```

- [ ] **Step 6: Instalar deps e abrir a janela**

Run (dentro de `agente-impressora/`): `npm install` e depois `npm start`
Expected: abre uma janela 480×760 mostrando "Nymbus Impressora / Scaffold OK." (Validação MANUAL — Electron não é unit-testável. Se rodar headless/CI, declarar "scaffold criado, janela não validada".)

- [ ] **Step 7: Commit**

```bash
git add agente-impressora/package.json agente-impressora/.gitignore agente-impressora/main/main.js agente-impressora/renderer/index.html agente-impressora/renderer/preload.js
git commit -m "feat(agente): scaffold do app Electron (janela vazia)"
```

---

## Task 2: Config store (schema puro + persistência em userData)

**Files:**
- Create: `agente-impressora/main/config.js`
- Test: `agente-impressora/test/config.test.js`

**Interfaces:**
- Produces:
  - `normalizarConfig(parcial) -> config` — PURA. Aplica defaults e clampa valores. Shape:
    `{ apiBase: string, email: string, conexao: "rede"|"serial"|"usb", alvo: string, baud: number, corte: "parcial"|"total"|"nenhum", semAcento: boolean, vias: { cozinha: boolean, cupom: boolean }, copias: number }`
  - `carregar() -> config` — lê de `app.getPath("userData")/config.json` (defaults se faltar).
  - `salvar(parcial) -> config` — normaliza, grava, retorna o config salvo.
  - `DEFAULTS` — objeto com os defaults (`apiBase:"https://bot-restaurante.fly.dev"`, `conexao:"rede"`, `alvo:""`, `baud:9600`, `corte:"parcial"`, `semAcento:false`, `vias:{cozinha:true,cupom:true}`, `copias:1`).

- [ ] **Step 1: Escrever o teste (falha)**

```js
// agente-impressora/test/config.test.js
const test = require("node:test");
const assert = require("node:assert");
const { normalizarConfig, DEFAULTS } = require("../main/config");

test("normalizarConfig: vazio devolve os defaults", () => {
  const c = normalizarConfig({});
  assert.equal(c.apiBase, "https://bot-restaurante.fly.dev");
  assert.equal(c.conexao, "rede");
  assert.equal(c.corte, "parcial");
  assert.equal(c.copias, 1);
  assert.deepEqual(c.vias, { cozinha: true, cupom: true });
});

test("normalizarConfig: clampa copias >=1 e conexao invalida vira rede", () => {
  assert.equal(normalizarConfig({ copias: 0 }).copias, 1);
  assert.equal(normalizarConfig({ copias: 99 }).copias, 10);
  assert.equal(normalizarConfig({ conexao: "xpto" }).conexao, "rede");
});

test("normalizarConfig: corte invalido vira parcial; semAcento vira boolean", () => {
  assert.equal(normalizarConfig({ corte: "laser" }).corte, "parcial");
  assert.equal(normalizarConfig({ semAcento: 1 }).semAcento, true);
});

test("normalizarConfig: pelo menos uma via fica ligada (nao deixa imprimir nada)", () => {
  const c = normalizarConfig({ vias: { cozinha: false, cupom: false } });
  assert.equal(c.vias.cozinha || c.vias.cupom, true);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run (dentro de `agente-impressora/`): `node --test test/config.test.js`
Expected: FALHA com "Cannot find module '../main/config'".

- [ ] **Step 3: Implementar `agente-impressora/main/config.js`**

```js
const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  apiBase: "https://bot-restaurante.fly.dev",
  email: "",
  conexao: "rede",          // "rede" | "serial" | "usb"
  alvo: "",                  // rede: "IP:porta" | serial: "COM3" | usb: nome da fila
  baud: 9600,
  corte: "parcial",          // "parcial" | "total" | "nenhum"
  semAcento: false,
  vias: { cozinha: true, cupom: true },
  copias: 1,
};

function umDe(v, lista, padrao) { return lista.includes(v) ? v : padrao; }
function clamp(n, min, max, padrao) {
  const x = parseInt(n, 10);
  if (Number.isNaN(x)) return padrao;
  return Math.min(max, Math.max(min, x));
}

function normalizarConfig(parcial) {
  const p = parcial || {};
  const vias = p.vias || {};
  let cozinha = vias.cozinha !== false;
  let cupom = vias.cupom !== false;
  if (!cozinha && !cupom) cozinha = true; // nunca zera as duas (senao nao imprime nada)
  return {
    apiBase: (typeof p.apiBase === "string" && p.apiBase.trim()) ? p.apiBase.trim().replace(/\/+$/, "") : DEFAULTS.apiBase,
    email: typeof p.email === "string" ? p.email : "",
    conexao: umDe(p.conexao, ["rede", "serial", "usb"], DEFAULTS.conexao),
    alvo: typeof p.alvo === "string" ? p.alvo.trim() : "",
    baud: clamp(p.baud, 1200, 921600, DEFAULTS.baud),
    corte: umDe(p.corte, ["parcial", "total", "nenhum"], DEFAULTS.corte),
    semAcento: !!p.semAcento,
    vias: { cozinha, cupom },
    copias: clamp(p.copias, 1, 10, DEFAULTS.copias),
  };
}

function caminho() {
  const { app } = require("electron");
  return path.join(app.getPath("userData"), "config.json");
}

function carregar() {
  try { return normalizarConfig(JSON.parse(fs.readFileSync(caminho(), "utf8"))); }
  catch (_) { return normalizarConfig({}); }
}

function salvar(parcial) {
  const cfg = normalizarConfig(parcial);
  fs.writeFileSync(caminho(), JSON.stringify(cfg, null, 2));
  return cfg;
}

module.exports = { DEFAULTS, normalizarConfig, carregar, salvar };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/config.test.js`
Expected: PASS (4 testes). `carregar`/`salvar` usam `electron` (não testados aqui — exercitados manualmente no app).

- [ ] **Step 5: Commit**

```bash
git add agente-impressora/main/config.js agente-impressora/test/config.test.js
git commit -m "feat(agente): config store (schema puro + persistencia)"
```

---

## Task 3: Print-job builder (PURO — reusa comanda.js + serial-escpos.js)

**Files:**
- Create: `agente-impressora/main/print-job.js`
- Test: `agente-impressora/test/print-job.test.js`

**Interfaces:**
- Consumes: `Comanda.montarComanda(pedido, config, extras)` de `../../public/comanda.js`; `SerialEscpos.montarEscPos(texto, opts)` de `../../public/serial-escpos.js`; o `config` da Task 2 (campos `vias`, `copias`, `corte`, `semAcento`).
- Produces: `montarJob(pedido, tenantConfig, agentConfig, extras) -> Uint8Array[]` — PURA. Devolve a lista de buffers ESC/POS a enviar, **na ordem cozinha→cupom**, repetindo por `copias`. Cada buffer é uma "via" (a impressora corta no fim de cada). `tenantConfig` = config do tenant (restaurante/impressao) p/ o `Comanda`; `agentConfig` = config da Task 2; `extras` = `{ linkCardapio }`.

- [ ] **Step 1: Escrever o teste (falha)**

```js
// agente-impressora/test/print-job.test.js
const test = require("node:test");
const assert = require("node:assert");
const { montarJob } = require("../main/print-job");

const pedido = {
  numero: 42, cliente: "Joao", telefone: "11999", tipoEntrega: "Entrega",
  endereco: "Rua A, 1", pagamento: "Pix", taxaEntrega: 5, total: 70,
  itens: [{ nome: "X-Burger", qtd: 1, preco: 65, opcionais: [{ nome: "Bacon", preco: 5 }] }],
  observacao: "", criadoEm: "2026-06-26T12:00:00.000Z",
};
const tenant = { restaurante: { nome: "Teste" }, impressao: { rodape: "Volte sempre" } };

test("montarJob: 2 vias x 1 copia = 2 buffers, todos Uint8Array nao-vazios", () => {
  const cfg = { vias: { cozinha: true, cupom: true }, copias: 1, corte: "parcial", semAcento: false };
  const job = montarJob(pedido, tenant, cfg, {});
  assert.equal(job.length, 2);
  job.forEach((b) => { assert.ok(b instanceof Uint8Array); assert.ok(b.length > 10); });
  // 1o byte = ESC @ (init) — 0x1B 0x40
  assert.equal(job[0][0], 0x1B); assert.equal(job[0][1], 0x40);
});

test("montarJob: so cupom, 2 copias = 2 buffers", () => {
  const cfg = { vias: { cozinha: false, cupom: true }, copias: 2, corte: "total", semAcento: false };
  const job = montarJob(pedido, tenant, cfg, {});
  assert.equal(job.length, 2);
});

test("montarJob: so cozinha, 1 copia = 1 buffer", () => {
  const cfg = { vias: { cozinha: true, cupom: false }, copias: 1, corte: "nenhum", semAcento: true };
  const job = montarJob(pedido, tenant, cfg, {});
  assert.equal(job.length, 1);
});

test("montarJob: corte 'nenhum' nao adiciona ESC m nem ESC i no fim", () => {
  const cfg = { vias: { cozinha: true, cupom: false }, copias: 1, corte: "nenhum", semAcento: false };
  const b = montarJob(pedido, tenant, cfg, {})[0];
  const fim = Array.from(b.slice(-2));
  assert.notDeepEqual(fim, [0x1B, 0x6D]); // nao termina em ESC m
  assert.notDeepEqual(fim, [0x1B, 0x69]); // nem ESC i
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/print-job.test.js`
Expected: FALHA com "Cannot find module '../main/print-job'".

- [ ] **Step 3: Implementar `agente-impressora/main/print-job.js`**

```js
// Monta os buffers ESC/POS de um pedido, reusando os modulos puros do app principal.
const Comanda = require("../../public/comanda");
const SerialEscpos = require("../../public/serial-escpos");

// pedido: shape do /api/agente/pendentes; tenantConfig: config do tenant (restaurante/impressao);
// agentConfig: config da Task 2 (vias/copias/corte/semAcento); extras: { linkCardapio }.
function montarJob(pedido, tenantConfig, agentConfig, extras) {
  const { cozinha, cupom } = Comanda.montarComanda(pedido, tenantConfig || {}, extras || {});
  const opts = { semAcento: !!(agentConfig && agentConfig.semAcento), corte: (agentConfig && agentConfig.corte) || "parcial" };
  const vias = (agentConfig && agentConfig.vias) || { cozinha: true, cupom: true };
  const copias = Math.max(1, parseInt(agentConfig && agentConfig.copias, 10) || 1);
  const textos = [];
  if (vias.cozinha) textos.push(cozinha);
  if (vias.cupom) textos.push(cupom);
  const buffers = [];
  for (let c = 0; c < copias; c++) {
    for (const txt of textos) buffers.push(SerialEscpos.montarEscPos(txt, opts));
  }
  return buffers;
}

module.exports = { montarJob };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/print-job.test.js`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add agente-impressora/main/print-job.js agente-impressora/test/print-job.test.js
git commit -m "feat(agente): montagem dos buffers ESC/POS (reusa comanda+escpos)"
```

---

## Task 4: Transporte — validação pura + roteamento + envio (Rede/Serial/USB)

**Files:**
- Create: `agente-impressora/main/transporte.js`
- Create: `agente-impressora/main/impressora/rede.js`
- Create: `agente-impressora/main/impressora/serial.js`
- Create: `agente-impressora/main/impressora/usb.js`
- Test: `agente-impressora/test/transporte.test.js`

**Interfaces:**
- Produces:
  - `parseAlvoRede(alvo) -> { host, porta } | null` — PURA. "1.2.3.4:9100" → `{host:"1.2.3.4",porta:9100}`; "1.2.3.4" → porta default 9100; inválido → null.
  - `validarConfigImpressora(cfg) -> { ok: boolean, erro?: string }` — PURA. Rede exige host válido; serial exige `alvo` (COM); usb exige `alvo` (nome da fila).
  - `async enviar(buffers, cfg) -> void` — roteia p/ `rede.enviar`/`serial.enviar`/`usb.enviar` conforme `cfg.conexao`; junta os buffers numa sequência e envia. Lança em erro de I/O (NÃO marca impresso → poller retenta).
  - `async listarImpressoras(conexao) -> Array` — serial: portas COM (`[{path, fabricante}]`); usb: filas do Windows; rede: `[]` (usuário digita IP).

- [ ] **Step 1: Escrever o teste das partes PURAS (falha)**

```js
// agente-impressora/test/transporte.test.js
const test = require("node:test");
const assert = require("node:assert");
const { parseAlvoRede, validarConfigImpressora } = require("../main/transporte");

test("parseAlvoRede: host:porta", () => {
  assert.deepEqual(parseAlvoRede("192.168.0.50:9100"), { host: "192.168.0.50", porta: 9100 });
});
test("parseAlvoRede: so host usa porta 9100", () => {
  assert.deepEqual(parseAlvoRede("192.168.0.50"), { host: "192.168.0.50", porta: 9100 });
});
test("parseAlvoRede: vazio/invalido -> null", () => {
  assert.equal(parseAlvoRede(""), null);
  assert.equal(parseAlvoRede("  "), null);
});
test("validarConfigImpressora: rede sem host -> erro", () => {
  assert.equal(validarConfigImpressora({ conexao: "rede", alvo: "" }).ok, false);
});
test("validarConfigImpressora: rede com host -> ok", () => {
  assert.equal(validarConfigImpressora({ conexao: "rede", alvo: "10.0.0.2:9100" }).ok, true);
});
test("validarConfigImpressora: serial/usb sem alvo -> erro; com alvo -> ok", () => {
  assert.equal(validarConfigImpressora({ conexao: "serial", alvo: "" }).ok, false);
  assert.equal(validarConfigImpressora({ conexao: "serial", alvo: "COM3" }).ok, true);
  assert.equal(validarConfigImpressora({ conexao: "usb", alvo: "" }).ok, false);
  assert.equal(validarConfigImpressora({ conexao: "usb", alvo: "ELGIN i9" }).ok, true);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/transporte.test.js`
Expected: FALHA com "Cannot find module '../main/transporte'".

- [ ] **Step 3: Implementar `agente-impressora/main/impressora/rede.js`**

```js
// Envia bytes p/ uma termica de rede (RAW / porta 9100) via socket TCP.
const net = require("net");

function enviar(buffer, host, porta) {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let pronto = false;
    sock.setTimeout(8000);
    sock.on("timeout", () => { sock.destroy(); if (!pronto) reject(new Error("timeout conectando " + host + ":" + porta)); });
    sock.on("error", (e) => { if (!pronto) reject(e); });
    sock.connect(porta, host, () => {
      pronto = true;
      sock.write(Buffer.from(buffer), () => sock.end(() => resolve()));
    });
  });
}

module.exports = { enviar };
```

- [ ] **Step 4: Implementar `agente-impressora/main/impressora/serial.js`**

```js
// Lista portas COM e envia bytes pra termica serial (cobre Daruma e BT pareado).
const { SerialPort } = require("serialport");

async function listar() {
  const portas = await SerialPort.list();
  return portas.map((p) => ({ path: p.path, fabricante: p.manufacturer || p.friendlyName || "" }));
}

function enviar(buffer, caminho, baud) {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: caminho, baudRate: baud || 9600, autoOpen: false });
    port.open((err) => {
      if (err) return reject(err);
      port.write(Buffer.from(buffer), (e) => {
        if (e) { port.close(() => {}); return reject(e); }
        port.drain(() => port.close(() => resolve()));
      });
    });
  });
}

module.exports = { listar, enviar };
```

- [ ] **Step 5: Implementar `agente-impressora/main/impressora/usb.js`**

```js
// Impressao RAW na fila do Windows (datatype RAW), evitando a rasterizacao do driver.
// Usa o spooler do Windows via PowerShell Out-Printer NAO serve (rasteriza); aqui
// gravamos um arquivo temporario e mandamos RAW com a API do Windows via "RawPrint".
// v1: usa o utilitario nativo do Windows `COPY /B arquivo \\.\<fila>` quando a fila
// estiver compartilhada; senao, cai no metodo do spooler RAW abaixo.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

// Lista as filas de impressao instaladas no Windows (nome amigavel).
function listar() {
  return new Promise((resolve) => {
    execFile("powershell", ["-NoProfile", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"], (err, stdout) => {
      if (err) return resolve([]);
      resolve(String(stdout).split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((nome) => ({ path: nome, fabricante: "" })));
    });
  });
}

// Envia bytes RAW pra fila `fila` gravando um .bin temporario e despachando via spooler RAW.
function enviar(buffer, fila) {
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), "nymbus-print-" + Date.now() + ".bin");
    fs.writeFile(tmp, Buffer.from(buffer), (werr) => {
      if (werr) return reject(werr);
      // PrintUI/RawPrint nativo nao vem no Windows; usamos o spooler via "print /D".
      // Para RAW de verdade, despachamos com a API do Windows pelo helper PowerShell abaixo,
      // que abre a fila com datatype RAW (sem renderizar).
      const ps = [
        "$bytes = [System.IO.File]::ReadAllBytes('" + tmp.replace(/'/g, "''") + "');",
        "$printer = '" + String(fila).replace(/'/g, "''") + "';",
        "Add-Type -AssemblyName System.Drawing;",
        "$rp = New-Object System.Printing.PrintQueue([System.Printing.LocalPrintServer]::new().GetPrintQueue($printer));",
        "$job = $rp.AddJob('Nymbus', [System.Printing.PrintJobInfo]::new());", // fallback simples
      ].join(" ");
      // NOTA DE IMPLEMENTACAO: o caminho RAW 100% confiavel no Windows usa WritePrinter
      // (winspool) — recomenda-se a lib `@thiagoelg/node-printer` (printDirect, type RAW).
      // Se a lib estiver instalada, prefira-a; senao, este fallback PowerShell cobre os casos
      // comuns. Marcar como ponto de validacao em hardware na Task 4 Step 8.
      execFile("powershell", ["-NoProfile", "-Command", ps], (err) => {
        fs.unlink(tmp, () => {});
        if (err) return reject(err);
        resolve();
      });
    });
  });
}

module.exports = { listar, enviar };
```

- [ ] **Step 6: Implementar `agente-impressora/main/transporte.js` (puro + roteamento)**

```js
const rede = require("./impressora/rede");
const serial = require("./impressora/serial");
const usb = require("./impressora/usb");

function parseAlvoRede(alvo) {
  const s = String(alvo || "").trim();
  if (!s) return null;
  const [host, portaStr] = s.split(":");
  if (!host || !host.trim()) return null;
  const porta = portaStr ? parseInt(portaStr, 10) : 9100;
  if (Number.isNaN(porta) || porta <= 0) return null;
  return { host: host.trim(), porta };
}

function validarConfigImpressora(cfg) {
  const c = cfg || {};
  if (c.conexao === "rede") {
    return parseAlvoRede(c.alvo) ? { ok: true } : { ok: false, erro: "Informe o IP da impressora (ex.: 192.168.0.50)." };
  }
  if (c.conexao === "serial") {
    return c.alvo ? { ok: true } : { ok: false, erro: "Escolha a porta COM da impressora." };
  }
  if (c.conexao === "usb") {
    return c.alvo ? { ok: true } : { ok: false, erro: "Escolha a impressora (fila do Windows)." };
  }
  return { ok: false, erro: "Tipo de conexao invalido." };
}

// Envia a sequencia de buffers (uma via cada) pela conexao configurada.
async function enviar(buffers, cfg) {
  const v = validarConfigImpressora(cfg);
  if (!v.ok) throw new Error(v.erro);
  for (const buf of buffers) {
    if (cfg.conexao === "rede") { const a = parseAlvoRede(cfg.alvo); await rede.enviar(buf, a.host, a.porta); }
    else if (cfg.conexao === "serial") await serial.enviar(buf, cfg.alvo, cfg.baud);
    else if (cfg.conexao === "usb") await usb.enviar(buf, cfg.alvo);
  }
}

async function listarImpressoras(conexao) {
  if (conexao === "serial") return serial.listar();
  if (conexao === "usb") return usb.listar();
  return [];
}

module.exports = { parseAlvoRede, validarConfigImpressora, enviar, listarImpressoras };
```

- [ ] **Step 7: Rodar e ver passar (testes PUROS)**

Run: `node --test test/transporte.test.js`
Expected: PASS (6 testes). O envio/listagem real (I/O) NÃO é testado aqui.

- [ ] **Step 8: Validação MANUAL do I/O (declarar ressalva)**

Sem hardware no ambiente, a função `enviar` (rede/serial/usb) e `listarImpressoras` são validadas manualmente com impressora real. Para rede, dá pra testar contra um servidor TCP local que ecoa os bytes (smoke). Declarar no relatório: "partes puras testadas (6/6); envio real pendente de validação em hardware (DR800/rede)". **Risco conhecido:** o caminho USB RAW no Windows é o mais frágil — se o fallback PowerShell não imprimir RAW corretamente, trocar por `@thiagoelg/node-printer` (`printDirect({ type: "RAW", data: Buffer })`) e ajustar `usb.enviar`.

- [ ] **Step 9: Commit**

```bash
git add agente-impressora/main/transporte.js agente-impressora/main/impressora/ agente-impressora/test/transporte.test.js
git commit -m "feat(agente): transportes (rede/serial/usb) + validacao pura + roteamento"
```

---

## Task 5: Auth (login/refresh + safeStorage) e wrapper de API

**Files:**
- Create: `agente-impressora/main/api.js`
- Create: `agente-impressora/main/auth.js`

**Interfaces:**
- Consumes: rotas `POST /api/agente/login {email,senha}` → `{token,refresh,slug,nome}`; `POST /api/agente/refresh {refresh}` → `{token,refresh,slug,nome}`; `GET /api/agente/pendentes` (Bearer); `POST /api/agente/pedidos/:numero/impresso` (Bearer); `GET /api/config` (Bearer); `GET /api/cardapio/link` (Bearer).
- Produces:
  - `api.setBase(url)`, `api.setToken(tok)`, `api.get(path)`, `api.post(path, body)` — fetch com `Authorization: Bearer` e `Content-Type: application/json`. Em 401, chama `auth.renovar()` uma vez e repete.
  - `auth.login(apiBase, email, senha) -> { slug, nome }` — loga, guarda o refresh no `safeStorage`, mantém o access token via `api.setToken`.
  - `auth.renovar() -> boolean` — lê o refresh do cofre, chama `/api/agente/refresh`, atualiza token e rotaciona o refresh.
  - `auth.estaLogado() -> boolean`; `auth.sair()` — limpa cofre e token.

- [ ] **Step 1: Implementar `agente-impressora/main/api.js`**

```js
// Wrapper de fetch com Bearer + retry unico em 401 (renova a sessao e repete).
let base = "";
let token = "";
let aoRenovar = null; // injetado por auth.js p/ evitar dependencia circular

function setBase(url) { base = String(url || "").replace(/\/+$/, ""); }
function setToken(t) { token = t || ""; }
function setRenovador(fn) { aoRenovar = fn; }

async function req(metodo, caminho, body) {
  const fazer = () => fetch(base + caminho, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let r = await fazer();
  if (r.status === 401 && aoRenovar) {
    const ok = await aoRenovar();
    if (ok) r = await fazer();
  }
  return r;
}

module.exports = {
  setBase, setToken, setRenovador,
  get: (p) => req("GET", p),
  post: (p, b) => req("POST", p, b),
};
```

- [ ] **Step 2: Implementar `agente-impressora/main/auth.js`**

```js
const { safeStorage } = require("electron");
const fs = require("fs");
const path = require("path");
const api = require("./api");

let sessao = { slug: "", nome: "" };

function arqRefresh() {
  const { app } = require("electron");
  return path.join(app.getPath("userData"), "refresh.bin");
}
function guardarRefresh(refresh) {
  try { fs.writeFileSync(arqRefresh(), safeStorage.encryptString(String(refresh || ""))); } catch (_) {}
}
function lerRefresh() {
  try { return safeStorage.decryptString(fs.readFileSync(arqRefresh())); } catch (_) { return ""; }
}
function limparRefresh() { try { fs.unlinkSync(arqRefresh()); } catch (_) {} }

async function login(apiBase, email, senha) {
  api.setBase(apiBase);
  const r = await api.post("/api/agente/login", { email, senha });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.erro || "Falha no login."); }
  const d = await r.json();
  api.setToken(d.token);
  guardarRefresh(d.refresh);
  sessao = { slug: d.slug || "", nome: d.nome || "" };
  return sessao;
}

async function renovar() {
  const refresh = lerRefresh();
  if (!refresh) return false;
  const r = await api.post("/api/agente/refresh", { refresh });
  if (!r.ok) { limparRefresh(); api.setToken(""); return false; }
  const d = await r.json();
  api.setToken(d.token);
  guardarRefresh(d.refresh);
  sessao = { slug: d.slug || sessao.slug, nome: d.nome || sessao.nome };
  return true;
}

function estaLogado() { return !!lerRefresh(); }
function dados() { return sessao; }
function sair() { limparRefresh(); api.setToken(""); sessao = { slug: "", nome: "" }; }

api.setRenovador(renovar);

module.exports = { login, renovar, estaLogado, dados, sair };
```

- [ ] **Step 3: Verificação (sem teste unitário — depende de Electron/rede)**

Run: `node -e "require('./agente-impressora/main/api.js'); console.log('api ok')"` (de `c:/Users/nymbu/Downloads/bot-restaurante/bot-restaurante`)
Expected: imprime "api ok" (carrega sem erro de sintaxe). `auth.js` usa `electron` (`safeStorage`) → carrega só dentro do app; validar login/refresh MANUALMENTE no app com uma conta real. Declarar a ressalva.

- [ ] **Step 4: Commit**

```bash
git add agente-impressora/main/api.js agente-impressora/main/auth.js
git commit -m "feat(agente): auth (login/refresh + safeStorage) e wrapper de API"
```

---

## Task 6: Poller (loop de polling + impressão + idempotência + backoff)

**Files:**
- Create: `agente-impressora/main/poller.js`
- Test: `agente-impressora/test/backoff.test.js`

**Interfaces:**
- Consumes: `api` (Task 5), `montarJob` (Task 3), `transporte.enviar` (Task 4), `config.carregar` (Task 2).
- Produces:
  - `calcBackoff(tentativas) -> ms` — PURA. Backoff exponencial com teto (1ª falha 5s, depois dobra até 60s).
  - `iniciar(opts)` / `parar()` — liga/desliga o loop (intervalo ~6s). `opts.onLog(msg)` e `opts.onStatus(estado)` notificam a UI.
  - Ciclo: `GET /api/config` (cacheia tenantConfig) + `GET /api/cardapio/link` (cacheia link) na 1ª vez; `GET /api/agente/pendentes` → p/ cada pedido: `montarJob` → `transporte.enviar` → em sucesso `POST /api/agente/pedidos/:numero/impresso`; em erro, loga e NÃO marca (retenta no próximo ciclo com backoff).

- [ ] **Step 1: Escrever o teste do backoff (falha)**

```js
// agente-impressora/test/backoff.test.js
const test = require("node:test");
const assert = require("node:assert");
const { calcBackoff } = require("../main/poller");

test("calcBackoff: 1a falha = 5s; dobra; teto 60s", () => {
  assert.equal(calcBackoff(1), 5000);
  assert.equal(calcBackoff(2), 10000);
  assert.equal(calcBackoff(3), 20000);
  assert.equal(calcBackoff(10), 60000); // teto
  assert.equal(calcBackoff(0), 5000);   // defensivo
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test test/backoff.test.js`
Expected: FALHA com "Cannot find module '../main/poller'".

- [ ] **Step 3: Implementar `agente-impressora/main/poller.js`**

```js
const api = require("./api");
const { montarJob } = require("./print-job");
const transporte = require("./transporte");
const config = require("./config");

const INTERVALO_MS = 6000;

function calcBackoff(tentativas) {
  const n = Math.max(1, parseInt(tentativas, 10) || 1);
  return Math.min(60000, 5000 * Math.pow(2, n - 1));
}

let timer = null;
let rodando = false;
let tenantConfig = null;
let linkCardapio = "";
let falhas = 0;

async function carregarTenant() {
  try {
    const rc = await api.get("/api/config");
    if (rc.ok) tenantConfig = await rc.json();
  } catch (_) {}
  try {
    const rl = await api.get("/api/cardapio/link");
    if (rl.ok) { const d = await rl.json(); linkCardapio = d.link || d.url || ""; }
  } catch (_) {}
}

async function umCiclo(opts) {
  const log = (opts && opts.onLog) || (() => {});
  const status = (opts && opts.onStatus) || (() => {});
  if (!tenantConfig) await carregarTenant();
  let r;
  try { r = await api.get("/api/agente/pendentes"); }
  catch (e) { falhas++; status({ tipo: "sem-conexao" }); log("Sem conexao com o servidor. Retentando..."); return calcBackoff(falhas); }
  if (!r.ok) { falhas++; status({ tipo: "erro", http: r.status }); log("Erro " + r.status + " ao buscar pedidos."); return calcBackoff(falhas); }
  falhas = 0;
  status({ tipo: "ok" });
  const pendentes = await r.json().catch(() => []);
  const cfg = config.carregar();
  for (const pedido of (pendentes || [])) {
    try {
      const buffers = montarJob(pedido, tenantConfig || {}, cfg, { linkCardapio });
      await transporte.enviar(buffers, cfg);
      await api.post("/api/agente/pedidos/" + pedido.numero + "/impresso", {});
      log("Pedido #" + pedido.numero + " impresso.");
    } catch (e) {
      log("Falha ao imprimir #" + pedido.numero + ": " + e.message + " (retenta).");
      // NAO marca impresso -> volta nos pendentes no proximo ciclo.
    }
  }
  return INTERVALO_MS;
}

function agendar(opts, ms) {
  timer = setTimeout(async () => {
    if (!rodando) return;
    const proximo = await umCiclo(opts);
    if (rodando) agendar(opts, proximo);
  }, ms);
}

function iniciar(opts) {
  if (rodando) return;
  rodando = true;
  tenantConfig = null; linkCardapio = ""; falhas = 0;
  agendar(opts, 500); // primeiro ciclo quase imediato
}

function parar() { rodando = false; if (timer) clearTimeout(timer); timer = null; }

module.exports = { calcBackoff, iniciar, parar };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test test/backoff.test.js`
Expected: PASS (1 teste). O loop/rede é validado MANUALMENTE no app (pedido real cai → imprime sozinho). Declarar ressalva.

- [ ] **Step 5: Commit**

```bash
git add agente-impressora/main/poller.js agente-impressora/test/backoff.test.js
git commit -m "feat(agente): poller (polling + impressao + idempotencia + backoff)"
```

---

## Task 7: IPC + Renderer (UI espelhando o iMenu Impressora)

**Files:**
- Create: `agente-impressora/main/ipc.js`
- Modify: `agente-impressora/main/main.js` (ligar ipc + tray)
- Modify: `agente-impressora/renderer/preload.js` (contextBridge → window.api)
- Create/Modify: `agente-impressora/renderer/index.html`, `agente-impressora/renderer/app.js`, `agente-impressora/renderer/style.css`

**Interfaces:**
- Consumes: `auth` (Task 5), `config` (Task 2), `transporte.listarImpressoras` + `transporte.enviar` (Task 4), `poller` (Task 6), `print-job.montarJob` (Task 3) p/ o teste de impressão.
- Produces (canais IPC, via `ipcMain.handle`): `auth:login {apiBase,email,senha}`, `auth:status`, `auth:sair`, `config:carregar`, `config:salvar {cfg}`, `impressora:listar {conexao}`, `impressora:teste`, `poller:iniciar`, `poller:parar`. Eventos main→renderer: `log` (string), `status` (objeto). O preload expõe `window.api` com esses métodos e `onLog/onStatus`.

- [ ] **Step 1: Implementar `agente-impressora/main/ipc.js`**

```js
const { ipcMain } = require("electron");
const auth = require("./auth");
const config = require("./config");
const transporte = require("./transporte");
const poller = require("./poller");
const { montarJob } = require("./print-job");

function registrar(janela) {
  const log = (m) => janela && janela.webContents.send("log", m);
  const status = (s) => janela && janela.webContents.send("status", s);
  const opts = { onLog: log, onStatus: status };

  ipcMain.handle("auth:login", async (_e, { apiBase, email, senha }) => {
    const s = await auth.login(apiBase, email, senha);
    config.salvar({ ...config.carregar(), apiBase, email });
    poller.iniciar(opts);
    return s;
  });
  ipcMain.handle("auth:status", () => ({ logado: auth.estaLogado(), ...auth.dados() }));
  ipcMain.handle("auth:sair", () => { poller.parar(); auth.sair(); return true; });

  ipcMain.handle("config:carregar", () => config.carregar());
  ipcMain.handle("config:salvar", (_e, { cfg }) => config.salvar(cfg));

  ipcMain.handle("impressora:listar", (_e, { conexao }) => transporte.listarImpressoras(conexao));
  ipcMain.handle("impressora:teste", async () => {
    const cfg = config.carregar();
    const pedido = { numero: 0, cliente: "TESTE", tipoEntrega: "Balcão", itens: [{ nome: "Teste de impressao", qtd: 1, preco: 0 }], total: 0, criadoEm: new Date().toISOString() };
    const buffers = montarJob(pedido, { restaurante: { nome: "Nymbus" } }, cfg, {});
    await transporte.enviar(buffers, cfg);
    return true;
  });

  ipcMain.handle("poller:iniciar", () => { poller.iniciar(opts); return true; });
  ipcMain.handle("poller:parar", () => { poller.parar(); return true; });
}

module.exports = { registrar };
```

- [ ] **Step 2: Atualizar `agente-impressora/main/main.js` (ligar IPC + tray + auto-start do poller)**

```js
const { app, BrowserWindow, Tray, Menu } = require("electron");
const path = require("path");
const ipc = require("./ipc");
const auth = require("./auth");
const poller = require("./poller");

let janela = null;
let tray = null;

function criarJanela() {
  janela = new BrowserWindow({
    width: 480, height: 760, resizable: true,
    webPreferences: { preload: path.join(__dirname, "..", "renderer", "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  janela.removeMenu();
  janela.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  ipc.registrar(janela);
  janela.on("close", (e) => { if (!app.isQuitting) { e.preventDefault(); janela.hide(); } });
  janela.webContents.on("did-finish-load", () => {
    if (auth.estaLogado()) poller.iniciar({ onLog: (m) => janela.webContents.send("log", m), onStatus: (s) => janela.webContents.send("status", s) });
  });
}

function criarTray() {
  try {
    tray = new Tray(path.join(__dirname, "..", "renderer", "icone.png"));
    tray.setToolTip("Nymbus Impressora");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Abrir", click: () => janela.show() },
      { label: "Sair", click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    tray.on("click", () => janela.show());
  } catch (_) { /* sem icone: ignora o tray */ }
}

app.whenReady().then(() => { criarJanela(); criarTray(); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
```

- [ ] **Step 3: Atualizar `agente-impressora/renderer/preload.js` (contextBridge)**

```js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  login: (apiBase, email, senha) => ipcRenderer.invoke("auth:login", { apiBase, email, senha }),
  authStatus: () => ipcRenderer.invoke("auth:status"),
  sair: () => ipcRenderer.invoke("auth:sair"),
  carregarConfig: () => ipcRenderer.invoke("config:carregar"),
  salvarConfig: (cfg) => ipcRenderer.invoke("config:salvar", { cfg }),
  listarImpressoras: (conexao) => ipcRenderer.invoke("impressora:listar", { conexao }),
  testeImpressao: () => ipcRenderer.invoke("impressora:teste"),
  iniciarPoller: () => ipcRenderer.invoke("poller:iniciar"),
  pararPoller: () => ipcRenderer.invoke("poller:parar"),
  onLog: (cb) => ipcRenderer.on("log", (_e, m) => cb(m)),
  onStatus: (cb) => ipcRenderer.on("status", (_e, s) => cb(s)),
});
```

- [ ] **Step 4: Criar a UI `agente-impressora/renderer/index.html`** (cards: Restaurante, Status, Impressora, Registros — espelhando o iMenu). Conteúdo completo:

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nymbus Impressora</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="topo"><h1>Nymbus Impressora</h1><p>Impressão automática dos pedidos</p></header>

  <section id="telaLogin" class="card">
    <h2>Entrar</h2>
    <label>Servidor (API)</label>
    <input id="apiBase" type="text" value="https://bot-restaurante.fly.dev" />
    <label>E-mail</label>
    <input id="email" type="email" placeholder="seu@email.com" />
    <label>Senha</label>
    <input id="senha" type="password" />
    <button id="btnLogin" class="primario">Entrar</button>
    <p id="erroLogin" class="erro"></p>
  </section>

  <section id="telaApp" hidden>
    <div class="card">
      <div class="restaurante"><div><strong id="nomeRest">—</strong><span id="emailRest"></span></div>
      <button id="btnSair" class="secundario">Sair</button></div>
    </div>
    <div id="faixaStatus" class="faixa">Verificando…</div>
    <div class="card">
      <h2>Impressora</h2>
      <label>Tipo de conexão</label>
      <select id="conexao"><option value="rede">Rede / Wi-Fi</option><option value="serial">Serial (COM)</option><option value="usb">USB</option></select>
      <div id="campoRede"><label>IP da impressora (ex.: 192.168.0.50)</label><input id="alvoRede" type="text" placeholder="192.168.0.50:9100" /></div>
      <div id="campoSerialUsb" hidden><label>Impressora</label><select id="alvoLista"></select><button id="btnDetectar" class="secundario">Detectar</button></div>
      <div id="campoBaud" hidden><label>Baud</label><input id="baud" type="number" value="9600" /></div>
      <label>Corte do papel</label>
      <select id="corte"><option value="parcial">Parcial (picote)</option><option value="total">Total</option><option value="nenhum">Não cortar</option></select>
      <label class="check"><input id="semAcento" type="checkbox" /> Imprimir sem acento</label>
      <fieldset><legend>Vias</legend>
        <label class="check"><input id="viaCozinha" type="checkbox" checked /> Cozinha</label>
        <label class="check"><input id="viaCupom" type="checkbox" checked /> Cupom</label>
      </fieldset>
      <label>Cópias por via</label><input id="copias" type="number" min="1" max="10" value="1" />
      <div class="botoes"><button id="btnTeste" class="secundario">Teste de impressão</button><button id="btnSalvar" class="primario">Salvar</button></div>
    </div>
    <div class="card"><h2>Registros</h2><pre id="registros" class="console"></pre></div>
  </section>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 5: Criar `agente-impressora/renderer/app.js`** (lógica da UI via `window.api`):

```js
const $ = (id) => document.getElementById(id);
function log(m) { const c = $("registros"); c.textContent += (c.textContent ? "\n" : "") + m; c.scrollTop = c.scrollHeight; }

function aplicarConexao(v) {
  $("campoRede").hidden = v !== "rede";
  $("campoSerialUsb").hidden = v === "rede";
  $("campoBaud").hidden = v !== "serial";
}

async function carregar() {
  const st = await window.api.authStatus();
  if (st.logado) { mostrarApp(st); } else { $("telaLogin").hidden = false; $("telaApp").hidden = true; }
}

function mostrarApp(st) {
  $("telaLogin").hidden = true; $("telaApp").hidden = false;
  $("nomeRest").textContent = st.nome || "Restaurante";
  $("emailRest").textContent = st.email || "";
  window.api.carregarConfig().then((cfg) => {
    $("conexao").value = cfg.conexao; aplicarConexao(cfg.conexao);
    $("alvoRede").value = cfg.conexao === "rede" ? cfg.alvo : "";
    $("baud").value = cfg.baud; $("corte").value = cfg.corte; $("semAcento").checked = cfg.semAcento;
    $("viaCozinha").checked = cfg.vias.cozinha; $("viaCupom").checked = cfg.vias.cupom; $("copias").value = cfg.copias;
  });
}

function montarCfgDaUI() {
  const conexao = $("conexao").value;
  const alvo = conexao === "rede" ? $("alvoRede").value : ($("alvoLista").value || "");
  return { conexao, alvo, baud: parseInt($("baud").value, 10) || 9600, corte: $("corte").value, semAcento: $("semAcento").checked,
    vias: { cozinha: $("viaCozinha").checked, cupom: $("viaCupom").checked }, copias: parseInt($("copias").value, 10) || 1 };
}

$("btnLogin").addEventListener("click", async () => {
  $("erroLogin").textContent = "";
  try { const s = await window.api.login($("apiBase").value, $("email").value, $("senha").value); s.email = $("email").value; mostrarApp(s); }
  catch (e) { $("erroLogin").textContent = e.message || "Falha no login."; }
});
$("btnSair").addEventListener("click", async () => { await window.api.sair(); location.reload(); });
$("conexao").addEventListener("change", (e) => { aplicarConexao(e.target.value); });
$("btnDetectar").addEventListener("click", async () => {
  const lista = await window.api.listarImpressoras($("conexao").value);
  const sel = $("alvoLista"); sel.innerHTML = "";
  lista.forEach((p) => { const o = document.createElement("option"); o.value = p.path; o.textContent = p.path + (p.fabricante ? " (" + p.fabricante + ")" : ""); sel.appendChild(o); });
  log(lista.length ? ("Encontradas " + lista.length + " impressora(s).") : "Nenhuma impressora encontrada.");
});
$("btnSalvar").addEventListener("click", async () => { await window.api.salvarConfig(montarCfgDaUI()); log("Configuração salva."); });
$("btnTeste").addEventListener("click", async () => {
  await window.api.salvarConfig(montarCfgDaUI());
  try { await window.api.testeImpressao(); log("Teste enviado à impressora."); } catch (e) { log("Falha no teste: " + e.message); }
});

window.api.onLog(log);
window.api.onStatus((s) => {
  const f = $("faixaStatus");
  if (s.tipo === "ok") { f.textContent = "IMPRESSORA ATIVA — aguardando pedidos"; f.className = "faixa ok"; }
  else if (s.tipo === "sem-conexao") { f.textContent = "Sem conexão com o servidor"; f.className = "faixa aviso"; }
  else { f.textContent = "Erro " + (s.http || ""); f.className = "faixa erro"; }
});

carregar();
```

- [ ] **Step 6: Criar `agente-impressora/renderer/style.css`** (dark, simples, sem framework):

```css
:root { --bg:#0f1115; --card:#171a21; --bd:#262b36; --tx:#e7e9ee; --mut:#9aa3b2; --ac:#6d5efc; --ok:#1f9d55; --av:#b7791f; --er:#c5303a; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--tx); font-family:Segoe UI, system-ui, sans-serif; font-size:14px; }
.topo { padding:16px; } .topo h1 { margin:0; font-size:18px; } .topo p { margin:2px 0 0; color:var(--mut); font-size:12px; }
.card { background:var(--card); border:1px solid var(--bd); border-radius:12px; margin:12px; padding:14px; }
h2 { margin:0 0 10px; font-size:14px; }
label { display:block; margin:10px 0 4px; color:var(--mut); font-size:12px; }
label.check { display:flex; align-items:center; gap:8px; color:var(--tx); }
input, select { width:100%; padding:9px; background:#0f131a; border:1px solid var(--bd); border-radius:8px; color:var(--tx); }
input[type=checkbox] { width:auto; }
button { padding:10px 14px; border-radius:8px; border:1px solid transparent; font-weight:600; cursor:pointer; }
.primario { background:var(--ac); color:#fff; } .secundario { background:#222734; color:var(--tx); border-color:var(--bd); }
.botoes { display:flex; gap:8px; margin-top:12px; } .botoes button { flex:1; }
.restaurante { display:flex; justify-content:space-between; align-items:center; } .restaurante span { display:block; color:var(--mut); font-size:12px; }
.faixa { margin:12px; padding:10px 14px; border-radius:8px; font-weight:600; background:#222734; }
.faixa.ok { background:rgba(31,157,85,.15); color:#7ee2a8; } .faixa.aviso { background:rgba(183,121,31,.15); color:#f0c674; } .faixa.erro { background:rgba(197,48,58,.15); color:#f1a0a6; }
.console { background:#0b0e13; border:1px solid var(--bd); border-radius:8px; padding:10px; height:140px; overflow:auto; font-family:Consolas, monospace; font-size:12px; color:#bcd; white-space:pre-wrap; }
.erro { color:#f1a0a6; font-size:12px; } fieldset { border:1px solid var(--bd); border-radius:8px; margin:10px 0 0; }
```

- [ ] **Step 7: Verificação MANUAL (Electron)**

Run (dentro de `agente-impressora/`): `npm start`
Expected: tela de login → após logar com conta real, mostra os cards; "Detectar" lista COM/USB; "Teste de impressão" envia à impressora; um pedido novo do cardápio web sai sozinho. **Sem hardware/conta no ambiente → declarar "UI/fluxo não validados, pendente de teste manual".** (Falta o ícone do tray `renderer/icone.png` — adicionar um PNG 32×32; sem ele o tray é ignorado.)

- [ ] **Step 8: Commit**

```bash
git add agente-impressora/main/ipc.js agente-impressora/main/main.js agente-impressora/renderer/
git commit -m "feat(agente): IPC + UI (login, config de impressora, teste, registros, tray)"
```

---

## Task 8: Empacotamento (electron-builder + auto-update)

**Files:**
- Create: `agente-impressora/electron-builder.yml`
- Modify: `agente-impressora/main/main.js` (ligar electron-updater)

**Interfaces:**
- Produces: `npm run dist` gera `agente-impressora/dist/Nymbus Impressora Setup X.Y.Z.exe` (NSIS). `electron-updater` checa atualização no feed configurado.

- [ ] **Step 1: Criar `agente-impressora/electron-builder.yml`**

```yaml
appId: com.nymbus.impressora
productName: Nymbus Impressora
directories:
  output: dist
files:
  - main/**/*
  - renderer/**/*
  - ../public/comanda.js
  - ../public/serial-escpos.js
  - package.json
win:
  target: nsis
  artifactName: ${productName} Setup ${version}.${ext}
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  perMachine: false
publish:
  provider: generic
  url: https://bot-restaurante.fly.dev/downloads/
```

> NOTA: o `files` inclui `../public/comanda.js` e `../public/serial-escpos.js` para o `require("../../public/...")` resolver dentro do pacote. Conferir que o caminho empacotado mantém a estrutura; se o electron-builder reescrever os paths, mover esses dois módulos para `agente-impressora/shared/` via cópia no `prepack` (ajuste documentado aqui, não silencioso).

- [ ] **Step 2: Ligar o auto-update no `main.js`** (adicionar perto do `app.whenReady`):

```js
// no topo:
const { autoUpdater } = require("electron-updater");
// dentro de app.whenReady().then(...), após criarJanela():
try { autoUpdater.checkForUpdatesAndNotify(); } catch (_) {}
```

- [ ] **Step 3: Gerar o instalador**

Run (dentro de `agente-impressora/`): `npm run dist`
Expected: cria `dist/Nymbus Impressora Setup 0.1.0.exe`. **Build pesado/Windows — se não rodar no ambiente, declarar "config de empacotamento criada, instalador não gerado".** O upload do `.exe` para `https://bot-restaurante.fly.dev/downloads/` e a rota estática que o serve são uma tarefa de infra à parte (servir `downloads/` no Express do app principal) — registrar como follow-up.

- [ ] **Step 4: Commit**

```bash
git add agente-impressora/electron-builder.yml agente-impressora/main/main.js
git commit -m "feat(agente): empacotamento NSIS (electron-builder) + auto-update"
```

---

## Task 9: Link de download no painel (remover "em breve")

**Files:**
- Modify: `public/admin.html` (seção `#impressora-app`, botão `#btn-baixar-impressora`)
- Modify: `public/style.css` (remover/ajustar o estado `aria-disabled` se não for mais necessário)

**Interfaces:**
- Consumes: a URL final do `.exe` (definida na Task 8, ex.: `https://bot-restaurante.fly.dev/downloads/Nymbus%20Impressora%20Setup%200.1.0.exe`).

- [ ] **Step 1: Atualizar o link em `public/admin.html`**

Trocar:
```html
<a id="btn-baixar-impressora" class="primario" href="#" aria-disabled="true">Baixar (em breve)</a>
```
por:
```html
<a id="btn-baixar-impressora" class="primario" href="/downloads/Nymbus%20Impressora%20Setup%200.1.0.exe" download>Baixar para Windows</a>
```

- [ ] **Step 2: Verificação**

Run: `npm run check` (na raiz do projeto)
Expected: OK (sem erro de sintaxe). Validar visualmente no painel que o botão fica clicável (estado `aria-disabled` some). **Só fazer esta task quando o `.exe` da Task 8 estiver publicado** — senão o link aponta pra 404.

- [ ] **Step 3: Commit**

```bash
git add public/admin.html public/style.css
git commit -m "feat(agente): link de download do app no painel"
```

---

## Notas de execução / verificação

- **Testável com `node:test` (TDD real):** Tasks 2, 3, 4 (partes puras), 6 (backoff). Rodar `node --test test/` dentro de `agente-impressora/` → deve dar tudo verde.
- **Validação MANUAL (sem unit test possível):** o shell Electron (Task 1, 7), o I/O dos transportes (Task 4 — rede/serial/usb reais), auth/rede (Task 5), o loop do poller (Task 6) e o empacotamento (Task 8). Cada relatório deve declarar a ressalva honesta em vez de fingir teste.
- **Risco nº 1 — USB RAW no Windows:** o fallback PowerShell pode não imprimir RAW de forma confiável; se falhar em hardware, adotar `@thiagoelg/node-printer` (`printDirect type RAW`). Rede (TCP 9100) e Serial (COM) são o caminho sólido da v1.
- **Pendência de infra (follow-up, não bloqueia o app):** servir `downloads/` no Express do app principal (ou Storage) para hospedar o `.exe`; só então a Task 9 vale.
