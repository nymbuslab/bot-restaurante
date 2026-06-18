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

// Fallback p/ tenants antigos sem `boasVindasRetorno` salvo na config.
const MSG_RETORNO_PADRAO = "Que bom te ver de novo, *{cliente}*! 👋";

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

function estaAberto(tenantDir) {
  const config = store.getConfig(tenantDir);
  if (!config.atendimento.aberto) return false;
  const horarios = config.horarios;
  if (!horarios) return true;
  const agora = new Date();
  const h = horarios[DIAS[agora.getDay()]];
  if (!h || h.fechado) return false;
  if (!h.abre || !h.fecha) return true;
  const [hA, mA] = h.abre.split(":").map(Number);
  const [hF, mF] = h.fecha.split(":").map(Number);
  const min = agora.getHours() * 60 + agora.getMinutes();
  return min >= hA * 60 + mA && min < hF * 60 + mF;
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

async function menuPrincipal(tenantDir, chatId, telefone = "") {
  const config = store.getConfig(tenantDir);
  // Reconhece o cliente (por chat_id ou telefone) p/ saudar pelo nome.
  const cli = await clientes.buscarCliente(tenantDir, { chatId, telefone });
  const intro = cli && cli.nome
    ? aplicar(config.mensagens.boasVindasRetorno || MSG_RETORNO_PADRAO, {
        cliente: primeiroNome(cli.nome), restaurante: config.restaurante.nome,
      })
    : aplicar(config.mensagens.boasVindas, { restaurante: config.restaurante.nome });
  const link = linkCardapio(tenantDir, chatId);
  const corpo = link
    ? `\n\n🛒 *Faça seu pedido pelo nosso cardápio:*\n${link}\n\nÉ só escolher os itens, montar o pedido e confirmar — ele chega aqui automaticamente. 😉`
    : `\n\n🛒 Nosso cardápio digital está quase pronto. Volte em instantes!`;
  return intro + corpo + `\n\n_Precisa falar com uma pessoa? Digite *atendente*._`;
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
      return { respostas: [await menuPrincipal(tenantDir, chatId, sessao.telefone)] };
    }
    return { respostas: [] };
  }

  // Atalho para atendimento humano, a qualquer momento.
  if (["atendente", "humano"].includes(lower)) {
    sessao.estado = "ATENDENTE";
    return { respostas: [config.mensagens.atendente] };
  }

  // Loja fechada: informa o horário e não envia o link de pedido.
  if (!aberto) {
    sessao.estado = "MENU";
    return { respostas: [aplicar(config.mensagens.fechado, { horario: textoHorario(config) })] };
  }

  // Aberto: qualquer mensagem recebe o menu com o link do cardápio.
  sessao.estado = "MENU";
  return { respostas: [await menuPrincipal(tenantDir, chatId, sessao.telefone)] };
}

module.exports = { processarMensagem, estaAberto };
