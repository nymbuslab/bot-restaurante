// ============================================================
// FORMAS DE PAGAMENTO — vocabulário FIXO da plataforma (puro, sem I/O).
//
// Antes as formas eram texto livre em `config.pagamentos`. Agora são um
// conjunto fechado: o dono só liga/desliga cada uma. `config.pagamentos`
// segue sendo um array de strings (compatível com todos os leitores atuais:
// PDV, Mesa, "Receber", checkout web) — mas agora só com valores canônicos.
// ============================================================

// Ordem canônica de exibição (toggles em Configurações seguem esta ordem).
const FORMAS_PAGAMENTO = ["Dinheiro", "PIX", "Cartão de Crédito", "Cartão de Débito"];

// Mapeia UMA string (canônica ou legada de texto livre) para as formas
// canônicas correspondentes. "Cartão" genérico (ex.: "Cartão (na entrega)")
// vira Crédito + Débito. Retorna [] quando não reconhece (ex.: "Outros", "A Prazo").
function _mapear(forma) {
  const f = String(forma || "");
  if (/pix/i.test(f)) return ["PIX"];
  if (/dinheiro|esp[eé]cie/i.test(f)) return ["Dinheiro"];
  const credito = /cr[eé]dito/i.test(f);
  const debito = /d[eé]bito/i.test(f);
  if (credito || debito) {
    const r = [];
    if (credito) r.push("Cartão de Crédito");
    if (debito) r.push("Cartão de Débito");
    return r;
  }
  if (/cart[aã]o/i.test(f)) return ["Cartão de Crédito", "Cartão de Débito"]; // genérico
  return [];
}

// Normaliza uma lista de formas (canônicas ou legadas) para o subconjunto
// canônico, sem duplicar e na ordem fixa de FORMAS_PAGAMENTO. Serve tanto de
// whitelist ao salvar quanto de migração dos tenants antigos. Nunca devolve
// vazio: se nada sobrar, cai em ["Dinheiro"] (todo restaurante aceita ao menos
// uma forma).
function normalizarFormasPagamento(lista) {
  const arr = Array.isArray(lista) ? lista : [];
  const ligadas = new Set();
  for (const forma of arr) for (const canon of _mapear(forma)) ligadas.add(canon);
  const out = FORMAS_PAGAMENTO.filter((f) => ligadas.has(f));
  return out.length ? out : ["Dinheiro"];
}

module.exports = { FORMAS_PAGAMENTO, normalizarFormasPagamento };
