// ============================================================
// HORÁRIO DE FUNCIONAMENTO — uma regra só para "está aberto agora?".
// PURO e dual-mode (Node/browser), como `pagamentos.js` e `estoque.js`.
//
// Existiam DUAS implementações da mesma pergunta e elas discordavam. O servidor
// (bot e cardápio web) usava a completa; o painel do dono tinha uma versão curta
// que errava em quatro casos, todos exibindo "FECHADO" para loja aberta:
//   - horário que vira a noite (18:00 às 02:00) ficava fechado 24h por dia;
//   - fechar às 00:00 (e o 00:00–00:00 de quem abre 24h) nunca abria;
//   - a cauda da madrugada (01:00 de terça pela janela da segunda) não contava;
//   - config sem `atendimento.aberto` fechava no painel e abria no servidor.
// Quem decide se o pedido entra é o servidor, então o painel só mentia para o
// dono — que podia sair mexendo na config para "abrir" o que já estava aberto.
//
// O texto do horário (`textoHorario`) também morava duplicado nos dois lados.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.Horario = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  // A semana do dono começa na segunda (é como ele lê a tabela de horários).
  const DIAS_LABEL = [
    { key: "seg", label: "Segunda" }, { key: "ter", label: "Terça" },
    { key: "qua", label: "Quarta" }, { key: "qui", label: "Quinta" },
    { key: "sex", label: "Sexta" }, { key: "sab", label: "Sábado" },
    { key: "dom", label: "Domingo" },
  ];

  // Hora "agora" SEMPRE no fuso do Brasil (America/Sao_Paulo, UTC-3 fixo desde 2019).
  // O servidor de produção (Fly) roda em UTC → usar a hora local dele atrasava/adiantava
  // 3h e fazia o bot dizer "fechado" na hora errada (sobretudo de madrugada). No painel
  // vale o mesmo: o relógio do navegador é de quem está olhando, não o da loja.
  function agoraBR() {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date());
    const get = (t) => (p.find((x) => x.type === t) || {}).value;
    const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    let hora = Number(get("hour"));
    if (hora === 24) hora = 0; // alguns ambientes devolvem "24" à meia-noite
    return { dia: WD[get("weekday")], min: hora * 60 + Number(get("minute")) };
  }

  // "HH:MM" -> minutos do dia. Fechamento "00:00" representa a meia-noite (fim do
  // dia) → 1440, e NÃO o começo do dia, pra "11:00 às 00:00" abrir o dia inteiro
  // até as 24h — e pra "00:00 às 00:00" significar as 24 horas, que é como o dono
  // escreve "abro sem parar".
  function paraMin(hhmm, ehFecha) {
    const [h, m] = String(hhmm).split(":").map(Number);
    const min = h * 60 + m;
    return ehFecha && min === 0 ? 1440 : min;
  }

  // Janela de um dia normalizada, ou null se fechado/sem horário (= sempre aberto
  // é tratado por quem chama).
  function janela(h) {
    if (!h || h.fechado || !h.abre || !h.fecha) return null;
    return { abre: paraMin(h.abre), fecha: paraMin(h.fecha, true) };
  }

  // A loja está aberta agora? `agora` ({ dia, min }) é injetável para teste.
  function abertoAgora(config, agora) {
    const cfg = config || {};
    if (cfg.atendimento && cfg.atendimento.aberto === false) return false;
    const horarios = cfg.horarios;
    if (!horarios) return true;
    const { dia, min } = agora || agoraBR();

    // Dia atual.
    const hoje = horarios[DIAS[dia]];
    if (hoje && !hoje.fechado && (!hoje.abre || !hoje.fecha)) return true; // aberto sem horário definido
    const jHoje = janela(hoje);
    if (jHoje) {
      if (jHoje.fecha > jHoje.abre) {
        if (min >= jHoje.abre && min < jHoje.fecha) return true; // janela no mesmo dia
      } else {
        if (min >= jHoje.abre) return true; // vira a noite: parte antes da meia-noite
      }
    }

    // Cauda da madrugada: o dia ANTERIOR pode ter virado a noite (fecha <= abre).
    const jOntem = janela(horarios[DIAS[(dia + 6) % 7]]);
    if (jOntem && jOntem.fecha <= jOntem.abre && min < jOntem.fecha) return true;

    return false;
  }

  // Texto pt-BR do horário: agrupa dias seguidos com o mesmo abre/fecha e pula os
  // fechados. Ex.: "Nosso atendimento é de *Segunda* a *Sexta* das *11:00* às
  // *22:00*; *Sábado* das *11:00* às *23:00*". Devolve "" quando não há dia aberto
  // — o fallback (o texto legado do tenant) é de quem chama.
  function textoHorario(horarios) {
    if (!horarios) return "";
    const grupos = [];
    let atual = null;
    for (const { key, label } of DIAS_LABEL) {
      const h = horarios[key] || {};
      if (h.fechado) { atual = null; continue; } // dia fechado quebra a sequência
      const abre = h.abre || "11:00";
      const fecha = h.fecha || "22:00";
      if (atual && atual.abre === abre && atual.fecha === fecha) atual.fim = label;
      else { atual = { ini: label, fim: label, abre, fecha }; grupos.push(atual); }
    }
    if (!grupos.length) return "";
    const trechos = grupos.map((g) => {
      const dias = g.ini === g.fim ? `*${g.ini}*` : `de *${g.ini}* a *${g.fim}*`;
      return `${dias} das *${g.abre}* às *${g.fecha}*`;
    });
    return "Nosso atendimento é " + trechos.join("; ");
  }

  // Próxima abertura a partir de agora, em texto curto p/ a variável
  // {proximaAbertura}: "hoje às *18:00*", "amanhã (sexta) às *08:00*" ou
  // "sábado às *10:00*". Varre os próximos 7 dias; "" se nenhum dia abre.
  function proximaAbertura(config, agora) {
    const horarios = (config || {}).horarios;
    if (!horarios) return "";
    const { dia, min } = agora || agoraBR();
    const LABEL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
    for (let d = 0; d < 7; d++) {
      const j = janela(horarios[DIAS[(dia + d) % 7]]);
      if (!j) continue;
      if (d === 0 && min >= j.abre) continue; // hoje, mas o horário de abertura já passou
      const hora = `*${String(Math.floor(j.abre / 60)).padStart(2, "0")}:${String(j.abre % 60).padStart(2, "0")}*`;
      if (d === 0) return `hoje às ${hora}`;
      if (d === 1) return `amanhã (${LABEL[(dia + 1) % 7]}) às ${hora}`;
      return `${LABEL[(dia + d) % 7]} às ${hora}`;
    }
    return "";
  }

  return {
    DIAS: DIAS, DIAS_LABEL: DIAS_LABEL, agoraBR: agoraBR, paraMin: paraMin, janela: janela,
    abertoAgora: abertoAgora, textoHorario: textoHorario, proximaAbertura: proximaAbertura,
  };
});
