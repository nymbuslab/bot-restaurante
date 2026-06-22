# Impressão via porta serial (COM) — Web Serial — Design

**Data:** 2026-06-22
**Escopo:** Suportar impressoras de cupom em **COM/serial** (além das USB/driver já
suportadas), via **Web Serial API** + **ESC/POS**. Plano Completo.

## Problema

A impressão atual usa `window.print()` (diálogo do navegador → driver do SO), que cobre
impressoras **USB/com driver**. Algumas térmicas conectam por **COM/serial** e não passam
bem por esse caminho. O dono quer poder usar **as duas** — USB e serial.

## Objetivo

Adicionar a impressão **serial** como método **de primeira classe**, escolhido por
restaurante em Configurações → Impressora. **Sem remover** o caminho USB atual.

## Restrições (conhecidas)

- **Web Serial só no Chrome/Edge desktop** (não Firefox/Safari/mobile). Estação confirmada:
  PC com Chrome/Edge. Requer **HTTPS** (já temos) e **autorização da porta** (1ª vez).
- ESC/POS não é UTF-8: acentos precisam de **codepage** (CP850) ou normalização ASCII.

## Não-objetivos (YAGNI)

- **Sem** impressão por rede (IP) nesta etapa. Sem Bluetooth.
- **Sem** logo/imagem na comanda (só texto, como hoje).
- **Sem** migration (config no `config.impressao` jsonb).

## Modelo de dados

`config.impressao` (jsonb) ganha:
```json
{ "metodo": "navegador" | "serial", "baud": 9600, "semAcento": false }
```
Ausente = `navegador` (comportamento atual). A **porta** em si não é salva aqui — é
autorizada por dispositivo (o navegador lembra via `navigator.serial.getPorts()`).

## Componentes

### 1. Encoder ESC/POS — puro e testável (`public/serial-escpos.js`)

- `montarEscPos(texto, { semAcento }) -> Uint8Array`:
  - **Init** `ESC @` (`0x1B 0x40`).
  - **Codepage** (quando `!semAcento`): `ESC t 2` (`0x1B 0x74 0x02`) = CP850.
  - **Texto**: cada char → byte. ASCII (<128) direto; acentuado → byte CP850 via mapa PT
    (ã, ç, é, õ, …, maiúsculas); desconhecido → `?`. Com `semAcento`, normaliza pra ASCII
    (NFD + remove diacrítico) antes.
  - **Avanço** (algumas linhas `\n`) + **corte** `GS V 0` (`0x1D 0x56 0x00`).
- Dual-mode (window.SerialEscpos + module.exports). Testável: monta os bytes certos.

### 2. Módulo serial — browser (`public/serial.js`)

- `suportado()` → `!!(navigator.serial)`.
- `conectar(baud)` → `navigator.serial.requestPort()` (gesto do usuário) → `port.open(...)`;
  guarda a porta em memória. Erros → throw com mensagem amigável.
- `portaLembrada()` → `getPorts()` (porta já autorizada antes) — pra reusar sem repedir.
- `imprimir(texto, opts)` → garante porta aberta (lembrada ou pedida) → `writable.getWriter()`
  → `write(montarEscPos(texto, opts))` → `releaseLock()`. Best-effort no fechamento.

### 3. Configuração (Configurações → Impressora) (`public/admin.html` + `public/app.js`)

No card `#impressoraConfig`, adicionar:
- **Método de impressão**: select Navegador (padrão) / Porta serial (COM).
- Quando **serial** (mostrar/ocultar conforme o select):
  - **Baud rate** (campo numérico, default 9600).
  - **Conectar impressora** (botão → `Serial.conectar(baud)`; mostra status conectada/erro).
  - **Sem acento** (checkbox: normaliza pra ASCII se a térmica não suportar CP850).
  - Aviso se `!Serial.suportado()` (navegador sem Web Serial).
- Esses campos entram no **salvar da config** (em `config.impressao`), seguindo o fluxo já
  existente da sub-aba. O **Conectar** é ação de dispositivo (não faz parte do salvar).

### 4. Fiação da impressão (`public/impressao.js`)

- `imprimirTexto(texto)` passa a checar `config.impressao.metodo`:
  - `serial` **e** `Serial.suportado()` → `await Serial.imprimir(texto, { semAcento })`;
    em erro → toast + cai no `window.print()`.
  - senão → `window.print()` (comportamento atual, inalterado).
- `abrirPreview(pedido, config)` já recebe a config → guardar `config.impressao` para o
  `imprimirTexto` usar.

### 5. Scripts + CSP

- `admin.html` carrega `serial-escpos.js` + `serial.js` (antes de `app.js`/`impressao.js`).
- Conferir o **helmet**: Web Serial é `navigator.serial` (sem CSP de script). Verificar que
  nenhum `Permissions-Policy: serial=()` é emitido bloqueando; se houver, liberar `serial`.

## Fluxo de dados

1. Dono escolhe método **serial** + baud + Conectar (autoriza a porta) → salva
   `config.impressao`.
2. Ao imprimir uma via, `impressao.js` vê `metodo=serial` → `Serial.imprimir` → ESC/POS na
   porta → impressora imprime e corta.
3. Restaurante com USB mantém `metodo=navegador` → `window.print()` como sempre.

## Tratamento de erros / bordas

- **Navegador sem Web Serial** (Firefox/mobile): o select avisa; se mesmo assim `metodo=serial`,
  o `imprimirTexto` cai no `window.print()` com toast.
- **Porta não autorizada / sumiu:** `imprimir` tenta `getPorts()`; se vazio, pede ou avisa
  ("Conecte a impressora em Configurações → Impressora"); cai no `window.print()`.
- **Acentos errados na térmica:** o checkbox "Sem acento" normaliza pra ASCII.
- **USB inalterado:** `metodo=navegador` nunca toca o código serial.

## Validação

- `npm run check` e `npm test` passam.
- **Testes do encoder** (`test/serial-escpos.test.js`): init/codepage/corte nos bytes certos;
  acento mapeado (ç→0x87, ã→0xC6) com CP850; `semAcento` normaliza (ç→c) e **não** emite o
  comando de codepage.
- **Visual (harness):** a sub-aba Impressora com o select + campos serial (mostrar/ocultar).
- **Manual (sua):** impressão real numa térmica COM (precisa do hardware) — declaro como
  validação do usuário. O `window.print()` segue testável como hoje.

## Riscos

Médio. Pontos: (a) **codepage/acentos** variam por modelo — mitigado pelo "Sem acento"; (b)
**suporte do navegador** (só Chromium desktop) — avisado na UI + fallback; (c) garantir que o
caminho **USB não regrida** (método default = navegador). O encoder é puro/testável; o serial
em si depende de hardware (validação manual).
