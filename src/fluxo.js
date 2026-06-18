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
    return { respostas: [aplicar(config.mensagens.fechado, { horario: textoHorario(config) })] };
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
