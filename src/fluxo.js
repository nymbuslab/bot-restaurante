// ============================================================
// FLUXO DE CONVERSA (máquina de estados)
// Todas as funções recebem `tenantDir` — diretório do tenant.
//
// Fluxo de um item:
//   PEDINDO -> (OPCIONAIS) -> OBSERVACAO -> QUANTIDADE -> REVISAO
// Finalização:
//   REVISAO -> PERGUNTA_BEBIDA -> (BEBIDAS/BEBIDA_QTD) ->
//   FIN_NOME -> FIN_ENTREGA -> [FIN_ENDERECO] -> FIN_PAGAMENTO -> CONFIRMACAO
// ============================================================

const store = require("./store");
const { resetSessao } = require("./sessoes");
const pedidos = require("./pedidos");

function formatarMoeda(valor) {
  return "R$ " + Number(valor).toFixed(2).replace(".", ",");
}

function aplicar(texto, vars) {
  let t = texto || "";
  for (const [k, v] of Object.entries(vars)) t = t.split("{" + k + "}").join(v);
  return t;
}

function formatarComposicao(texto) {
  if (!texto || !texto.trim()) return "";
  let out = "";
  for (let linha of texto.split("\n")) {
    linha = linha.trim();
    if (!linha) continue;
    if (linha.endsWith(":")) out += `\n*${linha.slice(0, -1).trim()}*\n`;
    else out += `• ${linha.replace(/^[*\-•]\s*/, "")}\n`;
  }
  return out.trim();
}

function parseOpcionais(texto) {
  if (!texto || !texto.trim()) return [];
  const lista = [];
  for (let linha of texto.split("\n")) {
    linha = linha.trim().replace(/^[*\-•]\s*/, "");
    if (!linha) continue;
    const partes = linha.split("|");
    const nome = partes[0].trim();
    let preco = 0;
    if (partes.length >= 2) preco = parseFloat(partes[1].replace(",", ".").replace(/[^\d.]/g, "")) || 0;
    if (nome) lista.push({ nome, preco });
  }
  return lista;
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

// ---------- Cardápio / bebidas ----------

function textoCardapio(tenantDir) {
  const cardapio = store.getCardapio(tenantDir);
  const config = store.getConfig(tenantDir);
  let texto = `*📋 CARDÁPIO — ${config.restaurante.nome}*\n`;
  for (const cat of cardapio.categorias) {
    const disp = cat.itens.filter((i) => i.disponivel);
    if (disp.length === 0) continue;
    texto += `\n*${cat.nome}*\n`;
    for (const item of disp) {
      texto += `${item.id}. ${item.nome} — ${formatarMoeda(item.preco)}\n`;
      if (item.desc) texto += `   _${item.desc}_\n`;
    }
  }
  return texto.trim();
}

function bebidasDisponiveis(tenantDir) {
  const cardapio = store.getCardapio(tenantDir);
  const cat = cardapio.categorias.find((c) => c.nome.toLowerCase().includes("bebida"));
  if (!cat) return [];
  return cat.itens.filter((i) => i.disponivel);
}

function textoBebidas(tenantDir) {
  let t = "*🥤 Bebidas disponíveis:*\n";
  for (const b of bebidasDisponiveis(tenantDir)) t += `${b.id}. ${b.nome} — ${formatarMoeda(b.preco)}\n`;
  return t.trim();
}

// ---------- Menu / carrinho ----------

function menuPrincipal(tenantDir) {
  const config = store.getConfig(tenantDir);
  const intro = aplicar(config.mensagens.boasVindas, { restaurante: config.restaurante.nome });
  return (
    intro +
    `\n\n*1* — 🛒 Fazer pedido\n*2* — 🧑‍🍳 Falar com atendente\n\n` +
    `_Digite *menu* a qualquer momento para voltar aqui._`
  );
}

function categoriasDisponiveis(tenantDir) {
  const cardapio = store.getCardapio(tenantDir);
  return cardapio.categorias.filter((c) => c.itens.some((i) => i.disponivel));
}

function textoCategorias(tenantDir) {
  const cats = categoriasDisponiveis(tenantDir);
  let texto = "*Escolha uma categoria:*\n\n";
  cats.forEach((cat, idx) => { texto += `*${idx + 1}* — ${cat.nome}\n`; });
  return texto + `\n*0* — Voltar ao menu`;
}

function listaItensDaCategoria(categoria) {
  let texto = `*${categoria.nome}*\n\n`;
  for (const item of categoria.itens.filter((i) => i.disponivel)) {
    texto += `*${item.id}* — ${item.nome} — ${formatarMoeda(item.preco)}\n`;
    if (item.desc) texto += `   _${item.desc}_\n`;
  }
  return texto + `\n👉 Digite o número do item para adicionar.\n*0* — Voltar às categorias`;
}

function precoLinha(item) {
  const extras = (item.opcionais || []).reduce((a, o) => a + (o.preco || 0), 0);
  return (item.preco + extras) * item.qtd;
}

function resumoCarrinho(carrinho) {
  if (carrinho.length === 0) return "_Seu carrinho está vazio._";
  let texto = "*🛒 Seu pedido até agora:*\n";
  let total = 0;
  for (const item of carrinho) {
    const subtotal = precoLinha(item);
    total += subtotal;
    texto += `• ${item.qtd}x ${item.nome} — ${formatarMoeda(subtotal)}\n`;
    for (const o of item.opcionais || []) {
      texto += `   + ${o.nome}${o.preco ? " (" + formatarMoeda(o.preco) + ")" : ""}\n`;
    }
    if (item.observacao) texto += `   📝 _${item.observacao}_\n`;
  }
  texto += `\n*Total: ${formatarMoeda(total)}*`;
  return texto;
}

const totalCarrinho = (c) => c.reduce((a, i) => a + precoLinha(i), 0);

function listaItensParaPedido(tenantDir) {
  return textoCardapio(tenantDir) + `\n\n👉 *Digite o número do item* que deseja adicionar.\nOu digite *0* para voltar ao menu.`;
}

function opcoesAposItem(carrinho) {
  return (
    resumoCarrinho(carrinho) +
    `\n\nO que deseja fazer?\n*1* — ➕ Adicionar mais itens\n*2* — ✅ Finalizar pedido\n*3* — 🗑️ Cancelar pedido`
  );
}

function textoOpcionais(ip) {
  let t = `Deseja algum opcional para *${ip.nome}*?\n\n`;
  ip.opcionaisDisp.forEach((o, idx) => {
    const marcado = ip.opcionaisSel.some((s) => s.nome === o.nome) ? "✅ " : "";
    const preco = o.preco > 0 ? ` (+${formatarMoeda(o.preco)})` : "";
    t += `*${idx + 1}* — ${marcado}${o.nome}${preco}\n`;
  });
  t += `\n_Digite o número para adicionar/remover._\n*0* — Continuar`;
  return t;
}

function perguntaObservacao(nomeItem) {
  return `Alguma *observação* para o *${nomeItem}*? (ex: _sem cebola_, _bem passado_)\n\nDigite ou *0* para pular.`;
}

function perguntaQuantidade(ip) {
  return `Quantas unidades de *${ip.nome}*? Digite um número (ex: *1*, *2*, *3*).`;
}

const MSG_PEDIR_NOME = "Quase lá! 🎉 Para finalizar, qual é o seu *nome*?";

function irParaBebidaOuNome(sessao, tenantDir) {
  const disponiveis = bebidasDisponiveis(tenantDir);
  const idsBebs = new Set(disponiveis.map((b) => b.id));
  const jaTemBebida = sessao.carrinho.some((item) => idsBebs.has(item.id));
  if (disponiveis.length > 0 && !sessao.bebidaPerguntada && !jaTemBebida) {
    sessao.bebidaPerguntada = true;
    sessao.estado = "PERGUNTA_BEBIDA";
    return resumoCarrinho(sessao.carrinho) + "\n\nGostaria de adicionar uma *bebida* ao pedido? 🥤\n\n*1* — Sim, quero!\n*2* — Não, pode seguir";
  }
  sessao.estado = "FIN_NOME";
  return MSG_PEDIR_NOME;
}

function formaPagamento(tenantDir) {
  const config = store.getConfig(tenantDir);
  let texto = "Qual a *forma de pagamento*?\n\n";
  config.pagamentos.forEach((p, i) => { texto += `*${i + 1}* — ${p}\n`; });
  return texto.trim();
}

function textoConfirmacao(sessao, tenantDir) {
  const p = sessao.pedido;
  const config = store.getConfig(tenantDir);
  const taxa = p.tipoEntrega === "Entrega" ? (config.atendimento.taxaEntrega || 0) : 0;
  const totalItens = totalCarrinho(sessao.carrinho);
  const totalFinal = totalItens + taxa;

  let texto = `*📦 Confirme seu pedido:*\n\n`;
  for (const item of sessao.carrinho) {
    const subtotal = precoLinha(item);
    texto += `• ${item.qtd}x ${item.nome} — ${formatarMoeda(subtotal)}\n`;
    for (const o of item.opcionais || []) {
      texto += `   + ${o.nome}${o.preco ? " (" + formatarMoeda(o.preco) + ")" : ""}\n`;
    }
    if (item.observacao) texto += `   📝 _${item.observacao}_\n`;
  }
  if (taxa > 0) texto += `🛵 Taxa de entrega: ${formatarMoeda(taxa)}\n`;
  texto += `*Total: ${formatarMoeda(totalFinal)}*`;
  texto += `\n\n*Nome:* ${p.nome}\n*Tipo:* ${p.tipoEntrega}\n*Endereço:* ${p.endereco}\n*Pagamento:* ${p.pagamento}\n\n`;
  texto += `Está tudo certo?\n*1* — ✅ Confirmar pedido\n*2* — ❌ Cancelar`;
  return texto;
}

// ---------- Máquina de estados ----------

function processarMensagem(chatId, texto, sessao, tenantDir, telefone = "") {
  const config = store.getConfig(tenantDir);
  const msg = (texto || "").trim();
  const lower = msg.toLowerCase();

  // Captura cedo na sessão (robusto): o chatId é o canal da conversa (LID ou phone
  // JID) por onde o "avisar" vai enviar; o telefone real (de senderPn) pode não vir
  // em TODA mensagem — guardamos o melhor valor conhecido para usar na gravação.
  sessao.chatId = chatId;
  if (telefone) sessao.telefone = telefone;

  // No estado ATENDENTE o bot fica quieto — o atendente humano conduz a conversa.
  if (sessao.estado === "ATENDENTE") {
    if (lower === "menu") {
      sessao.estado = "MENU";
      return { respostas: [menuPrincipal(tenantDir)] };
    }
    return { respostas: [] };
  }

  const saudacoes = ["menu", "início", "inicio", "oi", "olá", "ola", "bom dia", "boa tarde", "boa noite"];
  if (!estaAberto(tenantDir) && saudacoes.includes(lower)) {
    sessao.estado = "MENU";
    return { respostas: [aplicar(config.mensagens.fechado, { horario: config.restaurante.horario })] };
  }
  if (saudacoes.includes(lower)) {
    sessao.estado = "MENU";
    return { respostas: [menuPrincipal(tenantDir)] };
  }
  if (["cancelar", "sair"].includes(lower)) {
    resetSessao(chatId);
    return { respostas: ["Tudo bem! Seu pedido foi cancelado. 😊\n\nQuando quiser recomeçar, é só mandar *oi*."] };
  }

  switch (sessao.estado) {
    case "INICIO":
      sessao.estado = "MENU";
      return { respostas: [menuPrincipal(tenantDir)] };

    case "MENU":
      if (msg === "1") {
        if (!estaAberto(tenantDir))
          return { respostas: [aplicar(config.mensagens.fechado, { horario: config.restaurante.horario })] };
        sessao.estado = "CATEGORIA";
        return { respostas: [textoCategorias(tenantDir)] };
      }
      if (msg === "2") {
        sessao.estado = "ATENDENTE";
        return { respostas: [config.mensagens.atendente] };
      }
      return { respostas: ["Não entendi. 😅 Por favor, escolha uma das opções abaixo:\n\n" + menuPrincipal(tenantDir)] };

    case "CATEGORIA": {
      if (msg === "0") {
        sessao.estado = "MENU";
        return { respostas: [menuPrincipal(tenantDir)] };
      }
      const cats = categoriasDisponiveis(tenantDir);
      const idxCat = parseInt(msg, 10) - 1;
      if (isNaN(idxCat) || idxCat < 0 || idxCat >= cats.length)
        return { respostas: ["Opção inválida.\n\n" + textoCategorias(tenantDir)] };
      sessao.categoriaAtual = cats[idxCat];
      sessao.estado = "PEDINDO";
      return { respostas: [listaItensDaCategoria(cats[idxCat])] };
    }

    case "PEDINDO": {
      if (msg === "0") {
        sessao.estado = "CATEGORIA";
        return { respostas: [textoCategorias(tenantDir)] };
      }
      const id = parseInt(msg, 10);
      const item = store.itensDisponiveis(tenantDir)[id];
      if (!item)
        return { respostas: ["Ops, não encontrei esse item. 🤔 Digite o *número* de um dos itens da lista ou *0* para voltar."] };

      sessao.itemPendente = {
        id: item.id, nome: item.nome, preco: item.preco,
        opcionaisDisp: parseOpcionais(item.opcionais),
        opcionaisSel: [], observacao: "",
      };

      let resp = `Você escolheu *${item.nome}* (${formatarMoeda(item.preco)}).`;
      const comp = formatarComposicao(item.composicao);
      if (comp) resp += `\n\n📋 *Vem com:*\n${comp}`;

      if (sessao.itemPendente.opcionaisDisp.length > 0) {
        sessao.estado = "OPCIONAIS";
        resp += `\n\n${textoOpcionais(sessao.itemPendente)}`;
      } else {
        sessao.estado = "OBSERVACAO";
        resp += `\n\n${perguntaObservacao(item.nome)}`;
      }
      return { respostas: [resp] };
    }

    case "OPCIONAIS": {
      if (msg === "0") {
        sessao.estado = "OBSERVACAO";
        return { respostas: [perguntaObservacao(sessao.itemPendente.nome)] };
      }
      const i = parseInt(msg, 10) - 1;
      const disp = sessao.itemPendente.opcionaisDisp;
      if (isNaN(i) || i < 0 || i >= disp.length)
        return { respostas: ["Opção inválida.\n\n" + textoOpcionais(sessao.itemPendente)] };
      const opc = disp[i];
      const sel = sessao.itemPendente.opcionaisSel;
      const ja = sel.findIndex((o) => o.nome === opc.nome);
      if (ja >= 0) sel.splice(ja, 1);
      else sel.push(opc);
      return { respostas: [textoOpcionais(sessao.itemPendente)] };
    }

    case "OBSERVACAO":
      sessao.itemPendente.observacao = msg === "0" ? "" : msg;
      sessao.estado = "QUANTIDADE";
      return { respostas: [perguntaQuantidade(sessao.itemPendente)] };

    case "QUANTIDADE": {
      const qtd = parseInt(msg, 10);
      if (isNaN(qtd) || qtd < 1 || qtd > 50)
        return { respostas: ["Quantidade inválida. Digite um número entre *1* e *50*."] };
      const ip = sessao.itemPendente;
      sessao.carrinho.push({
        id: ip.id, nome: ip.nome, preco: ip.preco, qtd,
        opcionais: ip.opcionaisSel, observacao: ip.observacao,
      });
      sessao.itemPendente = null;
      sessao.estado = "REVISAO";
      return { respostas: [`✅ Adicionado: *${qtd}x ${ip.nome}*.\n\n` + opcoesAposItem(sessao.carrinho)] };
    }

    case "REVISAO":
      if (msg === "1") {
        sessao.estado = "CATEGORIA";
        return { respostas: [textoCategorias(tenantDir)] };
      }
      if (msg === "2") {
        if (sessao.carrinho.length === 0) {
          sessao.estado = "PEDINDO";
          return { respostas: ["Seu carrinho está vazio. " + listaItensParaPedido(tenantDir)] };
        }
        return { respostas: [irParaBebidaOuNome(sessao, tenantDir)] };
      }
      if (msg === "3") {
        sessao.carrinho = [];
        sessao.bebidaPerguntada = false;
        sessao.estado = "MENU";
        return { respostas: ["Pedido cancelado. 🗑️\n\nSempre que quiser recomeçar, é só escolher uma opção:\n\n" + menuPrincipal(tenantDir)] };
      }
      return { respostas: ["Opção inválida. Por favor, escolha:\n\n" + opcoesAposItem(sessao.carrinho)] };

    case "PERGUNTA_BEBIDA":
      if (msg === "1") {
        sessao.estado = "BEBIDAS";
        return { respostas: [textoBebidas(tenantDir) + "\n\n👉 Digite o número da bebida ou *0* para concluir."] };
      }
      if (msg === "2") {
        sessao.estado = "FIN_NOME";
        return { respostas: [MSG_PEDIR_NOME] };
      }
      return { respostas: ["Por favor, digite *1* para sim ou *2* para não."] };

    case "BEBIDAS": {
      if (msg === "0") {
        sessao.estado = "FIN_NOME";
        return { respostas: [MSG_PEDIR_NOME] };
      }
      const id = parseInt(msg, 10);
      const bebida = bebidasDisponiveis(tenantDir).find((b) => b.id === id);
      if (!bebida)
        return { respostas: ["Bebida inválida ❌. Digite o número de uma bebida da lista ou *0* para concluir."] };
      sessao.itemPendente = { id: bebida.id, nome: bebida.nome, preco: bebida.preco };
      sessao.estado = "BEBIDA_QTD";
      return { respostas: [`Quantas unidades de *${bebida.nome}*? Digite um número.`] };
    }

    case "BEBIDA_QTD": {
      const qtd = parseInt(msg, 10);
      if (isNaN(qtd) || qtd < 1 || qtd > 50)
        return { respostas: ["Quantidade inválida. Digite um número entre *1* e *50*."] };
      const ip = sessao.itemPendente;
      const existente = sessao.carrinho.find(
        (c) => c.id === ip.id && (!c.opcionais || c.opcionais.length === 0) && !c.observacao
      );
      if (existente) existente.qtd += qtd;
      else sessao.carrinho.push({ id: ip.id, nome: ip.nome, preco: ip.preco, qtd, opcionais: [], observacao: "" });
      sessao.itemPendente = null;
      sessao.estado = "BEBIDAS";
      return {
        respostas: [`✅ Adicionado: *${qtd}x ${ip.nome}*.\n\n` + textoBebidas(tenantDir) + "\n\n👉 Mais alguma bebida? Digite o número ou *0* para concluir."],
      };
    }

    case "FIN_NOME":
      if (msg.length < 2) return { respostas: ["Por favor, informe seu nome completo (pelo menos 2 letras)."] };
      sessao.pedido.nome = msg;
      sessao.estado = "FIN_ENTREGA";
      return { respostas: [`Prazer, *${msg}*! 😊 Como prefere receber seu pedido?\n\n*1* — 🛵 Entrega no endereço\n*2* — 🏃 Retirada no balcão`] };

    case "FIN_ENTREGA":
      if (msg === "1") {
        sessao.pedido.tipoEntrega = "Entrega";
        sessao.estado = "FIN_ENDERECO";
        const taxa = config.atendimento.taxaEntrega || 0;
        const infoTaxa = taxa > 0
          ? `\n\n🛵 Taxa de entrega: *${formatarMoeda(taxa)}*`
          : "\n\n🛵 Entrega *gratuita*!";
        return { respostas: ["Digite o *endereço completo* para entrega (rua, número, bairro e referência)." + infoTaxa] };
      }
      if (msg === "2") {
        sessao.pedido.tipoEntrega = "Retirada";
        sessao.pedido.endereco = "—";
        sessao.estado = "FIN_PAGAMENTO";
        const endRestaurante = config.restaurante.endereco ? `\n\n📍 Estamos em: *${config.restaurante.endereco}*` : "";
        return { respostas: ["Ótimo, retirada no balcão! 🏃" + endRestaurante + "\n\n" + formaPagamento(tenantDir)] };
      }
      return { respostas: ["Por favor, escolha *1* para entrega ou *2* para retirada no balcão."] };

    case "FIN_ENDERECO":
      if (msg.length < 5) return { respostas: ["Endereço muito curto. Por favor, informe rua, número e bairro."] };
      sessao.pedido.endereco = msg;
      sessao.estado = "FIN_PAGAMENTO";
      return { respostas: ["Endereço anotado! 📝\n\n" + formaPagamento(tenantDir)] };

    case "FIN_PAGAMENTO": {
      const idx = parseInt(msg, 10) - 1;
      const forma = config.pagamentos[idx];
      if (!forma) return { respostas: ["Opção inválida. " + formaPagamento(tenantDir)] };
      sessao.pedido.pagamento = forma;
      sessao.estado = "CONFIRMACAO";
      return { respostas: [textoConfirmacao(sessao, tenantDir)] };
    }

    case "CONFIRMACAO":
      if (msg === "1") {
        const taxa = sessao.pedido.tipoEntrega === "Entrega" ? (config.atendimento.taxaEntrega || 0) : 0;
        const total = totalCarrinho(sessao.carrinho) + taxa;
        const registro = pedidos.salvarPedido(tenantDir, {
          cliente: sessao.pedido.nome,
          telefone: sessao.telefone || "", // telefone real (senderPn) capturado na sessão; vazio no simulador
          chatId: sessao.chatId || "",     // canal da conversa (LID/phone JID) para o "avisar"
          tipoEntrega: sessao.pedido.tipoEntrega,
          endereco: sessao.pedido.endereco,
          pagamento: sessao.pedido.pagamento,
          taxaEntrega: taxa,
          itens: sessao.carrinho,
          total,
        });
        resetSessao(chatId);
        const txt = aplicar(config.mensagens.pedidoConfirmado, {
          numero: registro.numero,
          tempo: config.atendimento.tempoEstimado,
        });
        return { respostas: [txt], pedidoNovo: registro };
      }
      if (msg === "2") {
        sessao.carrinho = [];
        sessao.pedido = {};
        sessao.bebidaPerguntada = false;
        sessao.estado = "MENU";
        return { respostas: ["Pedido cancelado. 🗑️\n\nSempre que quiser fazer um novo, é só chamar!\n\n" + menuPrincipal(tenantDir)] };
      }
      return { respostas: ["Por favor, confirme:\n*1* para finalizar o pedido ou *2* para cancelar.\n\n" + textoConfirmacao(sessao, tenantDir)] };

    case "ATENDENTE":
      return { respostas: [] };

    default:
      sessao.estado = "MENU";
      return { respostas: [menuPrincipal(tenantDir)] };
  }
}

module.exports = { processarMensagem };
