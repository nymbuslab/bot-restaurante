// ============================================================
// Util monetário compartilhado (padrão único da plataforma).
//
// Máscara "centavos primeiro": conforme o usuário digita, o valor preenche
// a partir dos centavos e vai virando real — 1 → 0,01 · 10 → 0,10 ·
// 1000 → 10,00 · 123456 → 1.234,56. Sem precisar apagar nada.
//
// Formato BR único: vírgula nos centavos, ponto no milhar.
// Exposto em window.Dinheiro.
// ============================================================
(function (global) {
  function soDigitos(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }

  // Centavos (inteiro) → "1.234,56".
  function formatarCentavos(cents) {
    cents = Math.max(0, Math.floor(cents || 0));
    const inteiro = Math.floor(cents / 100);
    const dec = String(cents % 100).padStart(2, "0");
    return inteiro.toLocaleString("pt-BR") + "," + dec;
  }

  // Número em reais → "1.234,56" (sem prefixo).
  function formatar(reais) {
    return formatarCentavos(Math.round(Math.abs(Number(reais) || 0) * 100));
  }
  // Número em reais → "R$ 1.234,56".
  function comPrefixo(reais) { return "R$ " + formatar(reais); }

  function el(ref) { return typeof ref === "string" ? document.getElementById(ref) : ref; }

  // Lê o valor numérico (reais) de um campo mascarado.
  function valor(ref) {
    const e = el(ref);
    if (!e) return 0;
    return parseInt(soDigitos(e.value) || "0", 10) / 100;
  }

  // Define o valor de um campo a partir de um número em reais.
  function setValor(ref, reais) {
    const e = el(ref);
    if (e) e.value = formatar(reais);
  }

  // Liga a máscara "centavos primeiro" a um campo de texto (idempotente).
  function mascarar(ref) {
    const e = el(ref);
    if (!e || e.dataset.dinheiro) return;
    e.dataset.dinheiro = "1";
    const aplicar = () => { e.value = formatarCentavos(parseInt(soDigitos(e.value) || "0", 10)); };
    e.addEventListener("input", aplicar);
    if (e.value.trim()) aplicar(); // normaliza um valor inicial (ex.: "18,00")
  }

  global.Dinheiro = { formatar, comPrefixo, valor, setValor, mascarar };
})(window);
