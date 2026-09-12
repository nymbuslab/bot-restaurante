// ============================================================
// TELEGRAM — relatórios do caixa e do estoque via Bot API (HTTP puro, sem SDK).
//
// Bot único da plataforma (D-01): o TELEGRAM_BOT_TOKEN identifica o bot, e cada
// tenant é diferenciado pelo próprio chat_id, guardado em config.telegram.chatId.
// Sem TELEGRAM_BOT_TOKEN, os envios viram no-op (não quebram o fluxo) — o mesmo
// contrato de src/email.js sem RESEND_API_KEY. Os disparos são FIRE-AND-FORGET:
// enviar() nunca lança; o chamador faz .catch() e segue.
// ============================================================

const crypto = require("crypto");
const calc = require("./caixa-calc"); // contagemPorForma/diferencaPorForma (volumes e diferenças)
const relatorioCaixa = require("../public/relatorio-caixa"); // estadoCaixa (D-08) — mesmo veredito do cupom 80mm

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || "";
const CONFIGURADO = Boolean(TELEGRAM_BOT_TOKEN);

if (!CONFIGURADO) {
  console.warn("⚠️  Telegram não configurado (defina TELEGRAM_BOT_TOKEN). Relatórios desativados (no-op).");
}

// Envia uma mensagem ao chat do dono. Resolve { ok, motivo? } sem lançar —
// seguro para fire-and-forget.
async function enviar(chatId, texto) {
  if (!CONFIGURADO || !chatId || !texto) return { ok: false, motivo: "nao_configurado" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: "Markdown" }),
    });
    if (!r.ok) {
      const d = await r.text().catch(() => "");
      console.error("telegram sendMessage:", r.status, d.slice(0, 200));
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("telegram sendMessage erro:", e.message);
    return { ok: false };
  }
}

// Busca updates pendentes do getUpdates (polling simples). `offset`, quando
// informado, confirma ao Telegram que tudo antes dele já foi processado —
// sem isso a API reenvia o MESMO lote para sempre a cada chamada (e um
// backlog acima de 100 updates não confirmados pode nem trazer o /start mais
// recente, que fica soterrado atrás dos antigos). Devolve a lista de updates
// ou [] se não houver nada. Nunca lança.
async function buscarUpdates(offset) {
  if (!CONFIGURADO) return [];
  try {
    let url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?timeout=10`;
    if (offset != null) url += `&offset=${encodeURIComponent(offset)}`;
    const r = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!r.ok) {
      const d = await r.text().catch(() => "");
      console.error("telegram getUpdates:", r.status, d.slice(0, 200));
      return [];
    }
    const data = await r.json();
    return data.ok ? (data.result || []) : [];
  } catch (e) {
    console.error("telegram getUpdates erro:", e.message);
    return [];
  }
}

// Próximo `offset` a mandar em buscarUpdates: o maior update_id do lote + 1.
// Função pura para o chamador (index.js) guardar o offset entre rodadas do
// polling. Lote vazio ou sem update_id válido devolve null (mantém o offset
// atual, se houver).
function proximoOffset(updates) {
  let maior = 0;
  for (const u of updates || []) {
    const id = Number(u && u.update_id);
    if (Number.isFinite(id) && id > maior) maior = id;
  }
  return maior > 0 ? maior + 1 : null;
}

// ---- Vinculação (D-02, D-08, D-09) ---------------------------------------

// Código aleatório de USO ÚNICO para o deep link. Nunca o slug do tenant:
// slug é público (aparece no link do cardápio /c/:slug) e, usado como código,
// permitiria a qualquer um vincular o chat_id ao tenant de outro dono.
function gerarCodigoVinculacao() {
  return crypto.randomBytes(12).toString("hex");
}

// Link t.me/<bot>?start=<codigo> que o dono abre para iniciar a conversa.
function linkVinculacao(codigo) {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${codigo}`;
}

// Lê um update do getUpdates: o chat_id e o código que vem após "/start ".
// Update sem message, sem chat ou sem o padrão "/start <código>" retorna null
// (não há o que vincular) sem lançar.
function extrairCodigoDeUpdate(update) {
  const msg = update && update.message;
  if (!msg || !msg.chat || msg.chat.id == null) return null;
  if (typeof msg.text !== "string" || msg.text === "") return null;
  const m = msg.text.match(/^\/start\s+([A-Za-z0-9_-]+)\s*$/);
  if (!m) return null;
  return { codigo: m[1], chatId: msg.chat.id };
}

// Orquestrador PURO de resolução de vínculos: casa os updates (do getUpdates)
// com os tenants via funções injetadas e chama vincular(tenant, chatId) só
// quando existe tenant para o código. Nunca lança: erro de banco ou de gravação
// isola o update e deixa o resto andar (padrão fire-and-forget). Devolve a
// lista dos vínculos resolvidos ({ codigo, chatId }).
async function resolverVinculos(updates, buscarTenantPorCodigo, vincular) {
  const resolvidos = [];
  for (const update of updates || []) {
    const extraido = extrairCodigoDeUpdate(update);
    if (!extraido) continue;
    let tenant = null;
    try {
      tenant = await buscarTenantPorCodigo(extraido.codigo);
    } catch (e) {
      console.error("telegram buscar por código:", e.message);
      continue;
    }
    if (!tenant) continue;
    try {
      await vincular(tenant, extraido.chatId);
      resolvidos.push({ codigo: extraido.codigo, chatId: extraido.chatId });
    } catch (e) {
      console.error("telegram vincular:", e.message);
    }
  }
  return resolvidos;
}

// ---- Formatação das mensagens (D-03, D-12) --------------------------------

// Valor em R$ com separador de milhar e vírgula decimal (padrão do projeto).
// Ex.: 1250 → "1.250,00" (nunca "1250.00").
function fmtBr(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Quantidade com a unidade do estoque: kg vira decimal BR, un vira inteiro.
function fmtQtd(q, unidade) {
  const n = Number(q) || 0;
  if (unidade === "kg") return String(Math.round(n * 1000) / 1000).replace(".", ",") + " kg";
  return String(Math.round(n)) + " un";
}

// Data/hora no fuso do restaurante (BR): "07/09/2026, 10:00", com ano explícito
// (em Node sem full-icu o toLocaleString omite o ano se não for pedido). Vazio
// se não der para parsear — o chamador decide se a linha entra na mensagem.
function _dataHoraBR(iso) {
  try {
    if (!iso) return "";
    return new Date(iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch (_) { return ""; }
}

// Diferença por forma com sinal: "+R$ 5,00" / "-R$ 10,00" / "R$ 0,00" (tolerância
// de arredondamento igual à do cupom p/ float 0,1+0,2 não virar diferença).
function fmtDif(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) < 0.005) return "R$ 0,00";
  return (n > 0 ? "+R$ " : "-R$ ") + fmtBr(Math.abs(n));
}

// Garante o limite de 4096 caracteres do sendMessage: corta o fim e avisa.
function _encurtar(texto) {
  const limite = 4096;
  if (texto.length <= limite) return texto;
  const fim = "\n[…] (mensagem encurtada)";
  const linhas = texto.split("\n");
  const guardadas = [];
  let tam = 0;
  for (const linha of linhas) {
    const acrescimo = (guardadas.length ? 1 : 0) + linha.length + fim.length;
    if (tam + acrescimo > limite) break;
    if (guardadas.length) tam += 1;
    tam += linha.length;
    guardadas.push(linha);
  }
  return guardadas.join("\n") + fim;
}

// Relatório do fechamento de caixa do dia. Entrada: o detalhe rico montado em
// fecharCaixa (operador, datas, contagemPorForma, recebidoPorForma,
// contadoPorForma, esperadoPorForma, totalRecebido, suprimentos, sangrias,
// cancelamentos). Compatível com o resumo de caixa-calc (resumoCaixa) quando só
// houver os totais. Fórmulas delegadas a módulos puros — contagemPorForma e
// diferencaPorForma de caixa-calc, veredito de estadoCaixa (D-08), que é o MESMO
// do cupom 80mm: o Telegram nunca recalcula regra própria.
function formatarMensagemFechamentoCaixa(detalhe) {
  const d = detalhe || {};
  const linhas = [];
  linhas.push("*Fechamento de caixa*");
  if (d.restaurante) linhas.push(d.restaurante);
  if (d.operador) linhas.push("Operador: " + d.operador);
  const aberto = _dataHoraBR(d.abertoEm);
  const fechado = _dataHoraBR(d.fechadoEm);
  if (aberto && fechado) linhas.push(aberto + "  ->  " + fechado);
  linhas.push("");
  linhas.push("Total recebido: *R$ " + fmtBr(d.totalRecebido) + "*");

  // Vendas por forma (D-01): quantidade (contagemPorForma) e valor (recebidoPorForma).
  const recebido = d.recebidoPorForma || {};
  const contagens = d.contagemPorForma || (Array.isArray(d.movimentos) ? calc.contagemPorForma(d.movimentos) : {});
  const formas = Object.keys(recebido);
  if (formas.length) {
    linhas.push("");
    linhas.push("*Vendas por forma*");
    for (const forma of formas) {
      const qtd = contagens[forma] != null ? contagens[forma] + "x · " : "";
      linhas.push("- " + forma + ": " + qtd + "R$ " + fmtBr(recebido[forma]));
    }
  }

  // Conferência por forma (D-04): contado × esperado, com a diferença de cada forma.
  const contado = d.contadoPorForma || {};
  const esperado = d.esperadoPorForma || {};
  if (Object.keys(contado).length || Object.keys(esperado).length) {
    linhas.push("");
    linhas.push("*Conferência do caixa*");
    const formasConf = Array.from(new Set([...Object.keys(contado), ...Object.keys(esperado)]));
    for (const forma of formasConf) {
      const c = Number(contado[forma]) || 0;
      const e = Number(esperado[forma]) || 0;
      linhas.push("- " + forma + ": R$ " + fmtBr(c) + " (esperado R$ " + fmtBr(e) + " · " + fmtDif(c - e) + ")");
    }
  }

  // Veredito final (D-08): total do operador (soma do contado) contra a
  // conferência (soma do esperado), com a MESMA fórmula do cupom impresso. O
  // rótulo do veredito vem pronto de estadoCaixa — aqui nunca se recodifica.
  const soma = (o) => Object.values(o || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalOperador = soma(contado);
  const totalConferencia = soma(esperado);
  if (totalOperador || totalConferencia) {
    const st = relatorioCaixa.estadoCaixa(totalOperador, totalConferencia);
    let rot = "*" + st.estado + "*";
    if (st.diferenca > 0.004) rot += " · +R$ " + fmtBr(st.diferenca);
    else if (st.diferenca < -0.004) rot += " · -R$ " + fmtBr(Math.abs(st.diferenca));
    linhas.push("");
    linhas.push("Veredito: " + rot);
  }

  const extras = [];
  if (Number(d.suprimentos)) extras.push("Suprimentos: R$ " + fmtBr(d.suprimentos));
  if (Number(d.sangrias)) extras.push("Sangrias: R$ " + fmtBr(d.sangrias));
  if (Number(d.cancelamentos)) extras.push("Cancelamentos: R$ " + fmtBr(d.cancelamentos));
  if (extras.length) {
    linhas.push("");
    linhas.push(extras.join("\n"));
  }
  return _encurtar(linhas.join("\n"));
}

// Alerta de estoque baixo/esgotado. Entrada: as linhas de public/estoque.js
// (linhasDeEstoque) já filtradas por baixo/esgotado — cada linha tem nome,
// quantidade, minimo, unidade e os flags. Sai em DUAS seções (D-03): Zerado
// (esgotado) e Mínimo (baixo). Seção vazia não aparece; tudo em dia → aviso único.
function formatarMensagemEstoqueBaixo(linhas) {
  const criticos = (linhas || []).filter((l) => l && (l.esgotado || l.baixo));
  if (!criticos.length) return "Sem itens com estoque baixo no momento.";
  const linhaItem = (l) => {
    const nome = l.pai ? l.pai + " (" + l.nome + ")" : l.nome;
    if (l.esgotado) return "- " + nome + ": esgotado";
    let resto = "restam " + fmtQtd(l.quantidade, l.unidade);
    if (l.minimo) resto += " (mínimo " + fmtQtd(l.minimo, l.unidade) + ")";
    return "- " + nome + ": " + resto;
  };
  const L = [];
  L.push("*Estoque baixo*");
  const zerados = criticos.filter((l) => l.esgotado);
  if (zerados.length) {
    L.push("");
    L.push("*Zerado*");
    zerados.forEach((l) => L.push(linhaItem(l)));
  }
  const minimos = criticos.filter((l) => !l.esgotado && l.baixo);
  if (minimos.length) {
    L.push("");
    L.push("*Mínimo*");
    minimos.forEach((l) => L.push(linhaItem(l)));
  }
  return _encurtar(L.join("\n"));
}

// Quais relatórios o dono quer receber (D-03): ponto ÚNICO de leitura de
// config.telegram.tipos. Fechamento de caixa e estoque nascem LIGADOS para quem
// já usa o Telegram (sem tipos salvos, segue tudo como era); cancelamento é
// recurso novo: nasce desligado, com margem mínima 0. Nunca lança — qualquer
// nível ausente (cfg, cfg.telegram, cfg.telegram.tipos) cai nos defaults.
function tiposAtivos(cfg) {
  const tipos = (cfg && cfg.telegram && cfg.telegram.tipos) || {};
  return {
    fechamentoCaixa: tipos.fechamentoCaixa !== false,
    estoque: tipos.estoque !== false,
    cancelamentoAtivo: Boolean(tipos.cancelamentoAtivo),
    margemMinima: Number(tipos.margemMinima) > 0 ? Number(tipos.margemMinima) : 0,
  };
}

// Alerta de cancelamento/estorno (D-05/D-06): dispara NA HORA que o dono
// cancela um pedido pago ou estorna um recebimento. Traz pedido, valor em R$,
// forma e o tipo, com título diferente para cada caso — o dono distingue num
// relance. Sem chamada de rede: entrada é o objeto já resolvido pelo hook.
function formatarMensagemCancelamento(dados) {
  const d = dados || {};
  const eEstorno = String(d.tipo || "").toLowerCase() === "estorno";
  const linhas = [];
  linhas.push(eEstorno ? "*Estorno de recebimento*" : "*Cancelamento de pedido*");
  linhas.push("");
  linhas.push("Pedido: " + (d.pedidoNumero != null ? d.pedidoNumero : "não informado"));
  linhas.push("Valor: *R$ " + fmtBr(d.valor) + "*");
  if (d.forma) linhas.push("Forma: " + d.forma);
  return _encurtar(linhas.join("\n"));
}

module.exports = {
  CONFIGURADO,
  enviar,
  buscarUpdates,
  proximoOffset,
  gerarCodigoVinculacao,
  linkVinculacao,
  extrairCodigoDeUpdate,
  resolverVinculos,
  formatarMensagemFechamentoCaixa,
  formatarMensagemEstoqueBaixo,
  formatarMensagemCancelamento,
  tiposAtivos,
};