// ============================================================
// Util compartilhado de endereço: máscara/busca de CEP (ViaCEP)
// + composição da string única de endereço.
// Usado no onboarding (cadastro.html) e no painel (app.js).
// Exposto em window.EnderecoCep.
// ============================================================
(function (global) {
  // Monta a string única que o painel/pedido/bot usam a partir dos campos.
  function comporEndereco({ logradouro, numero, bairro, complemento, cidade, uf, cep }) {
    let s = (logradouro || "").trim();
    if (numero) s += `, ${numero}`;
    const linha2 = [bairro, complemento].filter(Boolean).join(", ");
    if (linha2) s += ` - ${linha2}`;
    const cidUf = [cidade, uf].filter(Boolean).join("/");
    if (cidUf) s += ` - ${cidUf}`;
    if (cep) s += ` · CEP ${cep}`;
    return s.trim();
  }

  // Liga máscara de CEP + autofill (ViaCEP) a um conjunto de inputs por id.
  // ids: { cep, hint?, logradouro?, numero?, bairro?, cidade?, uf?, hintClass? }
  function ligarBuscaCep(ids) {
    const $ = (id) => (id ? document.getElementById(id) : null);
    const cepEl = $(ids.cep);
    const hintEl = $(ids.hint);
    const ufEl = $(ids.uf);
    const hintBase = ids.hintClass || "cep-hint";
    if (!cepEl) return;

    cepEl.addEventListener("input", (ev) => {
      const v = ev.target.value.replace(/\D/g, "").slice(0, 8);
      ev.target.value = v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
      if (v.length === 8) buscar(v);
    });
    if (ufEl) ufEl.addEventListener("input", (ev) => { ev.target.value = ev.target.value.toUpperCase(); });

    function setHint(txt, cls) {
      if (!hintEl) return;
      hintEl.textContent = txt;
      hintEl.className = cls ? `${hintBase} ${cls}` : hintBase;
    }

    async function buscar(cep) {
      setHint("Buscando endereço...");
      try {
        // Nosso backend (cache no banco + ViaCEP no servidor). Devolve
        // { logradouro, bairro, cidade, uf } ou { erro: true }.
        const r = await fetch(`/api/cep/${cep}`);
        const d = await r.json();
        if (d.erro) { setHint("CEP não encontrado. Preencha o endereço à mão.", "erro-hint"); return; }
        if (d.logradouro && $(ids.logradouro)) $(ids.logradouro).value = d.logradouro;
        if (d.bairro && $(ids.bairro))         $(ids.bairro).value = d.bairro;
        if (d.cidade && $(ids.cidade))         $(ids.cidade).value = d.cidade;
        if (d.uf && $(ids.uf))                 $(ids.uf).value = d.uf;
        setHint("Endereço preenchido. Confira e informe o número.", "ok-hint");
        if ($(ids.numero)) $(ids.numero).focus();
      } catch (e) {
        setHint("Não foi possível buscar o CEP. Preencha à mão.", "erro-hint");
      }
    }
  }

  global.EnderecoCep = { comporEndereco, ligarBuscaCep };
})(window);
