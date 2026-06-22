// ESC/POS: monta os bytes de impressão a partir do texto da comanda (puro/testável).
// init (ESC @) + codepage CP850 (ESC t 2) + texto + avanço + corte (GS V m).
// Corte: "parcial" (GS V 1, lâmina de picote — padrão), "total" (GS V 0) ou "nenhum".
// Dual-mode: window.SerialEscpos no browser, module.exports no Node (testes).
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.SerialEscpos = api;
})(this, function () {
  // Caracteres PT -> byte CP850 (PC850).
  const CP850 = {
    "á":0xA0,"é":0x82,"í":0xA1,"ó":0xA2,"ú":0xA3,"à":0x85,"â":0x83,"ã":0xC6,"õ":0xE4,"ê":0x88,"ô":0x93,"ç":0x87,"ü":0x81,"ï":0x8B,"ñ":0xA4,
    "Á":0xB5,"É":0x90,"Í":0xD6,"Ó":0xE0,"Ú":0xE9,"À":0xB7,"Â":0xB6,"Ã":0xC7,"Õ":0xE5,"Ê":0xD2,"Ô":0xE2,"Ç":0x80,"Ü":0x9A,"Ñ":0xA5,
    "º":0xA7,"ª":0xA6,
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
      const code = txt.charCodeAt(i);
      if (code < 128) out.push(code);
      else if (!opts.semAcento && CP850[txt[i]] != null) out.push(CP850[txt[i]]);
      else out.push(0x3F); // "?" p/ desconhecido
    }
    out.push(0x0A, 0x0A, 0x0A); // avanço de papel
    const corte = opts.corte || "parcial";
    if (corte === "total") out.push(0x1D, 0x56, 0x00);       // GS V 0 (corte total)
    else if (corte !== "nenhum") out.push(0x1D, 0x56, 0x01);  // GS V 1 (corte parcial/picote)
    return new Uint8Array(out);
  }
  return { montarEscPos: montarEscPos };
});
