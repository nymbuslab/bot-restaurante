// ============================================================
// FLUXO DE CONVERSA (máquina de estados)
// O PEDIDO é feito no CARDÁPIO WEB (/c/:slug) — o bot é só a porta de entrada:
// na saudação ele envia o LINK do cardápio (com um token que liga o pedido feito
// na web ao cliente do WhatsApp) e mantém o atalho "falar com atendente".
// Estados: MENU (responde com o link) e ATENDENTE (bot quieto). O ciclo do pedido
// (montar/confirmar/recalcular/salvar) vive em src/cardapio-web.js + a rota
// POST /api/c/:slug/pedido em src/servidor.js.
// ============================================================

const path = require("path");
const store = require("./store");
const cardapioWeb = require("./cardapio-web");
const clientes = require("./clientes");

// Fallbacks p/ tenants antigos sem a mensagem salva na config.
const MSG_RETORNO_PADRAO = "Que bom te ver de novo, *{cliente}*! 👋";
const MSG_DESPEDIDA_PADRAO = "Atendimento encerrado. Quando quiser pedir de novo, é só mandar *oi*! 👋";

// Palavras de navegação do atendimento automático.
const CMD_VOLTAR = ["menu", "voltar", "0"];
const CMD_SAIR = ["sair", "#sair", "encerrar"];
const CMD_ATENDENTE = ["atendente", "humano"];

// Só o primeiro nome deixa a saudação mais natural ("Pablo", não "Pablo Martins").
function primeiroNome(nome) {
  return String(nome || "").trim().split(/\s+/)[0] || "";
}

function aplicar(texto, vars) {
  let t = texto || "";
  for (const [k, v] of Object.entries(vars)) t = t.split("{" + k + "}").join(v);
  return t;
}

// ---------- Verificação de horário ----------

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

// Hora "agora" SEMPRE no fuso do Brasil (America/Sao_Paulo, UTC-3 fixo desde 2019).
// O servidor de produção (Fly) roda em UTC → usar a hora local dele atrasava/adiantava
// 3h e fazia o bot dizer "fechado" na hora errada (sobretudo de madrugada). Mesmo
// padrão do corte de mês das métricas em src/servidor.js.
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

// "HH:MM" -> minutos do dia. Fechamento "00:00" representa a meia-noite (fim do dia)
// → 1440, e NÃO o começo do dia, pra "11:00 às 00:00" abrir o dia inteiro até as 24h.
function paraMin(hhmm, ehFecha = false) {
  const [h, m] = String(hhmm).split(":").map(Number);
  const min = h * 60 + m;
  return ehFecha && min === 0 ? 1440 : min;
}

// Janela de um dia normalizada, ou null se fechado/sem horário (= sempre aberto trata fora).
function janela(h) {
  if (!h || h.fechado || !h.abre || !h.fecha) return null;
  return { abre: paraMin(h.abre), fecha: paraMin(h.fecha, true) };
}

function estaAberto(tenantDir) {
  const config = store.getConfig(tenantDir);
  if (!config.atendimento.aberto) return false;
  const horarios = config.horarios;
  if (!horarios) return true;
  const { dia, min } = agoraBR();

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

// Próxima abertura a partir de agora (fuso BR), em texto curto p/ a variável
// {proximaAbertura}: "hoje às *18:00*", "amanhã (sexta) às *08:00*" ou "sábado às *10:00*".
// Varre os próximos 7 dias; "" se não houver nenhum dia aberto.
function proximaAbertura(config) {
  const horarios = config.horarios;
  if (!horarios) return "";
  const { dia, min } = agoraBR();
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

// Texto do horário de funcionamento (mesmo formato do painel) p/ a variável {horario}
// na mensagem de "fechado". Garante que o cliente sempre veja o horário atualizado.
const DIAS_LABEL = [
  { key: "seg", label: "Segunda" }, { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" }, { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" }, { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];
function textoHorario(config) {
  const horarios = config.horarios;
  if (!horarios) return config.restaurante.horario || "";
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
  if (!grupos.length) return config.restaurante.horario || "";
  const trechos = grupos.map((g) => {
    const dias = g.ini === g.fim ? `*${g.ini}*` : `de *${g.ini}* a *${g.fim}*`;
    return `${dias} das *${g.abre}* às *${g.fecha}*`;
  });
  return "Nosso atendimento é " + trechos.join("; ");
}

// ---------- Link do cardápio + menu ----------

// Monta o link público do cardápio com um token assinado (liga o pedido feito na
// web ao cliente do WhatsApp, p/ a confirmação automática). Precisa de PUBLIC_URL;
// sem ela, retorna "" (o menu mostra um aviso amigável). Token só com o segredo
// configurado; ausente → o link vai sem token e a confirmação usa o telefone.
function linkCardapio(tenantDir, chatId) {
  const base = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
  if (!base) return "";
  const slug = path.basename(tenantDir);
  const secret = process.env.CARDAPIO_LINK_SECRET || "";
  const token = secret && chatId ? cardapioWeb.assinarToken(secret, slug, chatId) : "";
  return base + "/c/" + slug + (token ? "?p=" + encodeURIComponent(token) : "");
}

// Saudação + menu numerado (sem o link — o link vem depois, ao escolher "1").
async function menuPrincipal(tenantDir, chatId, telefone = "") {
  const config = store.getConfig(tenantDir);
  // Reconhece o cliente (por chat_id ou telefone) p/ saudar pelo nome.
  const cli = await clientes.buscarCliente(tenantDir, { chatId, telefone });
  const intro = cli && cli.nome
    ? aplicar(config.mensagens.boasVindasRetorno || MSG_RETORNO_PADRAO, {
        cliente: primeiroNome(cli.nome), restaurante: config.restaurante.nome,
      })
    : aplicar(config.mensagens.boasVindas, { restaurante: config.restaurante.nome });
  return intro + `\n\nComo posso te ajudar?\n*1* - Fazer pedido\n*2* - Falar com atendente`;
}

// Resposta da opção "1": envia o link do cardápio web (com token, se houver).
function respostaPedido(tenantDir, chatId) {
  const link = linkCardapio(tenantDir, chatId);
  if (!link) return `🛒 Nosso cardápio digital está quase pronto. Volte em instantes!`;
  return `Continue seu pedido no nosso cardápio 👇\n${link}\n\nÉ só montar o pedido e confirmar — ele chega aqui automaticamente. 😉\n\n_Digite *menu* para voltar, *atendente* para falar com uma pessoa, ou *sair* para encerrar._`;
}

// ---------- Máquina de estados ----------

async function processarMensagem(chatId, texto, sessao, tenantDir, telefone = "", opts = {}) {
  await store.ensure(tenantDir); // garante config/cardápio no cache (reads síncronos abaixo)
  const config = store.getConfig(tenantDir);
  const lower = (texto || "").trim().toLowerCase();
  // Simulador (console de testes) ignora o horário comercial; o bot real respeita.
  const aberto = opts.ignorarHorario ? true : estaAberto(tenantDir);

  // chatId = canal da conversa (LID/phone JID) por onde a confirmação/aviso é enviado;
  // o telefone real (de senderPn) pode não vir em TODA mensagem — guarda o melhor valor.
  sessao.chatId = chatId;
  if (telefone) sessao.telefone = telefone;

  // No estado ATENDENTE o bot fica quieto — o atendente humano conduz a conversa.
  if (sessao.estado === "ATENDENTE") {
    if (lower === "menu") {
      sessao.estado = "MENU";
      sessao.saudou = true;
      return { respostas: [await menuPrincipal(tenantDir, chatId, sessao.telefone)] };
    }
    return { respostas: [] };
  }

  // Atalho global para atendimento humano (palavra explícita, a qualquer momento).
  if (CMD_ATENDENTE.includes(lower)) {
    sessao.estado = "ATENDENTE";
    return { respostas: [config.mensagens.atendente] };
  }

  // Loja fechada: informa o horário e não envia o menu/link. Ao reabrir, cumprimenta de novo.
  if (!aberto) {
    sessao.estado = "MENU";
    sessao.saudou = false;
    return { respostas: [aplicar(config.mensagens.fechado, {
      horario: textoHorario(config),
      proximaAbertura: proximaAbertura(config),
    })] };
  }

  // Aberto. Primeiro contato da sessão → saudação + menu numerado (1/2).
  sessao.estado = "MENU";
  if (!sessao.saudou) {
    sessao.saudou = true;
    return { respostas: [await menuPrincipal(tenantDir, chatId, sessao.telefone)] };
  }

  // Já cumprimentado: trata a escolha do menu e a navegação.
  if (CMD_SAIR.includes(lower)) {
    sessao.saudou = false; // próximo "oi" recomeça do menu
    return { respostas: [config.mensagens.despedida || MSG_DESPEDIDA_PADRAO] };
  }
  if (lower === "2") {
    sessao.estado = "ATENDENTE";
    return { respostas: [config.mensagens.atendente] };
  }
  if (CMD_VOLTAR.includes(lower)) {
    return { respostas: [await menuPrincipal(tenantDir, chatId, sessao.telefone)] };
  }
  // "1" ou qualquer outra coisa → manda o link do cardápio.
  return { respostas: [respostaPedido(tenantDir, chatId)] };
}

module.exports = { processarMensagem, estaAberto };
