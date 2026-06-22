// Impressao via Web Serial (Chromium desktop). Usa o encoder ESC/POS.
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
    if (!suportado()) throw new Error("Este navegador nao suporta impressao serial (use Chrome/Edge no PC).");
    porta = await navigator.serial.requestPort();
    await _abrir(porta, baud);
    return true;
  }
  async function imprimir(texto, opts) {
    if (!suportado()) throw new Error("Navegador sem suporte a impressao serial.");
    const baud = (opts && opts.baud) || 9600;
    if (!porta) porta = await _portaLembrada();
    if (!porta) throw new Error("Impressora serial nao conectada. Conecte em Configuracoes > Impressora.");
    await _abrir(porta, baud);
    const dados = global.SerialEscpos.montarEscPos(texto, opts || {});
    const writer = porta.writable.getWriter();
    try { await writer.write(dados); } finally { writer.releaseLock(); }
  }
  function status() { return { suportado: suportado(), conectada: !!(porta && porta.readable) }; }
  global.Serial = { suportado: suportado, conectar: conectar, imprimir: imprimir, status: status };
})(window);
