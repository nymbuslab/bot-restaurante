// ============================================================
// DOCUMENTO — PURO (dual-mode Node/browser): máscara e validação de
// CPF/CNPJ e de telefone (padrão WhatsApp). Usado no cadastro de cliente
// (Fase 2). A validação de dígito espelha src/validacao.js (fonte de
// verdade no servidor); aqui é só para o feedback imediato no formulário.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.Documento = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const digitos = (v) => String(v == null ? "" : v).replace(/\D/g, "");

  function validarCpf(valor) {
    const c = digitos(valor);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += Number(c[i]) * (10 - i);
    let d1 = (soma * 10) % 11; if (d1 === 10) d1 = 0;
    if (d1 !== Number(c[9])) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += Number(c[i]) * (11 - i);
    let d2 = (soma * 10) % 11; if (d2 === 10) d2 = 0;
    return d2 === Number(c[10]);
  }

  function validarCnpj(valor) {
    const c = digitos(valor);
    if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
    const digito = (base) => {
      const len = base.length;
      let pos = len - 7;
      let soma = 0;
      for (let i = 0; i < len; i++) { soma += Number(base[i]) * pos--; if (pos < 2) pos = 9; }
      const r = soma % 11;
      return r < 2 ? 0 : 11 - r;
    };
    if (digito(c.slice(0, 12)) !== Number(c[12])) return false;
    return digito(c.slice(0, 13)) === Number(c[13]);
  }

  // Documento vazio é aceito (campo opcional). Senão, valida conforme o tipo.
  function valido(tipo, valor) {
    const c = digitos(valor);
    if (!c) return true;
    return tipo === "PJ" ? validarCnpj(c) : validarCpf(c);
  }

  // Máscara progressiva conforme o usuário digita.
  function formatarDocumento(valor, tipo) {
    if (tipo === "PJ") {
      const c = digitos(valor).slice(0, 14); // 00.000.000/0000-00
      if (c.length > 12) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
      if (c.length > 8) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8)}`;
      if (c.length > 5) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5)}`;
      if (c.length > 2) return `${c.slice(0, 2)}.${c.slice(2)}`;
      return c;
    }
    const c = digitos(valor).slice(0, 11); // 000.000.000-00
    if (c.length > 9) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
    if (c.length > 6) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6)}`;
    if (c.length > 3) return `${c.slice(0, 3)}.${c.slice(3)}`;
    return c;
  }

  // Telefone padrão WhatsApp: (DD) 90000-0000 (celular) ou (DD) 0000-0000 (fixo).
  function formatarTelefone(valor) {
    const d = digitos(valor).slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }

  return { digitos, validarCpf, validarCnpj, valido, formatarDocumento, formatarTelefone };
});
