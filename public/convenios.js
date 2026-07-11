// ============================================================
// CONVÊNIOS — regras de vencimento do fiado. Módulo PURO (sem I/O), testado em
// test/convenios.test.js. Um convênio tem faixas por dia da compra; cada faixa
// vence por dia fixo do mês (com deslocamento de meses) ou por N dias após a
// compra. Ficam em config.convenios (por restaurante); o cliente referencia por
// convenio_id. Ver docs/superpowers/specs/2026-07-11-convenios-vencimento-fiado-design.md
//
// Dual-mode (Node/browser) via UMD: TUDO fica dentro do factory — no browser os
// <script> compartilham o escopo global, então nada pode vazar (só window.Convenios),
// senão colide com outros scripts (ex.: o `api` do app.js).
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.Convenios = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const pad = (n) => String(n).padStart(2, "0");

  // PURO: vencimento de uma venda a prazo pelo convênio. `dataCompraISO` = 'YYYY-MM-DD'
  // (data BR). Retorna 'YYYY-MM-DD' ou null (sem convênio, sem faixas, ou dia sem faixa).
  function calcularVencimentoConvenio(dataCompraISO, convenio) {
    if (!convenio || !Array.isArray(convenio.faixas) || !convenio.faixas.length) return null;
    const [ano, mes, dia] = String(dataCompraISO).split("-").map(Number);
    if (!ano || !mes || !dia) return null;
    const faixa = convenio.faixas.find((f) => dia >= Number(f.de) && dia <= Number(f.ate));
    if (!faixa) return null;

    if (faixa.tipo === "dias") {
      // compra + N dias (UTC evita saltos de fuso). Meses ignorado.
      const d = new Date(Date.UTC(ano, mes - 1, dia));
      d.setUTCDate(d.getUTCDate() + (Number(faixa.valor) || 0));
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    // tipo "fixo": dia fixo do mês (mês da compra + meses), clamp em mês curto.
    let alvoMes = mes + (Number(faixa.meses) || 0);
    let alvoAno = ano + Math.floor((alvoMes - 1) / 12);
    alvoMes = ((alvoMes - 1) % 12) + 1;
    const ultimoDia = new Date(Date.UTC(alvoAno, alvoMes, 0)).getUTCDate();
    const diaAlvo = Math.min(Number(faixa.valor) || 1, ultimoDia);
    return `${alvoAno}-${pad(alvoMes)}-${pad(diaAlvo)}`;
  }

  // PURO: valida o convênio p/ salvar. Retorna mensagem de erro (pt-BR) ou null.
  // As faixas têm de cobrir 1..31 sem buraco nem sobreposição.
  function validarConvenio(c) {
    if (!c || typeof c !== "object") return "Convênio inválido.";
    if (!String(c.nome || "").trim()) return "Dê um nome ao convênio.";
    const faixas = Array.isArray(c.faixas) ? c.faixas : [];
    if (!faixas.length) return "Adicione ao menos uma faixa de dias.";
    const ord = faixas.slice().sort((a, b) => Number(a.de) - Number(b.de));
    let esperado = 1;
    for (const f of ord) {
      const de = Number(f.de), ate = Number(f.ate), valor = Number(f.valor), meses = Number(f.meses);
      if (!Number.isInteger(de) || !Number.isInteger(ate) || de < 1 || ate > 31 || de > ate)
        return "Cada faixa deve ir de 1 a 31, com início menor ou igual ao fim.";
      if (de !== esperado) return "As faixas devem cobrir os dias 1 a 31 sem buraco nem sobreposição.";
      esperado = ate + 1;
      if (f.tipo !== "fixo" && f.tipo !== "dias") return "Tipo de faixa inválido.";
      if (f.tipo === "fixo" && (!Number.isInteger(valor) || valor < 1 || valor > 31))
        return "No tipo dia fixo, o valor deve ser um dia de 1 a 31.";
      if (f.tipo === "dias" && (!Number.isInteger(valor) || valor < 1))
        return "No tipo +dias, informe um número de dias (1 ou mais).";
      if (!Number.isInteger(meses) || meses < 0) return "O mês deve ser 0 ou mais.";
    }
    if (esperado !== 32) return "As faixas devem cobrir até o dia 31.";
    return null;
  }

  function _slug(nome) {
    return "cv_" + String(nome || "conv").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cv_conv";
  }

  // PURO: saneia a lista p/ persistir em config.convenios. Descarta inválidos, coage
  // tipos, força meses=0 no tipo "dias", garante id.
  function normalizarConvenios(lista) {
    const arr = Array.isArray(lista) ? lista : [];
    const out = [];
    const usados = new Set();
    for (const c of arr) {
      const faixas = (Array.isArray(c && c.faixas) ? c.faixas : []).map((f) => ({
        de: Number(f.de), ate: Number(f.ate),
        tipo: f.tipo === "dias" ? "dias" : "fixo",
        valor: Math.trunc(Number(f.valor) || 0),
        meses: f.tipo === "dias" ? 0 : Math.trunc(Number(f.meses) || 0),
      }));
      let id = String((c && c.id) || "").trim() || _slug(c && c.nome);
      while (usados.has(id)) id += "x";
      const norm = { id, nome: String((c && c.nome) || "").trim(), faixas };
      if (validarConvenio(norm) === null) { usados.add(id); out.push(norm); }
    }
    return out;
  }

  // PURO: resumo legível das faixas p/ a lista na UI.
  function resumoFaixas(convenio) {
    const faixas = (convenio && Array.isArray(convenio.faixas)) ? convenio.faixas : [];
    return faixas.map((f) => {
      const dias = `${f.de}–${f.ate}`;
      if (f.tipo === "dias") return `Dias ${dias}: ${f.valor} dias após a compra`;
      const quando = Number(f.meses) === 0 ? "no mês" : Number(f.meses) === 1 ? "no mês seguinte" : `em ${f.meses} meses`;
      return `Dias ${dias}: dia ${f.valor} ${quando}`;
    }).join(" · ");
  }

  return { calcularVencimentoConvenio, validarConvenio, normalizarConvenios, resumoFaixas };
});
