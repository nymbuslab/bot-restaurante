// ============================================================
// DASHBOARD-CALC — montagem PURA do dashboard a partir dos agregados crus do banco
// (src/pedidos.js → dashboardRaw) + o cardápio (para mapear item → grupo).
//
// Sem I/O, sem Date.now(): recebe `hojeBR` ('YYYY-MM-DD', já no fuso do dono) e
// caminha as datas em UTC (determinístico, sem drift de fuso). Testado em
// test/dashboard-calc.test.js. O front só EXIBE o que sai daqui.
// ============================================================

const MES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MES_LONGO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const pad2 = (n) => String(n).padStart(2, "0");
const chaveDia = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const ddmm = (y, m, d) => `${pad2(d)}/${pad2(m)}`;
const dmy  = (y, m, d) => `${pad2(d)}/${pad2(m)}/${y}`;
const cap  = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Monta o objeto final do dashboard. `raw` = saída de pedidos.dashboardRaw;
// `cardapio` = { categorias:[{ nome, itens:[{ id, nome }] }] } (para o ranking de grupos).
function montarDashboard(raw, cardapio) {
  raw = raw || {};
  const diarioMap = {};
  (raw.diario || []).forEach((r) => { diarioMap[r.dia] = Number(r.valor) || 0; });
  const mensalMap = {};
  (raw.mensal || []).forEach((r) => { mensalMap[r.mes] = Number(r.valor) || 0; });

  const [hy, hm, hd] = String(raw.hojeBR || "1970-01-01").split("-").map(Number);
  const hojeUTC = Date.UTC(hy, hm - 1, hd);

  // ---- Série diária (30 dias) + janelas hoje / ontem / 7 dias ----
  const serieDia = [];
  let hoje = 0, ontem = 0, sete = 0;
  for (let i = 29; i >= 0; i--) {
    const dt = new Date(hojeUTC - i * 86400000);
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
    const valor = diarioMap[chaveDia(y, m, d)] || 0;
    serieDia.push({ rotulo: ddmm(y, m, d), valor });
    if (i === 0) hoje = valor;
    if (i === 1) ontem = valor;
    if (i < 7) sete += valor; // últimos 7 dias (inclui hoje)
  }

  // ---- Série mensal (12 meses) ----
  const serieMes = [];
  for (let i = 11; i >= 0; i--) {
    let mm = hm - 1 - i, yy = hy;
    while (mm < 0) { mm += 12; yy -= 1; }
    const valor = mensalMap[`${yy}-${pad2(mm + 1)}`] || 0;
    serieMes.push({ rotulo: `${cap(MES_ABREV[mm])} de ${yy}`, valor });
  }

  // ---- Vendas por janela (faturamento de produtos, sem frete) ----
  const mes = raw.mes || {};
  const fatMes = Number(mes.fat) || 0;
  const ativos = Number(mes.ativos) || 0;
  const cancel = Number(mes.cancel) || 0;
  const totalMes = Number(mes.total) || 0;
  const vendas = { hoje, ontem, sete, mes: fatMes };

  // Legendas das datas (o front só exibe).
  const ontemDt = new Date(hojeUTC - 86400000);
  const ini7Dt  = new Date(hojeUTC - 6 * 86400000);
  const labels = {
    hoje:  dmy(hy, hm, hd),
    ontem: dmy(ontemDt.getUTCFullYear(), ontemDt.getUTCMonth() + 1, ontemDt.getUTCDate()),
    sete:  `${ddmm(ini7Dt.getUTCFullYear(), ini7Dt.getUTCMonth() + 1, ini7Dt.getUTCDate())} a ${ddmm(hy, hm, hd)}`,
    mes:   `${MES_LONGO[hm - 1]} de ${hy}`,
  };

  // ---- Top 10 produtos (por faturamento) — mescla por descrição ----
  const prod = {};
  (raw.itens || []).forEach((r) => {
    const nome = r.descricao || "—";
    prod[nome] = (prod[nome] || 0) + (Number(r.valor) || 0);
  });
  const top10 = Object.entries(prod).map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor).slice(0, 10);

  // ---- Ranking de grupos (por quantidade) — mapeia item → categoria pelo cardápio ----
  const catById = {}, catByNome = {};
  ((cardapio && cardapio.categorias) || []).forEach((c) => (c.itens || []).forEach((it) => {
    if (it.id != null) catById[it.id] = c.nome;
    if (it.nome) catByNome[it.nome] = c.nome;
  }));
  const grupo = {};
  (raw.itens || []).forEach((r) => {
    // item_id vem como string do bigint; as chaves de objeto são string → casa com it.id.
    const cat = catById[r.item_id] || catByNome[r.descricao] || "Outros";
    grupo[cat] = (grupo[cat] || 0) + (Number(r.qtd) || 0);
  });
  const ranking = Object.entries(grupo).map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd).slice(0, 6);

  // ---- Visão geral (qualidade/origem das vendas do mês) ----
  const ticket = ativos ? fatMes / ativos : 0;
  const taxaCanc = totalMes ? Math.round((cancel / totalMes) * 100) : 0;

  const canaisRows = (raw.canais || []).map((r) => ({ nome: r.canal, valor: Number(r.valor) || 0 }));
  const fatCanais = canaisRows.reduce((s, c) => s + c.valor, 0) || 1;
  const canais = canaisRows.sort((a, b) => b.valor - a.valor).slice(0, 3)
    .map((c) => ({ nome: c.nome, pct: Math.round((c.valor / fatCanais) * 100) }));

  const pagRows = (raw.pagamentos || []).map((r) => ({ nome: r.forma, qtd: Number(r.qtd) || 0 }));
  const pagTot = pagRows.reduce((s, p) => s + p.qtd, 0);
  const pagTop = pagRows.sort((a, b) => b.qtd - a.qtd)[0];
  const pagamento = (pagTop && pagTot) ? { nome: pagTop.nome, pct: Math.round((pagTop.qtd / pagTot) * 100) } : null;

  const visao = { ticket, taxaCanc, canais, pagamento };

  return { hojeBR: raw.hojeBR || null, vendas, labels, serieDia, serieMes, top10, ranking, visao };
}

module.exports = { montarDashboard };
